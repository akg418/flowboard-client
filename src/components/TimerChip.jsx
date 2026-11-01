import clsx from 'clsx';
import { Pause, Play, Timer } from 'lucide-react';
import { elapsed, formatDuration, pauseTimer, startTimer, useTick } from '../lib/timer';

/**
 * Start / pause control with live time. Running = in progress.
 * With `always`, an untouched task still gets a small ▶ so it can be started from the list.
 */
export default function TimerChip({ item, always, className }) {
  const running = !!item.timerStartedAt;
  useTick(running);
  if (item.kind === 'project') return null;
  const sec = elapsed(item);

  if (item.done)
    return sec ? (
      <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap px-1 text-[11px] tabular-nums text-stone-500', className)}>
        <Timer size={10} /> {formatDuration(sec)}
      </span>
    ) : null;
  if (!running && !sec && !always) return null;

  const toggle = (e) => {
    e.stopPropagation();
    running ? pauseTimer(item) : startTimer(item);
  };

  if (!running && !sec)
    return (
      <button
        type="button"
        title="Start — mark in progress"
        onClick={toggle}
        className={clsx(
          'grid h-6 w-6 shrink-0 place-items-center rounded-full text-stone-500 ring-1 ring-white/10 transition hover:bg-emerald-500/15 hover:text-emerald-300 hover:ring-emerald-500/40',
          className
        )}
      >
        <Play size={11} className="ml-px" />
      </button>
    );

  return (
    <button
      type="button"
      title={running ? 'Pause' : 'Resume — mark in progress'}
      onClick={toggle}
      className={clsx(
        'group/timer inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-medium tabular-nums transition',
        running
          ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
          : 'bg-white/5 text-stone-400 hover:bg-emerald-500/15 hover:text-emerald-300',
        className
      )}
    >
      {running ? (
        <>
          <span className="relative flex h-1.5 w-1.5 group-hover/timer:hidden">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <Pause size={10} className="hidden group-hover/timer:block" />
        </>
      ) : (
        <Play size={10} />
      )}
      {formatDuration(sec, { seconds: running })}
    </button>
  );
}
