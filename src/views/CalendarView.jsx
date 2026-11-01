import { openContextMenu } from '../components/ContextMenu';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import {
  addMonths, addWeeks, addYears, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek, startOfYear,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Inbox, Video } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useStore } from '../lib/store';
import { moveToDay } from '../lib/drop';

const WEEK = { weekStartsOn: 6 }; // Saturday
const MODES = ['week', 'month', 'year'];
const dayKey = (d) => format(d, 'yyyy-MM-dd');

function useByDay(items) {
  return useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it.start) continue;
      const k = dayKey(new Date(it.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    }
    for (const list of map.values())
      list.sort((a, b) => (a.allDay === b.allDay ? new Date(a.start) - new Date(b.start) : a.allDay ? -1 : 1));
    return map;
  }, [items]);
}

function Chip({ item, compact }) {
  const openDrawer = useStore((s) => s.openDrawer);
  const tone =
    item.kind === 'session'
      ? 'bg-violet-500/10 text-violet-200 border-violet-500/20'
      : item.kind === 'meeting'
      ? 'bg-sky-50 text-sky-700 border-sky-200/70 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/20'
      : 'bg-white text-stone-700 border-stone-200/80 dark:bg-white/5 dark:text-stone-200 dark:border-white/10';
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
        title={item.title}
        onContextMenu={(e) => openContextMenu(e, item)}
        onClick={(e) => {
          e.stopPropagation();
          openDrawer(item.id);
        }}
        className={clsx(
          'flex cursor-grab items-center gap-1 rounded-lg border px-2 text-xs shadow-sm transition hover:-translate-y-px hover:shadow active:cursor-grabbing',
          compact ? 'py-0.5' : 'py-1.5',
          tone,
          item.done && 'opacity-50 line-through'
        )}
      >
        {item.start && !item.allDay && <span className="shrink-0 tabular-nums opacity-60">{format(new Date(item.start), 'H:mm')}</span>}
        {item.kind === 'meeting' && !compact && <Video size={11} className="shrink-0" />}
        {/* Its own block with dir="auto": Arabic titles are cut at their end, not their start. */}
        <span dir="auto" className="min-w-0 flex-1 truncate">{item.title}</span>
      </div>
    </motion.div>
  );
}

function DropCell({ day, className, children, onClick }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        moveToDay(e.dataTransfer.getData('text/plain'), day);
      }}
      className={clsx(className, 'transition-colors', over && '!bg-accent-50 ring-2 ring-inset ring-accent-300 dark:!bg-accent-500/10')}
    >
      {children}
    </div>
  );
}

function WeekView({ cursor, byDay }) {
  const days = eachDayOfInterval({ start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) });
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((d) => (
        <DropCell key={dayKey(d)} day={d} className={clsx('card min-h-28 p-2 md:min-h-[420px]', isToday(d) && '!border-accent-300 dark:!border-accent-500/40')}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <span className="text-xs font-medium uppercase text-stone-400">{format(d, 'EEE')}</span>
            <span className={clsx('grid h-7 w-7 place-items-center rounded-full text-sm font-semibold', isToday(d) ? 'bg-accent-500 text-white' : 'text-stone-600 dark:text-stone-300')}>
              {format(d, 'd')}
            </span>
          </div>
          <div className="space-y-1.5">
            {(byDay.get(dayKey(d)) || []).map((it) => (
              <Chip key={it.id} item={it} />
            ))}
          </div>
        </DropCell>
      ))}
    </div>
  );
}

