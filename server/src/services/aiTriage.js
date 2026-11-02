import 'dotenv/config';

// Taxonomy matches the imported dataset's issue_type / product_area fields
// (see server/src/db/importDataset.js) so historical and freshly-triaged tickets share one schema.
export const CATEGORIES = [
  'Account Access',
  'Bug',
  'Performance',
  'Billing Problem',
  'Security Concern',
  'Feature Request',
  'How-To Question',
  'Other',
];

export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

export const TEAMS = [
  'Mobile App Team',
  'Identity & Access Team',
  'Platform/API Team',
  'Billing Team',
  'Data Team',
  'Analytics Team',
  'Notifications Team',
  'Product Team',
];

export const DEFAULT_TEAM_BY_CATEGORY = {
  'Account Access': 'Identity & Access Team',
  Bug: 'Platform/API Team',
  Performance: 'Platform/API Team',
  'Billing Problem': 'Billing Team',
  'Security Concern': 'Identity & Access Team',
  'Feature Request': 'Product Team',
  'How-To Question': 'Product Team',
  Other: 'Product Team',
};

export const ENVIRONMENTS = ['Production', 'Staging', 'Development', 'Internal'];

export const SYSTEM_OPTIONS = [
  'Authentication / SSO',
  'Mobile App (iOS/Android)',
  'Web Dashboard',
  'Platform API / Webhooks',
  'Billing & Payments',
  'Data Warehouse & Exports',
  'Notification Service',
  'Customer Portal',
];

const SYSTEM_PROMPT = `You are an expert IT support ticket triage assistant for an enterprise SaaS platform.
Analyze the ticket details (including description and any optional technical context such as affected system, environment, error details, and reproduction steps) and classify it accurately.

Respond with ONLY a compact JSON object, no markdown fences, no commentary, in exactly this shape:
{"category": "<one of: ${CATEGORIES.join(', ')}>", "severity": "<one of: ${SEVERITIES.join(', ')}>", "team": "<one of: ${TEAMS.join(', ')}>", "confidence": <number between 0 and 1>, "reasoning": "<concise sentence explaining why category, severity, and team were chosen>", "reviewReason": "<if confidence < 0.7, explain why human review is required; otherwise null>"}

Classification Rules:
- "confidence": Reflects how certain the classification is based on concrete evidence. Use < 0.65 for brief, ambiguous, or vague descriptions (e.g. 'not working', 'thing is broken'). Use high confidence (0.80+) when symptoms, system, or error codes are clear.
- "severity":
  * Critical = widespread outage, production failure affecting multiple users, data loss, or active security exploit.
  * High = single user blocked from working (e.g. unable to log in / authenticate), core workflow broken, or high-impact production issue.
  * Medium = bug or error with available workaround, non-blocking performance degradation.
  * Low = cosmetic issue, minor UI flaw, how-to question, or feature idea.
- "team":
  * Identity & Access Team: login, SSO, password, authentication, MFA, permissions.
  * Mobile App Team: iOS / Android apps, mobile crashes, mobile layout bugs.
  * Platform/API Team: backend APIs, webhooks, 5xx server errors, system timeouts.
  * Billing Team: invoices, payment gateway, charges, refunds, subscription plans.
  * Data Team: database queries, data warehouse, CSV/ETL imports and exports.
  * Analytics Team: dashboards, charts, reporting metrics, telemetry.
  * Notifications Team: email alerts, SMS, push notifications infrastructure.
  * Product Team: feature requests, how-to questions, user feedback, general inquiries.
- Match taxonomy exactly.`;

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in AI response');
  return JSON.parse(text.slice(start, end + 1));
}

function formatTicketPayload(input) {
  if (typeof input === 'string') {
    return { description: input.trim(), affectedSystem: '', environment: '', errorDetails: '', reproductionSteps: '' };
  }
  return {
    description: (input?.description || '').trim(),
    affectedSystem: (input?.affectedSystem || '').trim(),
    environment: (input?.environment || '').trim(),
    errorDetails: (input?.errorDetails || '').trim(),
    reproductionSteps: (input?.reproductionSteps || '').trim(),
  };
}

function buildPromptContent(payload) {
  const lines = [`Ticket Description:\n"""${payload.description}"""`];
  if (payload.affectedSystem) lines.push(`Affected System: ${payload.affectedSystem}`);
  if (payload.environment) lines.push(`Environment: ${payload.environment}`);
  if (payload.errorDetails) lines.push(`Error Details: ${payload.errorDetails}`);
  if (payload.reproductionSteps) lines.push(`Reproduction Steps:\n${payload.reproductionSteps}`);
  return lines.join('\n\n');
}

