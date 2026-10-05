import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/Card.jsx';
import Reveal from '../components/Reveal.jsx';
import { SeverityBadge, StatusBadge, CategoryBadge, ReviewBadge } from '../components/Badge.jsx';
import { getMeta, listTickets, resolveTicket, reopenTicket, deleteTicket } from '../api/client.js';

const STATUS_OPTIONS = ['all', 'open', 'resolved'];
const PAGE_SIZE = 25;

export default function AllTickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialStatus = searchParams.get('status') || 'all';

  const [tickets, setTickets] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState(initialCategory);
  const [severity, setSeverity] = useState('all');
  const [team, setTeam] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);

  async function load() {
    const params = { page, pageSize: PAGE_SIZE };
    if (status !== 'all') params.status = status;
    if (category !== 'all') params.category = category;
    if (severity !== 'all') params.severity = severity;
    if (team !== 'all') params.team = team;
    if (search.trim()) params.search = search.trim();

    const [result, metaData] = await Promise.all([listTickets(params), meta ? Promise.resolve(meta) : getMeta()]);
    setTickets(result.items);
    setTotal(result.total);
    setTotalPages(result.totalPages);
    if (!meta) setMeta(metaData);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, severity, team, search, page]);

  function updateFilter(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    updateFilter(setSearch)(searchInput);
  }

  function handleResetFilters() {
    setStatus('all');
    setCategory('all');
    setSeverity('all');
    setTeam('all');
    setSearch('');
    setSearchInput('');
    setPage(1);
    setSearchParams({});
  }

  async function handleResolve(id) {
    setBusyId(id);
    try {
      const updated = await resolveTicket(id);
      setTickets((rows) => rows.map((t) => (t.id === id ? updated : t)));
      if (selectedTicket?.id === id) setSelectedTicket(updated);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReopen(id) {
    setBusyId(id);
    try {
      const updated = await reopenTicket(id);
      setTickets((rows) => rows.map((t) => (t.id === id ? updated : t)));
      if (selectedTicket?.id === id) setSelectedTicket(updated);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this ticket permanently?')) return;
    setBusyId(id);
    try {
      await deleteTicket(id);
      if (selectedTicket?.id === id) setSelectedTicket(null);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tightest text-slate-900 dark:text-white">
            All tickets
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-base md:text-lg">
            {total.toLocaleString()} ticket{total === 1 ? '' : 's'} — central repository to filter, inspect, and manage status.
          </p>
        </div>
      </Reveal>

      {/* Filter Toolbar */}
      <Reveal delay={60}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* Status Segmented Control */}
          <div className="inline-flex rounded-full glass border border-white/60 dark:border-slate-700 p-1 shadow-sm">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => updateFilter(setStatus)(s)}
                className={`press rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  status === s
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => updateFilter(setCategory)(e.target.value)}
            className="rounded-full border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 transition-all"
          >
            <option value="all">All categories</option>
            {meta?.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={severity}
            onChange={(e) => updateFilter(setSeverity)(e.target.value)}
            className="rounded-full border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 transition-all"
          >
            <option value="all">All severities</option>
            {meta?.severities?.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Team Filter */}
          <select
            value={team}
            onChange={(e) => updateFilter(setTeam)(e.target.value)}
            className="rounded-full border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 transition-all"
          >
            <option value="all">All teams</option>
            {meta?.teams?.map((tm) => (
              <option key={tm} value={tm}>
                {tm}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="ml-auto">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search tickets / ID..."
              className="rounded-full border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 w-52 md:w-60 transition-all"
            />
          </form>

          {(status !== 'all' || category !== 'all' || severity !== 'all' || team !== 'all' || search) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline px-2"
            >
              Reset filters
            </button>
          )}
        </div>
      </Reveal>

      {/* Ticket List Table */}
      <Reveal delay={120}>
        <Card className="!p-0 overflow-hidden shadow-lg border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Ticket Description</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Severity</th>
                  <th className="px-4 py-3.5">Assigned Team</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {tickets === null && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      Loading tickets...
                    </td>
                  </tr>
                )}
                {tickets?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      No tickets match these filters.
                    </td>
                  </tr>
                )}
                {tickets?.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className="cursor-pointer hover:bg-sky-50/60 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 max-w-sm">
                      <p className="font-medium text-slate-800 dark:text-slate-100 line-clamp-1">{t.title || t.description}</p>
                      {t.title && <p className="text-xs text-slate-400 line-clamp-1">{t.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-mono text-slate-400">{t.id}</span>
                        {t.needsReview ? <ReviewBadge /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <CategoryBadge category={t.category} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <SeverityBadge severity={t.severity} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium text-xs">
                      {t.team}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(t.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-2.5">
                        <button
                          onClick={() => setSelectedTicket(t)}
                          className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          View
                        </button>
                        {t.status === 'open' ? (
                          <button
                            disabled={busyId === t.id}
                            onClick={() => handleResolve(t.id)}
                            className="press text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60"
                          >
                            Resolve
                          </button>
                        ) : (
                          <button
                            disabled={busyId === t.id}
                            onClick={() => handleReopen(t.id)}
                            className="press text-xs font-semibold text-sky-600 hover:text-sky-700 disabled:opacity-50 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30">
            <p className="text-xs text-slate-400">
              Showing page <strong className="text-slate-700 dark:text-slate-200">{page}</strong> of <strong className="text-slate-700 dark:text-slate-200">{totalPages}</strong> ({total.toLocaleString()} tickets total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="press rounded-full border border-sky-200 dark:border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="press rounded-full border border-sky-200 dark:border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-slate-400 block mb-1">Ticket #{selectedTicket.id}</span>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  {selectedTicket.title || 'Support Ticket Details'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <CategoryBadge category={selectedTicket.category} />
              <SeverityBadge severity={selectedTicket.severity} />
              <StatusBadge status={selectedTicket.status} />
              {selectedTicket.needsReview ? <ReviewBadge /> : null}
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Description
              </span>
              <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {selectedTicket.description}
              </div>
            </div>

            {selectedTicket.aiReasoning && (
              <div className="rounded-xl p-3.5 bg-sky-50/50 dark:bg-slate-800/40 border border-sky-100 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                  AI Triage Rationale (Confidence: {Math.round(selectedTicket.confidence * 100)}%)
                </span>
                <p className="text-slate-600 dark:text-slate-400 italic">"{selectedTicket.aiReasoning}"</p>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-y-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
              <dt className="text-slate-400">Assigned Team</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">{selectedTicket.team}</dd>
              <dt className="text-slate-400">Submitted At</dt>
              <dd className="text-slate-800 dark:text-slate-200">{new Date(selectedTicket.submittedAt).toLocaleString()}</dd>
              {selectedTicket.resolvedAt && (
                <>
                  <dt className="text-slate-400">Resolved At</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{new Date(selectedTicket.resolvedAt).toLocaleString()}</dd>
                </>
              )}
              {selectedTicket.resolutionMinutes && (
                <>
                  <dt className="text-slate-400">Resolution Time</dt>
                  <dd className="text-slate-800 dark:text-slate-200">
                    {selectedTicket.resolutionMinutes > 60
                      ? `${(selectedTicket.resolutionMinutes / 60).toFixed(1)} hours`
                      : `${selectedTicket.resolutionMinutes} minutes`}
                  </dd>
                </>
              )}
            </dl>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                disabled={busyId === selectedTicket.id}
                onClick={() => handleDelete(selectedTicket.id)}
                className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                Delete Ticket
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                {selectedTicket.status === 'open' ? (
                  <button
                    disabled={busyId === selectedTicket.id}
                    onClick={() => handleResolve(selectedTicket.id)}
                    className="press px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-500/20"
                  >
                    Mark Resolved
                  </button>
                ) : (
                  <button
                    disabled={busyId === selectedTicket.id}
                    onClick={() => handleReopen(selectedTicket.id)}
                    className="press px-4 py-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-md shadow-sky-500/20"
                  >
                    Reopen Ticket
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
