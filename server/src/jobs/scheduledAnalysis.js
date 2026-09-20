import cron from 'node-cron';
import { computeRiskScores } from '../services/riskAnalysis.js';
import { generateNextTicketPrediction } from '../services/predictionService.js';

const CRON_EXPRESSION = process.env.RISK_CRON ?? '*/15 * * * *';

export function runAnalysisNow() {
  const { computedAt, results } = computeRiskScores();
  const rising = results.filter((r) => r.rising);
  console.log(
    `[scheduledAnalysis] computed risk scores at ${computedAt} — ${results.length} categories analyzed, ${rising.length} rising`
  );
  return { computedAt, results };
}

export async function runFullAnalysisNow() {
  const riskResult = runAnalysisNow();
  let prediction = null;
  try {
    prediction = await generateNextTicketPrediction();
    console.log(
      `[scheduledAnalysis] predicted next ticket: category="${prediction.category}" confidence=${prediction.confidence} source=${prediction.source}`
    );
  } catch (err) {
    console.error('[scheduledAnalysis] prediction failed:', err);
  }
  return { ...riskResult, prediction };
}

export function startScheduledAnalysis() {
  runFullAnalysisNow().catch((err) => console.error('[scheduledAnalysis] initial run failed:', err));
  cron.schedule(CRON_EXPRESSION, () => {
    runFullAnalysisNow().catch((err) => console.error('[scheduledAnalysis] failed:', err));
  });
  console.log(`[scheduledAnalysis] scheduled with cron expression "${CRON_EXPRESSION}"`);
}
