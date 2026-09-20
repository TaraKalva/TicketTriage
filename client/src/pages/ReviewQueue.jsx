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

  async function handleConfirm(id) {
    setSavingId(id);
    setError(null);
    try {
      await reviewTicket(id, drafts[id]);
      setTickets((rows) => rows.filter((t) => t.id !== id));
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
      <Reveal className="mb-10">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tightest text-slate-900 dark:text-white">
          Review queue
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base md:text-lg">
          Tickets the AI wasn't confident about. Confirm or correct the classification before it's routed.
        </p>
      </Reveal>

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
              <p className="font-medium text-lg text-slate-700 dark:text-slate-200">Review queue is empty</p>
              <p className="text-sm text-slate-400 mt-1">Every triaged ticket met the confidence threshold.</p>
            </div>
          </Card>
        </Reveal>
      ) : (
        <div className="space-y-4">
          {tickets.map((t, i) => (
            <Reveal key={t.id} delay={Math.min(i, 6) * 60}>
              <Card hover>
                <div className="grid md:grid-cols-[1fr_auto] gap-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <CategoryBadge category={t.aiCategory} />
                      <SeverityBadge severity={t.aiSeverity} />
                      <span className="text-xs text-slate-400">AI confidence: {Math.round(t.aiConfidence * 100)}%</span>
                    </div>
                    {t.title && <p className="font-medium text-slate-800 dark:text-slate-100">{t.title}</p>}
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t.description}</p>
                    {t.aiReasoning && (
                      <p className="text-xs text-slate-400 italic mt-2">AI note: "{t.aiReasoning}"</p>
                    )}
                    <p className="text-xs text-slate-400 mt-2">Submitted {new Date(t.submittedAt).toLocaleString()}</p>
                  </div>

                  <div className="w-full md:w-56 flex flex-col gap-2.5 md:border-l md:border-slate-100 md:dark:border-slate-800 md:pl-5">
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
                    <Field label="Team">
                      <Select
                        value={drafts[t.id]?.team}
                        onChange={(v) => updateDraft(t.id, 'team', v)}
                        options={meta.teams}
                      />
                    </Field>
                    <button
                      onClick={() => handleConfirm(t.id)}
                      disabled={savingId === t.id}
                      className="press mt-1 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 transition-all shadow-md shadow-sky-400/25"
                    >
                      {savingId === t.id ? 'Saving...' : 'Confirm & route'}
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
      <span className="text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-sm focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 outline-none transition-all"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
