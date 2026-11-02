export default function TerminologyGuideModal({ onClose }) {
  const TERMS = [
    {
      term: 'Confidence Score (0% – 100%)',
      definition:
        'A numerical score produced by the triage engine indicating certainty based on clear keywords, technical error codes, and symptoms. High confidence (≥70%) auto-routes directly to engineering. Lower confidence (<70%) holds the ticket in the Review Queue for human confirmation.',
    },
    {
      term: 'Review Queue vs. Rejected Tickets',
      definition:
        'The Review Queue does NOT contain rejected tickets. It is a quality-assurance safety checkpoint holding ambiguous or low-confidence tickets until a support specialist confirms or adjusts the category, severity, and team assignment.',
    },
    {
      term: 'Proactive Risk Surge (+25% Threshold)',
      definition:
        'Triggered when a category exhibits at least 3 tickets in the past 7 days and volume has increased by at least 25% (1.25x) compared to the prior 7-day period. This alerts teams to emerging outages or regressions before they cascade.',
    },
    {
      term: 'AI Predictive Ticket Forecast',
      definition:
        'Grounds machine intelligence in real-time volume trends and actual recent tickets from the surging category to predict the next probable incoming incident description and target team.',
    },
    {
      term: 'Resolution Minutes & Resolution Rate',
      definition:
        'Resolution Minutes measures the elapsed time from ticket submission until resolution. Resolution Rate represents the proportion of total tickets marked resolved.',
    },
    {
      term: 'Default Team Mapping',
      definition:
        'Each category maps to a specialized engineering team (e.g. Account Access → Identity & Access Team; Bugs → Platform/API Team; Billing → Billing Team; Mobile App crashes → Mobile App Team).',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl my-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
              Operational Handbook
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
              TicketLens Triage &amp; Risk Metrics Guide
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Clear definitions of machine learning scores, confidence thresholds, and risk calculations.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          {TERMS.map((t, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
            >
              <h3 className="font-semibold text-xs sm:text-sm text-sky-700 dark:text-sky-300 mb-1">
                {t.term}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.definition}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
