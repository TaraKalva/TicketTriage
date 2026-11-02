import { useEffect, useState } from 'react';
import Card from '../components/Card.jsx';
import Reveal from '../components/Reveal.jsx';
import { SeverityBadge, CategoryBadge, EnvironmentBadge, SystemBadge } from '../components/Badge.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import { getMeta, listTickets, reviewTicket } from '../api/client.js';

export default function ReviewQueue() {
  const [tickets, setTickets] = useState(null);
  const [meta, setMeta] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [autoUpdatedTeam, setAutoUpdatedTeam] = useState({});
  const [sortBy, setSortBy] = useState('oldest'); // 'oldest' | 'newest' | 'lowest_confidence'
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [inspectTicket, setInspectTicket] = useState(null);

  async function load() {
    const [{ items }, metaData] = await Promise.all([
      listTickets({ needsReview: true, status: 'open', pageSize: 200, sortBy: 'submittedAt', sortOrder: 'ASC' }),
      getMeta(),
    ]);
    setTickets(items);
    setMeta(metaData);
    setDrafts(
      Object.fromEntries(
        items.map((t) => [
          t.id,
          {
            category: t.category,
            severity: t.severity,
            team: t.team,
            reviewNotes: '',
          },
        ])
      )
    );
  }

  useEffect(() => {
    load();
  }, []);

  function handleCategoryChange(id, newCategory) {
    const defaultTeam = meta?.defaultTeamByCategory?.[newCategory] || drafts[id]?.team;
    setDrafts((d) => ({
      ...d,
      [id]: {
        ...d[id],
        category: newCategory,
        team: defaultTeam,
      },
    }));
    setAutoUpdatedTeam((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setAutoUpdatedTeam((prev) => ({ ...prev, [id]: false }));
    }, 3000);
  }

  function updateDraft(id, field, value) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  function resetToSuggested(t) {
    setDrafts((d) => ({
      ...d,
      [t.id]: {
        category: t.originalCategory || t.aiCategory || t.category,
        severity: t.originalSeverity || t.aiSeverity || t.severity,
        team: t.originalTeam || t.aiTeam || t.team,
        reviewNotes: '',
      },
    }));
  }

  async function handleConfirm(t) {
    setSavingId(t.id);
    setError(null);
    setSuccessMsg(null);
    try {
      const selected = drafts[t.id];
      await reviewTicket(t.id, selected);
      setTickets((rows) => rows.filter((row) => row.id !== t.id));
      setSuccessMsg(`Ticket #${t.id.slice(0, 11)} successfully verified and routed to ${selected.team}!`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to save review.');
    } finally {
      setSavingId(null);
    }
  }

  if (tickets === null || !meta) {
    return <p className="text-slate-400 text-sm">Loading review queue...</p>;
  }

  // Apply sorting (E25: oldest pending reviews displayed first)
  const sortedTickets = [...tickets].sort((a, b) => {
    if (sortBy === 'oldest') {
      return new Date(a.submittedAt) - new Date(b.submittedAt);
    }
    if (sortBy === 'newest') {
      return new Date(b.submittedAt) - new Date(a.submittedAt);
    }
    if (sortBy === 'lowest_confidence') {
      return (a.confidence ?? 0.5) - (b.confidence ?? 0.5);
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tightest text-slate-900 dark:text-white">
              Review queue
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-base md:text-lg">
              Human-in-the-loop verification checkpoint for tickets requiring manual review before team dispatch.
            </p>
          </div>
          {tickets.length > 0 && (
            <div className="px-4 py-2 rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              {tickets.length} Pending Verification
            </div>
          )}
        </div>
      </Reveal>

      {/* Clear Explainer Banner (Addresses E31 & E32) */}
      <Reveal delay={40}>
        <div className="rounded-2xl border border-sky-200/80 dark:border-slate-800 bg-sky-50/70 dark:bg-slate-800/50 p-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1.5">
          <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>🛡️ Quality Assurance Protocol (Not Rejected Tickets)</span>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Tickets in this queue have <strong>NOT been rejected</strong>. They are valid customer issues held for human verification because their automated confidence score fell below{' '}
            <strong className="text-sky-600 dark:text-sky-400 font-semibold">{Math.round((meta.confidenceThreshold || 0.7) * 100)}%</strong>, or conflicting signals were detected. Confirm or adjust the category, severity, and team below to dispatch the ticket.
          </p>
        </div>
      </Reveal>

      {/* Toolbar: Queue Sorting (E25) */}
      <Reveal delay={60}>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/60 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Sort queue by:</span>
            <div className="inline-flex rounded-full glass border border-slate-200 dark:border-slate-700 p-0.5">
              {[
                { id: 'oldest', label: '⏳ Oldest First (Recommended)' },
                { id: 'newest', label: '🆕 Newest First' },
                { id: 'lowest_confidence', label: '📉 Lowest Confidence' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                    sortBy === opt.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-slate-400">
            Showing {sortedTickets.length} pending ticket{sortedTickets.length === 1 ? '' : 's'}
          </span>
        </div>
      </Reveal>

      {successMsg && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-sm px-4 py-3 flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {sortedTickets.length === 0 ? (
        <Reveal>
          <Card>
            <div className="text-center py-14">
              <p className="text-5xl mb-3">✅</p>
              <p className="font-semibold text-xl text-slate-800 dark:text-slate-100">Review queue is empty</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
                All submitted tickets have met the confidence threshold and been dispatched to their teams.
              </p>
            </div>
          </Card>
        </Reveal>
      ) : (
        <div className="space-y-4">
          {sortedTickets.map((t, i) => {
            const draft = drafts[t.id] || { category: t.category, severity: t.severity, team: t.team, reviewNotes: '' };
            const isCategoryChanged = draft.category !== (t.originalCategory || t.category);
            const isSeverityChanged = draft.severity !== (t.originalSeverity || t.severity);
            const isTeamChanged = draft.team !== (t.originalTeam || t.team);
            const hasModifications = isCategoryChanged || isSeverityChanged || isTeamChanged;

            return (
              <Reveal key={t.id} delay={Math.min(i, 6) * 50}>
                <Card hover className="border-slate-200 dark:border-slate-800">
                  <div className="grid lg:grid-cols-[1fr_310px] gap-6">
                    {/* Left Column: Ticket Details & AI Analysis */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CategoryBadge category={t.category} />
                        <SeverityBadge severity={t.severity} />
                        {t.environment && <EnvironmentBadge environment={t.environment} />}
                        {t.affectedSystem && <SystemBadge system={t.affectedSystem} />}
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Confidence: {Math.round((t.confidence ?? 0.5) * 100)}% (&lt;70%)
                        </span>
                      </div>

                      {t.title && (
                        <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                          {t.title}
                        </h3>
                      )}

                      <div className="rounded-xl p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {t.description}
                      </div>

                      {/* Technical error snippet if present */}
                      {t.errorDetails && (
                        <div className="text-xs bg-slate-900 text-sky-300 p-2.5 rounded-xl font-mono overflow-x-auto">
                          Error: {t.errorDetails}
                        </div>
                      )}

                      {/* Explicit Review Reason (Priority 2: E14, E32) */}
                      <div className="rounded-xl bg-amber-50/70 dark:bg-amber-500/10 p-3 border border-amber-200/70 dark:border-amber-500/20 text-xs">
                        <span className="font-semibold text-amber-900 dark:text-amber-200 block mb-0.5">
                          ⚠️ Reason for Human Review:
                        </span>
                        <p className="text-amber-800 dark:text-amber-300">
                          {t.reviewReason || `Confidence (${Math.round((t.confidence ?? 0.5) * 100)}%) is below 70% threshold. Symptoms require human validation.`}
                        </p>
                      </div>

                      {/* AI Decision Rationale */}
                      {t.aiReasoning && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          <strong className="text-slate-600 dark:text-slate-300 not-italic">AI Triage Note:</strong> "{t.aiReasoning}"
                        </p>
                      )}

                      {/* Audit History / Previous AI Suggestion (E20) */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <span>ID: <code className="font-mono">{t.id.slice(0, 16)}...</code></span>
                          <span>Submitted: {new Date(t.submittedAt).toLocaleString()}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectTicket(t)}
                          className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                        >
                          View Full Details →
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Review & Routing Controls */}
                    <div className="flex flex-col justify-between gap-3 lg:border-l lg:border-slate-100 lg:dark:border-slate-800 lg:pl-6 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl p-4 lg:p-0 lg:bg-transparent">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Routing Decision
                          </span>
                          {hasModifications && (
                            <button
                              type="button"
                              onClick={() => resetToSuggested(t)}
                              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium"
                            >
                              ↺ Reset to AI
                            </button>
                          )}
                        </div>

                        {/* Category Dropdown (E19: auto-updates assigned team) */}
                        <Field
                          label="Category"
                          hint={isCategoryChanged ? 'Modified by reviewer' : 'AI suggested'}
                        >
                          <select
                            value={draft.category}
                            onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                            className="w-full rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:border-sky-400 outline-none transition-all"
                          >
                            {meta.categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </Field>

                        {/* Severity Dropdown */}
                        <Field
                          label="Severity"
                          hint={isSeverityChanged ? 'Modified' : 'AI suggested'}
                        >
                          <select
                            value={draft.severity}
                            onChange={(e) => updateDraft(t.id, 'severity', e.target.value)}
                            className="w-full rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:border-sky-400 outline-none transition-all"
                          >
                            {meta.severities.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </Field>

                        {/* Assigned Team Dropdown */}
                        <Field
                          label="Assigned Team"
                          hint={
                            autoUpdatedTeam[t.id]
                              ? '⚡ Auto-updated for category'
                              : isTeamChanged
                              ? 'Modified'
                              : 'Recommended'
                          }
                        >
                          <select
                            value={draft.team}
                            onChange={(e) => updateDraft(t.id, 'team', e.target.value)}
                            className="w-full rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:border-sky-400 outline-none transition-all"
                          >
                            {meta.teams.map((tm) => (
                              <option key={tm} value={tm}>
                                {tm}
                              </option>
                            ))}
                          </select>
                        </Field>

                        {/* Audit Trail Note */}
                        {hasModifications && (
                          <div className="text-[11px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-slate-800/80 p-2 rounded-lg border border-sky-100 dark:border-slate-700">
                            <strong>Correction tracked:</strong> will log review changes to ticket audit trail.
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleConfirm(t)}
                        disabled={savingId === t.id}
                        className="press mt-3 w-full inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-3 transition-all shadow-md shadow-emerald-500/20"
                      >
                        {savingId === t.id ? 'Dispatching Ticket...' : '✓ Confirm & Route'}
                      </button>
                    </div>
                  </div>
                </Card>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* Full Ticket Inspection Modal */}
      {inspectTicket && (
        <TicketDetailModal
          ticket={inspectTicket}
          onClose={() => setInspectTicket(null)}
          onReview={() => {
            setInspectTicket(null);
          }}
        />
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block text-xs">
      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-medium mb-1">
        <span>{label}</span>
        {hint && <span className="text-[10px] text-sky-600 dark:text-sky-400 font-normal">{hint}</span>}
      </div>
      <div>{children}</div>
    </label>
  );
}
