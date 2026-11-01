import { useState } from 'react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import { Check, Circle, CircleDot, Pause, Pencil, Play, RotateCcw } from 'lucide-react';
import { elapsed, formatDuration, parseDuration, pauseTimer, setStatus, setTimeSpent, startTimer, useTick } from '../lib/timer';

const STATUSES = [
  { id: 'todo', label: 'To do', icon: Circle },
  { id: 'progress', label: 'In progress', icon: CircleDot },
  { id: 'done', label: 'Done', icon: Check },
];

/** Status switch + timer with manual editing, for the task drawer. */
export default function TimeTracker({ item }) {
  const running = !!item.timerStartedAt;
  useTick(running);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const status = item.done ? 'done' : running ? 'progress' : 'todo';
  const sec = elapsed(item);

  const save = (e) => {
    e.preventDefault();
    const v = parseDuration(text);
    if (v == null) return setError(true);
    setTimeSpent(item, v);
    setEditing(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-white/5 p-1">
        {STATUSES.map((st) => (
          <button
            key={st.id}
            onClick={() => status !== st.id && setStatus(item, st.id)}
            className={clsx(
              'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors sm:text-sm',
              status === st.id ? 'text-white' : 'text-stone-500 hover:text-stone-300'
            )}
          >
            {status === st.id && (
              <motion.span
                layoutId="status-pill"
                className={clsx(
                  'absolute inset-0 rounded-lg',
                  st.id === 'progress' ? 'bg-amber-500/20' : st.id === 'done' ? 'bg-emerald-500/20' : 'bg-white/10'
                )}
              />
            )}
            <st.icon size={14} className="relative" />
            <span className="relative">{st.label}</span>
          </button>
        ))}
      </div>

      <div className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2.5', running ? 'border-emerald-500/30 bg-emerald-500/[.06]' : 'border-white/10 bg-white/[.03]')}>
        {editing ? (
          <form onSubmit={save} className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={text}
              onChange={(e) => (setText(e.target.value), setError(false))}
              onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
              placeholder="1:30 · 1h 30m · 45m"
              className={clsx('input py-1.5 font-mono tabular-nums', error && '!border-rose-500/60')}
            />
            <button className="btn-primary py-1.5 text-xs">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost py-1.5 text-xs">Cancel</button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className={clsx('font-mono text-2xl font-semibold tabular-nums tracking-tight', running ? 'text-emerald-300' : 'text-stone-200')}>
                {formatDuration(sec, { seconds: true })}
              </div>
              <div className="text-[11px] text-stone-500">{running ? 'Timer running' : sec ? 'Time spent' : 'No time tracked yet'}</div>
            </div>
            <button
              title="Edit time"
              onClick={() => {
                setText(formatDuration(sec, { seconds: false }).replace('<1m', '0m'));
                setError(false);
                setEditing(true);
              }}
              className="rounded-lg p-2 text-stone-400 transition hover:bg-white/10 hover:text-stone-100"
            >
              <Pencil size={15} />
            </button>
            {sec > 0 && !running && (
              <button title="Reset to zero" onClick={() => setTimeSpent(item, 0)} className="rounded-lg p-2 text-stone-400 transition hover:bg-white/10 hover:text-rose-300">
                <RotateCcw size={15} />
              </button>
            )}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => (running ? pauseTimer(item) : startTimer(item))}
              className={clsx('grid h-10 w-10 place-items-center rounded-full text-white shadow-lg transition', running ? 'bg-amber-500 shadow-amber-500/30 hover:bg-amber-600' : 'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600')}
              title={running ? 'Pause' : 'Start'}
            >
              {running ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
            </motion.button>
          </>
        )}
      </div>
      {editing && error && <p className="text-xs text-rose-300">Try “1:30”, “1h 30m”, “45m” or “2h”.</p>}
    </div>
  );
}
