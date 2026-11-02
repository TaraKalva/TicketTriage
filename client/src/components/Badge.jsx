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

const ENV_STYLES = {
  Production: 'bg-rose-100 text-rose-800 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  Staging: 'bg-purple-100 text-purple-800 ring-purple-600/20 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-500/30',
  Development: 'bg-blue-100 text-blue-800 ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
  Internal: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-500/30',
};

export function SeverityBadge({ severity }) {
  return <Pill className={SEVERITY_STYLES[severity] ?? NEUTRAL}>{severity}</Pill>;
}

export function StatusBadge({ status }) {
  return <Pill className={STATUS_STYLES[status] ?? NEUTRAL}>{status === 'resolved' ? 'Resolved' : 'Open'}</Pill>;
}

export function CategoryBadge({ category }) {
  return <Pill className={NEUTRAL}>{category}</Pill>;
}

export function EnvironmentBadge({ environment }) {
  if (!environment) return null;
  return <Pill className={ENV_STYLES[environment] ?? NEUTRAL}>🌍 {environment}</Pill>;
}

export function SystemBadge({ system }) {
  if (!system) return null;
  return (
    <Pill className="bg-sky-50 text-sky-800 ring-sky-300/40 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-700/50">
      ⚙️ {system}
    </Pill>
  );
}

export function ReviewBadge() {
  return (
    <Pill className="bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30 font-semibold">
      ✋ Needs review
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

