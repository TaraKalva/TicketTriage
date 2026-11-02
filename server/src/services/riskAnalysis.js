import db from '../db/index.js';
import { CATEGORIES, DEFAULT_TEAM_BY_CATEGORY } from './aiTriage.js';

const PERIOD_DAYS = Number(process.env.RISK_PERIOD_DAYS) || 7;
const MIN_RECENT_VOLUME = 3;
const RISE_MULTIPLIER = 1.25;

const countByCategoryStmt = db.prepare(`
  SELECT category, COUNT(*) as count
  FROM tickets
  WHERE category = ? AND submittedAt >= ? AND submittedAt < ?
`);

const insertRiskScoreStmt = db.prepare(`
  INSERT INTO risk_scores (
    category, recentCount, priorCount, rising, recommendation,
    calculationDetails, suggestedActions, computedAt
  ) VALUES (
    @category, @recentCount, @priorCount, @rising, @recommendation,
    @calculationDetails, @suggestedActions, @computedAt
  )
`);

function buildRecommendation(category, recentCount, priorCount, rising) {
  if (!rising) return null;
  if (priorCount === 0) {
    return `Proactive review of ${category} recommended — ${recentCount} ticket(s) in the last ${PERIOD_DAYS} days with none in the prior period.`;
  }
  const pctChange = Math.round(((recentCount - priorCount) / priorCount) * 100);
  return `Proactive review of ${category} recommended — volume is up ${pctChange}% vs. the prior ${PERIOD_DAYS}-day period (${priorCount} → ${recentCount}).`;
}

function buildCalculationDetails(recentCount, priorCount, rising) {
  if (!rising) {
    return `Standard volume baseline: ${recentCount} ticket(s) in last ${PERIOD_DAYS}d vs ${priorCount} in prior ${PERIOD_DAYS}d. No anomalous spike detected.`;
  }
  const pctChange = priorCount > 0 ? Math.round(((recentCount - priorCount) / priorCount) * 100) : 100;
  return `Volume surge calculation: ${recentCount} tickets in past ${PERIOD_DAYS} days vs ${priorCount} in prior period (+${pctChange}% change). Exceeds the +${Math.round((RISE_MULTIPLIER - 1) * 100)}% surge threshold with ≥${MIN_RECENT_VOLUME} tickets.`;
}

function buildSuggestedActions(category) {
  const team = DEFAULT_TEAM_BY_CATEGORY[category] || 'Support Team';
  switch (category) {
    case 'Account Access':
      return [
        `Audit identity & authentication service logs for elevated 401/403 error rates.`,
        `Check SSO provider and token validation endpoints for connectivity degradation.`,
        `Notify ${team} to inspect potential credential stuffing or expired certs.`,
      ].join('\n');
    case 'Bug':
      return [
        `Inspect error logs from recent software releases or deployments.`,
        `Identify common client versions, devices, or operating systems reported in tickets.`,
        `Brief ${team} lead on incoming error patterns for priority triage.`,
      ].join('\n');
    case 'Performance':
      return [
        `Review database slow query logs and API endpoint P95/P99 latency trends.`,
        `Check server CPU, memory, and connection pool saturation.`,
        `Coordinate with ${team} to evaluate scaling or caching adjustments.`,
      ].join('\n');
    case 'Billing Problem':
      return [
        `Inspect payment gateway webhooks for batch declined or duplicate transactions.`,
        `Audit recent automated recurring billing runs and invoice generations.`,
        `Alert ${team} to prioritize pending billing disputes.`,
      ].join('\n');
    case 'Security Concern':
      return [
        `Immediately escalate to Security Operations and ${team}.`,
        `Analyze source IP addresses and affected user accounts for suspicious activity.`,
        `Consider enforcing temporary MFA re-authentication if credentials were exposed.`,
      ].join('\n');
    default:
      return [
        `Review recent incident tickets to identify emerging root causes.`,
        `Engage ${team} for cross-functional investigation.`,
        `Monitor ticket velocity over the next 24-48 hours.`,
      ].join('\n');
  }
}

export function computeRiskScores(now = new Date()) {
  const nowMs = now.getTime();
  const recentStart = new Date(nowMs - PERIOD_DAYS * 86400000).toISOString();
  const priorStart = new Date(nowMs - 2 * PERIOD_DAYS * 86400000).toISOString();
  const nowIso = now.toISOString();

  const computedAt = nowIso;
  const results = [];

  const transaction = db.transaction(() => {
    for (const category of CATEGORIES) {
      const recentRow = countByCategoryStmt.get(category, recentStart, nowIso);
      const priorRow = countByCategoryStmt.get(category, priorStart, recentStart);
      const recentCount = recentRow?.count ?? 0;
      const priorCount = priorRow?.count ?? 0;

      if (recentCount === 0 && priorCount === 0) continue;

      const rising =
        recentCount >= MIN_RECENT_VOLUME &&
        (priorCount === 0 || recentCount >= priorCount * RISE_MULTIPLIER);

      const recommendation = buildRecommendation(category, recentCount, priorCount, rising);
      const calculationDetails = buildCalculationDetails(recentCount, priorCount, rising);
      const suggestedActions = rising ? buildSuggestedActions(category) : null;

      const row = {
        category,
        recentCount,
        priorCount,
        rising: rising ? 1 : 0,
        recommendation,
        calculationDetails,
        suggestedActions,
        computedAt,
      };
      insertRiskScoreStmt.run(row);
      results.push(row);
    }
  });

  transaction();
  return { computedAt, results };
}

