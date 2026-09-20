import { useEffect, useState } from 'react';

function getInitialTheme() {
  try {
    const stored = localStorage.getItem('ticketlens-theme');
    if (stored) return stored;
  } catch {
    // ignore
  }
  // TicketLens defaults to its light pastel theme regardless of system preference.
  return 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('ticketlens-theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
      aria-label="Toggle dark mode"
      title="Toggle theme"
    >
      {theme === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3a1 1 0 011 1v1a1 1 0 11-2 0V4a1 1 0 011-1zm0 15a5 5 0 100-10 5 5 0 000 10zm9-6a1 1 0 010 2h-1a1 1 0 110-2h1zM4 12a1 1 0 010 2H3a1 1 0 110-2h1zm14.36-6.36a1 1 0 011.41 1.41l-.7.71a1 1 0 11-1.42-1.42l.71-.7zM6.34 17.66a1 1 0 011.41 1.41l-.7.71a1 1 0 01-1.42-1.42l.71-.7zM19.07 17.66l.71.7a1 1 0 01-1.42 1.42l-.7-.71a1 1 0 011.41-1.41zM6.34 6.34l.71-.71A1 1 0 105.63 4.2l-.7.71a1 1 0 001.41 1.42zM12 20a1 1 0 011 1v.01a1 1 0 11-2 0V21a1 1 0 011-1z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73 8.15 8.15 0 01-8.14-8.1 8.59 8.59 0 01.25-2A1 1 0 008 2.36a10.14 10.14 0 1013.66 12.1 1 1 0 00-.02-1.46z" />
        </svg>
      )}
    </button>
  );
}
