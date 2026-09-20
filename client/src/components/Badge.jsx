const SEVERITY_STYLES = {
  Critical: 'bg-red-100 text-red-700 ring-red-600/20 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30',
  High: 'bg-orange-100 text-orange-700 ring-orange-600/20 dark:bg-orange-500/15 dark:text-orange-400 dark:ring-orange-500/30',
  Medium: 'bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/30',
  Low: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30',
};

const STATUS_STYLES = {
  open: 'bg-sky-100 text-sky-700 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-400 dark:ring-sky-500/30',
  resolved: 'bg-slate-200 text-slate-600 ring-slate-500/20 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-500/30',
};

const NEUTRAL = 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/30';

export function SeverityBadge({ severity }) {
  return <Pill className={SEVERITY_STYLES[severity] ?? NEUTRAL}>{severity}</Pill>;
}

export function StatusBadge({ status }) {
  return <Pill className={STATUS_STYLES[status] ?? NEUTRAL}>{status === 'resolved' ? 'Resolved' : 'Open'}</Pill>;
}

export function CategoryBadge({ category }) {
  return <Pill className={NEUTRAL}>{category}</Pill>;
}

export function ReviewBadge() {
  return (
    <Pill className="bg-violet-100 text-violet-700 ring-violet-600/20 dark:bg-violet-500/15 dark:text-violet-400 dark:ring-violet-500/30">
      Needs review
    </Pill>
  );
}

function Pill({ className, children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}
