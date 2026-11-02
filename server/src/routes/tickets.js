import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db/index.js';
import {
  triageTicket,
  getConfidenceThreshold,
  CATEGORIES,
  SEVERITIES,
  TEAMS,
  ENVIRONMENTS,
  SYSTEM_OPTIONS,
  DEFAULT_TEAM_BY_CATEGORY,
} from '../services/aiTriage.js';

const router = Router();

const insertTicketStmt = db.prepare(`
  INSERT INTO tickets (
    id, title, description, category, severity, team, confidence,
    aiCategory, aiSeverity, aiTeam, aiConfidence, aiReasoning,
    needsReview, status, submittedAt,
    affectedSystem, environment, errorDetails, reproductionSteps,
    reviewReason, originalCategory, originalSeverity, originalTeam,
    originalConfidence, auditTrail
  ) VALUES (
    @id, @title, @description, @category, @severity, @team, @confidence,
    @aiCategory, @aiSeverity, @aiTeam, @aiConfidence, @aiReasoning,
    @needsReview, @status, @submittedAt,
    @affectedSystem, @environment, @errorDetails, @reproductionSteps,
    @reviewReason, @originalCategory, @originalSeverity, @originalTeam,
    @originalConfidence, @auditTrail
  )
`);

router.get('/meta', (req, res) => {
  res.json({
    categories: CATEGORIES,
    severities: SEVERITIES,
    teams: TEAMS,
    environments: ENVIRONMENTS,
    systems: SYSTEM_OPTIONS,
    defaultTeamByCategory: DEFAULT_TEAM_BY_CATEGORY,
    confidenceThreshold: getConfidenceThreshold(),
  });
});

router.get('/', (req, res) => {
  const { status, needsReview, category, team, severity, search, sortBy, sortOrder } = req.query;
  const clauses = [];
  const params = {};
  if (status) {
    clauses.push('status = @status');
    params.status = status;
  }
  if (needsReview !== undefined) {
    clauses.push('needsReview = @needsReview');
    params.needsReview = needsReview === 'true' || needsReview === '1' ? 1 : 0;
  }
  if (category) {
    clauses.push('category = @category');
    params.category = category;
  }
  if (team) {
    clauses.push('team = @team');
    params.team = team;
  }
  if (severity) {
    clauses.push('severity = @severity');
    params.severity = severity;
  }
  if (search) {
    clauses.push('(description LIKE @search OR id LIKE @search OR title LIKE @search OR errorDetails LIKE @search OR affectedSystem LIKE @search)');
    params.search = `%${search}%`;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const ALLOWED_SORT_COLUMNS = new Set(['submittedAt', 'confidence', 'resolutionMinutes', 'severity']);
  const sortCol = ALLOWED_SORT_COLUMNS.has(sortBy) ? sortBy : 'submittedAt';
  const sortDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * pageSize;

  const total = db.prepare(`SELECT COUNT(*) as count FROM tickets ${where}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM tickets ${where} ORDER BY ${sortCol} ${sortDir} LIMIT @pageSize OFFSET @offset`)
    .all({ ...params, pageSize, offset });

  res.json({ items: rows.map(serializeTicket), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Ticket not found' });
  res.json(serializeTicket(row));
});

router.post('/', async (req, res) => {
  const { title, description, affectedSystem, environment, errorDetails, reproductionSteps } = req.body ?? {};
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }

  try {
    const ai = await triageTicket({
      description: description.trim(),
      affectedSystem: affectedSystem?.trim() || '',
      environment: environment?.trim() || '',
      errorDetails: errorDetails?.trim() || '',
      reproductionSteps: reproductionSteps?.trim() || '',
    });

    const threshold = getConfidenceThreshold();
    const needsReview = ai.confidence < threshold;
    const submittedAt = new Date().toISOString();

    const auditTrail = JSON.stringify([
      {
        timestamp: submittedAt,
        action: 'ticket_created',
        actor: 'User Submission',
        details: 'Ticket submitted with technical context.',
      },
      {
        timestamp: submittedAt,
        action: needsReview ? 'held_for_review' : 'auto_dispatched',
        actor: ai.source || 'AI Triage Engine',
        details: needsReview
          ? `Confidence ${Math.round(ai.confidence * 100)}% is below ${Math.round(threshold * 100)}% threshold. Held for human verification.`
          : `Confidence ${Math.round(ai.confidence * 100)}% meets threshold. Auto-dispatched directly to ${ai.team}.`,
      },
    ]);

    const row = {
      id: crypto.randomUUID(),
      title: title?.trim() || null,
      description: description.trim(),
      category: ai.category,
      severity: ai.severity,
      team: ai.team,
      confidence: ai.confidence,
      aiCategory: ai.category,
      aiSeverity: ai.severity,
      aiTeam: ai.team,
      aiConfidence: ai.confidence,
      aiReasoning: ai.reasoning,
      needsReview: needsReview ? 1 : 0,
      status: 'open',
      submittedAt,
      affectedSystem: affectedSystem?.trim() || null,
      environment: environment?.trim() || null,
      errorDetails: errorDetails?.trim() || null,
      reproductionSteps: reproductionSteps?.trim() || null,
      reviewReason: ai.reviewReason || null,
      originalCategory: ai.category,
      originalSeverity: ai.severity,
      originalTeam: ai.team,
      originalConfidence: ai.confidence,
      auditTrail,
    };

    insertTicketStmt.run(row);
    res.status(201).json(serializeTicket(row));
  } catch (err) {
    console.error('[tickets] failed to create ticket:', err);
    res.status(500).json({ error: 'Failed to triage and create ticket' });
  }
});

router.patch('/:id/review', (req, res) => {
  const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });

  const category = CATEGORIES.includes(req.body?.category) ? req.body.category : existing.category;
  const severity = SEVERITIES.includes(req.body?.severity) ? req.body.severity : existing.severity;
  const team = TEAMS.includes(req.body?.team) ? req.body.team : existing.team;
  const reviewNotes = req.body?.reviewNotes?.trim() || 'Verified and confirmed by human reviewer.';

  let trail = [];
  try {
    trail = JSON.parse(existing.auditTrail || '[]');
  } catch {}

  trail.push({
    timestamp: new Date().toISOString(),
    action: 'human_review_confirmed',
    actor: 'Human Reviewer',
    changes: {
      category: { from: existing.category, to: category },
      severity: { from: existing.severity, to: severity },
      team: { from: existing.team, to: team },
    },
    notes: reviewNotes,
  });

  db.prepare(`
    UPDATE tickets
    SET category = ?, severity = ?, team = ?, confidence = 1,
        needsReview = 0, reviewedAt = ?, reviewReason = NULL,
        auditTrail = ?
    WHERE id = ?
  `).run(category, severity, team, new Date().toISOString(), JSON.stringify(trail), req.params.id);

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  res.json(serializeTicket(updated));
});

