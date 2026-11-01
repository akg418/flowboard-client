import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { ChevronRight, FolderClosed, FolderOpen, GripVertical, Plus, Trash2 } from 'lucide-react';
import PageHeader, { Empty } from '../components/PageHeader';
import { useStore } from '../lib/store';
import { childrenMap, computeMoves, getProjection, removeChildrenOf } from '../lib/tree';
import { confirmDelete } from '../lib/actions';
import { openContextMenu } from '../components/ContextMenu';
import { ask } from '../components/ui/Dialog';

export default function ProjectsView() {
  const items = useStore((s) => s.items);
  const loaded = useStore((s) => s.loaded);
  const create = useStore((s) => s.create);
  const folded = useStore((s) => s.navFolded);
  const setPref = useStore((s) => s.setPref);

  const reorder = useStore((s) => s.reorder);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [offsetX, setOffsetX] = useState(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Projects only, nested under their nearest project (a project inside a task still shows).
  // `viaTask`: its real parent is a task, so it only moves when it's the one dragged.
  const rows = useMemo(() => {
    const map = childrenMap(items);
    const hidden = new Set(folded);
    const hasSub = (id) => (map.get(id) || []).some((k) => k.kind === 'project' || hasSub(k.id));
    const out = [];
    const walk = (p, d, proj) =>
      (map.get(p) || []).forEach((it) => {
        if (it.kind !== 'project') return walk(it.id, d, proj);
        const sub = hasSub(it.id);
        out.push({ ...it, depth: d, parentId: proj, viaTask: (it.parent || null) !== proj, childCount: sub ? 1 : 0, collapsed: hidden.has(it.id) });
        if (!hidden.has(it.id)) walk(it.id, d + 1, it.id);
      });
    walk(null, 0, null);
    return out;
  }, [items, folded]);
  const visible = useMemo(() => (activeId ? removeChildrenOf(rows, [activeId]) : rows), [rows, activeId]);
  const projection = activeId && overId ? getProjection(visible, activeId, overId, offsetX, INDENT, null) : null;
  const activeRow = activeId && rows.find((r) => r.id === activeId);
  // Tasks only: sub-projects aren't something to finish.
  const prog = useMemo(() => {
    const map = childrenMap(items);
    const out = new Map();
    const walk = (id) => {
      let done = 0, total = 0;
      for (const k of map.get(id) || []) {
        const sub = walk(k.id);
        done += sub.done + (k.kind !== 'project' && k.done ? 1 : 0);
        total += sub.total + (k.kind !== 'project' ? 1 : 0);
      }
      out.set(id, { done, total });
      return { done, total };
    };
    walk(null);
    return out;
  }, [items]);
  const total = items.filter((i) => i.kind === 'project').length;

  const reset = () => (setActiveId(null), setOverId(null), setOffsetX(0));
  const drop = ({ active, over }) => {
    if (projection && over) {
      const viaTask = new Set(visible.filter((r) => r.viaTask && r.id !== active.id).map((r) => r.id));
      reorder(computeMoves(visible, active.id, over.id, projection).filter((m) => !viaTask.has(m.id)));
    }
    reset();
  };

  const newProject = async (parent = null) => {
    const name = await ask({ title: parent ? 'New sub-project' : 'New project', input: true, placeholder: 'Project name', confirmText: 'Create' });
    if (name) await create({ title: name, kind: 'project', parent });
  };
  const toggle = (id) => setPref('navFolded', folded.includes(id) ? folded.filter((f) => f !== id) : [...folded, id]);

  return (
    <>
      <PageHeader title="Projects" subtitle="Drag to reorder · drag right to nest a project inside the one above">
        <button onClick={() => newProject()} className="btn-primary">
          <Plus size={15} /> New project
        </button>
      </PageHeader>
      {loaded && !total && <Empty icon="📁" title="No projects yet" text="Create one above, or write “#Website” in a task." />}
      {rows.length > 0 && (
        <div className="card p-1.5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => (setActiveId(active.id), setOverId(active.id))}
            onDragMove={({ delta }) => setOffsetX(delta.x)}
            onDragOver={({ over }) => setOverId(over?.id ?? null)}
            onDragEnd={drop}
            onDragCancel={reset}
          >
            <SortableContext items={visible.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              {visible.map((p) => (
                <SortableProject
                  key={p.id}
                  p={p}
                  depth={p.id === activeId && projection ? projection.depth : p.depth}
                  prog={prog.get(p.id)}
                  onToggle={toggle}
                  onAdd={newProject}
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 180 }}>
              {activeRow && <ProjectRow p={activeRow} depth={0} prog={prog.get(activeRow.id)} clone />}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </>
  );
}

const INDENT = 24;

function SortableProject({ p, depth, ...rest }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={clsx(isDragging && 'opacity-40')}>
      <ProjectRow p={p} depth={depth} handleProps={{ ...attributes, ...listeners }} {...rest} />
    </div>
  );
}

function ProjectRow({ p, depth, prog = { done: 0, total: 0 }, handleProps, clone, onToggle, onAdd }) {
  const open = prog.total - prog.done;
  const color = p.color || 'var(--color-accent-500)';
  const stop = (fn) => (e) => (e.preventDefault(), e.stopPropagation(), fn());
  return (
    <Link
      to={`/p/${p.id}`}
      onContextMenu={clone ? undefined : (e) => openContextMenu(e, p)}
      style={{ paddingLeft: 4 + (clone ? 0 : depth * INDENT) }}
      className={clsx('group flex items-center gap-2 rounded-xl py-2.5 pr-2 transition-colors', clone ? 'bg-stone-800 shadow-xl ring-1 ring-white/10' : 'hover:bg-white/[.04]')}
    >
      <span
        {...handleProps}
        onClick={(e) => (e.preventDefault(), e.stopPropagation())}
        className="cursor-grab touch-none text-stone-600 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing max-md:opacity-60"
        aria-label="Drag"
      >
        <GripVertical size={15} />
      </span>
      <span
        role={p.childCount ? 'button' : undefined}
        onClick={p.childCount ? stop(() => onToggle(p.id)) : undefined}
        className={clsx('-ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-md text-stone-500', p.childCount ? 'hover:bg-white/10 hover:text-stone-200' : 'invisible')}
      >
        <ChevronRight size={14} className={clsx('transition-transform duration-200', !p.collapsed && 'rotate-90')} />
      </span>
      {p.childCount && !p.collapsed ? <FolderOpen size={18} style={{ color }} className="shrink-0" /> : <FolderClosed size={18} style={{ color }} className="shrink-0" />}
      <span dir="auto" className="min-w-0 flex-1 truncate font-medium text-stone-200">{p.title}</span>
      <span className="text-xs tabular-nums text-stone-500">{open ? `${open} open` : prog.total ? 'all done' : 'empty'}</span>
      {prog.total > 0 && (
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10 max-sm:hidden">
          <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${(prog.done / prog.total) * 100}%` }} />
        </span>
      )}
      {!clone && (
        <span className="flex items-center opacity-0 transition group-hover:opacity-100 max-md:opacity-100">
          <button title="Add a sub-project" onClick={stop(() => onAdd(p.id))} className="rounded-lg p-1 text-stone-400 hover:bg-white/10 hover:text-stone-100">
            <Plus size={15} />
          </button>
          <button title="Delete project" onClick={stop(() => confirmDelete(p))} className="rounded-lg p-1 text-stone-400 hover:bg-rose-500/10 hover:text-rose-300">
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </Link>
  );
}
