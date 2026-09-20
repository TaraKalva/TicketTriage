import db from '../db/index.js';
import { predictNextTicket, DEFAULT_TEAM_BY_CATEGORY } from './aiTriage.js';
import { getLatestRiskScores } from './riskAnalysis.js';

const insertPredictionStmt = db.prepare(`
  INSERT INTO predictions (category, severity, team, confidence, predictedDescription, rationale, source, computedAt)
  VALUES (@category, @severity, @team, @confidence, @predictedDescription, @rationale, @source, @computedAt)
`);

const recentExamplesStmt = db.prepare(`
  SELECT description, team, severity FROM tickets
  WHERE category = ?
  ORDER BY submittedAt DESC
  LIMIT 5
`);

const mostCommonCategoryStmt = db.prepare(`
  SELECT category, COUNT(*) as count
  FROM tickets
  WHERE submittedAt >= datetime('now', '-30 days')
  GROUP BY category
  ORDER BY count DESC
  LIMIT 1
`);

const mostCommonSeverityStmt = db.prepare(`
  SELECT severity, COUNT(*) as count FROM tickets WHERE category = ? GROUP BY severity ORDER BY count DESC LIMIT 1
`);

const mostCommonTeamStmt = db.prepare(`
  SELECT team, COUNT(*) as count FROM tickets WHERE category = ? GROUP BY team ORDER BY count DESC LIMIT 1
`);

function pickTargetCategory() {
  const { scores } = getLatestRiskScores();
  const rising = scores.filter((s) => s.rising).sort((a, b) => b.recentCount / (b.priorCount || 1) - a.recentCount / (a.priorCount || 1));
  if (rising.length > 0) return { category: rising[0].category, riskScore: rising[0] };

  const mostCommon = mostCommonCategoryStmt.get();
  if (mostCommon) return { category: mostCommon.category, riskScore: null };

  return { category: null, riskScore: null };
}

function buildTrendSummary(riskScore, targetCategory) {
  const { scores } = getLatestRiskScores();
  if (scores.length === 0) {
    return `No risk-scan data yet. Using overall most common category: ${targetCategory}.`;
  }
  const lines = scores
    .slice()
    .sort((a, b) => b.recentCount - a.recentCount)
    .map((s) => `- ${s.category}: ${s.priorCount} -> ${s.recentCount} tickets${s.rising ? ' (RISING)' : ''}`);
  const header = riskScore
    ? `Highest-signal category: ${targetCategory} (volume ${riskScore.priorCount} -> ${riskScore.recentCount}, flagged rising).`
    : `No category is currently flagged as rising; using the most common category overall: ${targetCategory}.`;
  return [header, ...lines].join('\n');
}

export async function generateNextTicketPrediction() {
  const { category: targetCategory, riskScore } = pickTargetCategory();

  if (!targetCategory) {
    const computedAt = new Date().toISOString();
    const row = {
      category: 'Other',
      severity: 'Medium',
      team: DEFAULT_TEAM_BY_CATEGORY.Other,
      confidence: 0,
      predictedDescription: 'Not enough ticket history yet to make a prediction.',
      rationale: 'No tickets in the system.',
      source: 'none',
      computedAt,
    };
    insertPredictionStmt.run(row);
    return row;
  }

  const examples = recentExamplesStmt.all(targetCategory);
  // Category types that aren't tied to a specific product area (feature ideas, questions,
  // catch-all) get their team from the fixed mapping instead of "most common historically" —
  // that stat is close to noise for these since they can land anywhere.
  const TEAM_AGNOSTIC_CATEGORIES = new Set(['Feature Request', 'How-To Question', 'Other']);
  const targetTeam = TEAM_AGNOSTIC_CATEGORIES.has(targetCategory)
    ? DEFAULT_TEAM_BY_CATEGORY[targetCategory]
    : mostCommonTeamStmt.get(targetCategory)?.team ?? DEFAULT_TEAM_BY_CATEGORY[targetCategory];
  const targetSeverity = mostCommonSeverityStmt.get(targetCategory)?.severity ?? 'Medium';
  const trendSummary = buildTrendSummary(riskScore, targetCategory);

  const prediction = await predictNextTicket({
    targetCategory,
    targetTeam,
    targetSeverity,
    trendSummary,
    examples: examples.map((e) => e.description),
  });

  const computedAt = new Date().toISOString();
  const row = { ...prediction, computedAt };
  insertPredictionStmt.run(row);
  return row;
}

export function getLatestPrediction() {
  return db.prepare('SELECT * FROM predictions ORDER BY computedAt DESC LIMIT 1').get() ?? null;
}
