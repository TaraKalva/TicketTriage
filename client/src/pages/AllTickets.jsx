import { useEffect, useState } from 'react';
import Card from '../components/Card.jsx';
import Reveal from '../components/Reveal.jsx';
import { SeverityBadge, StatusBadge, CategoryBadge, ReviewBadge } from '../components/Badge.jsx';
import { getMeta, listTickets, resolveTicket, reopenTicket, deleteTicket } from '../api/client.js';

const STATUS_OPTIONS = ['all', 'open', 'resolved'];
const PAGE_SIZE = 25;

export default function AllTickets() {
  const [tickets, setTickets] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const params = { page, pageSize: PAGE_SIZE };
    if (status !== 'all') params.status = status;
    if (category !== 'all') params.category = category;
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
  }, [status, category, search, page]);

  function updateFilter(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }
  const handleCategoryChange = (e) => updateFilter(setCategory)(e.target.value);

  function handleSearchSubmit(e) {
    e.preventDefault();
    updateFilter(setSearch)(searchInput);
  }

  async function handleResolve(id) {
    setBusyId(id);
    try {
      const updated = await resolveTicket(id);
      setTickets((rows) => rows.map((t) => (t.id === id ? updated : t)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReopen(id) {
    setBusyId(id);
    try {
      const updated = await reopenTicket(id);
      setTickets((rows) => rows.map((t) => (t.id === id ? updated : t)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this ticket permanently?')) return;
    setBusyId(id);
    try {
      await deleteTicket(id);
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
            {total.toLocaleString()} ticket{total === 1 ? '' : 's'} — browse, filter, and resolve.
          </p>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
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

          <select
            value={category}
            onChange={handleCategoryChange}
            className="rounded-full border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 transition-all"
          >
            <option value="all">All categories</option>
            {meta?.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <form onSubmit={handleSearchSubmit} className="ml-auto">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search descriptions..."
              className="rounded-full border border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-300/20 w-56 transition-all"
            />
          </form>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-slate-400">
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets === null && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Loading tickets...
                    </td>
                  </tr>
                )}
                {tickets?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No tickets match these filters.
                    </td>
                  </tr>
                )}
                {tickets?.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-sky-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{t.title || t.description}</p>
                      {t.title && <p className="text-xs text-slate-400 truncate">{t.description}</p>}
                      {t.needsReview && (
                        <div className="mt-1">
                          <ReviewBadge />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={t.category} />
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={t.severity} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.team}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(t.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3">
                        {t.status === 'open' ? (
                          <button
                            disabled={busyId === t.id}
                            onClick={() => handleResolve(t.id)}
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                          >
                            Resolve
                          </button>
                        ) : (
                          <button
                            disabled={busyId === t.id}
                            onClick={() => handleReopen(t.id)}
                            className="text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50"
                          >
                            Reopen
                          </button>
                        )}
                        <button
                          disabled={busyId === t.id}
                          onClick={() => handleDelete(t.id)}
                          className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages}
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
    </div>
  );
}
