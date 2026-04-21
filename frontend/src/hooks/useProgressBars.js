import { useRef, useCallback, useState } from 'react';

export default function useProgressBars() {
  const [bars, setBars] = useState(new Map());
  const barsRef = useRef(new Map());
  const timersRef = useRef(new Map());

  function computeProgress(elapsedMs) {
    if (elapsedMs <= 0) return 0;
    return 0.949 * (1 - Math.exp(-elapsedMs / 30000));
  }

  function startBarAnimation(slug) {
    const timer = setInterval(() => {
      const entry = barsRef.current.get(slug);
      if (!entry || entry.done) {
        clearInterval(timer);
        timersRef.current.delete(slug);
        return;
      }
      const remaining = 0.95 - entry.progress;
      const step = remaining * 0.03;
      entry.progress = Math.min(entry.progress + step, 0.949);
      barsRef.current.set(slug, { ...entry });
      setBars(new Map(barsRef.current));
    }, 500);
    timersRef.current.set(slug, timer);
  }

  const addBar = useCallback((slug, text, startedAt) => {
    if (barsRef.current.has(slug)) return;
    let initialProgress = 0;
    if (startedAt) {
      initialProgress = computeProgress(Date.now() - startedAt);
    }
    const entry = { text, progress: initialProgress, done: false };
    barsRef.current.set(slug, entry);
    setBars(new Map(barsRef.current));
    startBarAnimation(slug);
  }, []);

  const completeBar = useCallback((slug, doneText) => {
    const entry = barsRef.current.get(slug);
    if (!entry) return;
    entry.done = true;
    entry.progress = 1;
    entry.text = doneText;
    const timer = timersRef.current.get(slug);
    if (timer) { clearInterval(timer); timersRef.current.delete(slug); }
    barsRef.current.set(slug, { ...entry });
    setBars(new Map(barsRef.current));

    setTimeout(() => {
      barsRef.current.delete(slug);
      setBars(new Map(barsRef.current));
    }, 2000);
  }, []);

  const removeBar = useCallback((slug) => {
    const entry = barsRef.current.get(slug);
    if (!entry) return;
    entry.done = true;
    const timer = timersRef.current.get(slug);
    if (timer) { clearInterval(timer); timersRef.current.delete(slug); }
    barsRef.current.delete(slug);
    setBars(new Map(barsRef.current));
  }, []);

  return { bars, addBar, completeBar, removeBar };
}