router.patch('/:id/resolve', (req, res) => {
  const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });
  if (existing.status === 'resolved') return res.status(400).json({ error: 'Ticket already resolved' });

  const resolvedAt = new Date();
  const submittedAt = new Date(existing.submittedAt);
  const resolutionMinutes = Math.max(0, Math.round((resolvedAt - submittedAt) / 60000));

  let trail = [];
  try {
    trail = JSON.parse(existing.auditTrail || '[]');
  } catch {}
  trail.push({
    timestamp: resolvedAt.toISOString(),
    action: 'resolved',
    actor: 'Support Agent',
    details: `Resolved after ${resolutionMinutes > 60 ? (resolutionMinutes / 60).toFixed(1) + ' hrs' : resolutionMinutes + ' mins'}.`,
  });

  db.prepare(`UPDATE tickets SET status = 'resolved', resolvedAt = ?, resolutionMinutes = ?, auditTrail = ? WHERE id = ?`).run(
    resolvedAt.toISOString(),
    resolutionMinutes,
    JSON.stringify(trail),
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  res.json(serializeTicket(updated));
});

router.patch('/:id/reopen', (req, res) => {
  const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });

  let trail = [];
  try {
    trail = JSON.parse(existing.auditTrail || '[]');
  } catch {}
  trail.push({
    timestamp: new Date().toISOString(),
    action: 'reopened',
    actor: 'Support Agent',
    details: 'Ticket reopened for further investigation.',
  });

  db.prepare(`UPDATE tickets SET status = 'open', resolvedAt = NULL, resolutionMinutes = NULL, auditTrail = ? WHERE id = ?`).run(
    JSON.stringify(trail),
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  res.json(serializeTicket(updated));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Ticket not found' });
  res.status(204).end();
});

function serializeTicket(row) {
  let auditTrail = [];
  if (row.auditTrail) {
    try {
      auditTrail = JSON.parse(row.auditTrail);
    } catch {
      auditTrail = [];
    }
  }
  return {
    ...row,
    needsReview: !!row.needsReview,
    auditTrail,
  };
}

export default router;

