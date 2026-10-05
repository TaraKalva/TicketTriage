import { useEffect, useState } from 'react';
import Card from '../components/Card.jsx';
import Reveal from '../components/Reveal.jsx';
import { SeverityBadge, CategoryBadge } from '../components/Badge.jsx';
import { getMeta, listTickets, reviewTicket } from '../api/client.js';

export default function ReviewQueue() {
  const [tickets, setTickets] = useState(null);
  const [meta, setMeta] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  async function load() {
    const [{ items }, metaData] = await Promise.all([listTickets({ needsReview: true, pageSize: 200 }), getMeta()]);
    setTickets(items);
    setMeta(metaData);
    setDrafts(
      Object.fromEntries(items.map((t) => [t.id, { category: t.category, severity: t.severity, team: t.team }]))
    );
  }

  useEffect(() => {
    load();
  }, []);

  function updateDraft(id, field, value) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  function resetToSuggested(t) {
    setDrafts((d) => ({
      ...d,
      [t.id]: {
        category: t.aiCategory || t.category,
        severity: t.aiSeverity || t.severity,
        team: t.aiTeam || t.team,
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

  return (
    <div>
      <Reveal className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tightest text-slate-900 dark:text-white">
              Review queue
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-base md:text-lg">
              Tickets requiring human verification before routing to engineering teams.
            </p>
          </div>
          {tickets.length > 0 && (
            <div className="px-4 py-2 rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {tickets.length} Pending Review
            </div>
          )}
        </div>
      </Reveal>

      {/* Instructional Info Banner */}
      <Reveal delay={40} className="mb-6">
        <div className="rounded-2xl border border-sky-200/70 dark:border-slate-800 bg-sky-50/60 dark:bg-slate-800/40 p-4 text-xs md:text-sm text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
            <span>ℹ️ Human-in-the-Loop Protocol</span>
          </p>
          TicketLens holds tickets when AI classification confidence is under{' '}
          <strong className="text-sky-600 dark:text-sky-400">{Math.round((meta.confidenceThreshold || 0.7) * 100)}%</strong>.
          Support staff can review the AI suggestion, make any necessary adjustments to category, severity, or team,
          and click <strong>Confirm & Route</strong>.
        </div>
      </Reveal>

      {successMsg && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-sm px-4 py-3 mb-5 flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {tickets.length === 0 ? (
        <Reveal>
          <Card>
            <div className="text-center py-14">
              <p className="text-5xl mb-3">✅</p>
              <p className="font-semibold text-xl text-slate-800 dark:text-slate-100">Review queue is empty</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
                All triaged tickets have met the confidence threshold and been auto-routed.
              </p>
            </div>
          </Card>
        </Reveal>
      ) : (
        <div className="space-y-4">
          {tickets.map((t, i) => (
            <Reveal key={t.id} delay={Math.min(i, 6) * 50}>
              <Card hover className="border-slate-200 dark:border-slate-800">
                <div className="grid lg:grid-cols-[1fr_280px] gap-6">
                  {/* Left Column: Ticket Details & AI Analysis */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <CategoryBadge category={t.aiCategory || t.category} />
                      <SeverityBadge severity={t.aiSeverity || t.severity} />
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Confidence: {Math.round((t.aiConfidence ?? t.confidence ?? 0.5) * 100)}% (&lt;70%)
                      </span>
                    </div>

                    {t.title && <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 mb-1">{t.title}</h3>}
                    <div className="rounded-xl p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {t.description}
                    </div>

                    {t.aiReasoning && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-2.5">
                        <strong className="text-slate-600 dark:text-slate-300 not-italic">AI Note:</strong> "{t.aiReasoning}"
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span>ID: <code className="font-mono">{t.id}</code></span>
                      <span>Submitted: {new Date(t.submittedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Right Column: Human Review & Correction Controls */}
                  <div className="flex flex-col justify-between gap-3 lg:border-l lg:border-slate-100 lg:dark:border-slate-800 lg:pl-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl p-3.5 lg:p-0 lg:bg-transparent">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Review & Routing
                        </span>
                        <button
                          type="button"
                          onClick={() => resetToSuggested(t)}
                          className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          Reset to AI
                        </button>
                      </div>

                      <Field label="Category">
                        <Select
                          value={drafts[t.id]?.category}
                          onChange={(v) => updateDraft(t.id, 'category', v)}
                          options={meta.categories}
                        />
                      </Field>
                      <Field label="Severity">
                        <Select
                          value={drafts[t.id]?.severity}
                          onChange={(v) => updateDraft(t.id, 'severity', v)}
                          options={meta.severities}
                        />
                      </Field>
                      <Field label="Assigned Team">
                        <Select
                          value={drafts[t.id]?.team}
                          onChange={(v) => updateDraft(t.id, 'team', v)}
                          options={meta.teams}
                        />
                      </Field>
                    </div>

                    <button
                      onClick={() => handleConfirm(t)}
                      disabled={savingId === t.id}
                      className="press mt-3 w-full inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 transition-all shadow-md shadow-emerald-500/20"
                    >
                      {savingId === t.id ? 'Routing Ticket...' : '✓ Confirm & Route'}
                    </button>
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-xs">
      <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 outline-none transition-all"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