function normalize(result, payload) {
  const category = CATEGORIES.includes(result.category) ? result.category : 'Other';
  const severity = SEVERITIES.includes(result.severity) ? result.severity : 'Medium';
  const team = TEAMS.includes(result.team) ? result.team : DEFAULT_TEAM_BY_CATEGORY[category];
  let confidence = Number(result.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.min(1, Math.max(0, confidence));

  let reasoning = typeof result.reasoning === 'string' && result.reasoning.trim()
    ? result.reasoning.slice(0, 500)
    : `Classified as ${category} routed to ${team}.`;

  let reviewReason = result.reviewReason || null;
  if (confidence < 0.7 && !reviewReason) {
    reviewReason = `Confidence score (${Math.round(confidence * 100)}%) is below the 70% threshold. Human verification is recommended.`;
  }

  return {
    category,
    severity,
    team,
    confidence,
    reasoning,
    reviewReason: confidence < 0.7 ? reviewReason : null,
    source: result.source ?? 'ai',
  };
}

async function classifyWithOpenAI(payload) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const content = buildPromptContent(payload);
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });
  return extractJson(completion.choices[0].message.content);
}

// Uses the Gemini API — defaults to gemini-3.8-flash with fallbacks
async function classifyWithGemini(payload) {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = [
    process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
  ];

  const content = buildPromptContent(payload);
  let lastErr = null;
  for (const model of models) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: content,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
        },
      });
      return extractJson(response.text);
    } catch (err) {
      lastErr = err;
      if (err.status === 503 || err.message?.includes('503') || err.message?.includes('404')) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

const KEYWORD_RULES = [
  { category: 'Account Access', keywords: ['password', 'login', 'log in', 'locked out', "can't access", 'cannot access', 'mfa', '2fa', 'sign in', 'reset my', 'incorrect', 'auth', 'authentication', 'credential', 'sso'] },
  { category: 'Bug', keywords: ['bug', 'crash', 'crashing', 'broken', 'not working', "doesn't work", "isn't saving", 'not saving', 'error', 'glitch', 'freezes', 'exception', 'stack trace'] },
  { category: 'Performance', keywords: ['slow', 'lag', 'laggy', 'timeout', 'timing out', 'unresponsive', 'loading forever', 'takes forever', 'performance', 'latency', 'high cpu'] },
  { category: 'Billing Problem', keywords: ['billing', 'invoice', 'charge', 'charged', 'payment', 'refund', 'subscription', 'price', 'overcharged', 'receipt', 'card declined'] },
  { category: 'Security Concern', keywords: ['suspicious', 'phishing', 'breach', 'hacked', 'unauthorized', 'malware', 'security', 'fraud', 'vulnerability', 'exploit'] },
  { category: 'Feature Request', keywords: ['would be nice', 'feature request', 'please add', 'wish', 'suggestion', 'could you add', 'it would help if', 'add support for'] },
  { category: 'How-To Question', keywords: ['how do i', 'how to', 'where is', 'where can i', 'can you explain', 'instructions', 'not sure how', 'documentation'] },
];

const SEVERITY_RULES = [
  { severity: 'Critical', keywords: ['down', 'outage', 'breach', 'data loss', 'everyone', 'production outage', 'all users', 'entire team', 'lost all my data', 'catastrophic'] },
  { severity: 'High', keywords: ['cannot work', "can't work", 'blocked', 'urgent', 'asap', 'cannot access', "can't access", 'locked out', 'cannot log in', 'auth failed', 'authentication failed'] },
  { severity: 'Low', keywords: ['minor', 'cosmetic', 'small issue', 'when you get a chance', 'no rush', 'just wondering', 'typo', 'feedback'] },
];

export function classifyWithRules(input) {
  const payload = typeof input === 'string' ? { description: input, affectedSystem: '', environment: '', errorDetails: '', reproductionSteps: '' } : {
    description: input.description || '',
    affectedSystem: input.affectedSystem || '',
    environment: input.environment || '',
    errorDetails: input.errorDetails || '',
    reproductionSteps: input.reproductionSteps || '',
  };
  const fullText = `${payload.description} ${payload.errorDetails} ${payload.reproductionSteps} ${payload.affectedSystem}`.toLowerCase();
  const descWords = payload.description.trim().split(/\s+/).filter(Boolean);

  let bestCategory = null;
  let bestHits = 0;
  for (const rule of KEYWORD_RULES) {
    const hits = rule.keywords.filter((kw) => fullText.includes(kw)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestCategory = rule.category;
    }
  }

  // System context influence
  const systemLower = payload.affectedSystem.toLowerCase();
  if (systemLower.includes('auth') || systemLower.includes('sso')) {
    bestCategory = 'Account Access';
    bestHits = Math.max(bestHits, 2);
  } else if (systemLower.includes('billing') || systemLower.includes('payment')) {
    bestCategory = 'Billing Problem';
    bestHits = Math.max(bestHits, 2);
  } else if (systemLower.includes('mobile')) {
    if (!bestCategory || bestCategory === 'Other') bestCategory = 'Bug';
  }

  const category = bestCategory ?? 'Other';

  // Determine Severity
  let severity = 'Medium';
  for (const rule of SEVERITY_RULES) {
    if (rule.keywords.some((kw) => fullText.includes(kw))) {
      severity = rule.severity;
      break;
    }
  }

  // Elevate severity if in Production and has high impact
  if (payload.environment === 'Production' && severity === 'Medium' && (payload.errorDetails || fullText.includes('error') || fullText.includes('fail'))) {
    severity = 'High';
  }

  // Determine Team
  let team = DEFAULT_TEAM_BY_CATEGORY[category] || 'Product Team';
  if (systemLower.includes('mobile')) {
    team = 'Mobile App Team';
  } else if (systemLower.includes('auth') || systemLower.includes('sso') || category === 'Account Access') {
    team = 'Identity & Access Team';
  } else if (systemLower.includes('billing') || category === 'Billing Problem') {
    team = 'Billing Team';
  } else if (systemLower.includes('api') || systemLower.includes('webhook')) {
    team = 'Platform/API Team';
  } else if (systemLower.includes('data') || systemLower.includes('export')) {
    team = 'Data Team';
  }

  // Calculate Confidence
  let confidence = 0.5;
  const isVague =
    descWords.length < 8 &&
    !payload.errorDetails &&
    !payload.reproductionSteps &&
    (fullText.includes('thing') || fullText.includes('not working') || bestHits <= 1);

  if (isVague) {
    confidence = 0.45;
  } else if (bestCategory && bestHits >= 2) {
    confidence = 0.88;
  } else if (bestCategory && bestHits === 1) {
    confidence = 0.65;
  } else {
    confidence = 0.42;
  }

  // Technical context boost
  if (payload.errorDetails && payload.errorDetails.length > 3) confidence = Math.min(0.95, confidence + 0.08);
  if (payload.reproductionSteps && payload.reproductionSteps.length > 10) confidence = Math.min(0.95, confidence + 0.06);
  if (payload.affectedSystem) confidence = Math.min(0.95, confidence + 0.04);

  let reasoning = '';
  let reviewReason = null;

  if (confidence >= 0.7) {
    reasoning = `Strong signal match for ${category} (${bestHits} matching pattern indicators). Routed to ${team} with ${severity} priority.`;
  } else {
    reasoning = bestCategory
      ? `Tentative match for ${category}, but signals are sparse.`
      : 'Ambiguous description with insufficient technical indicators.';
    reviewReason = isVague
      ? `Confidence score (${Math.round(confidence * 100)}%) is below 70% threshold because the description is brief/vague and lacks concrete error or reproduction details.`
      : `Confidence score (${Math.round(confidence * 100)}%) is below 70% threshold. Human confirmation required before team dispatch.`;
  }

  return {
    category,
    severity,
    team,
    confidence: Number(confidence.toFixed(2)),
    reasoning,
    reviewReason,
    source: 'rule-based-engine',
  };
}

export async function triageTicket(input) {
  const payload = formatTicketPayload(input);
  try {
    if (process.env.GEMINI_API_KEY) {
      const raw = await classifyWithGemini(payload);
      return normalize({ ...raw, source: 'gemini' }, payload);
    }
    if (process.env.OPENAI_API_KEY) {
      const raw = await classifyWithOpenAI(payload);
      return normalize({ ...raw, source: 'openai' }, payload);
    }
  } catch (err) {
    console.error('[aiTriage] AI classification failed, falling back to rule-based engine:', err.message);
  }
  return normalize(classifyWithRules(payload), payload);
}

export function getConfidenceThreshold() {
  const raw = Number(process.env.CONFIDENCE_THRESHOLD);
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.7;
}


// ---------------------------------------------------------------------------
// Predictive layer: "what's the next probable ticket?"
// Grounds the AI in real recent ticket examples + the current risk-score trend,
// rather than asking it to hallucinate a forecast out of nothing.
// ---------------------------------------------------------------------------

const PREDICTION_SYSTEM_PROMPT = `You are a proactive support-operations analyst for a SaaS product. You are given:
- a short summary of recent ticket volume trends by category
- a handful of real, recent ticket descriptions from the category most likely to produce the next incident

Using that evidence, predict the single most likely NEXT support ticket the team will receive.
Respond with ONLY a compact JSON object, no markdown fences, no commentary, in exactly this shape:
{"category": "<one of: ${CATEGORIES.join(', ')}>", "severity": "<one of: ${SEVERITIES.join(', ')}>", "team": "<one of: ${TEAMS.join(', ')}>", "confidence": <number between 0 and 1>, "predictedDescription": "<a realistic one-to-two sentence ticket description, written the way a customer would write it>", "rationale": "<one short sentence explaining why, referencing the trend or examples>"}

Guidance:
- Base the prediction on the evidence given — don't invent an unrelated scenario.
- "predictedDescription" should read like a real customer wrote it, not a summary of the trend.
- "confidence" reflects how strong the evidence is (e.g. a sharp volume spike + consistent examples = higher confidence).`;

function buildPredictionPrompt({ trendSummary, examples }) {
  const examplesBlock = examples.length
    ? examples.map((e, i) => `${i + 1}. "${e}"`).join('\n')
    : '(no recent examples available)';
  return `Recent ticket volume trend by category:\n${trendSummary}\n\nRecent example tickets from the highest-signal category:\n${examplesBlock}`;
}


async function predictWithOpenAI(prompt) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: PREDICTION_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });
  return extractJson(completion.choices[0].message.content);
}

