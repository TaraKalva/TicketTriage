import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'ticketlens.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    team TEXT NOT NULL,
    confidence REAL NOT NULL,
    aiCategory TEXT,
    aiSeverity TEXT,
    aiTeam TEXT,
    aiConfidence REAL,
    aiReasoning TEXT,
    needsReview INTEGER NOT NULL DEFAULT 0,
    reviewedAt TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    submittedAt TEXT NOT NULL,
    resolvedAt TEXT,
    resolutionMinutes REAL
  );

  CREATE TABLE IF NOT EXISTS risk_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    recentCount INTEGER NOT NULL,
    priorCount INTEGER NOT NULL,
    rising INTEGER NOT NULL DEFAULT 0,
    recommendation TEXT,
    computedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    team TEXT NOT NULL,
    confidence REAL NOT NULL,
    predictedDescription TEXT NOT NULL,
    rationale TEXT,
    source TEXT,
    computedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_needsReview ON tickets(needsReview);
  CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
  CREATE INDEX IF NOT EXISTS idx_tickets_submittedAt ON tickets(submittedAt);
  CREATE INDEX IF NOT EXISTS idx_tickets_category_submittedAt ON tickets(category, submittedAt);
  CREATE INDEX IF NOT EXISTS idx_risk_scores_computedAt ON risk_scores(computedAt);
  CREATE INDEX IF NOT EXISTS idx_predictions_computedAt ON predictions(computedAt);
`);

export default db;
