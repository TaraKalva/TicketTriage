import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ticketsRouter from './routes/tickets.js';
import dashboardRouter from './routes/dashboard.js';
import { startScheduledAnalysis } from './jobs/scheduledAnalysis.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/tickets', ticketsRouter);
app.use('/api/dashboard', dashboardRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`TicketLens API listening on http://localhost:${PORT}`);
  startScheduledAnalysis();
});
