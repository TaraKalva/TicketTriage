import crypto from 'node:crypto';
import db from './index.js';
import { triageTicket, getConfidenceThreshold } from '../services/aiTriage.js';

// Adds a large batch of realistic "live" tickets on top of the imported historical dataset.
// Unlike importDataset.js (which bulk-inserts pre-labeled ground truth), every ticket here is
// run through the *real* triageTicket() pipeline — the same function the API uses — so
// confidence scores and needsReview flags are authentic, not faked. That's what populates the
// Review Queue, and the added recent-dated volume gives the risk-trend job and the next-ticket
// predictor a lot more (and more current) signal to work with.

const CLEAR_COUNT = Number(process.argv.find((a) => a.startsWith('--clear-count='))?.split('=')[1]) || 1400;
const VAGUE_COUNT = Number(process.argv.find((a) => a.startsWith('--vague-count='))?.split('=')[1]) || 60;

const AREAS = ['billing', 'the mobile app', 'the API integration', 'the analytics dashboard', 'notifications', 'data export', 'login'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function area() {
  return pick(AREAS);
}

// Deliberately clear, keyword-rich templates — each one contains at least TWO substrings
// from its category's KEYWORD_RULES list (see aiTriage.js), which is what the rule-based
// fallback classifier requires to reach high (0.8) confidence and auto-route. A template
// with only one matching keyword lands at 0.62 — still below the review threshold — so
// under-seeding keywords here would (and, on a first pass, did) flood the review queue
// instead of giving a realistic mostly-auto-routed / some-flagged mix.
const TEMPLATES = {
  'Account Access': [
    () => "I can't log in — it says my password is incorrect.",
    () => 'My account is locked out and I forgot my password.',
    () => "The 2FA code never arrives, so I can't sign in.",
    () => 'I reset my password but now I get incorrect login errors.',
    () => "Getting 'incorrect password' every time I try to log in.",
    () => 'Someone must have changed my password — now my login is locked out.',
  ],
  Bug: [
    () => 'The app keeps crashing and showing an error message.',
    () => `Found a bug — ${area()} freezes every time I click save.`,
    () => `${area()[0].toUpperCase()}${area().slice(1)} is broken and not working at all.`,
    () => `Getting a glitch where ${area()} crashes randomly.`,
    () => `It isn't saving my changes in ${area()} — I think it's a bug.`,
    () => `There's a bug causing random crashes in ${area()}.`,
  ],
  Performance: [
    () => 'The app is really slow and laggy today.',
    () => `${area()[0].toUpperCase()}${area().slice(1)} is timing out and feels unresponsive.`,
    () => `Loading ${area()} takes forever now, definitely a performance issue.`,
    () => `${area()[0].toUpperCase()}${area().slice(1)} is so slow, it takes forever to load anything.`,
    () => `Getting constant timeouts — really laggy performance in ${area()} lately.`,
  ],
  'Billing Problem': [
    () => 'I was charged twice for my subscription this month.',
    () => 'My invoice shows the wrong billing amount.',
    () => 'Requesting a refund for an incorrect charge on my account.',
    () => 'My payment failed but I was still charged for the subscription.',
    () => 'I think I was overcharged on my last invoice.',
  ],
  'Security Concern': [
    () => 'I received a suspicious phishing email about my account.',
    () => "I think my account was hacked — there's unauthorized access happening.",
    () => 'This looks like a security breach, possibly fraud.',
    () => 'Got a suspicious email that might be malware.',
    () => 'There is unauthorized activity on my account, might be a security issue.',
  ],
  'Feature Request': [
    () => 'Feature request: could you add dark mode please?',
    () => `It would be nice if you could add bulk editing to ${area()}.`,
    () => `Just a suggestion — it would help if ${area()} had an export option.`,
    () => `I wish you could add keyboard shortcuts to ${area()}, just a suggestion.`,
    () => `Please add CSV export to ${area()} — would be nice to have.`,
  ],
  'How-To Question': [
    () => 'How do I set this up? Not sure how to get started.',
    () => `Can you explain how to configure ${area()}? Where do I find instructions?`,
    () => `Where can I find setup instructions for ${area()}?`,
    () => `Not sure how to connect ${area()} — are there any instructions?`,
    () => `How do I migrate my data? Where is the import option for ${area()}?`,
  ],
};
const TEMPLATE_CATEGORIES = Object.keys(TEMPLATES);

// Deliberately vague/short — real support inboxes get plenty of these, and they're exactly
// what should land in the review queue (rule-based fallback caps confidence below the
// threshold for anything this short or ambiguous).
const VAGUE_DESCRIPTIONS = [
  'thing is broken',
  'not working',
  'please help',
  'issue with the app',
  "something's wrong",
  'help asap',
  'broken again',
  "can't use it",
  'having a problem',
  'not sure what happened but its broken',
  'stuff isnt working right',
  'having trouble with this',
  'weird issue today',
  'app being difficult',
  'need help with something',
  'this is frustrating',
  'cant get it to work',
  'issue again',
];

const insertStmt = db.prepare(`
  INSERT INTO tickets (
    id, title, description, category, severity, team, confidence,
    aiCategory, aiSeverity, aiTeam, aiConfidence, aiReasoning,
    needsReview, status, submittedAt, resolvedAt, resolutionMinutes
  ) VALUES (
    @id, @title, @description, @category, @severity, @team, @confidence,
    @aiCategory, @aiSeverity, @aiTeam, @aiConfidence, @aiReasoning,
    @needsReview, @status, @submittedAt, @resolvedAt, @resolutionMinutes
  )
`);

function randomTimestamp(maxDaysAgo, recencyBias = 1.5) {
  const dayOffset = Math.floor(maxDaysAgo * Math.pow(Math.random(), recencyBias));
  const msAgo = dayOffset * 86400000 + Math.floor(Math.random() * 86400000);
  return new Date(Date.now() - msAgo);
}

function resolveOutcome(submittedAt, forceOpen) {
  const ageHours = (Date.now() - submittedAt.getTime()) / 3600000;
  if (forceOpen || ageHours < 12) {
    return { status: 'open', resolvedAt: null, resolutionMinutes: null };
  }
  const resolveChance = Math.min(0.85, ageHours / 200);
  if (Math.random() > resolveChance) {
    return { status: 'open', resolvedAt: null, resolutionMinutes: null };
  }
  const maxMinutes = Math.min(ageHours * 60, 4320);
  const resolutionMinutes = Math.round(20 + Math.random() * Math.max(20, maxMinutes - 20));
  const resolvedAt = new Date(submittedAt.getTime() + resolutionMinutes * 60000);
  return { status: 'resolved', resolvedAt: resolvedAt.toISOString(), resolutionMinutes };
}

async function run() {
  console.log(`Generating ${CLEAR_COUNT} clear + ${VAGUE_COUNT} vague tickets through the live triage pipeline...`);
  const rows = [];
  let flagged = 0;
  const threshold = getConfidenceThreshold();

  for (let i = 0; i < CLEAR_COUNT; i++) {
    const category = pick(TEMPLATE_CATEGORIES);
    const description = pick(TEMPLATES[category])();
    const submittedAt = randomTimestamp(30, 1.4);
    const ai = await triageTicket(description);
    const needsReview = ai.confidence < threshold;
    if (needsReview) flagged++;
    const { status, resolvedAt, resolutionMinutes } = resolveOutcome(submittedAt, needsReview);
    rows.push({
      id: crypto.randomUUID(),
      title: null,
      description,
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
      status,
      submittedAt: submittedAt.toISOString(),
      resolvedAt,
      resolutionMinutes,
    });
    if ((i + 1) % 200 === 0) console.log(`  ...${i + 1}/${CLEAR_COUNT} clear tickets triaged`);
  }

  for (let i = 0; i < VAGUE_COUNT; i++) {
    const description = pick(VAGUE_DESCRIPTIONS);
    const submittedAt = randomTimestamp(4, 1);
    const ai = await triageTicket(description);
    const needsReview = ai.confidence < threshold;
    if (needsReview) flagged++;
    rows.push({
      id: crypto.randomUUID(),
      title: null,
      description,
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
      submittedAt: submittedAt.toISOString(),
      resolvedAt: null,
      resolutionMinutes: null,
    });
  }

  const insertAll = db.transaction((items) => {
    for (const item of items) insertStmt.run(item);
  });
  insertAll(rows);

  console.log(`Inserted ${rows.length} tickets. ${flagged} flagged needsReview (confidence < ${threshold}).`);
}

run();