export function getLatestRiskScores() {
  const latest = db.prepare('SELECT MAX(computedAt) as computedAt FROM risk_scores').get();
  if (!latest?.computedAt) return { computedAt: null, scores: [] };
  const scores = db
    .prepare('SELECT * FROM risk_scores WHERE computedAt = ? ORDER BY rising DESC, recentCount DESC')
    .all(latest.computedAt);
  return {
    computedAt: latest.computedAt,
    scores: scores.map((s) => ({
      ...s,
      rising: !!s.rising,
      suggestedActionsList: s.suggestedActions ? s.suggestedActions.split('\n') : [],
    })),
  };
}

export function getRiskScoresForWindow(days = 7, team = null) {
  const periodDays = Math.max(1, Number(days) || 7);
  const now = new Date();
  const nowMs = now.getTime();
  const recentStart = new Date(nowMs - periodDays * 86400000).toISOString();
  const priorStart = new Date(nowMs - 2 * periodDays * 86400000).toISOString();
  const nowIso = now.toISOString();

  const teamClause = team && team !== 'all' && team !== 'All' ? 'AND team = ?' : '';
  const teamParams = team && team !== 'all' && team !== 'All' ? [team] : [];

  const scores = [];
  for (const category of CATEGORIES) {
    const recentRow = db
      .prepare(`SELECT COUNT(*) as count FROM tickets WHERE category = ? AND submittedAt >= ? AND submittedAt < ? ${teamClause}`)
      .get(category, recentStart, nowIso, ...teamParams);
    const priorRow = db
      .prepare(`SELECT COUNT(*) as count FROM tickets WHERE category = ? AND submittedAt >= ? AND submittedAt < ? ${teamClause}`)
      .get(category, priorStart, recentStart, ...teamParams);

    const recentCount = recentRow?.count ?? 0;
    const priorCount = priorRow?.count ?? 0;
    if (recentCount === 0 && priorCount === 0) continue;

    const rising =
      recentCount >= MIN_RECENT_VOLUME &&
      (priorCount === 0 || recentCount >= priorCount * RISE_MULTIPLIER);

    const pctChange = priorCount > 0 ? Math.round(((recentCount - priorCount) / priorCount) * 100) : 100;
    const recommendation = rising
      ? priorCount === 0
        ? `Proactive review of ${category} recommended — ${recentCount} ticket(s) in the last ${periodDays} days with none in the prior period.`
        : `Proactive review of ${category} recommended — volume is up ${pctChange}% vs. the prior ${periodDays}-day period (${priorCount} → ${recentCount}).`
      : null;

    const calculationDetails = rising
      ? `Volume surge calculation: ${recentCount} tickets in past ${periodDays} days vs ${priorCount} in prior period (+${pctChange}% change). Exceeds the +${Math.round((RISE_MULTIPLIER - 1) * 100)}% surge threshold with ≥${MIN_RECENT_VOLUME} tickets.`
      : `Standard volume baseline: ${recentCount} ticket(s) in last ${periodDays}d vs ${priorCount} in prior ${periodDays}d. No anomalous spike detected.`;

    const suggestedActions = rising ? buildSuggestedActions(category) : null;

    scores.push({
      category,
      recentCount,
      priorCount,
      rising,
      recommendation,
      calculationDetails,
      suggestedActions,
      suggestedActionsList: suggestedActions ? suggestedActions.split('\n') : [],
      periodDays,
      computedAt: nowIso,
    });
  }

  scores.sort((a, b) => (b.rising ? 1 : 0) - (a.rising ? 1 : 0) || b.recentCount - a.recentCount);
  return { computedAt: nowIso, scores, periodDays };
}

export function getSupportingTicketsForRisk(category, days = 7, team = null) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const clauses = ['category = ?', 'submittedAt >= ?'];
  const params = [category, since];
  if (team && team !== 'all' && team !== 'All') {
    clauses.push('team = ?');
    params.push(team);
  }

  return db
    .prepare(
      `SELECT id, title, description, category, severity, team, confidence, status, submittedAt,
              affectedSystem, environment, errorDetails, reproductionSteps, aiReasoning, needsReview
       FROM tickets
       WHERE ${clauses.join(' AND ')}
       ORDER BY submittedAt DESC
       LIMIT 50`
    )
    .all(...params);
}

