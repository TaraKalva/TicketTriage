import { Router } from 'express';
import db from '../db/index.js';
import { CATEGORIES } from '../services/aiTriage.js';
import { getLatestRiskScores } from '../services/riskAnalysis.js';
import { getLatestPrediction, generateNextTicketPrediction } from '../services/predictionService.js';
import { runAnalysisNow, runFullAnalysisNow } from '../jobs/scheduledAnalysis.js';

const router = Router();

router.get('/summary', (req, res) => {
  const totals = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN needsReview = 1 THEN 1 ELSE 0 END) as needsReview
      FROM tickets`
    )
    .get();

  const severityBreakdown = db
    .prepare(`SELECT severity, COUNT(*) as count FROM tickets GROUP BY severity`)
    .all();

  const volumeByDay = db
    .prepare(
      `SELECT substr(submittedAt, 1, 10) as day, COUNT(*) as count
       FROM tickets
       WHERE submittedAt >= datetime('now', '-13 days')
       GROUP BY day
       ORDER BY day ASC`
    )
    .all();

  const categoryPerformanceRows = db
    .prepare(
      `SELECT
        category,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        AVG(CASE WHEN status = 'resolved' THEN resolutionMinutes ELSE NULL END) as avgResolutionMinutes
      FROM tickets
      GROUP BY category`
    )
    .all();

  const categoryPerformance = CATEGORIES.map((category) => {
    const row = categoryPerformanceRows.find((r) => r.category === category);
    return {
      category,
      total: row?.total ?? 0,
      open: row?.open ?? 0,
      resolved: row?.resolved ?? 0,
      avgResolutionMinutes: row?.avgResolutionMinutes != null ? Math.round(row.avgResolutionMinutes) : null,
    };
  }).filter((c) => c.total > 0);

  const mostCommonCategory = [...categoryPerformance].sort((a, b) => b.total - a.total)[0] ?? null;
  const slowestCategory = [...categoryPerformance]
    .filter((c) => c.avgResolutionMinutes != null)
    .sort((a, b) => b.avgResolutionMinutes - a.avgResolutionMinutes)[0] ?? null;

  const { computedAt, scores } = getLatestRiskScores();
  const prediction = getLatestPrediction();

  res.json({
    totals: {
      total: totals.total ?? 0,
      resolved: totals.resolved ?? 0,
      open: totals.open ?? 0,
      needsReview: totals.needsReview ?? 0,
    },
    severityBreakdown,
    volumeByDay,
    categoryPerformance,
    insights: { mostCommonCategory, slowestCategory },
    riskScores: { computedAt, scores },
    prediction,
  });
});

router.get('/risk-scores', (req, res) => {
  res.json(getLatestRiskScores());
});

router.post('/risk-scores/recompute', (req, res) => {
  const result = runAnalysisNow();
  res.json(result);
});

router.get('/predict-next-ticket', (req, res) => {
  res.json(getLatestPrediction());
});

router.post('/predict-next-ticket/recompute', async (req, res) => {
  try {
    const prediction = await generateNextTicketPrediction();
    res.json(prediction);
  } catch (err) {
    console.error('[dashboard] prediction recompute failed:', err);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

router.post('/recompute', async (req, res) => {
  try {
    const result = await runFullAnalysisNow();
    res.json(result);
  } catch (err) {
    console.error('[dashboard] full recompute failed:', err);
    res.status(500).json({ error: 'Failed to recompute' });
  }
});

export default router;
