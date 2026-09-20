# TicketLens — Intelligent Ticket Triage and Pattern Detection

A SaaS support ticket system that uses AI to classify and route tickets, keeps a human in the loop for
low-confidence calls, tracks resolution time, proactively flags categories with rising ticket volume, and
predicts the next likely incoming ticket from recent trends.

## Stack

- **Backend:** Node.js / Express, SQLite (`better-sqlite3`), `node-cron`
- **Frontend:** React (Vite), Tailwind CSS, Chart.js
- **AI:** Google Gemini (free tier), Anthropic Claude, or OpenAI (auto-detected from env vars, in that
  priority order), with a built-in rule-based fallback classifier so the app works fully with no API key
- **Data:** imported from `server/data/synthetic_it_support_tickets.csv` (100k real-shaped support tickets)

## Getting started

```bash
npm run install:all   # installs server + client dependencies
```

Configure AI (optional):

```bash
cp server/.env.example server/.env
# then edit server/.env and set GEMINI_API_KEY (free — https://aistudio.google.com/apikey),
# ANTHROPIC_API_KEY, or OPENAI_API_KEY
```

If no key is set, the triage engine automatically falls back to a keyword-based rule classifier —
useful for demos and development. Ambiguous/short descriptions get lower confidence and land in the
review queue either way.

Import the ticket dataset (required for first run — the dashboard, risk flags, and predictions all
depend on historical data):

```bash
npm run --prefix server import-data
```

This maps the CSV's `issue_type` / `priority` / `product_area` columns onto TicketLens's schema and
time-shifts the whole dataset so its most recent ticket lands "today" — this keeps the real
burst/density patterns in the data intact, which is what makes the 7-day risk trend and the "last 14
days" volume chart show something meaningful instead of empty history.

Optionally, add a large batch of realistic *live* traffic on top of the imported historical data:

```bash
npm run --prefix server generate-traffic
```

Unlike the CSV import (which bulk-inserts pre-labeled ground truth), this runs every generated ticket
through the real `triageTicket()` pipeline — the same code path the API uses — so confidence scores and
`needsReview` flags are authentic. It mixes clear, keyword-rich descriptions (which mostly auto-route)
with a smaller batch of deliberately vague ones (which land in the Review Queue), and spreads them over
the last ~30 days so the risk-trend job and next-ticket predictor have much richer, more recent signal
to work with. Defaults to 1,400 clear + 60 vague tickets — override with `--clear-count=N --vague-count=N`.

Run both apps together:

```bash
npm run dev
```

- API: http://localhost:4000
- App: http://localhost:5173 (Vite proxies `/api` to the backend)

## How it works

1. **Submit** a ticket description on the Submit Ticket page.
2. The backend calls the AI triage engine, which returns `category`, `severity`, `team`, `confidence`,
   and a one-line `reasoning`.
3. If `confidence` is below `CONFIDENCE_THRESHOLD` (default `0.7`), the ticket is flagged `needsReview`
   and shows up in the **Review Queue** instead of being auto-routed. A person confirms or corrects the
   classification there.
4. Tickets can be marked **Resolved**, which records `resolutionMinutes`.
5. A scheduled job (`node-cron`, every 15 min by default — see `RISK_CRON` in `.env`) compares each
   category's ticket volume in the last 7 days against the prior 7 days and stores a `risk_scores`
   snapshot. A category is flagged `rising` when recent volume is at least 25% above the prior period
   (with a minimum volume floor to avoid noise on low-traffic categories), and gets a plain-language
   recommendation.
6. The same job then asks the AI to **predict the next probable ticket**: it hands the model the current
   volume trend plus a handful of real recent ticket descriptions from the highest-signal category, and
   asks for a realistic next-ticket forecast (category/severity/team/description/rationale/confidence) —
   grounded in real data rather than an unconstrained guess. Stored in `predictions`.
7. The **Dashboard** shows ticket volume, severity breakdown, category performance/resolution time, the
   proactive risk flags, and the predicted-next-ticket card — polling every 20s, or trigger
   `Recompute AI insights` manually.

## Ticket taxonomy

Matches the imported dataset so historical and freshly-triaged tickets share one schema:

- **Category:** Account Access, Bug, Performance, Billing Problem, Security Concern, Feature Request,
  How-To Question, Other
- **Severity:** Low, Medium, High, Critical
- **Team:** Mobile App, Identity & Access, Platform/API, Billing, Data, Analytics, Notifications, Product

## Project layout

```
server/
  data/            synthetic_it_support_tickets.csv (source dataset) + ticketlens.sqlite
  src/
    db/            schema + importDataset.js (CSV -> SQLite, time-shifted)
    services/      aiTriage.js (triage + fallback), riskAnalysis.js (trend detection),
                   predictionService.js (next-ticket forecast)
    jobs/          scheduledAnalysis.js (node-cron job: risk scores + prediction)
    routes/        tickets.js (paginated), dashboard.js
client/
  src/
    pages/         Dashboard, SubmitTicket, ReviewQueue, AllTickets (paginated + search)
    components/    Layout, Badge, Card, ThemeToggle, chart config
```

With 100k imported tickets, `GET /api/tickets` is paginated (`page`, `pageSize`, `search`, plus the
existing `status`/`category`/`team`/`needsReview` filters) — the All Tickets page has Previous/Next
controls and a search box for this reason.
