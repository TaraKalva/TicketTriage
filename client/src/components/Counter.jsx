import { useEffect, useRef, useState } from 'react';

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Animates a number counting up from 0 to `value` when it first scrolls into view.
 * Falls back to setting the value immediately if the tab is hidden (rAF is paused
 * by the browser while a tab is backgrounded, so an animation started there would
 * otherwise stall indefinitely) or if rAF hasn't produced a final frame in time.
 */
export default function Counter({ value, duration = 900, formatter }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  const rafId = useRef(null);
  const backstop = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const target = Number(value) || 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();

        if (document.hidden) {
          setDisplay(target);
          return;
        }

        const start = performance.now();
        function tick(now) {
          const progress = Math.min(1, (now - start) / duration);
          setDisplay(Math.round(target * easeOutExpo(progress)));
          if (progress < 1) rafId.current = requestAnimationFrame(tick);
        }
        rafId.current = requestAnimationFrame(tick);
        backstop.current = setTimeout(() => setDisplay(target), duration + 400);
      },
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (backstop.current) clearTimeout(backstop.current);
    };
  }, [value, duration]);

  const text = formatter ? formatter(display) : display.toLocaleString();
  return <span ref={ref}>{text}</span>;
}
