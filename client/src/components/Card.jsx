export default function Card({ title, subtitle, action, children, className = '', hover = false }) {
  return (
    <div
      className={`rounded-[28px] border border-white/60 dark:border-slate-800 glass shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(56,189,248,0.25)] p-6 transition-all duration-300 ${
        hover ? 'hover:-translate-y-1 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-16px_rgba(56,189,248,0.35)]' : ''
      } ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between mb-4 gap-2">
          <div>
            {title && <h3 className="font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
