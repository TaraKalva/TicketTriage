import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
            Operational Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-base md:text-lg">
            Real-time ticket triage metrics, volume trends, proactive risk flags, and AI predictive insights.
          </p>
        </div>
        <button
          onClick={handleRecompute}
          disabled={recomputing}
          className="press inline-flex items-center gap-1.5 rounded-full glass border border-white/60 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-sky-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm"
        >
          {recomputing ? (
            <>
              <Spinner /> Recomputing...
            </>
          ) : (
            '✨ Recompute AI Insights'
          )}
        </button>
      </Reveal>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Reveal delay={0}>
          <StatCard label="Total Tickets" value={totals.total} accent="blue" />
        </Reveal>
        <Reveal delay={50}>
          <StatCard label="Open Tickets" value={totals.open} accent="sky" />
        </Reveal>
        <Reveal delay={100}>
          <StatCard label="Resolved Tickets" value={totals.resolved} accent="emerald" />
        </Reveal>
        <Reveal delay={150}>
          <StatCard label="Needs Review" value={totals.needsReview} accent="pink" />
        </Reveal>
        <Reveal delay={200}>
          <Card hover>
            <p className="text-sm text-slate-400 mb-1">Avg Resolution</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-indigo-500 dark:text-indigo-400">
              {formatMinutes(totals.avgResolutionMinutes)}
            </p>
          </Card>
        </Reveal>
      </div>

      {/* Proactive Risk Flags (Feature F6 & Task 3) */}
      {risingScores.length > 0 && (
        <Reveal>
          <Card
            className="border-amber-300/80 dark:border-amber-500/30 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-500/10 dark:to-slate-900"
            title="⚠️ Proactive Pattern & Risk Detection"
            subtitle="Categories with surging ticket volume vs. prior period — flagged to prevent larger operational incidents"
          >
            <div className="grid sm:grid-cols-2 gap-4 mt-2">
              {risingScores.map((s) => {
                const pctSurge = s.priorCount > 0 ? Math.round(((s.recentCount - s.priorCount) / s.priorCount) * 100) : 100;
                return (
                  <div
                    key={s.category}
                    className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-white/90 dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                          {s.category}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                          +{pctSurge}% Surge
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Volume increased from <strong className="text-slate-700 dark:text-slate-200">{s.priorCount}</strong> (prior 7 days) to <strong className="text-amber-600 dark:text-amber-400">{s.recentCount}</strong> (last 7 days).
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {s.recommendation}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Actionable triage lead</span>
                      <Link
                        to={`/tickets?category=${encodeURIComponent(s.category)}`}
                        className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 flex items-center gap-1"
                      >
                        Investigate Tickets →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
      )}

      {/* AI Next Ticket Prediction (Feature F6) */}
      {prediction && (
        <Reveal>
          <Card
            hover
            className="border-sky-300/80 dark:border-sky-500/30 bg-gradient-to-br from-sky-50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-900"
            title="🔮 AI Predictive Ticket Forecast"
            subtitle="Forecast grounded in recent ticket volume trends and ground-truth patterns from the highest-signal category"
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <CategoryBadge category={prediction.category} />
              <SeverityBadge severity={prediction.severity} />
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                Target Team: {prediction.team}
              </span>
              <span className="ml-auto text-xs font-semibold text-sky-600 dark:text-sky-400">
                {Math.round(prediction.confidence * 100)}% Confidence
              </span>
            </div>
            <div className="rounded-xl p-3.5 bg-white/80 dark:bg-slate-800/80 border border-sky-100 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Predicted Incoming Description
              </p>
              <p className="text-base text-slate-800 dark:text-slate-200 italic font-medium">
                "{prediction.predictedDescription}"
              </p>
            </div>
            {prediction.rationale && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 whitespace-pre-line bg-sky-50/50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-sky-100/50 dark:border-slate-800">
                <strong className="text-slate-700 dark:text-slate-300 font-semibold block mb-0.5">Forecast Rationale:</strong>
                {prediction.rationale}
              </p>
            )}
          </Card>
        </Reveal>
      )}

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Reveal className="lg:col-span-2">
          <Card title="Ticket Volume Trend" subtitle="Daily ticket counts over the last 14 days">
            <VolumeChart volumeByDay={volumeByDay} />
          </Card>
        </Reveal>
        <Reveal delay={80}>
          <Card title="Severity Distribution" subtitle="All-time ticket priority breakdown">
            <SeverityChart severityBreakdown={severityBreakdown} />
          </Card>
        </Reveal>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Reveal className="lg:col-span-2">
          <Card title="Category Performance" subtitle="Total volume, active tickets, and resolution metrics by area">
            <CategoryChart categoryPerformance={categoryPerformance} />
          </Card>
        </Reveal>

        <Reveal delay={80}>
          <Card title="Key Operational Insights" subtitle="Highlights from triage metrics">
            <div className="space-y-4 pt-2">
              <InsightRow
                label="Highest Volume Area"
                value={insights?.mostCommonCategory?.category ?? '—'}
                detail={insights?.mostCommonCategory ? `${insights.mostCommonCategory.total.toLocaleString()} total tickets` : null}
              />
              <InsightRow
                label="Longest Resolution Time"
                value={insights?.slowestCategory?.category ?? '—'}
                detail={insights?.slowestCategory ? `Avg ${formatMinutes(insights.slowestCategory.avgResolutionMinutes)}` : null}
              />
              <InsightRow
                label="Resolution Rate"
                value={totals.total > 0 ? `${Math.round((totals.resolved / totals.total) * 100)}%` : '—'}
                detail={`${totals.resolved.toLocaleString()} of ${totals.total.toLocaleString()} resolved`}
              />
              <InsightRow
                label="Review Queue Backlog"
                value={`${totals.needsReview} tickets`}
                detail="Awaiting human confirmation"
              />
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Category Performance Data Table */}
      <Reveal>
        <Card title="Category Breakdown Table" subtitle="Detailed resolution and status statistics per category">
          <div className="overflow-x-auto -mx-6 -mb-6 mt-4">
            <table className="w-full text-left text-sm border-t border-slate-100 dark:border-slate-800">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Open</th>
                  <th className="py-3 px-4">Resolved</th>
                  <th className="py-3 px-4">Avg Resolution</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categoryPerformance.map((c) => (
                  <tr key={c.category} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-800 dark:text-slate-100">
                      <CategoryBadge category={c.category} />
                    </td>
                    <td className="py-3.5 px-4 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {c.total.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums text-sky-600 dark:text-sky-400">{c.open.toLocaleString()}</td>
                    <td className="py-3.5 px-4 tabular-nums text-emerald-600 dark:text-emerald-400">
                      {c.resolved.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums text-slate-600 dark:text-slate-300">
                      {formatMinutes(c.avgResolutionMinutes)}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <Link
                        to={`/tickets?category=${encodeURIComponent(c.category)}`}
                        className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        View Tickets →
                      </Link>
                    </td>
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
      <p className={`text-3xl font-semibold tracking-tight tabular-nums ${accents[accent]}`}>
        <Counter value={value} />
      </p>
    </Card>
  );
}

function InsightRow({ label, value, detail }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <div className="text-right">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
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
    labels: volumeByDay.map((d) => new Date(d.day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Tickets Submitted',
        data: volumeByDay.map((d) => d.count),
        borderColor: '#0284c7',
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#0284c7',
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: CHART_TEXT_COLOR, font: { size: 11 } }, grid: { display: false } },
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
      x: { ticks: { color: CHART_TEXT_COLOR, font: { size: 11 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: CHART_TEXT_COLOR, precision: 0 }, grid: { color: CHART_GRID_COLOR } },
    },
  };
  if (categoryPerformance.length === 0) return <EmptyChart />;
  return <Bar data={data} options={options} />;
}

function EmptyChart() {
  return <p className="text-sm text-slate-400 text-center py-10">Not enough data yet.</p>;
}

function Spinner() {
  return (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
