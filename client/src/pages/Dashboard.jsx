import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, Doughnut } from 'react-chartjs-2';
import Card from '../components/Card.jsx';
import Reveal from '../components/Reveal.jsx';
import Counter from '../components/Counter.jsx';
import { SeverityBadge, CategoryBadge } from '../components/Badge.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import SupportingIncidentsModal from '../components/SupportingIncidentsModal.jsx';
import TerminologyGuideModal from '../components/TerminologyGuideModal.jsx';
import { CHART_TEXT_COLOR, CHART_GRID_COLOR, SEVERITY_COLORS } from '../components/charts.js';
import { getDashboardSummary, recomputeAll, getMeta } from '../api/client.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [recomputing, setRecomputing] = useState(false);

  // Filters (Priority 5: E15)
  const [daysFilter, setDaysFilter] = useState('14'); // '7' | '14' | '30' | 'all'
  const [teamFilter, setTeamFilter] = useState('all');

  // Modals state
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [supportingCategory, setSupportingCategory] = useState(null);
  const [inspectedTicket, setInspectedTicket] = useState(null);

  const load = useCallback(async () => {
    try {
      const [summary, metaData] = await Promise.all([
        getDashboardSummary({ days: daysFilter, team: teamFilter }),
        meta ? Promise.resolve(meta) : getMeta(),
      ]);
      setData(summary);
      if (!meta) setMeta(metaData);
    } catch {
      setError('Failed to load dashboard data.');
    }
  }, [daysFilter, teamFilter, meta]);

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

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return <p className="text-slate-400 text-sm">Loading dashboard...</p>;

  const { totals, severityBreakdown, volumeByDay, categoryPerformance, insights, riskScores, prediction } = data;
  const risingScores = riskScores?.scores?.filter((s) => s.rising) || [];

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Top Page Header */}
      <Reveal className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
              Operations Center
            </span>
            <span className="text-xs text-slate-400">• Real-Time Triage Telemetry</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tightest text-slate-900 dark:text-white">
            Operational Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-base md:text-lg">
            Proactive pattern detection, volume telemetry, AI incident forecast, and team workload.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setGuideModalOpen(true)}
            className="press inline-flex items-center gap-1.5 rounded-full glass border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            📖 Triage &amp; Risk Guide
          </button>
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="press inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white px-5 py-2 text-xs font-semibold hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 transition-all shadow-md shadow-sky-500/20"
          >
            {recomputing ? (
              <>
                <Spinner /> Recomputing...
              </>
            ) : (
              '✨ Recompute AI Insights'
            )}
          </button>
        </div>
      </Reveal>

      {/* Quick Jump Sub-Navigation & Filters Bar (Addresses E08, E34, and E15) */}
      <Reveal delay={40}>
        <div className="sticky top-16 z-20 rounded-2xl glass border border-white/70 dark:border-slate-800 p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
          {/* Section Jump Links */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5">
            <span className="text-slate-400 font-medium px-2">Jump to:</span>
            {[
              { id: 'section-kpi', label: '📊 Overview' },
              { id: 'section-risk', label: `⚠️ Proactive Risks (${risingScores.length})`, highlight: risingScores.length > 0 },
              { id: 'section-forecast', label: '🔮 AI Forecast' },
              { id: 'section-trends', label: '📈 Volume & Severity' },
              { id: 'section-performance', label: '🏷️ Category Performance' },
            ].map((nav) => (
              <button
                key={nav.id}
                onClick={() => scrollToSection(nav.id)}
                className={`px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${
                  nav.highlight
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </div>

          {/* Time & Team Filters (E15) */}
          <div className="flex items-center gap-2 text-xs">
            {/* Days Filter */}
            <div className="inline-flex rounded-full glass border border-slate-200 dark:border-slate-700 p-0.5">
              {[
                { id: '7', label: '7D' },
                { id: '14', label: '14D' },
                { id: '30', label: '30D' },
                { id: 'all', label: 'All' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDaysFilter(d.id)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
                    daysFilter === d.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Team Filter */}
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 px-3 py-1.5 outline-none focus:border-sky-400"
            >
              <option value="all">All Teams</option>
              {(meta?.teams || []).map((tm) => (
                <option key={tm} value={tm}>
                  {tm}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Reveal>

      {/* KPI Metric Cards */}
      <section id="section-kpi" className="scroll-mt-32">
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
            <Link to="/review" className="block" title="Click to view Review Queue">
              <StatCard label="Needs Review" value={totals.needsReview} accent="pink" />
            </Link>
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
      </section>

      {/* Proactive Risk Flags (Feature F6, Task 3: Addresses E21, E22, E27) */}
      <section id="section-risk" className="scroll-mt-32">
        <Reveal>
          <Card
            className="border-amber-300/80 dark:border-amber-500/30 bg-gradient-to-br from-amber-50/80 to-orange-50/40 dark:from-amber-500/10 dark:to-slate-900"
            title="⚠️ Proactive Pattern &amp; Anomaly Detection"
            subtitle="Automated surveillance flagging recurring spikes, volume surges, and emerging incident risks before they cascade"
          >
            {risingScores.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                ✅ No abnormal category surges detected in the current analysis window. Ticket patterns are within standard operational baselines.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4 mt-2">
                {risingScores.map((s) => {
                  const pctSurge =
                    s.priorCount > 0
                      ? Math.round(((s.recentCount - s.priorCount) / s.priorCount) * 100)
                      : 100;

                  return (
                    <div
                      key={s.category}
                      className="rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-white/95 dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                            {s.category}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                            +{pctSurge}% Surge
                          </span>
                        </div>

                        {/* Recommendation */}
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium mb-2.5">
                          {s.recommendation}
                        </p>

                        {/* Explicit Risk Calculation Formula (E21) */}
                        <div className="rounded-xl p-3 bg-amber-50/80 dark:bg-slate-800/60 border border-amber-200/60 dark:border-slate-800 text-xs space-y-1 mb-3">
                          <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                            <span>📐 Calculation Logic:</span>
                          </span>
                          <p className="text-slate-600 dark:text-slate-300 font-mono text-[11px] leading-relaxed">
                            {s.calculationDetails ||
                              `Surge: ${s.recentCount} tickets in past 7d vs ${s.priorCount} in prior 7d (+${pctSurge}%). Exceeds 1.25x (25%) threshold with ≥3 tickets.`}
                          </p>
                        </div>

                        {/* Suggested Next Operational Actions (E27) */}
                        {s.suggestedActionsList && s.suggestedActionsList.length > 0 && (
                          <div className="rounded-xl p-3 bg-sky-50/60 dark:bg-slate-800/40 border border-sky-100 dark:border-slate-800 text-xs space-y-1">
                            <span className="font-semibold text-sky-900 dark:text-sky-200">
                              🎯 Suggested Next Operational Actions:
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                              {s.suggestedActionsList.map((act, idx) => (
                                <li key={idx}>{act}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Supporting Incidents Inspect Action (E22) */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {s.recentCount} supporting tickets
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSupportingCategory(s.category)}
                            className="press text-xs font-semibold px-3 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition-all flex items-center gap-1"
                          >
                            🔍 Inspect Supporting Incidents →
                          </button>
                          <Link
                            to={`/tickets?category=${encodeURIComponent(s.category)}`}
                            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            All Tickets
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Reveal>
      </section>

      {/* AI Next Ticket Prediction (Feature F6) */}
      {prediction && (
        <section id="section-forecast" className="scroll-mt-32">
          <Reveal>
            <Card
              hover
              className="border-sky-300/80 dark:border-sky-500/30 bg-gradient-to-br from-sky-50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-900"
              title="🔮 AI Predictive Ticket Forecast"
              subtitle="Grounded in real volume velocity trends and actual recent tickets from the surging category"
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
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line bg-sky-50/50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-sky-100/50 dark:border-slate-800 flex-1">
                    <strong className="text-slate-700 dark:text-slate-300 font-semibold block mb-0.5">Forecast Rationale:</strong>
                    {prediction.rationale}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSupportingCategory(prediction.category)}
                    className="press text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline px-3 py-1"
                  >
                    Inspect {prediction.category} Incidents →
                  </button>
                </div>
              )}
            </Card>
          </Reveal>
        </section>
      )}

      {/* Charts Grid */}
      <section id="section-trends" className="scroll-mt-32">
        <div className="grid lg:grid-cols-3 gap-5">
          <Reveal className="lg:col-span-2">
            <Card
              title="Ticket Volume Trend"
              subtitle={`Daily ticket counts over the selected timeframe (${daysFilter === 'all' ? 'All Time' : `Last ${daysFilter} Days`})`}
            >
              <VolumeChart volumeByDay={volumeByDay} />
            </Card>
          </Reveal>
          <Reveal delay={80}>
            <Card title="Severity Distribution" subtitle="Priority breakdown for filtered tickets">
              <SeverityChart severityBreakdown={severityBreakdown} />
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Key Operational Insights (Distinguishing Volume vs Slow Resolution: E26) */}
      <Reveal delay={60}>
        <div className="grid sm:grid-cols-3 gap-4">
          <Card hover className="border-sky-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1 text-sky-600 dark:text-sky-400">
              <span className="text-xl">📈</span>
              <span className="text-xs font-bold uppercase tracking-wider">Volume Leader</span>
            </div>
            <p className="font-bold text-lg text-slate-900 dark:text-white">
              {insights?.mostCommonCategory?.category ?? '—'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {insights?.mostCommonCategory
                ? `${insights.mostCommonCategory.total.toLocaleString()} tickets (${insights.mostCommonCategory.volumeSharePct}% of total volume)`
                : 'No volume data'}
            </p>
          </Card>

          <Card hover className="border-amber-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1 text-amber-600 dark:text-amber-400">
              <span className="text-xl">⏱️</span>
              <span className="text-xs font-bold uppercase tracking-wider">Slowest Resolution</span>
            </div>
            <p className="font-bold text-lg text-slate-900 dark:text-white">
              {insights?.slowestCategory?.category ?? '—'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {insights?.slowestCategory
                ? `Avg ${formatMinutes(insights.slowestCategory.avgResolutionMinutes)} to resolve`
                : 'Need more resolved tickets'}
            </p>
          </Card>

          <Card hover className="border-emerald-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1 text-emerald-600 dark:text-emerald-400">
              <span className="text-xl">⚡</span>
              <span className="text-xs font-bold uppercase tracking-wider">Fastest Resolution</span>
            </div>
            <p className="font-bold text-lg text-slate-900 dark:text-white">
              {insights?.fastestCategory?.category ?? '—'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {insights?.fastestCategory
                ? `Avg ${formatMinutes(insights.fastestCategory.avgResolutionMinutes)} resolution`
                : 'Need more resolved tickets'}
            </p>
          </Card>
        </div>
      </Reveal>

      {/* Category Performance Breakdown Table (E26: Clearly separating Volume & Resolution Time) */}
      <section id="section-performance" className="scroll-mt-32">
        <Reveal>
          <Card
            title="Category Performance Breakdown"
            subtitle="Distinguishing ticket volume load, active backlogs, and resolution duration by category"
          >
            <div className="overflow-x-auto -mx-6 -mb-6 mt-4">
              <table className="w-full text-left text-sm border-t border-slate-100 dark:border-slate-800">
                <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Category Area</th>
                    <th className="py-3 px-4">Volume (Share)</th>
                    <th className="py-3 px-4">Active Open</th>
                    <th className="py-3 px-4">Resolved</th>
                    <th className="py-3 px-4">Avg Resolution Time</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categoryPerformance.map((c) => (
                    <tr key={c.category} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-6 font-medium text-slate-800 dark:text-slate-100">
                        <CategoryBadge category={c.category} />
                      </td>
                      <td className="py-3.5 px-4 tabular-nums">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {c.total.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400 ml-1.5">({c.volumeSharePct}%)</span>
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-sky-600 dark:text-sky-400 font-semibold">
                        {c.open.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-emerald-600 dark:text-emerald-400">
                        {c.resolved.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-slate-600 dark:text-slate-300">
                        <span className="font-medium">{formatMinutes(c.avgResolutionMinutes)}</span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setSupportingCategory(c.category)}
                            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            Inspect Incidents
                          </button>
                          <Link
                            to={`/tickets?category=${encodeURIComponent(c.category)}`}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            Filter All →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </section>

      {/* Modals */}
      {guideModalOpen && (
        <TerminologyGuideModal onClose={() => setGuideModalOpen(false)} />
      )}

      {supportingCategory && (
        <SupportingIncidentsModal
          category={supportingCategory}
          days={daysFilter === 'all' ? 30 : Number(daysFilter)}
          team={teamFilter}
          onClose={() => setSupportingCategory(null)}
          onSelectTicket={(ticket) => {
            setInspectedTicket(ticket);
          }}
        />
      )}

      {inspectedTicket && (
        <TicketDetailModal
          ticket={inspectedTicket}
          onClose={() => setInspectedTicket(null)}
        />
      )}
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

function formatMinutes(mins) {
  if (mins == null) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function VolumeChart({ volumeByDay }) {
  const data = {
    labels: volumeByDay.map((d) => d.day.slice(5)),
    datasets: [
      {
        label: 'Tickets',
        data: volumeByDay.map((d) => d.count),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: CHART_GRID_COLOR }, ticks: { color: CHART_TEXT_COLOR, font: { size: 10 } } },
      y: { grid: { color: CHART_GRID_COLOR }, ticks: { color: CHART_TEXT_COLOR, font: { size: 10 } }, beginAtZero: true },
    },
  };

  return (
    <div className="h-56 w-full">
      <Line data={data} options={options} />
    </div>
  );
}

function SeverityChart({ severityBreakdown }) {
  const labels = ['Low', 'Medium', 'High', 'Critical'];
  const counts = labels.map((l) => severityBreakdown.find((s) => s.severity === l)?.count ?? 0);

  const data = {
    labels,
    datasets: [
      {
        data: counts,
        backgroundColor: labels.map((l) => SEVERITY_COLORS[l] ?? '#94a3b8'),
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: CHART_TEXT_COLOR, boxWidth: 10, font: { size: 11 } },
      },
    },
    cutout: '65%',
  };

  return (
    <div className="h-56 w-full flex items-center justify-center">
      <Doughnut data={data} options={options} />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
