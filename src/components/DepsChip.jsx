import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { CheckCircle2, CheckSquare, Circle, Link2, Lock, Plus, Timer, Video, X } from 'lucide-react';
import Popover from './ui/Popover';
import Select from './ui/Select';
import { useStore } from '../lib/store';
import { ancestors } from '../lib/tree';

const KIND_ICON = { task: CheckSquare, meeting: Video, session: Timer };

/** Ids of every item that (directly or through others) waits on `id` — adding one would make a cycle. */
function waitingOn(items, id) {
  const out = new Set();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    for (const it of items)
      if (it.dependsOn.includes(cur) && !out.has(it.id)) {
        out.add(it.id);
        stack.push(it.id);
      }
  }
  return out;
}

/**
 * "Depends on" next to a task: how many of its prerequisites are done, and a
 * scrollable list to open, remove or add them — same links as the Map.
 */
export default function DepsChip({ item }) {
  const items = useStore((s) => s.items);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const deps = useMemo(
    () => item.dependsOn.map((d) => items.find((i) => i.id === d)).filter(Boolean),
    [items, item.dependsOn]
  );
  const left = deps.filter((d) => !d.done).length;

  return (
    <>
      <button
        ref={ref}
        onClick={(e) => (e.stopPropagation(), setOpen((o) => !o))}
        title={deps.length ? `Depends on ${deps.length} task${deps.length > 1 ? 's' : ''}` : 'Add a task this waits on'}
        className={clsx(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors',
          !deps.length
            ? clsx(
                // Nothing to show yet: only on row hover, as a way to add one.
                'text-stone-400 transition hover:bg-stone-200/70 hover:text-stone-700 dark:hover:bg-white/10 dark:hover:text-stone-200 max-md:hidden',
                !open && 'opacity-0 group-hover:opacity-100'
              )
            : left
              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20'
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
        )}
      >
        {left ? <Lock size={10} /> : <Link2 size={11} />}
        {deps.length > 0 && (left ? `waits on ${left}` : `${deps.length}/${deps.length}`)}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={320} align="end">
        {/* Portal events still bubble through React: keep clicks from opening the row. */}
        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <DepsPanel item={item} deps={deps} items={items} />
        </div>
      </Popover>
    </>
  );
}

export function DepsPanel({ item, deps, items }) {
  const update = useStore((s) => s.update);
  const openDrawer = useStore((s) => s.openDrawer);
  const left = deps.filter((d) => !d.done).length;
  const options = useMemo(() => {
    const blocked = waitingOn(items, item.id);
    return items
      .filter((it) => it.id !== item.id && it.kind !== 'project' && !item.dependsOn.includes(it.id) && !blocked.has(it.id))
      .map((it) => ({
        value: it.id,
        label: it.title,
        hint: ancestors(items, it.id).map((a) => a.title).join(' › '),
        icon: KIND_ICON[it.kind],
      }));
  }, [items, item.id, item.dependsOn]);

  return (
    <div className="p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Depends on</span>
        {deps.length > 0 && (
          <span className={clsx('text-xs', left ? 'text-amber-300' : 'text-emerald-300')}>
            {left ? `${left} of ${deps.length} not done` : 'all done'}
          </span>
        )}
      </div>
      {deps.length > 0 ? (
        <ul className="scroll-thin mb-2 max-h-56 space-y-0.5 overflow-y-auto">
          <AnimatePresence initial={false}>
            {deps.map((d) => (
              <motion.li
                key={d.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="group/dep flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[.05]"
              >
                {d.done ? <CheckCircle2 size={14} className="shrink-0 text-emerald-400" /> : <Circle size={14} className="shrink-0 text-amber-400" />}
                <button
                  dir="auto"
                  onClick={() => openDrawer(d.id)}
                  className={clsx('min-w-0 flex-1 truncate text-start text-sm', d.done ? 'text-stone-500 line-through' : 'text-stone-200')}
                >
                  {d.title}
                </button>
                <button
                  title="Remove"
                  onClick={() => update(item.id, { dependsOn: item.dependsOn.filter((x) => x !== d.id) })}
                  className="rounded-md p-0.5 text-stone-500 opacity-0 transition hover:bg-white/10 hover:text-stone-200 group-hover/dep:opacity-100 max-md:opacity-100"
                >
                  <X size={13} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="mb-2 px-1 text-sm text-stone-500">Doesn’t wait on anything yet.</p>
      )}
      <Select
        value={null}
        onChange={(v) => update(item.id, { dependsOn: [...item.dependsOn, v] })}
        options={options}
        placeholder="Add a task this waits on…"
        searchable
        searchPlaceholder="Search tasks…"
        icon={Plus}
      />
    </div>
  );
}
