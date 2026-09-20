import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import db from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV_PATH = path.join(__dirname, '..', '..', 'data', 'synthetic_it_support_tickets.csv');

const ISSUE_TYPE_TO_CATEGORY = {
  how_to: 'How-To Question',
  account_access: 'Account Access',
  performance: 'Performance',
  feature_request: 'Feature Request',
  other: 'Other',
  security_concern: 'Security Concern',
  billing_problem: 'Billing Problem',
  bug: 'Bug',
};

const PRIORITY_TO_SEVERITY = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Critical',
};

const PRODUCT_AREA_TO_TEAM = {
  mobile_app: 'Mobile App Team',
  login_auth: 'Identity & Access Team',
  api_integration: 'Platform/API Team',
  billing: 'Billing Team',
  data_export: 'Data Team',
  analytics_dashboard: 'Analytics Team',
  notifications: 'Notifications Team',
};

const RESOLVED_STATUSES = new Set(['resolved', 'closed_no_action']);

function parseArgs(argv) {
  const args = { clear: false, limit: null, csvPath: DEFAULT_CSV_PATH };
  for (const arg of argv) {
    if (arg === '--clear') args.clear = true;
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length));
    else if (arg.startsWith('--csv=')) args.csvPath = arg.slice('--csv='.length);
  }
  return args;
}

function loadRows(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true });
}

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO tickets (
    id, title, description, category, severity, team, confidence,
    aiCategory, aiSeverity, aiTeam, aiConfidence, aiReasoning,
    needsReview, status, submittedAt, resolvedAt, resolutionMinutes
  ) VALUES (
    @id, @title, @description, @category, @severity, @team, @confidence,
    @aiCategory, @aiSeverity, @aiTeam, @aiConfidence, @aiReasoning,
    @needsReview, @status, @submittedAt, @resolvedAt, @resolutionMinutes
  )
`);

function run() {
  const { clear, limit, csvPath } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(csvPath)) {
    console.error(`Dataset CSV not found at ${csvPath}`);
    process.exit(1);
  }

  console.log(`Reading ${csvPath}...`);
  let rows = loadRows(csvPath);
  console.log(`Parsed ${rows.length} rows.`);
  if (limit && limit > 0 && limit < rows.length) {
    rows = rows.slice(0, limit);
  }

  if (clear) {
    db.prepare('DELETE FROM tickets').run();
    db.prepare('DELETE FROM risk_scores').run();
    db.prepare('DELETE FROM predictions').run();
    console.log('Cleared existing tickets, risk scores, and predictions.');
  }

  // Time-shift the whole dataset so its most recent ticket lands "now" — this keeps the
  // relative density/bursts of the real data intact, which makes the recent-vs-prior-period
  // risk trend detection and the "last 14 days" volume chart meaningful instead of empty.
  const originalDates = rows.map((r) => new Date(r.created_at).getTime()).filter((t) => Number.isFinite(t));
  const maxOriginal = Math.max(...originalDates);
  const shiftMs = Date.now() - maxOriginal;
  console.log(`Time-shifting dataset by ${(shiftMs / 86400000).toFixed(1)} days so it ends today.`);

  let skipped = 0;
  const insertAll = db.transaction((items) => {
    for (const r of items) {
      const category = ISSUE_TYPE_TO_CATEGORY[r.issue_type];
      const severity = PRIORITY_TO_SEVERITY[r.priority];
      const team = PRODUCT_AREA_TO_TEAM[r.product_area];
      const createdMs = new Date(r.created_at).getTime();
      if (!category || !severity || !team || !Number.isFinite(createdMs) || !r.ticket_id) {
        skipped++;
        continue;
      }

      const submittedAt = new Date(createdMs + shiftMs).toISOString();
      const isResolved = RESOLVED_STATUSES.has(r.status);
      const hours = Number(r.resolution_time_hours);
      const resolutionMinutes = isResolved && Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null;
      const resolvedAt =
        isResolved && resolutionMinutes != null
          ? new Date(createdMs + shiftMs + resolutionMinutes * 60000).toISOString()
          : null;

      insertStmt.run({
        id: r.ticket_id,
        title: null,
        description: r.initial_message || '(no description provided)',
        category,
        severity,
        team,
        confidence: 1,
        aiCategory: null,
        aiSeverity: null,
        aiTeam: null,
        aiConfidence: null,
        aiReasoning: 'Imported from historical dataset (ground-truth labels, not AI-classified).',
        needsReview: 0,
        status: isResolved ? 'resolved' : 'open',
        submittedAt,
        resolvedAt,
        resolutionMinutes,
      });
    }
  });

  insertAll(rows);
  console.log(`Imported ${rows.length - skipped} tickets${skipped ? ` (skipped ${skipped} unmappable rows)` : ''}.`);
}

run();
