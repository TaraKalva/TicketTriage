import { useState, useEffect } from 'react';
import { getSupportingTickets } from '../api/client.js';
import { CategoryBadge, SeverityBadge, StatusBadge } from './Badge.jsx';

export default function SupportingIncidentsModal({ category, days = 14, team = null, onClose, onSelectTicket }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getSupportingTickets(category, days, team);
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setError('Failed to load supporting incident tickets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [category, days, team]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl my-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Pattern Evidence Audit
              </span>
              <CategoryBadge category={category} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Supporting Incidents &amp; Evidence ({data?.total ?? 0} Tickets)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tickets submitted in the past {days} days that triggered this operational pattern detection.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        {loading && (
          <div className="py-12 text-center text-sm text-slate-400">
            <span className="inline-block animate-spin mr-2">⏳</span> Loading supporting incidents...
          </div>
        )}

        {error && (
          <div className="rounded-2xl p-4 bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        {!loading && data && data.tickets.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm">
            No incident tickets found matching the specified timeframe.
          </div>
        )}

        {!loading && data && data.tickets.length > 0 && (
          <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Ticket ID / Title</th>
                  <th className="py-2.5 px-3 font-semibold">Severity</th>
                  <th className="py-2.5 px-3 font-semibold">Team</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Submitted</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTicket(t)}
                    className="hover:bg-sky-50/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                        {t.title || t.description.slice(0, 50)}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{t.id.slice(0, 16)}...</span>
                      {t.affectedSystem && (
                        <span className="ml-2 text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                          • {t.affectedSystem}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <SeverityBadge severity={t.severity} />
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {t.team}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(t.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTicket(t);
                        }}
                        className="text-sky-600 dark:text-sky-400 font-semibold hover:underline"
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-400">
            Click any row to open the complete ticket detail screen.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
