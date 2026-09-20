import { useState } from 'react';
import Card from '../components/Card.jsx';
import Reveal from '../components/Reveal.jsx';
import { SeverityBadge, CategoryBadge, ReviewBadge } from '../components/Badge.jsx';
import { createTicket } from '../api/client.js';

export default function SubmitTicket() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const ticket = await createTicket({ title: title.trim() || undefined, description: description.trim() });
      setResult(ticket);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Something went wrong submitting the ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Reveal className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tightest text-slate-900 dark:text-white">
          Submit a ticket
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-base md:text-lg max-w-xl mx-auto">
          Describe the issue and our AI triage engine will classify it, score its severity, and route it to the
          right team — instantly.
        </p>
      </Reveal>

      <Reveal delay={100}>
        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="title">
                Title <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary"
                className="w-full rounded-2xl border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                required
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what's happening, what you were trying to do, and any error messages..."
                className="w-full rounded-2xl border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 outline-none transition-all resize-none"
              />
            </div>

            {error && (
              <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="press w-full inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 disabled:from-slate-200 disabled:to-slate-200 disabled:cursor-not-allowed text-white font-medium text-[15px] px-6 py-3.5 transition-all shadow-lg shadow-sky-400/30 disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <Spinner /> Triaging with AI...
                </>
              ) : (
                'Submit ticket'
              )}
            </button>
          </form>
        </Card>
      </Reveal>

      {result && (
        <Reveal>
          <Card className="mt-5 border-sky-200 dark:border-sky-500/30" title="Triage result">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <CategoryBadge category={result.category} />
              <SeverityBadge severity={result.severity} />
              {result.needsReview && <ReviewBadge />}
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm mb-3">
              <dt className="text-slate-400">Routed team</dt>
              <dd className="text-slate-800 dark:text-slate-200 font-medium">{result.team}</dd>
              <dt className="text-slate-400">AI confidence</dt>
              <dd className="text-slate-800 dark:text-slate-200 font-medium">{Math.round(result.confidence * 100)}%</dd>
            </dl>
            {result.aiReasoning && (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic border-t border-slate-100 dark:border-slate-800 pt-3">
                "{result.aiReasoning}"
              </p>
            )}
            {result.needsReview ? (
              <p className="text-sm text-violet-600 dark:text-violet-400 mt-3">
                Confidence was below the threshold, so this ticket was sent to the human review queue instead of being
                auto-routed.
              </p>
            ) : (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3">
                Confidence met the threshold — this ticket was auto-routed to {result.team}.
              </p>
            )}
          </Card>
        </Reveal>
      )}
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