function MonthView({ cursor, byDay, onPickDay }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), WEEK),
    end: endOfWeek(endOfMonth(cursor), WEEK),
  });
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-stone-200/70 text-center text-[11px] font-medium uppercase text-stone-400 dark:border-white/5">
        {days.slice(0, 7).map((d) => (
          <div key={d} className="py-2">{format(d, 'EEE')}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(dayKey(d)) || [];
          return (
            <DropCell
              key={dayKey(d)}
              day={d}
              onClick={() => onPickDay(d)}
              className={clsx(
                'min-h-16 cursor-pointer border-b border-r border-stone-100 p-1.5 hover:bg-stone-50 sm:min-h-28 dark:border-white/5 dark:hover:bg-white/[.02]',
                !isSameMonth(d, cursor) && 'bg-stone-50/60 text-stone-300 dark:bg-black/10 dark:text-stone-600'
              )}
            >
              <div className={clsx('mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-semibold', isToday(d) && 'bg-accent-500 text-white')}>
                {format(d, 'd')}
              </div>
              <div className="space-y-1 max-sm:hidden">
                {list.slice(0, 3).map((it) => (
                  <Chip key={it.id} item={it} compact />
                ))}
                {list.length > 3 && <div className="px-1 text-[11px] text-stone-400">+{list.length - 3} more</div>}
              </div>
              {list.length > 0 && (
                <div className="flex gap-0.5 sm:hidden">
                  {list.slice(0, 4).map((it) => (
                    <span key={it.id} className="h-1.5 w-1.5 rounded-full bg-accent-400" />
                  ))}
                </div>
              )}
            </DropCell>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ cursor, byDay, onPickMonth }) {
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startOfYear(cursor), i));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map((m) => {
        const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(m), WEEK), end: endOfWeek(endOfMonth(m), WEEK) });
        return (
          <motion.button
            key={m}
            whileHover={{ y: -3 }}
            onClick={() => onPickMonth(m)}
            className={clsx('card p-3 text-left', isSameMonth(m, new Date()) && '!border-accent-300 dark:!border-accent-500/40')}
          >
            <div className="mb-2 text-sm font-semibold">{format(m, 'MMMM')}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((d) => {
                const n = isSameMonth(d, m) ? (byDay.get(dayKey(d)) || []).length : 0;
                return (
                  <div
                    key={d}
                    title={n ? `${n} item(s)` : undefined}
                    className={clsx(
                      'grid aspect-square place-items-center rounded-md text-[10px]',
                      !isSameMonth(d, m) && 'invisible',
                      isToday(d) ? 'bg-accent-500 font-bold text-white' :
                        n >= 3 ? 'bg-accent-400/80 text-white' : n === 2 ? 'bg-accent-300/60 dark:text-white' : n === 1 ? 'bg-accent-100 dark:bg-accent-500/25' : 'text-stone-400'
                    )}
                  >
                    {format(d, 'd')}
                  </div>
                );
              })}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function Unscheduled() {
  const items = useStore((s) => s.items);
  const list = items.filter((i) => !i.start && !i.done && i.kind !== 'project');
  if (!list.length) return null;
  return (
    <aside className="card mb-4 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
        <Inbox size={13} /> No date yet — drag onto a day
      </div>
      <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1">
        {list.map((it) => (
          <div key={it.id} className="max-w-48 shrink-0">
            <Chip item={it} compact />
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function CalendarView() {
  const items = useStore((s) => s.items);
  const byDay = useByDay(items);
  const [mode, setMode] = useState('week');
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const [dir, setDir] = useState(0);

  const step = (n) => {
    setDir(n);
    setCursor((c) => (mode === 'week' ? addWeeks(c, n) : mode === 'month' ? addMonths(c, n) : addYears(c, n)));
  };
  const title =
    mode === 'week'
      ? `${format(startOfWeek(cursor, WEEK), 'MMM d')} – ${format(endOfWeek(cursor, WEEK), 'MMM d, yyyy')}`
      : mode === 'month' ? format(cursor, 'MMMM yyyy') : format(cursor, 'yyyy');

  return (
    <>
      <PageHeader title={title} subtitle="Drag tasks between days to reschedule.">
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-stone-100 p-1 dark:bg-white/5">
            {MODES.map((m) => (
              <button key={m} onClick={() => setMode(m)} className={clsx('relative rounded-lg px-3 py-1 text-sm font-medium capitalize', mode === m ? 'text-stone-800 dark:text-white' : 'text-stone-400')}>
                {mode === m && <motion.span layoutId="cal-mode" className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-white/10" />}
                <span className="relative">{m}</span>
              </button>
            ))}
          </div>
          <button onClick={() => step(-1)} className="btn-ghost p-1.5"><ChevronLeft size={18} /></button>
          <button onClick={() => { setDir(0); setCursor(startOfDay(new Date())); }} className="btn-ghost">Today</button>
          <button onClick={() => step(1)} className="btn-ghost p-1.5"><ChevronRight size={18} /></button>
        </div>
      </PageHeader>

      {mode !== 'year' && <Unscheduled />}

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={mode + dayKey(mode === 'week' ? startOfWeek(cursor, WEEK) : mode === 'month' ? startOfMonth(cursor) : startOfYear(cursor))}
          custom={dir}
          initial={{ opacity: 0, x: dir * 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -30 }}
          transition={{ duration: 0.2 }}
        >
          {mode === 'week' && <WeekView cursor={cursor} byDay={byDay} />}
          {mode === 'month' && <MonthView cursor={cursor} byDay={byDay} onPickDay={(d) => { setDir(0); setCursor(d); setMode('week'); }} />}
          {mode === 'year' && <YearView cursor={cursor} byDay={byDay} onPickMonth={(m) => { setDir(0); setCursor(m); setMode('month'); }} />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
