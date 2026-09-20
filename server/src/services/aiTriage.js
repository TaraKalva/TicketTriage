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

const SYSTEM_PROMPT = `You are a support ticket triage assistant for a SaaS product. Read the ticket description and classify it.
Respond with ONLY a compact JSON object, no markdown fences, no commentary, in exactly this shape:
{"category": "<one of: ${CATEGORIES.join(', ')}>", "severity": "<one of: ${SEVERITIES.join(', ')}>", "team": "<one of: ${TEAMS.join(', ')}>", "confidence": <number between 0 and 1>, "reasoning": "<one short sentence>"}

Guidance:
- "confidence" reflects how certain YOU are about this classification given the description. Use lower confidence (below 0.6) for vague, ambiguous, or very short descriptions. Use high confidence (0.85+) only when the description is clear and unambiguous.
- "severity" Critical = product down / data loss / security breach affecting many users; High = one user fully blocked from working; Medium = degraded but workable; Low = cosmetic, a question, or a minor annoyance.
- "team" should reflect which part of the product the issue lives in (e.g. billing issues -> Billing Team, login/password/MFA issues -> Identity & Access Team, mobile app crashes -> Mobile App Team, API/integration bugs -> Platform/API Team, dashboards/reporting -> Analytics Team, exports -> Data Team, alerts/emails -> Notifications Team; anything general, a how-to question, or a feature idea -> Product Team).
- Pick exactly one value from each enum list, matching spelling exactly.`;

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in AI response');
  return JSON.parse(text.slice(start, end + 1));
}

function normalize(result, description) {
  const category = CATEGORIES.includes(result.category) ? result.category : 'Other';
  const severity = SEVERITIES.includes(result.severity) ? result.severity : 'Medium';
  const team = TEAMS.includes(result.team) ? result.team : DEFAULT_TEAM_BY_CATEGORY[category];
  let confidence = Number(result.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.min(1, Math.max(0, confidence));
  const reasoning = typeof result.reasoning === 'string' ? result.reasoning.slice(0, 500) : '';
  return { category, severity, team, confidence, reasoning, source: result.source ?? 'ai' };
}

async function classifyWithAnthropic(description) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Ticket description:\n"""${description}"""` }],
  });
  const text = msg.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  return extractJson(text);
}

async function classifyWithOpenAI(description) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Ticket description:\n"""${description}"""` },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });
  return extractJson(completion.choices[0].message.content);
}

// Uses the Gemini API free tier — defaults to a Flash model, which is free-tier eligible.
// Get a free API key at https://aistudio.google.com/apikey
async function classifyWithGemini(description) {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await client.models.generateContent({
    model,
    contents: `Ticket description:\n"""${description}"""`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });
  return extractJson(response.text);
}

const KEYWORD_RULES = [
  { category: 'Account Access', keywords: ['password', 'login', 'log in', 'locked out', "can't access", 'cannot access', 'mfa', '2fa', 'sign in', 'reset my', 'incorrect'] },
  { category: 'Bug', keywords: ['bug', 'crash', 'crashing', 'broken', 'not working', "doesn't work", "isn't saving", 'not saving', 'error', 'glitch', 'freezes'] },
  { category: 'Performance', keywords: ['slow', 'lag', 'laggy', 'timeout', 'timing out', 'unresponsive', 'loading forever', 'takes forever', 'performance'] },
  { category: 'Billing Problem', keywords: ['billing', 'invoice', 'charge', 'charged', 'payment', 'refund', 'subscription', 'price', 'overcharged'] },
  { category: 'Security Concern', keywords: ['suspicious', 'phishing', 'breach', 'hacked', 'unauthorized', 'malware', 'security', 'fraud'] },
  { category: 'Feature Request', keywords: ['would be nice', 'feature request', 'please add', 'wish', 'suggestion', 'could you add', 'it would help if'] },
  { category: 'How-To Question', keywords: ['how do i', 'how to', 'where is', 'where can i', 'can you explain', 'instructions', 'not sure how'] },
];

const SEVERITY_RULES = [
  { severity: 'Critical', keywords: ['down', 'outage', 'breach', 'data loss', 'everyone', 'production', 'all users', 'entire team', 'lost all my data'] },
  { severity: 'High', keywords: ['cannot work', "can't work", 'blocked', 'urgent', 'asap', 'cannot access', "can't access", 'locked out'] },
  { severity: 'Low', keywords: ['minor', 'cosmetic', 'small issue', 'when you get a chance', 'no rush', 'just wondering'] },
];

function classifyWithRules(description) {
  const text = description.toLowerCase();

  let bestCategory = null;
  let bestHits = 0;
  for (const rule of KEYWORD_RULES) {
    const hits = rule.keywords.filter((kw) => text.includes(kw)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestCategory = rule.category;
    }
  }
  const category = bestCategory ?? 'Other';

  let severity = 'Medium';
  for (const rule of SEVERITY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      severity = rule.severity;
      break;
    }
  }

  const team = DEFAULT_TEAM_BY_CATEGORY[category];

  let confidence;
  if (bestCategory && bestHits >= 2) confidence = 0.8;
  else if (bestCategory) confidence = 0.62;
  else confidence = 0.4;
  if (text.trim().split(/\s+/).length < 6) confidence = Math.min(confidence, 0.45);

  return {
    category,
    severity,
    team,
    confidence,
    reasoning: bestCategory
      ? `Matched keyword rules for "${category}".`
      : 'No AI key configured and no clear keyword match; defaulted to Other with low confidence.',
    source: 'rule-based-fallback',
  };
}

export async function triageTicket(description) {
  try {
    if (process.env.GEMINI_API_KEY) {
      const raw = await classifyWithGemini(description);
      return normalize({ ...raw, source: 'gemini' }, description);
    }
    if (process.env.ANTHROPIC_API_KEY) {
      const raw = await classifyWithAnthropic(description);
      return normalize({ ...raw, source: 'anthropic' }, description);
    }
    if (process.env.OPENAI_API_KEY) {
      const raw = await classifyWithOpenAI(description);
      return normalize({ ...raw, source: 'openai' }, description);
    }
  } catch (err) {
    console.error('[aiTriage] AI classification failed, falling back to rule-based classifier:', err.message);
  }
  return normalize(classifyWithRules(description), description);
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

async function predictWithAnthropic(prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 400,
    system: PREDICTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  return extractJson(text);
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
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: PREDICTION_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });
  return extractJson(response.text);
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
    if (process.env.ANTHROPIC_API_KEY) {
      const raw = await predictWithAnthropic(prompt);
      return normalizePrediction({ ...raw, source: 'anthropic' }, { fallbackCategory: targetCategory, fallbackTeam: targetTeam });
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
