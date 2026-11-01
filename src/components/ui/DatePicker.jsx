import { useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Popover from './Popover';

const WEEK = { weekStartsOn: 6 };

export default function DatePicker({ value, onChange, placeholder = 'Pick a date', className }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(value || new Date()));
  const [dir, setDir] = useState(0);
  const ref = useRef(null);
  const days = eachDayOfInterval({ start: startOfWeek(month, WEEK), end: endOfWeek(endOfMonth(month), WEEK) });
  const today = startOfDay(new Date());

  const pick = (d) => {
    onChange(d);
    setOpen(false);
  };
  const go = (n) => {
    setDir(n);
    setMonth((m) => addMonths(m, n));
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => {
          setMonth(startOfMonth(value || new Date()));
          setOpen((o) => !o);
        }}
        className={clsx('input flex items-center gap-2 text-left', open && 'border-accent-500 ring-4 ring-accent-500/20', className)}
      >
        <CalendarDays size={15} className="text-stone-400" />
        <span className={clsx('flex-1 truncate', !value && 'text-stone-500')}>
          {value ? format(value, isSameDay(value, today) ? "'Today', MMM d" : 'EEE, MMM d, yyyy') : placeholder}
        </span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={288}>
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => go(-1)} className="btn-ghost p-1.5"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</span>
            <button type="button" onClick={() => go(1)} className="btn-ghost p-1.5"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase text-stone-500">
            {days.slice(0, 7).map((d) => <div key={d} className="py-1">{format(d, 'EEEEE')}</div>)}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={month.toISOString()}
              initial={{ opacity: 0, x: dir * 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -16 }}
              transition={{ duration: 0.14 }}
              className="grid grid-cols-7 gap-0.5"
            >
              {days.map((d) => {
                const sel = value && isSameDay(d, value);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => pick(d)}
                    className={clsx(
                      'aspect-square rounded-lg text-sm transition-colors',
                      sel ? 'bg-accent-500 font-semibold text-white shadow-lg shadow-accent-500/30' :
                        isToday(d) ? 'text-accent-300 ring-1 ring-inset ring-accent-500/50 hover:bg-white/5' :
                          isSameMonth(d, month) ? 'text-stone-200 hover:bg-white/[.07]' : 'text-stone-600 hover:bg-white/5',
                      d < today && !sel && 'opacity-60'
                    )}
                  >
                    {format(d, 'd')}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
            {[['Today', today], ['Tomorrow', addDays(today, 1)], ['Next week', addWeeks(today, 1)]].map(([l, d]) => (
              <button key={l} type="button" onClick={() => pick(d)} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-stone-300 hover:bg-accent-500/20 hover:text-accent-200">
                {l}
              </button>
            ))}
            {value && (
              <button type="button" onClick={() => pick(null)} className="ml-auto rounded-full px-2.5 py-1 text-xs text-stone-500 hover:text-rose-400">
                Clear
              </button>
            )}
          </div>
        </div>
      </Popover>
    </>
  );
}
