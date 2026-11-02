import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import Reveal from '../components/Reveal.jsx';
import { SeverityBadge, CategoryBadge, EnvironmentBadge, SystemBadge } from '../components/Badge.jsx';
import TicketDetailModal from '../components/TicketDetailModal.jsx';
import { createTicket, getMeta } from '../api/client.js';

const QUICK_SCENARIOS = [
  {
    label: '🔑 Login / Auth Failed (Task 1)',
    title: 'Account Authentication Failure',
    description: 'I cannot log in to my account. My password is correct, but I keep getting an authentication failed message.',
    affectedSystem: 'Authentication / SSO',
    environment: 'Production',
    errorDetails: 'HTTP 401: Invalid session credential token',
    reproductionSteps: '1. Navigate to login portal\n2. Enter valid user credentials\n3. Click Sign In -> Error displays',
  },
  {
    label: '⚠️ Vague Ticket (Task 2 Review)',
    title: 'System Problem',
    description: 'The thing is not working today, please look into it as soon as possible.',
    affectedSystem: '',
    environment: '',
    errorDetails: '',
    reproductionSteps: '',
  },
  {
    label: '💥 Mobile App Crash (Critical)',
    title: 'App crash on iOS startup',
    description: 'The mobile app keeps crashing immediately upon launch with a fatal memory exception on iOS 18.',
    affectedSystem: 'Mobile App (iOS/Android)',
    environment: 'Production',
    errorDetails: 'EXC_BAD_ACCESS (SIGSEGV) in UIWindowScene render',
    reproductionSteps: '1. Launch app on iOS 18 device\n2. Splash screen displays for 1 second\n3. App terminates abruptly',
  },
  {
    label: '💳 Duplicate Billing Charge',
    title: 'Charged twice this month',
    description: 'I was charged twice for my subscription this month on invoice #INV-9821. Requesting a refund for the duplicate charge.',
    affectedSystem: 'Billing & Payments',
    environment: 'Production',
    errorDetails: 'Duplicate transaction IDs: TXN_8921A and TXN_8921B',
    reproductionSteps: 'Auto-renewed on 1st of month with double debit.',
  },
];

