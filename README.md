# TicketLens — Intelligent Ticket Triage and Pattern Detection

A SaaS support ticket system that uses AI to classify and route tickets, keeps a human in the loop for
low-confidence calls, tracks resolution time, proactively flags categories with rising ticket volume, and
predicts the next likely incoming ticket from recent trends.

## Stack

- **Backend:** Node.js / Express, SQLite (`better-sqlite3`), `node-cron`
- **Frontend:** React (Vite), Tailwind CSS, Chart.js
- **AI:** Google Gemini (free tier) or OpenAI (auto-detected from env vars, in that
  priority order), with a built-in rule-based fallback classifier so the app works fully with no API key
- **Data:** imported from `server/data/synthetic_it_support_tickets.csv` (100k real-shaped support tickets)

## Getting started

TicketLens is designed to work out-of-the-box on both **macOS** and **Windows** with Node.js 18+.

### 1. Install dependencies

```bash
npm install
```
*(Runs a postinstall script that installs root, backend, and frontend packages automatically).*

### 2. Configure AI (Optional)

```bash
# macOS/Linux:
cp server/.env.example server/.env

# Windows (Command Prompt):
copy server\.env.example server\.env

# Windows (PowerShell):
cp server/.env.example server/.env
```

Edit `server/.env` and add your **GEMINI_API_KEY** (get a free key at [Google AI Studio](https://aistudio.google.com/apikey)) or `OPENAI_API_KEY`.

> **Note:** If no AI key is configured, TicketLens automatically runs using its high-speed built-in keyword rule classifier, allowing full end-to-end functionality offline without external dependencies.

### 3. Run the application

```bash
npm run dev
```

- **Web Application:** http://localhost:5173 (Vite auto-proxies `/api` requests to backend)
- **API Server:** http://localhost:4000
- **Health Check:** http://localhost:4000/api/health

> **Auto-Seeding:** On first run after cloning, the server automatically initializes SQLite, imports the bundled `server/data/synthetic_it_support_tickets.csv` (100k tickets), seeds active review queue tickets, and computes baseline risk analytics in ~2 seconds. No manual database setup required!

### Optional Manual Seed / Reset

To manually re-import or reset the dataset at any time:

```bash
npm run seed
```

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
