import { useEffect, useState } from 'react';
import { useStore } from './store';

/** Seconds spent so far, including the running stretch. */
export const elapsed = (item, now = Date.now()) =>
  (item.timeSpent || 0) + (item.timerStartedAt ? Math.max(0, (now - new Date(item.timerStartedAt)) / 1000) : 0);

export function formatDuration(sec, { seconds = false } = {}) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (seconds) return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return m ? `${m}m` : sec ? '<1m' : '0m';
}

/** "1:30", "1h 30m", "90m", "2h", "45" (minutes), "1.5h" → seconds, or null. */
export function parseDuration(text) {
  const t = text.trim().toLowerCase().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  let m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + (+m[3] || 0);
  m = t.match(/^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?|س|ساعه|ساعة|ساعات))?\s*(?:(\d+)\s*(?:m|min|mins|minutes?|د|دقيقه|دقيقة|دقايق))?$/);
  if (m && (m[1] || m[2])) return Math.round((+m[1] || 0) * 3600 + (+m[2] || 0) * 60);
  if (/^\d+$/.test(t)) return +t * 60;
  return null;
}

/** Starts this item's timer. Several tasks can run at once. */
export function startTimer(item) {
  const { update } = useStore.getState();
  update(item.id, { inProgress: true, done: false, timerStartedAt: new Date().toISOString() });
}

export function pauseTimer(item) {
  useStore.getState().update(item.id, { timeSpent: Math.round(elapsed(item)), timerStartedAt: null, inProgress: false });
}

export function setTimeSpent(item, seconds) {
  useStore.getState().update(item.id, { timeSpent: seconds, timerStartedAt: item.timerStartedAt ? new Date().toISOString() : null });
}

export function setStatus(item, status) {
  const { update } = useStore.getState();
  if (status === 'progress') return startTimer(item);
  if (status === 'done') return update(item.id, { done: true });
  update(item.id, { done: false, inProgress: false, ...(item.timerStartedAt && { timeSpent: Math.round(elapsed(item)), timerStartedAt: null }) });
}

/** Re-renders every second while `active` — only the components that show a running timer tick. */
export function useTick(active) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}