async function predictWithGemini(prompt) {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = [
    process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
  ];

  let lastErr = null;
  for (const model of models) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: PREDICTION_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
        },
      });
      return extractJson(response.text);
    } catch (err) {
      lastErr = err;
      if (err.status === 503 || err.message?.includes('503') || err.message?.includes('404')) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function normalizePrediction(result, { fallbackCategory, fallbackTeam }) {
  const category = CATEGORIES.includes(result.category) ? result.category : fallbackCategory;
  const severity = SEVERITIES.includes(result.severity) ? result.severity : 'Medium';
  const team = TEAMS.includes(result.team) ? result.team : fallbackTeam ?? DEFAULT_TEAM_BY_CATEGORY[category];
  let confidence = Number(result.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.min(1, Math.max(0, confidence));
  const predictedDescription =
    typeof result.predictedDescription === 'string' && result.predictedDescription.trim()
      ? result.predictedDescription.trim().slice(0, 600)
      : `A new "${category}" ticket, similar to recent reports in that category.`;
  const rationale = typeof result.rationale === 'string' ? result.rationale.slice(0, 400) : '';
  return { category, severity, team, confidence, predictedDescription, rationale, source: result.source ?? 'ai' };
}

function predictWithRules({ targetCategory, targetTeam, targetSeverity, trendSummary, examples }) {
  const category = targetCategory ?? 'Other';
  const team = targetTeam ?? DEFAULT_TEAM_BY_CATEGORY[category];
  const severity = targetSeverity ?? 'Medium';
  const sample = examples[0];
  const predictedDescription = sample
    ? `Likely another "${category}" ticket along the lines of: "${sample}"`
    : `A new "${category}" ticket is likely next, based on recent volume trends.`;
  return {
    category,
    severity,
    team,
    confidence: 0.55,
    predictedDescription,
    rationale: `Rule-based estimate from recent volume trends (no AI key configured):\n${trendSummary.split('\n')[0]}`,
    source: 'rule-based-fallback',
  };
}

export async function predictNextTicket({ targetCategory, targetTeam, targetSeverity, trendSummary, examples }) {
  const prompt = buildPredictionPrompt({ trendSummary, examples });
  try {
    if (process.env.GEMINI_API_KEY) {
      const raw = await predictWithGemini(prompt);
      return normalizePrediction({ ...raw, source: 'gemini' }, { fallbackCategory: targetCategory, fallbackTeam: targetTeam });
    }
    if (process.env.OPENAI_API_KEY) {
      const raw = await predictWithOpenAI(prompt);
      return normalizePrediction({ ...raw, source: 'openai' }, { fallbackCategory: targetCategory, fallbackTeam: targetTeam });
    }
  } catch (err) {
    console.error('[aiTriage] Prediction failed, falling back to rule-based estimate:', err.message);
  }
  return predictWithRules({ targetCategory, targetTeam, targetSeverity, trendSummary, examples });
}
