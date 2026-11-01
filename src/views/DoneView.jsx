import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { format, isToday, isYesterday } from 'date-fns';
import { FolderClosed, RotateCcw, Video, Timer } from 'lucide-react';
import PageHeader, { Empty } from '../components/PageHeader';
import Checkbox from '../components/Checkbox';
import { useStore } from '../lib/store';
import { ancestors } from '../lib/tree';

const when = (d) => (isToday(d) ? `Today ${format(d, 'h:mm a')}` : isYesterday(d) ? `Yesterday ${format(d, 'h:mm a')}` : format(d, 'MMM d, h:mm a'));
const doneAt = (it) => (it.completedAt ? new Date(it.completedAt).getTime() : 0);

function DoneLine({ item, path }) {
  const update = useStore((s) => s.update);
  const openDrawer = useStore((s) => s.openDrawer);
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
      <div onClick={() => openDrawer(item.id)} className="group flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[.04]">
        <Checkbox checked onChange={() => update(item.id, { done: false })} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.kind === 'meeting' && <Video size={14} className="shrink-0 text-sky-500" />}
            {item.kind === 'session' && <Timer size={14} className="shrink-0 text-violet-400" />}
            <span dir="auto" className="truncate text-[14.5px] text-stone-400 line-through">{item.title}</span>
          </div>
          {path && <div dir="auto" className="truncate text-[11px] text-stone-500">{path}</div>}
        </div>
        {item.completedAt && <span className="shrink-0 text-xs tabular-nums text-stone-500">{when(new Date(item.completedAt))}</span>}
        <button
          title="Restore"
          onClick={(e) => {
            e.stopPropagation();
            update(item.id, { done: false });
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-400 opacity-0 transition hover:bg-white/10 hover:text-stone-100 group-hover:opacity-100 max-md:opacity-100"
        >
          <RotateCcw size={13} /> Restore
        </button>
      </div>
    </motion.div>
  );
}

export default function DoneView() {
  const items = useStore((s) => s.items);
  const loaded = useStore((s) => s.loaded);

  // Done items grouped under their nearest project; a project only shows when it holds something done.
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it.done || it.kind === 'project') continue;
      const path = ancestors(items, it.id);
      const pi = path.findLastIndex((p) => p.kind === 'project');
      const project = pi >= 0 ? path[pi] : null;
      const key = project?.id ?? null;
      if (!map.has(key)) map.set(key, { project, rows: [] });
      map.get(key).rows.push({ item: it, path: path.slice(pi + 1).map((p) => p.title).join(' › ') });
    }
    const out = [...map.values()];
    for (const g of out) g.rows.sort((a, b) => doneAt(b.item) - doneAt(a.item));
    return out.sort((a, b) => doneAt(b.rows[0].item) - doneAt(a.rows[0].item));
  }, [items]);

  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <>
      <PageHeader title="Done" subtitle={`${total} finished · finished tasks move here from the lists after 10 minutes`} />
      {loaded && !total && <Empty icon="🏁" title="Nothing done yet" text="Tick a task — 10 minutes later it leaves your lists and waits here." />}
      {groups.map(({ project, rows }) => (
        <section key={project?.id ?? 'none'} className="mb-6">
          <h2 className="mb-1 flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-stone-400">
            {project ? <FolderClosed size={13} style={{ color: project.color || 'var(--color-accent-500)' }} /> : null}
            <span dir="auto">{project ? ancestors(items, project.id).concat(project).map((p) => p.title).join(' › ') : 'No project'}</span>
            <span className="ml-1 font-normal opacity-70">{rows.length}</span>
          </h2>
          <div className="card p-1.5">
            <AnimatePresence initial={false}>
              {rows.map(({ item, path }) => <DoneLine key={item.id} item={item} path={path} />)}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </>
  );
}
