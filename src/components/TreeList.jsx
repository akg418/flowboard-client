import { useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronsDownUp, ChevronsUpDown, CornerDownRight } from 'lucide-react';
import TaskRow from './TaskRow';
import { useStore } from '../lib/store';
import { childrenMap, computeMoves, flatten, innerFoldMap, getProjection, progressMap, removeChildrenOf } from '../lib/tree';
import { createFromText } from '../lib/actions';
import { dropOn, dropTargetAt, useHoverExpand } from '../lib/drop';
import { useProjectSuggest } from './ProjectSuggest';
import { hideArchived, useNow } from '../lib/archive';

const INDENT = 26;

function SortableRow({ row, depth, ...rest }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}>
      <TaskRow row={row} depth={depth} ghost={isDragging} handleProps={{ ...attributes, ...listeners }} {...rest} />
    </div>
  );
}

function InlineAdd({ depth, onDone, parent }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  const suggest = useProjectSuggest(text, setText, ref);
  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{ paddingLeft: depth * INDENT + 30 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return onDone();
        await createFromText(text, { parent });
        setText('');
      }}
      className="relative flex items-center gap-2 py-1"
    >
      <CornerDownRight size={14} className="text-stone-300" />
      <input
        ref={ref}
        autoFocus
        dir="auto"
        value={text}
        {...suggest.inputProps}
        onChange={(e) => {
          setText(e.target.value);
          suggest.onChange(e);
        }}
        onBlur={() => !text && onDone()}
        onKeyDown={(e) => !suggest.onKeyDown(e) && e.key === 'Escape' && onDone()}
        placeholder="Add inside… (Enter to save, Esc to close)"
        className="input py-1.5"
      />
      {suggest.dropdown}
    </motion.form>
  );
}

export default function TreeList({ rootId = null, rootFilter, empty }) {
  const items = useStore((s) => s.items);
  const reorder = useStore((s) => s.reorder);
  const update = useStore((s) => s.update);
  const setDropTarget = useStore((s) => s.setDropTarget);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [offsetX, setOffsetX] = useState(0);
  const [addingTo, setAddingTo] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const progressById = useMemo(() => progressMap(items), [items]);
  const now = useNow();
  const shown = useMemo(() => hideArchived(items, now), [items, now]);
  const rows = useMemo(() => flatten(shown, rootId, rootFilter), [shown, rootId, rootFilter]);
  const visible = useMemo(() => (activeId ? removeChildrenOf(rows, [activeId]) : rows), [rows, activeId]);
  const projection = activeId && overId ? getProjection(visible, activeId, overId, offsetX, INDENT, rootId) : null;
  const activeRow = activeId && rows.find((r) => r.id === activeId);
  // Every row in this tree (hidden ones too) that has something inside it.
  const foldable = useMemo(() => {
    const map = childrenMap(shown);
    const out = [];
    const walk = (parentId, depth) =>
      (map.get(parentId) || []).forEach((it) => {
        if (depth === 0 && rootFilter && !rootFilter(it)) return;
        if (map.has(it.id)) out.push(it);
        walk(it.id, depth + 1);
      });
    walk(rootId, 0);
    return out;
  }, [shown, rootId, rootFilter]);
  const anyOpen = foldable.some((it) => !it.collapsed);
  const innerFold = useMemo(() => innerFoldMap(items), [items]);
  const overRow = activeId && overId !== activeId ? byId.get(overId) : null;
  const overClosed = overRow?.collapsed && rows.find((r) => r.id === overId)?.childCount > 0;
  useHoverExpand(overClosed && overId, () => update(overId, { collapsed: false }));

  const reset = () => {
    setDropTarget(null);
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  };

  const addChild = (id) => {
    const it = byId.get(id);
    if (it?.collapsed) update(id, { collapsed: false });
    setAddingTo(id);
  };

  if (!rows.length) return empty ?? null;

  return (
    <>
    {foldable.length > 0 && (
      <div className="-mt-2 mb-1 flex justify-end">
        <button
          onClick={() => useStore.getState().setCollapsed(foldable.filter((it) => !!it.collapsed !== anyOpen).map((it) => it.id), anyOpen)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-stone-500 transition hover:bg-white/[.05] hover:text-stone-200"
        >
          {anyOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
          {anyOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
    )}
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => {
        setActiveId(active.id);
        setOverId(active.id);
      }}
      onDragMove={({ delta, activatorEvent }) => {
        setOffsetX(delta.x);
        const p = activatorEvent.touches?.[0] ?? activatorEvent;
        setDropTarget(dropTargetAt(p.clientX + delta.x, p.clientY + delta.y));
      }}
      onDragOver={({ over }) => setOverId(over?.id ?? null)}
      onDragEnd={({ active, over }) => {
        const target = useStore.getState().dropTarget;
        if (target) dropOn(target, active.id);
        else if (projection && over) reorder(computeMoves(visible, active.id, over.id, projection));
        reset();
      }}
      onDragCancel={reset}
    >
      <SortableContext items={visible.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <AnimatePresence initial={false}>
          {visible.map((row) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
              transition={{ duration: 0.2 }}
            >
              <SortableRow
                row={row}
                depth={row.id === activeId && projection ? projection.depth : row.depth}
                indent={INDENT}
                prog={row.childCount ? progressById.get(row.id) : null}
                onAddChild={addChild}
                inner={innerFold.get(row.id)}
              />
              <AnimatePresence>
                {addingTo === row.id && (
                  <InlineAdd depth={row.depth + 1} parent={row.id} onDone={() => setAddingTo(null)} />
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180 }}>
        {activeRow && <TaskRow row={activeRow} depth={0} indent={INDENT} clone />}
      </DragOverlay>
    </DndContext>
    </>
  );
}
