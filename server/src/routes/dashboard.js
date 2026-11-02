import { Router } from 'express';
import db from '../db/index.js';
import { CATEGORIES } from '../services/aiTriage.js';
import {
  getLatestRiskScores,
  getSupportingTicketsForRisk,
  getRiskScoresForWindow,
} from '../services/riskAnalysis.js';
import { getLatestPrediction, generateNextTicketPrediction } from '../services/predictionService.js';
import { runAnalysisNow, runFullAnalysisNow } from '../jobs/scheduledAnalysis.js';

const router = Router();

router.get('/summary', (req, res) => {
  const { days: daysParam, team } = req.query;
  const numDays = daysParam === 'all' ? null : Math.min(365, Math.max(1, Number(daysParam) || 14));
  const hasTeamFilter = team && team !== 'all' && team !== 'All';

  const clauses = [];
  const params = {};

  if (numDays !== null) {
    clauses.push(`submittedAt >= datetime('now', '-' || @days || ' days')`);
    params.days = String(numDays);
  }
  if (hasTeamFilter) {
    clauses.push(`team = @team`);
    params.team = team;
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const totals = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        AVG(CASE WHEN status = 'resolved' THEN resolutionMinutes ELSE NULL END) as avgResolutionMinutes
      FROM tickets
      ${whereSql}`
    )
    .get(params);

  // Active Review Queue Backlog is an ongoing operational queue and should not be hidden by historical date windows
  const reviewBacklogRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM tickets WHERE needsReview = 1 AND status = 'open' ${
        hasTeamFilter ? 'AND team = @team' : ''
      }`
    )
    .get(hasTeamFilter ? { team } : {});
  const activeNeedsReview = reviewBacklogRow?.count ?? 0;

  const severityBreakdown = db
    .prepare(`SELECT severity, COUNT(*) as count FROM tickets ${whereSql} GROUP BY severity`)
    .all(params);

  // Volume Trend for selected day range
  const chartDays = numDays || 30;
  const rawVolumeByDay = db
    .prepare(
      `SELECT substr(submittedAt, 1, 10) as day, COUNT(*) as count
       FROM tickets
       ${whereSql ? whereSql + ' AND' : 'WHERE'} submittedAt >= datetime('now', '-' || @chartDays || ' days')
       GROUP BY day
       ORDER BY day ASC`
    )
    .all({ ...params, chartDays: String(chartDays) });

  const countByDayMap = new Map(rawVolumeByDay.map((r) => [r.day, r.count]));
  const volumeByDay = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dayStr = d.toISOString().slice(0, 10);
    volumeByDay.push({ day: dayStr, count: countByDayMap.get(dayStr) || 0 });
  }

  // Category Performance with explicit distinction between Volume and Resolution Speed (E26)
  const categoryPerformanceRows = db
    .prepare(
      `SELECT
        category,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        AVG(CASE WHEN status = 'resolved' THEN resolutionMinutes ELSE NULL END) as avgResolutionMinutes,
        MIN(CASE WHEN status = 'resolved' THEN resolutionMinutes ELSE NULL END) as minResolutionMinutes,
        MAX(CASE WHEN status = 'resolved' THEN resolutionMinutes ELSE NULL END) as maxResolutionMinutes
      FROM tickets
      ${whereSql}
      GROUP BY category`
    )
    .all(params);

  const totalFilteredTickets = totals.total || 1;

  const categoryPerformance = CATEGORIES.map((category) => {
    const row = categoryPerformanceRows.find((r) => r.category === category);
    const catTotal = row?.total ?? 0;
    return {
      category,
      total: catTotal,
      open: row?.open ?? 0,
      resolved: row?.resolved ?? 0,
      volumeSharePct: Math.round((catTotal / totalFilteredTickets) * 100),
      avgResolutionMinutes: row?.avgResolutionMinutes != null ? Math.round(row.avgResolutionMinutes) : null,
      minResolutionMinutes: row?.minResolutionMinutes != null ? Math.round(row.minResolutionMinutes) : null,
      maxResolutionMinutes: row?.maxResolutionMinutes != null ? Math.round(row.maxResolutionMinutes) : null,
    };
  }).filter((c) => c.total > 0);

  // Key Operational Insights - clearly distinguishing volume load vs resolution delays
  const mostCommonCategory = [...categoryPerformance].sort((a, b) => b.total - a.total)[0] ?? null;
  const slowestCategory = [...categoryPerformance]
    .filter((c) => c.avgResolutionMinutes != null && c.resolved >= 2)
    .sort((a, b) => b.avgResolutionMinutes - a.avgResolutionMinutes)[0] ?? null;
  const fastestCategory = [...categoryPerformance]
    .filter((c) => c.avgResolutionMinutes != null && c.resolved >= 2)
    .sort((a, b) => a.avgResolutionMinutes - b.avgResolutionMinutes)[0] ?? null;

  const riskDays = numDays || 30;
  const { computedAt, scores } = getRiskScoresForWindow(riskDays, hasTeamFilter ? team : null);
  const prediction = getLatestPrediction();

  res.json({
    filters: {
      days: numDays ?? 'all',
      team: hasTeamFilter ? team : 'all',
    },
    totals: {
      total: totals.total ?? 0,
      resolved: totals.resolved ?? 0,
      open: totals.open ?? 0,
      needsReview: activeNeedsReview,
      avgResolutionMinutes: totals.avgResolutionMinutes != null ? Math.round(totals.avgResolutionMinutes) : null,
    },
    severityBreakdown,
    volumeByDay,
    categoryPerformance,
    insights: {
      mostCommonCategory,
      slowestCategory,
      fastestCategory,
    },
    riskScores: { computedAt, scores },
    prediction,
  });
});

// Endpoint to fetch concrete supporting tickets for a risk flag or insight (E22)
router.get('/supporting-tickets', (req, res) => {
  const { category, days, team } = req.query;
  if (!category) return res.status(400).json({ error: 'category query parameter is required' });
  const numDays = Math.min(90, Math.max(1, Number(days) || 14));
  const tickets = getSupportingTicketsForRisk(category, numDays, team);
  res.json({ category, days: numDays, team: team || 'all', total: tickets.length, tickets });
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

