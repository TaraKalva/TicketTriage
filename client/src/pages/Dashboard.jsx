import { useCallback, useEffect, useState } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import Card from '../components/Card.jsx';
import Reveal from '../components/Reveal.jsx';
import Counter from '../components/Counter.jsx';
import { SeverityBadge, CategoryBadge } from '../components/Badge.jsx';
import { CHART_TEXT_COLOR, CHART_GRID_COLOR, SEVERITY_COLORS, PALETTE } from '../components/charts.js';
import { getDashboardSummary, recomputeAll } from '../api/client.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    try {
      const summary = await getDashboardSummary();
      setData(summary);
    } catch (err) {
      setError('Failed to load dashboard data.');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  async function handleRecompute() {
    setRecomputing(true);
    try {
      await recomputeAll();
      await load();
    } finally {
      setRecomputing(false);
    }
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return <p className="text-slate-400 text-sm">Loading dashboard...</p>;

  const { totals, severityBreakdown, volumeByDay, categoryPerformance, insights, riskScores, prediction } = data;
  const risingScores = riskScores.scores.filter((s) => s.rising);

  return (
    <div className="space-y-8 md:space-y-12">
      <Reveal className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tightest text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-base md:text-lg">
            Ticket volume, severity, category performance, and proactive risk flags.
          </p>
        </div>
        <button
          onClick={handleRecompute}
          disabled={recomputing}
          className="press inline-flex items-center gap-1.5 rounded-full glass border border-white/60 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-sky-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm"
        >
          {recomputing ? 'Recomputing...' : '✨ Recompute AI insights'}
        </button>
      </Reveal>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Reveal delay={0}>
          <StatCard label="Total tickets" value={totals.total} accent="blue" />
        </Reveal>
        <Reveal delay={60}>
          <StatCard label="Open" value={totals.open} accent="sky" />
        </Reveal>
        <Reveal delay={120}>
          <StatCard label="Resolved" value={totals.resolved} accent="emerald" />
        </Reveal>
        <Reveal delay={180}>
          <StatCard label="Needs review" value={totals.needsReview} accent="pink" />
        </Reveal>
      </div>

      {prediction && (
        <Reveal>
          <Card
            hover
            className="border-sky-200/70 dark:border-sky-500/30 bg-gradient-to-br from-sky-50 to-cyan-50/60 dark:from-slate-900 dark:to-slate-900"
            title="🔮 Predicted next ticket"
            subtitle="AI forecast grounded in recent ticket volume trends and real examples from the highest-signal category"
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <CategoryBadge category={prediction.category} />
              <SeverityBadge severity={prediction.severity} />
              <span className="text-xs text-slate-400">{prediction.team}</span>
              <span className="ml-auto text-xs font-medium text-sky-600 dark:text-sky-400">
                {Math.round(prediction.confidence * 100)}% confidence
              </span>
            </div>
            <p className="text-base text-slate-700 dark:text-slate-200 italic">"{prediction.predictedDescription}"</p>
            {prediction.rationale && (
              <p className="text-xs text-slate-400 mt-2 whitespace-pre-line">{prediction.rationale}</p>
            )}
          </Card>
        </Reveal>
      )}

      {risingScores.length > 0 && (
        <Reveal>
          <Card
            className="border-amber-300/60 dark:border-amber-500/30 bg-gradient-to-br from-amber-50/80 to-orange-50/40 dark:from-amber-500/10 dark:to-slate-900"
            title="⚠ Proactive risk flags"
            subtitle="Categories trending upward vs. the prior period — computed by the scheduled analysis job"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {risingScores.map((s) => (
                <div
                  key={s.category}
                  className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-white/80 dark:bg-slate-900 p-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{s.category}</span>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {s.priorCount} → {s.recentCount}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{s.recommendation}</p>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <Reveal className="lg:col-span-2">
          <Card title="Ticket volume" subtitle="Last 14 days">
            <VolumeChart volumeByDay={volumeByDay} />
          </Card>
        </Reveal>
        <Reveal delay={80}>
          <Card title="Severity breakdown">
            <SeverityChart severityBreakdown={severityBreakdown} />
          </Card>
        </Reveal>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Reveal className="lg:col-span-2">
          <Card title="Category performance" subtitle="Ticket count by category">
            <CategoryChart categoryPerformance={categoryPerformance} />
          </Card>
        </Reveal>
        <Reveal delay={80}>
          <Card title="Insights">
            <div className="space-y-4">
              <InsightRow
                label="Most common category"
                value={insights.mostCommonCategory?.category ?? '—'}
                detail={insights.mostCommonCategory ? `${insights.mostCommonCategory.total} tickets` : null}
              />
              <InsightRow
                label="Slowest to resolve"
                value={insights.slowestCategory?.category ?? '—'}
                detail={
                  insights.slowestCategory
                    ? `${formatMinutes(insights.slowestCategory.avgResolutionMinutes)} avg`
                    : null
                }
              />
              <InsightRow
                label="Risk scan last run"
                value={riskScores.computedAt ? new Date(riskScores.computedAt).toLocaleTimeString() : 'Not yet run'}
                detail={riskScores.computedAt ? new Date(riskScores.computedAt).toLocaleDateString() : null}
              />
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card title="Category performance table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Open</th>
                  <th className="py-2 pr-4 font-medium">Resolved</th>
                  <th className="py-2 pr-4 font-medium">Avg. resolution time</th>
                </tr>
              </thead>
              <tbody>
                {categoryPerformance.map((c) => (
                  <tr key={c.category} className="border-b border-slate-50 dark:border-slate-800/60">
                    <td className="py-2 pr-4 font-medium text-slate-700 dark:text-slate-200">{c.category}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.total}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.open}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.resolved}</td>
                    <td className="py-2 pr-4 text-slate-500">{formatMinutes(c.avgResolutionMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const accents = {
    blue: 'text-blue-500 dark:text-blue-400',
    sky: 'text-sky-500 dark:text-sky-400',
    emerald: 'text-emerald-500 dark:text-emerald-400',
    pink: 'text-pink-500 dark:text-pink-400',
  };
  return (
    <Card hover>
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className={`text-4xl font-semibold tracking-tight tabular-nums ${accents[accent]}`}>
        <Counter value={value} />
      </p>
    </Card>
  );
}

function InsightRow({ label, value, detail }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/60 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="text-right">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
        {detail && <p className="text-xs text-slate-400">{detail}</p>}
      </div>
    </div>
  );
}

function formatMinutes(minutes) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function VolumeChart({ volumeByDay }) {
  const data = {
    labels: volumeByDay.map((d) => new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Tickets submitted',
        data: volumeByDay.map((d) => d.count),
        borderColor: '#7dd3fc',
        backgroundColor: 'rgba(125, 211, 252, 0.25)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#38bdf8',
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: CHART_TEXT_COLOR }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: CHART_TEXT_COLOR, precision: 0 }, grid: { color: CHART_GRID_COLOR } },
    },
  };
  if (volumeByDay.length === 0) return <EmptyChart />;
  return <Line data={data} options={options} />;
}

function SeverityChart({ severityBreakdown }) {
  const order = ['Critical', 'High', 'Medium', 'Low'];
  const sorted = [...severityBreakdown].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const data = {
    labels: sorted.map((s) => s.severity),
    datasets: [
      {
        data: sorted.map((s) => s.count),
        backgroundColor: sorted.map((s) => SEVERITY_COLORS[s.severity] ?? '#94a3b8'),
        borderWidth: 0,
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { color: CHART_TEXT_COLOR, boxWidth: 10, padding: 12 } } },
    cutout: '65%',
  };
  if (severityBreakdown.length === 0) return <EmptyChart />;
  return <Doughnut data={data} options={options} />;
}

function CategoryChart({ categoryPerformance }) {
  const data = {
    labels: categoryPerformance.map((c) => c.category),
    datasets: [
      {
        label: 'Tickets',
        data: categoryPerformance.map((c) => c.total),
        backgroundColor: categoryPerformance.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: CHART_TEXT_COLOR }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: CHART_TEXT_COLOR, precision: 0 }, grid: { color: CHART_GRID_COLOR } },
    },
  };
  if (categoryPerformance.length === 0) return <EmptyChart />;
  return <Bar data={data} options={options} />;
}

function EmptyChart() {
  return <p className="text-sm text-slate-400 text-center py-10">Not enough data yet.</p>;
}
