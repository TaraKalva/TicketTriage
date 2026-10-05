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
db.pragma('cache_size = -64000');
db.pragma('mmap_size = 268435456');
db.pragma('synchronous = NORMAL');

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
  CREATE INDEX IF NOT EXISTS idx_tickets_severity ON tickets(severity);
  CREATE INDEX IF NOT EXISTS idx_tickets_team ON tickets(team);
  CREATE INDEX IF NOT EXISTS idx_tickets_submittedAt ON tickets(submittedAt);
  CREATE INDEX IF NOT EXISTS idx_tickets_category_submittedAt ON tickets(category, submittedAt);
  CREATE INDEX IF NOT EXISTS idx_tickets_status_submittedAt ON tickets(status, submittedAt);
  CREATE INDEX IF NOT EXISTS idx_tickets_needsReview_submittedAt ON tickets(needsReview, submittedAt);
  CREATE INDEX IF NOT EXISTS idx_risk_scores_computedAt ON risk_scores(computedAt);
  CREATE INDEX IF NOT EXISTS idx_predictions_computedAt ON predictions(computedAt);
`);

export function ensureDataOptimizedAndCurrent() {
  try {
    const row = db.prepare('SELECT MAX(submittedAt) as maxDate, COUNT(*) as count FROM tickets').get();
    if (!row || !row.maxDate || row.count === 0) return;

    const maxMs = new Date(row.maxDate).getTime();
    const nowMs = Date.now();
    const diffSeconds = Math.round((nowMs - maxMs) / 1000);

    // If data is lagging by more than 3 hours, shift it forward to current time
    if (diffSeconds > 10800) {
      console.log(`[db] Optimizing and time-shifting dataset forward by ${(diffSeconds / 86400).toFixed(2)} days to ensure up-to-date data.`);
      const updateStmt = db.prepare(`
        UPDATE tickets
        SET submittedAt = datetime(submittedAt, '+' || ? || ' seconds'),
            resolvedAt = CASE WHEN resolvedAt IS NOT NULL THEN datetime(resolvedAt, '+' || ? || ' seconds') ELSE NULL END
      `);
      db.transaction(() => {
        updateStmt.run(diffSeconds, diffSeconds);
      })();
      console.log('[db] Dataset timestamps successfully synchronized with current time.');
    }
  } catch (err) {
    console.error('[db] Error ensuring current data:', err.message);
  }
}

export default db;

