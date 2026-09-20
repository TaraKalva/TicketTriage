import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db/index.js';
import { triageTicket, getConfidenceThreshold, CATEGORIES, SEVERITIES, TEAMS } from '../services/aiTriage.js';

const router = Router();

const insertTicketStmt = db.prepare(`
  INSERT INTO tickets (
    id, title, description, category, severity, team, confidence,
    aiCategory, aiSeverity, aiTeam, aiConfidence, aiReasoning,
    needsReview, status, submittedAt
  ) VALUES (
    @id, @title, @description, @category, @severity, @team, @confidence,
    @aiCategory, @aiSeverity, @aiTeam, @aiConfidence, @aiReasoning,
    @needsReview, @status, @submittedAt
  )
`);

router.get('/meta', (req, res) => {
  res.json({ categories: CATEGORIES, severities: SEVERITIES, teams: TEAMS, confidenceThreshold: getConfidenceThreshold() });
});

router.get('/', (req, res) => {
  const { status, needsReview, category, team, search } = req.query;
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
  if (search) {
    clauses.push('description LIKE @search');
    params.search = `%${search}%`;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * pageSize;

  const total = db.prepare(`SELECT COUNT(*) as count FROM tickets ${where}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM tickets ${where} ORDER BY submittedAt DESC LIMIT @pageSize OFFSET @offset`)
    .all({ ...params, pageSize, offset });

  res.json({ items: rows.map(serializeTicket), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Ticket not found' });
  res.json(serializeTicket(row));
});

router.post('/', async (req, res) => {
  const { title, description } = req.body ?? {};
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }

  try {
    const ai = await triageTicket(description.trim());
    const threshold = getConfidenceThreshold();
    const needsReview = ai.confidence < threshold;

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
      submittedAt: new Date().toISOString(),
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

  db.prepare(
    `UPDATE tickets SET category = ?, severity = ?, team = ?, confidence = 1, needsReview = 0, reviewedAt = ? WHERE id = ?`
  ).run(category, severity, team, new Date().toISOString(), req.params.id);

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

  db.prepare(`UPDATE tickets SET status = 'resolved', resolvedAt = ?, resolutionMinutes = ? WHERE id = ?`).run(
    resolvedAt.toISOString(),
    resolutionMinutes,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  res.json(serializeTicket(updated));
});

router.patch('/:id/reopen', (req, res) => {
  const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });

  db.prepare(`UPDATE tickets SET status = 'open', resolvedAt = NULL, resolutionMinutes = NULL WHERE id = ?`).run(req.params.id);
  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  res.json(serializeTicket(updated));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Ticket not found' });
  res.status(204).end();
});

function serializeTicket(row) {
  return { ...row, needsReview: !!row.needsReview };
}

export default router;
