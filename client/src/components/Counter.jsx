import { useEffect, useRef, useState } from 'react';

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Animates a number counting up to `value`.
 * Smoothly updates whenever `value` changes (e.g. changing duration filter from 14D to All).
 */
export default function Counter({ value, duration = 650, formatter }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(target);
  const currentDisplayRef = useRef(target);
  const ref = useRef(null);
  const hasEnteredView = useRef(false);
  const rafId = useRef(null);

  useEffect(() => {
    currentDisplayRef.current = display;
  }, [display]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    function animateTo(to) {
      if (document.hidden) {
        setDisplay(to);
        return;
      }
      const from = currentDisplayRef.current;
      if (from === to) return;

      if (rafId.current) cancelAnimationFrame(rafId.current);

      const start = performance.now();
      const animDuration = Math.min(duration, 700);

      function tick(now) {
        const progress = Math.min(1, (now - start) / animDuration);
        const currentVal = Math.round(from + (to - from) * easeOutExpo(progress));
        setDisplay(currentVal);
        if (progress < 1) {
          rafId.current = requestAnimationFrame(tick);
        } else {
          setDisplay(to);
        }
      }
      rafId.current = requestAnimationFrame(tick);
    }

    if (!hasEnteredView.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          hasEnteredView.current = true;
          observer.disconnect();
          animateTo(target);
        },
        { threshold: 0.1 }
      );
      observer.observe(node);
      return () => {
        observer.disconnect();
        if (rafId.current) cancelAnimationFrame(rafId.current);
      };
    } else {
      // Already viewed; smoothly animate to the new target
      animateTo(target);
      return () => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
      };
    }
  }, [target, duration]);

  const text = formatter ? formatter(display) : display.toLocaleString();
  return <span ref={ref}>{text}</span>;
}
