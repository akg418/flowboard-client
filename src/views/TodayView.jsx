import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { addDays, differenceInMinutes, format, isSameDay, startOfDay } from 'date-fns';
import { Timer, Video } from 'lucide-react';
import clsx from 'clsx';
import { moveToDay, nativeDropProps } from '../lib/drop';
import QuickAdd from '../components/QuickAdd';
import ItemLine from '../components/ItemLine';
import PageHeader, { Empty } from '../components/PageHeader';
import { useStore } from '../lib/store';
import { isArchived, useNow } from '../lib/archive';

const byStart = (a, b) => (a.allDay === b.allDay ? new Date(a.start) - new Date(b.start) : a.allDay ? -1 : 1);

function Group({ title, tone, items, showDate, dropDay }) {
  const [over, setOver] = useState(false);
  if (!items.length && !dropDay) return null;
  return (
    <section className="mb-6" {...(dropDay ? nativeDropProps((id) => moveToDay(id, dropDay), setOver) : {})}>
      <h2 className={`mb-1 px-3 text-xs font-semibold uppercase tracking-wider ${tone || 'text-stone-400'}`}>
        {title} <span className="ml-1 font-normal opacity-70">{items.length}</span>
      </h2>
      <div className={clsx('card p-1.5 transition-all', over && '!border-accent-400/60 bg-accent-500/10 ring-2 ring-accent-400/40')}>
        {!items.length && <div className="px-3 py-4 text-center text-xs text-stone-500">Drop a task here</div>}
        <AnimatePresence initial={false}>
          {items.map((i) => (
            <ItemLine key={i.id} item={i} showDate={showDate} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

export default function TodayView() {
  const items = useStore((s) => s.items);
  const loaded = useStore((s) => s.loaded);
  const openDrawer = useStore((s) => s.openDrawer);
  const setSessionOpen = useStore((s) => s.setSessionOpen);
  const now = useNow();
  const today = startOfDay(now);

  const inProgress = useMemo(() => items.filter((i) => i.timerStartedAt && !i.done), [items]);
  const { overdue, todays, tomorrow, nextMeeting, doneToday, todayTotal } = useMemo(() => {
    const dated = items.filter((i) => i.start);
    const overdue = dated.filter((i) => !i.done && new Date(i.start) < today).sort(byStart);
    const allToday = dated.filter((i) => isSameDay(new Date(i.start), today));
    const todays = allToday.filter((i) => !isArchived(i, now)).sort(byStart);
    const tomorrow = dated.filter((i) => isSameDay(new Date(i.start), addDays(today, 1)) && !isArchived(i, now)).sort(byStart);
    const nextMeeting = todays.find((i) => i.kind === 'meeting' && !i.done && !i.allDay && new Date(i.start).getTime() > now.getTime() - 15 * 60_000);
    return { overdue, todays, tomorrow, nextMeeting, doneToday: allToday.filter((i) => i.done).length, todayTotal: allToday.length };
  }, [items, today, now]);

  const mins = nextMeeting ? differenceInMinutes(new Date(nextMeeting.start), now) : null;

  return (
    <>
      <PageHeader title="Today" subtitle={`${format(now, 'EEEE, MMMM d')} · ${doneToday}/${todayTotal} done`}>
        <button onClick={() => setSessionOpen(true, { day: today })} className="btn bg-violet-500/15 text-violet-200 hover:bg-violet-500/25">
          <Timer size={15} /> Plan work session
        </button>
      </PageHeader>

      <AnimatePresence>
        {nextMeeting && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => openDrawer(nextMeeting.id)}
            className="relative mb-5 flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-accent-500 p-4 text-left text-white shadow-lg shadow-accent-500/20"
          >
            <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-white/20">
              <span className="absolute inset-0 animate-ping rounded-xl bg-white/20" />
              <Video size={20} />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-white/70">
                {mins > 0 ? `Next meeting in ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`}` : 'Meeting now'}
              </div>
              <div dir="auto" className="truncate text-lg font-semibold">{nextMeeting.title}</div>
              <div className="text-sm text-white/80">{format(new Date(nextMeeting.start), 'h:mm a')}</div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <QuickAdd defaults={{ start: today }} placeholder="Add for today… e.g. “gym 7pm” / عربي كمان" />

      <Group title="In progress" tone="text-amber-400" items={inProgress} showDate />
      <Group title="Overdue" tone="text-rose-500" items={overdue} showDate />
      <Group title="Today" items={todays} dropDay={today} />
      <Group title="Tomorrow" items={tomorrow} dropDay={addDays(today, 1)} />
      {loaded && !inProgress.length && !overdue.length && !todays.length && !tomorrow.length && (
        <Empty icon="☀️" title="Nothing scheduled" text="Drag tasks here from the calendar, or write “today 5pm” / “النهارده الساعة 5”." />
      )}
      <p className="mt-2 text-center text-xs text-stone-600">Tip: drag any row onto Today / Tomorrow, or onto a project in the sidebar.</p>
    </>
  );
}
