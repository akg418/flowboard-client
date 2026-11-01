import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { ArrowRightLeft, CheckCircle2, CirclePlus, Loader2, Pause, Pencil, Play, Redo2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import PageHeader, { Empty } from '../components/PageHeader';
import { useStore } from '../lib/store';
import { api } from '../lib/api';

const ACTIONS = {
  create: { icon: CirclePlus, verb: 'Added', tone: 'text-emerald-400' },
  edit: { icon: Pencil, verb: 'Edited', tone: 'text-accent-300' },
  done: { icon: CheckCircle2, verb: 'Completed', tone: 'text-emerald-400' },
  reopen: { icon: RotateCcw, verb: 'Reopened', tone: 'text-amber-300' },
  start: { icon: Play, verb: 'Started', tone: 'text-amber-300' },
  pause: { icon: Pause, verb: 'Paused', tone: 'text-stone-400' },
  move: { icon: ArrowRightLeft, verb: 'Moved', tone: 'text-sky-300' },
  delete: { icon: Trash2, verb: 'Deleted', tone: 'text-rose-400' },
  undo: { icon: Undo2, verb: 'Undid', tone: 'text-violet-300' },
  redo: { icon: Redo2, verb: 'Redid', tone: 'text-violet-300' },
};

const FIELD = {
  title: 'title', description: 'notes', kind: 'type', parent: 'project', start: 'date', end: 'end time',
  allDay: 'all-day', someday: 'later', remindBefore: 'reminder', dependsOn: 'dependencies',
  color: 'color', timeSpent: 'time spent', done: 'status', inProgress: 'status', timerStartedAt: 'timer',
};

const dayLabel = (d) => (isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, MMM d'));

/** Your undo/redo stacks for this session, and the full history of changes. */
export default function LogsView() {
  return (
    <>
      <PageHeader title="Logs" subtitle="What changed and when. The two stacks are what Ctrl+Z and Ctrl+Shift+Z do next." />
      <Stacks />
      <History />
    </>
  );
}

function Stacks() {
  const past = useStore((s) => s.past);
  const future = useStore((s) => s.future);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  return (
    <div className="mb-10 grid gap-3 sm:grid-cols-2">
      <Stack title="Undo stack" hint="Top is what Undo reverses next." entries={past} icon={Undo2} action="Undo" keys="Ctrl+Z" onAction={undo} />
      <Stack title="Redo stack" hint="What you undid. A new change empties it." entries={future} icon={Redo2} action="Redo" keys="Ctrl+Shift+Z" onAction={redo} />
    </div>
  );
}

function Stack({ title, hint, entries, icon: Icon, action, keys, onAction }) {
  // Stored oldest → newest; shown top of the stack first.
  const top = [...entries].reverse();
  return (
    <section className="flex flex-col rounded-3xl border border-white/[.06] bg-white/[.03] p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="rounded-md bg-white/[.06] px-1.5 text-xs tabular-nums text-stone-400">{entries.length}</span>
        <button onClick={onAction} disabled={!entries.length} title={keys} className="btn ml-auto bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600 disabled:opacity-40">
          <Icon size={15} /> {action}
        </button>
      </div>
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
      <ol className="mt-3 flex-1 space-y-1.5">
        {!top.length ? (
          <li className="grid h-20 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-stone-500">Empty</li>
        ) : (
          <AnimatePresence initial={false}>
            {top.map((e, i) => (
              <motion.li
                key={`${e.label}-${entries.length - i}`}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1 - Math.min(i, 5) * 0.12, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                style={{ marginInline: Math.min(i, 4) * 4 }}
                className={clsx('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', i === 0 ? 'border-accent-500/50 bg-accent-500/10' : 'border-white/[.06] bg-white/[.03]')}
              >
                {i === 0 && <span className="rounded bg-accent-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">next</span>}
                <span dir="auto" className="min-w-0 flex-1 truncate first-letter:uppercase">{e.label}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        )}
      </ol>
    </section>
  );
}

function History() {
  const items = useStore((s) => s.items);
  const openDrawer = useStore((s) => s.openDrawer);
  const [rows, setRows] = useState(null);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef(null);

  const loadFirst = useCallback(async () => {
    try {
      const r = await api.logs();
      setRows((old) => {
        // Keep pages already loaded by scrolling: put only the new entries on top.
        const at = old ? r.items.findIndex((x) => x.id === old[0]?.id) : -1;
        if (at < 0) {
          setNext(r.next);
          return r.items;
        }
        return [...r.items.slice(0, at), ...old];
      });
    } catch {
      setRows((x) => x ?? []);
    }
  }, []);
  // Refresh shortly after any change, so new entries show up here too.
  useEffect(() => {
    const t = setTimeout(loadFirst, rows ? 600 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loadFirst]);

  const loadMore = useCallback(async () => {
    if (!next || loading) return;
    setLoading(true);
    try {
      const r = await api.logs(next);
      setRows((x) => [...(x || []), ...r.items]);
      setNext(r.next);
    } finally {
      setLoading(false);
    }
  }, [next, loading]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  if (!rows) return <div className="grid place-items-center py-10 text-stone-500"><Loader2 className="animate-spin" size={18} /></div>;
  if (!rows.length) return <Empty icon="📜" title="No history yet" text="Add, edit or finish a task and it shows up here." />;

  const exists = new Set(items.map((i) => i.id));
  const days = [];
  for (const r of rows) {
    const d = new Date(r.createdAt);
    const key = format(d, 'yyyy-MM-dd');
    if (days.at(-1)?.key !== key) days.push({ key, label: dayLabel(d), rows: [] });
    days.at(-1).rows.push(r);
  }

  return (
    <div className="space-y-8">
      {days.map((day) => (
        <section key={day.key}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{day.label}</h3>
          <ol>
            {day.rows.map((r) => {
              const a = ACTIONS[r.action] || ACTIONS.edit;
              const Icon = a.icon;
              const live = r.itemId && exists.has(r.itemId);
              const fields = r.action === 'edit' ? [...new Set(r.fields.map((f) => FIELD[f] || f))] : [];
              return (
                <li key={r.id} className="group/log flex gap-3">
                  {/* Icon with the timeline line running down to the next entry. */}
                  <div className="flex flex-col items-center">
                    <span className={clsx('grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-stone-900', a.tone)}>
                      <Icon size={13} />
                    </span>
                    <span className="w-px flex-1 bg-white/10 group-last/log:hidden" />
                  </div>
                  <div className="min-w-0 flex-1 pb-5 pt-1 group-last/log:pb-0">
                    <div className="flex items-baseline gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-stone-200">{a.verb}</span>{' '}
                        {r.title && (
                          <button
                            disabled={!live}
                            onClick={() => openDrawer(r.itemId)}
                            className={clsx(live ? 'text-stone-300 hover:text-accent-300 hover:underline' : 'cursor-default text-stone-500')}
                          >
                            <bdi>{r.title}</bdi>
                          </button>
                        )}
                        {r.count > 1 && <span className="ml-1.5 text-xs text-stone-500">+{r.count - 1} more</span>}
                      </span>
                      <span className="shrink-0 text-xs text-stone-500" title={format(new Date(r.createdAt), 'PPpp')}>
                        {format(new Date(r.createdAt), 'H:mm')} · {formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {fields.length > 0 && <p className="mt-0.5 text-xs text-stone-500">Changed {fields.join(', ')}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <div ref={sentinel} className="grid h-10 place-items-center text-stone-500">{loading && <Loader2 className="animate-spin" size={16} />}</div>
    </div>
  );
}