export default function SubmitTicket() {
  const [meta, setMeta] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [affectedSystem, setAffectedSystem] = useState('');
  const [environment, setEnvironment] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [showTechnicalFields, setShowTechnicalFields] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    getMeta().then(setMeta).catch(() => {});
  }, []);

  function applyScenario(sc) {
    setTitle(sc.title);
    setDescription(sc.description);
    setAffectedSystem(sc.affectedSystem || '');
    setEnvironment(sc.environment || '');
    setErrorDetails(sc.errorDetails || '');
    setReproductionSteps(sc.reproductionSteps || '');
    if (sc.affectedSystem || sc.environment || sc.errorDetails) {
      setShowTechnicalFields(true);
    }
    setResult(null);
    setError(null);
  }

  function handleCopyId(id) {
    navigator.clipboard?.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const ticket = await createTicket({
        title: title.trim() || undefined,
        description: description.trim(),
        affectedSystem: affectedSystem.trim() || undefined,
        environment: environment.trim() || undefined,
        errorDetails: errorDetails.trim() || undefined,
        reproductionSteps: reproductionSteps.trim() || undefined,
      });
      setResult(ticket);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Something went wrong submitting the ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetForm() {
    setTitle('');
    setDescription('');
    setAffectedSystem('');
    setEnvironment('');
    setErrorDetails('');
    setReproductionSteps('');
    setResult(null);
    setError(null);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Reveal className="text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tightest text-slate-900 dark:text-white">
          Submit a ticket
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-base md:text-lg max-w-xl mx-auto">
          Describe the issue. TicketLens AI evaluates symptoms, technical context, and confidence score to auto-route or hold for review.
        </p>
      </Reveal>

      {/* Quick Test Scenarios */}
      <Reveal delay={50}>
        <div className="rounded-2xl border border-sky-100 dark:border-slate-800 bg-sky-50/50 dark:bg-slate-800/40 p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Quick test scenarios (Click to load):
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SCENARIOS.map((sc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyScenario(sc)}
                className="press text-xs font-medium px-3.5 py-1.5 rounded-full border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-slate-700 transition-all shadow-sm"
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
                placeholder="Short summary (e.g. Account Authentication Failure)"
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
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what's happening, what you were trying to do, and any error messages..."
                className="w-full rounded-2xl border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 outline-none transition-all resize-none"
              />
            </div>

            {/* Optional Technical Context Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowTechnicalFields(!showTechnicalFields)}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1.5"
              >
                <span>{showTechnicalFields ? '▼ Hide' : '▶ Add'} Technical Context</span>
                <span className="text-slate-400 font-normal">(system, environment, error logs, reproduction steps)</span>
              </button>

              {showTechnicalFields && (
                <div className="mt-3.5 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-4 animate-fadeIn">
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Affected System / Service
                      </label>
                      <input
                        list="systems-list"
                        type="text"
                        value={affectedSystem}
                        onChange={(e) => setAffectedSystem(e.target.value)}
                        placeholder="e.g. Authentication / SSO, Mobile App"
                        className="w-full rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-sky-400"
                      />
                      <datalist id="systems-list">
                        {(meta?.systems || []).map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Environment
                      </label>
                      <select
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value)}
                        className="w-full rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-sky-400"
                      >
                        <option value="">Select Environment (optional)</option>
                        {(meta?.environments || ['Production', 'Staging', 'Development', 'Internal']).map((env) => (
                          <option key={env} value={env}>
                            {env}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Error Code / Error Message / Stack Trace
                    </label>
                    <input
                      type="text"
                      value={errorDetails}
                      onChange={(e) => setErrorDetails(e.target.value)}
                      placeholder="e.g. HTTP 401, AUTH_FAILED_TOKEN, EXC_BAD_ACCESS"
                      className="w-full rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-sky-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Steps to Reproduce
                    </label>
                    <textarea
                      rows={2}
                      value={reproductionSteps}
                      onChange={(e) => setReproductionSteps(e.target.value)}
                      placeholder="1. Go to... 2. Click... 3. Notice error..."
                      className="w-full rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-sky-400 resize-none"
                    />
                  </div>
                </div>
              )}
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
                  <Spinner /> Triaging with AI Engine...
                </>
              ) : (
                'Submit ticket for triage'
              )}
            </button>
          </form>
        </Card>
      </Reveal>

      {/* Submission Confirmation & Triage Result (Priority 1: E02, E03, E18, E29) */}
      {result && (
        <Reveal className="mt-8 animate-fadeIn">
          <Card className="border-sky-300 dark:border-sky-500/40 shadow-xl overflow-hidden !p-0">
            {/* Confirmation Banner */}
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">
                  ✓
                </span>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    Ticket Submitted Successfully!
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-sky-100">
                    <span>ID: <code className="font-mono bg-black/20 px-1.5 py-0.5 rounded">{result.id}</code></span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(result.id)}
                      className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors"
                    >
                      {copiedId ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectModalOpen(true)}
                className="press inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-white text-sky-700 hover:bg-sky-50 shadow-md transition-all"
              >
                🔍 Open Full Ticket Details
              </button>
            </div>

            {/* Sub-Banner Routing Status */}
            <div
              className={`px-6 py-3 flex items-center justify-between border-b ${
                result.needsReview
                  ? 'bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{result.needsReview ? '✋' : '🚀'}</span>
                <div>
                  <span className="font-semibold text-xs sm:text-sm">
                    {result.needsReview ? 'Triage Result: Held for Human Review' : `Triage Result: Auto-Routed to ${result.team}`}
                  </span>
                  <p className="text-xs opacity-80">
                    {result.needsReview
                      ? result.reviewReason || `Confidence (${Math.round(result.confidence * 100)}%) is under the 70% threshold. Verification needed.`
                      : `Confidence score (${Math.round(result.confidence * 100)}%) meets threshold. Dispatched immediately.`}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-800 shadow-sm">
                Confidence: {Math.round(result.confidence * 100)}%
              </span>
            </div>

            <div className="p-6 space-y-5">
              {/* Core Triaged Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Suggested Category</span>
                  <CategoryBadge category={result.category} />
                </div>
                <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Assessed Severity</span>
                  <SeverityBadge severity={result.severity} />
                </div>
                <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Target Team</span>
                  <span className="font-medium text-xs text-slate-800 dark:text-slate-100">{result.team}</span>
                </div>
                <div className="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Review Status</span>
                  {result.needsReview ? (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Needs Review</span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Auto-Dispatched</span>
                  )}
                </div>
              </div>

              {/* Technical Context Tags if submitted */}
              {(result.affectedSystem || result.environment) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {result.environment && <EnvironmentBadge environment={result.environment} />}
                  {result.affectedSystem && <SystemBadge system={result.affectedSystem} />}
                </div>
              )}

              {/* AI Reasoning */}
              {result.aiReasoning && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3.5 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    AI Triage Rationale &amp; Decision Basis
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic">
                    "{result.aiReasoning}"
                  </p>
                </div>
              )}

              {/* Navigation Action Buttons */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
                >
                  + Submit Another Ticket
                </button>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setInspectModalOpen(true)}
                    className="press inline-flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    View Details Modal
                  </button>
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

      {/* Ticket Detail Modal */}
      {inspectModalOpen && result && (
        <TicketDetailModal
          ticket={result}
          onClose={() => setInspectModalOpen(false)}
        />
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
