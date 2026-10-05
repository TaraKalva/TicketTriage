import { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import Reveal from '../components/Reveal.jsx';
import { SeverityBadge, CategoryBadge, ReviewBadge } from '../components/Badge.jsx';
import { createTicket } from '../api/client.js';

const QUICK_SCENARIOS = [
  {
    label: '🔑 Login / Auth Failed (Task 1)',
    title: 'Account Authentication Failure',
    description: 'I cannot log in to my account. My password is correct, but I keep getting an authentication failed message.',
  },
  {
    label: '⚠️ Vague Ticket (Task 2 Review)',
    title: 'System Problem',
    description: 'The thing is not working today, please look into it as soon as possible.',
  },
  {
    label: '💥 Mobile App Crash (Critical)',
    title: 'App crash on iOS startup',
    description: 'The mobile app keeps crashing immediately upon launch with a fatal memory exception on iOS 18.',
  },
  {
    label: '💳 Duplicate Billing Charge',
    title: 'Charged twice this month',
    description: 'I was charged twice for my subscription this month on invoice #INV-9821. Requesting a refund for the duplicate charge.',
  },
];

export default function SubmitTicket() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function applyScenario(sc) {
    setTitle(sc.title);
    setDescription(sc.description);
    setResult(null);
    setError(null);
  }

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
      <Reveal className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tightest text-slate-900 dark:text-white">
          Submit a ticket
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-base md:text-lg max-w-xl mx-auto">
          Describe the issue and our AI triage engine will classify it, score its severity, and route it to the
          right team — instantly.
        </p>
      </Reveal>

      {/* Quick Test Scenarios */}
      <Reveal delay={50} className="mb-5">
        <div className="rounded-2xl border border-sky-100 dark:border-slate-800 bg-sky-50/50 dark:bg-slate-800/40 p-3.5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Quick test scenarios:
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SCENARIOS.map((sc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyScenario(sc)}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-slate-700 transition-all shadow-sm"
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
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
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                required
                rows={5}
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
                'Submit ticket for triage'
              )}
            </button>
          </form>
        </Card>
      </Reveal>

      {/* Triage Result Card */}
      {result && (
        <Reveal className="mt-6">
          <Card className="border-sky-300 dark:border-sky-500/40 shadow-xl overflow-hidden !p-0">
            {/* Header Routing Banner */}
            <div
              className={`px-6 py-4 flex items-center justify-between border-b ${
                result.needsReview
                  ? 'bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{result.needsReview ? '✋' : '🚀'}</span>
                <div>
                  <h3 className="font-semibold text-base leading-tight">
                    {result.needsReview ? 'Held for Human Review' : `Auto-Routed to ${result.team}`}
                  </h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    {result.needsReview
                      ? `Confidence score (${Math.round(result.confidence * 100)}%) is below the 70% threshold. Verification required.`
                      : `Confidence score (${Math.round(result.confidence * 100)}%) meets threshold. Ticket automatically dispatched.`}
                  </p>
                </div>
              </div>
              <div className="shrink-0 ml-3">
                {result.needsReview ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                    Needs Review
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
                    Auto-Dispatched
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Core Triaged Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Category</span>
                  <CategoryBadge category={result.category} />
                </div>
                <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Severity</span>
                  <SeverityBadge severity={result.severity} />
                </div>
                <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Assigned Team</span>
                  <span className="font-medium text-xs text-slate-800 dark:text-slate-100">{result.team}</span>
                </div>
                <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Confidence</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-sky-600 dark:text-sky-400">
                      {Math.round(result.confidence * 100)}%
                    </span>
                    <span className="text-[10px] text-slate-400">({result.confidence >= 0.7 ? '≥70%' : '<70%'})</span>
                  </div>
                </div>
              </div>

              {/* AI Reasoning */}
              {result.aiReasoning && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3.5 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    AI Triage Rationale
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                    "{result.aiReasoning}"
                  </p>
                </div>
              )}

              {/* Navigation Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400">
                  Ticket ID: <span className="font-mono">{result.id.slice(0, 16)}...</span>
                </span>
                <div className="flex gap-2">
                  {result.needsReview ? (
                    <Link
                      to="/review"
                      className="press inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 transition-all"
                    >
                      Open in Review Queue →
                    </Link>
                  ) : (
                    <Link
                      to="/tickets"
                      className="press inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md shadow-sky-500/20 hover:from-sky-600 hover:to-blue-600 transition-all"
                    >
                      View in All Tickets →
                    </Link>
                  )}
                </div>
              </div>
            </div>
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
