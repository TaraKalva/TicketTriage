import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import { useEffect, useState } from 'react';
import { listTickets } from '../api/client.js';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/submit', label: 'Submit Ticket' },
  { to: '/review', label: 'Review Queue' },
  { to: '/tickets', label: 'All Tickets' },
];

export default function Layout() {
  const [reviewCount, setReviewCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const { total } = await listTickets({ needsReview: true, status: 'open', pageSize: 1 });
        if (!cancelled) setReviewCount(total);
      } catch {
        // ignore transient errors
      }
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen relative">
      {/* Ambient hero-style gradient orbs, fixed behind all content */}
      <div
        className="ambient-orb animate-float"
        style={{ width: 480, height: 480, top: -160, left: -120, background: 'radial-gradient(circle, #93c5fd 0%, transparent 70%)' }}
      />
      <div
        className="ambient-orb animate-float"
        style={{ width: 420, height: 420, top: 120, right: -160, background: 'radial-gradient(circle, #67e8f9 0%, transparent 70%)', animationDelay: '-4s' }}
      />
      <div
        className="ambient-orb animate-float"
        style={{ width: 380, height: 380, bottom: -140, left: '30%', background: 'radial-gradient(circle, #c4b5fd 0%, transparent 70%)', animationDelay: '-2s' }}
      />

      <header
        className={`sticky top-0 z-30 transition-all duration-300 ${
          scrolled
            ? 'glass border-b border-sky-100/70 dark:border-slate-800 shadow-sm shadow-sky-100/40'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-xl font-semibold tracking-tightest bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-300 dark:to-blue-300 bg-clip-text text-transparent">
              TicketLens
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1 rounded-full glass px-1.5 py-1.5 border border-white/60 dark:border-slate-800 shadow-sm">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`
                }
              >
                {label}
                {label === 'Review Queue' && reviewCount > 0 && (
                  <span className="rounded-full bg-violet-400 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                    {reviewCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        <nav className="md:hidden flex items-center gap-4 px-4 pb-3 text-[13px] overflow-x-auto">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `whitespace-nowrap pb-1 border-b-2 transition-colors ${
                  isActive ? 'border-sky-400 text-sky-600 font-medium' : 'border-transparent text-slate-500'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 md:px-8 py-10 md:py-14">
        <Outlet />
      </main>

      <footer className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 text-center text-xs text-slate-400">
        Closed-loop pattern analysis &amp; proactive risk scoring run automatically in the background.
      </footer>
    </div>
  );
}
