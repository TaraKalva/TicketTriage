import db from '../db/index.js';
import { CATEGORIES } from './aiTriage.js';

const PERIOD_DAYS = Number(process.env.RISK_PERIOD_DAYS) || 7;
const MIN_RECENT_VOLUME = 3;
const RISE_MULTIPLIER = 1.25;

const countByCategoryStmt = db.prepare(`
  SELECT category, COUNT(*) as count
  FROM tickets
  WHERE category = ? AND submittedAt >= ? AND submittedAt < ?
`);

const insertRiskScoreStmt = db.prepare(`
  INSERT INTO risk_scores (category, recentCount, priorCount, rising, recommendation, computedAt)
  VALUES (@category, @recentCount, @priorCount, @rising, @recommendation, @computedAt)
`);

function buildRecommendation(category, recentCount, priorCount, rising) {
  if (!rising) return null;
  if (priorCount === 0) {
    return `Proactive review of ${category} recommended — ${recentCount} ticket(s) in the last ${PERIOD_DAYS} days with none in the prior period.`;
  }
  const pctChange = Math.round(((recentCount - priorCount) / priorCount) * 100);
  return `Proactive review of ${category} recommended — volume is up ${pctChange}% vs. the prior ${PERIOD_DAYS}-day period (${priorCount} → ${recentCount}).`;
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

      const row = {
        category,
        recentCount,
        priorCount,
        rising: rising ? 1 : 0,
        recommendation,
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
  return { computedAt: latest.computedAt, scores: scores.map((s) => ({ ...s, rising: !!s.rising })) };
}
