import clsx from 'clsx';
import { CalendarDays, Clock, Repeat } from 'lucide-react';
import { isToday, startOfDay } from 'date-fns';
import { describeDate, describeRepeat } from '../lib/parse';

export default function DateChip({ item, className }) {
  if (!item.start) return null;
  const d = new Date(item.start);
  const overdue = !item.done && (item.allDay ? d < startOfDay(new Date()) : d < new Date());
  const Icon = item.allDay ? CalendarDays : Clock;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        item.done
          ? 'bg-stone-100 text-stone-400 dark:bg-white/5'
          : overdue
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
            : isToday(d)
              ? 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300'
              : 'bg-stone-100 text-stone-500 dark:bg-white/5 dark:text-stone-400',
        className
      )}
      title={item.repeat ? describeRepeat(item.repeat, d) : undefined}
    >
      <Icon size={11} />
      {/* A missed occurrence of a repeating item stays behind, marked late; the next one is already lined up. */}
      {overdue && item.repeat && <span className="font-semibold">Late ·</span>}
      {describeDate(d, item.allDay, item.end)}
      {item.repeat && <Repeat size={10} className="opacity-70" />}
    </span>
  );
}
