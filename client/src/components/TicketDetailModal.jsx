import { useState } from 'react';
import { CategoryBadge, SeverityBadge, StatusBadge, ReviewBadge, EnvironmentBadge, SystemBadge } from './Badge.jsx';

export default function TicketDetailModal({ ticket, onClose, onResolve, onReopen, onDelete, onReview }) {
  const [copied, setCopied] = useState(false);

  if (!ticket) return null;

  function handleCopyId() {
    navigator.clipboard?.writeText(ticket.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const confidencePct = Math.round((ticket.confidence ?? ticket.aiConfidence ?? 0.5) * 100);
  const auditEvents = Array.isArray(ticket.auditTrail) ? ticket.auditTrail : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl my-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 sm:p-7 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                ID: {ticket.id}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
              >
                {copied ? '✓ Copied!' : 'Copy ID'}
              </button>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {ticket.title || 'Support Ticket Details'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Status & Attributes Ribbon */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          {ticket.needsReview ? <ReviewBadge /> : null}
          <CategoryBadge category={ticket.category} />
          <SeverityBadge severity={ticket.severity} />
          {ticket.environment && <EnvironmentBadge environment={ticket.environment} />}
          {ticket.affectedSystem && <SystemBadge system={ticket.affectedSystem} />}
        </div>

        {/* Triage Routing Banner */}
        <div
          className={`rounded-2xl p-4 border flex items-start gap-3.5 ${
            ticket.needsReview
              ? 'bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-900 dark:text-amber-200'
              : 'bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <span className="text-2xl shrink-0 mt-0.5">{ticket.needsReview ? '✋' : '🚀'}</span>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <span>{ticket.needsReview ? 'Held for Human Verification' : `Auto-Dispatched to ${ticket.team}`}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-900/50">
                Confidence: {confidencePct}%
              </span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed">
              {ticket.needsReview
                ? ticket.reviewReason || `Confidence (${confidencePct}%) is below 70% threshold. Human check required before final dispatch.`
                : `Confidence meets required triage threshold (≥70%). Assigned to ${ticket.team} with ${ticket.severity} severity.`}
            </p>
          </div>
        </div>

        {/* Ticket Description */}
        <div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
            Issue Description
          </span>
          <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {ticket.description}
          </div>
        </div>

        {/* Technical Context Section */}
        {(ticket.affectedSystem || ticket.environment || ticket.errorDetails || ticket.reproductionSteps) && (
          <div className="rounded-2xl p-4 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>⚙️ Technical Context</span>
            </span>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              {ticket.affectedSystem && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Affected System</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{ticket.affectedSystem}</span>
                </div>
              )}
              {ticket.environment && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Environment</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{ticket.environment}</span>
                </div>
              )}
            </div>

            {ticket.errorDetails && (
              <div>
                <span className="text-xs text-slate-400 block mb-1">Error Code / Log Details</span>
                <pre className="p-2.5 rounded-xl bg-slate-900 text-sky-300 font-mono text-xs overflow-x-auto">
                  {ticket.errorDetails}
                </pre>
              </div>
            )}

            {ticket.reproductionSteps && (
              <div>
                <span className="text-xs text-slate-400 block mb-1">Steps to Reproduce</span>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {ticket.reproductionSteps}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Triage Rationale */}
        {ticket.aiReasoning && (
          <div className="rounded-2xl p-4 bg-sky-50/60 dark:bg-slate-800/50 border border-sky-100 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              AI Triage Explanation &amp; Decision Basis
            </span>
            <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed">
              "{ticket.aiReasoning}"
            </p>
          </div>
        )}

        {/* Decision & Audit Trail */}
        {auditEvents.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
              Decision History &amp; Audit Trail
            </span>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {auditEvents.map((evt, idx) => (
                <div
                  key={idx}
                  className="rounded-xl p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs flex items-start gap-2.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <div className="space-y-0.5 w-full">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-200 font-medium">
                        {evt.actor || 'System'}
                      </strong>
                      <span>{new Date(evt.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {evt.details || evt.notes || evt.action}
                    </p>
                    {evt.changes && (
                      <p className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
                        {JSON.stringify(evt.changes)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata Footer Details */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
          <div>
            <dt className="text-slate-400">Assigned Team</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-200">{ticket.team}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Submitted At</dt>
            <dd className="text-slate-800 dark:text-slate-200">{new Date(ticket.submittedAt).toLocaleString()}</dd>
          </div>
          {ticket.reviewedAt && (
            <div>
              <dt className="text-slate-400">Human Verified At</dt>
              <dd className="text-slate-800 dark:text-slate-200">{new Date(ticket.reviewedAt).toLocaleString()}</dd>
            </div>
          )}
          {ticket.resolvedAt && (
            <div>
              <dt className="text-slate-400">Resolved At</dt>
              <dd className="text-slate-800 dark:text-slate-200">{new Date(ticket.resolvedAt).toLocaleString()}</dd>
            </div>
          )}
          {ticket.resolutionMinutes != null && (
            <div>
              <dt className="text-slate-400">Resolution Time</dt>
              <dd className="text-slate-800 dark:text-slate-200 font-medium">
                {ticket.resolutionMinutes > 60
                  ? `${(ticket.resolutionMinutes / 60).toFixed(1)} hours`
                  : `${ticket.resolutionMinutes} minutes`}
              </dd>
            </div>
          )}
        </dl>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
          {onDelete ? (
            <button
              onClick={() => onDelete(ticket.id)}
              className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
            >
              Delete Ticket
            </button>
          ) : <div />}

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            {onReview && ticket.needsReview && (
              <button
                onClick={() => onReview(ticket)}
                className="press px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 transition-all"
              >
                Review &amp; Route →
              </button>
            )}
            {ticket.status === 'open' && onResolve && (
              <button
                onClick={() => onResolve(ticket.id)}
                className="press px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all"
              >
                Mark Resolved
              </button>
            )}
            {ticket.status === 'resolved' && onReopen && (
              <button
                onClick={() => onReopen(ticket.id)}
                className="press px-4 py-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition-all"
              >
                Reopen Ticket
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
