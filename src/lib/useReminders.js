import { useEffect } from 'react';
import { differenceInMinutes, format } from 'date-fns';
import { useStore } from './store';

const KEY = 'flowboard.notified';
const MISSED_WINDOW = 60; // still remind about things that started up to 60 min ago

const readSent = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
};
const saveSent = (set) => {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set].slice(-300)));
  } catch {}
};

function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
  } catch {}
}

/** Checks every 20s for items whose reminder time has come and shows a toast + system notification. */
let lastCatchUp = 0;

export function useReminders() {
  useEffect(() => {
    const check = () => {
      const { items, toast, loaded, privacy } = useStore.getState();
      if (!loaded) return;
      // A repeating item whose time passed unfinished: reloading makes the server add the next one.
      const now0 = Date.now();
      const due = !privacy && items.some((it) => it.repeat && !it.nextSpawned && !it.done && it.start && new Date(it.start).getTime() + (it.allDay ? 864e5 : 0) <= now0);
      if (due && now0 - lastCatchUp > 60e3) {
        lastCatchUp = now0;
        useStore.getState().load();
      }
      if (privacy) return; // privacy mode only has made-up times: nothing real to remind about
      const sent = readSent();
      const now = new Date();
      for (const it of items) {
        if (!it.start || it.done || it.remindBefore == null) continue;
        const start = new Date(it.start);
        if (it.allDay) start.setHours(9, 0, 0, 0); // all-day items count from 9 AM
        const key = `${it.id}@${it.start}`;
        const minsLeft = differenceInMinutes(start, now);
        if (minsLeft > it.remindBefore || minsLeft < -MISSED_WINDOW || sent.has(key)) continue;
        sent.add(key);
        const when =
          minsLeft > 0 ? `in ${minsLeft} min · ${format(start, 'h:mm a')}` : minsLeft === 0 ? 'starting now' : `started at ${format(start, 'h:mm a')}`;
        const label = it.kind === 'meeting' ? 'Meeting' : it.kind === 'session' ? 'Work session' : 'Reminder';
        toast(when, { title: `${label}: ${it.title}`, tone: 'reminder', sticky: true, itemId: it.id });
        chime();
        if ('Notification' in window && Notification.permission === 'granted')
          new Notification(`${label}: ${it.title}`, { body: when, tag: key });
      }
      saveSent(sent);
    };
    check();
    const t = setInterval(check, 20_000);
    const unsub = useStore.subscribe((s, p) => s.loaded && !p.loaded && check());
    return () => {
      clearInterval(t);
      unsub();
    };
  }, []);
}
