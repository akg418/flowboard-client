import { useEffect } from 'react';
import { startOfDay } from 'date-fns';
import { useStore } from './store';
import { childrenMap, descendantIds } from './tree';

/** Moves an item to `day`, keeping its time (and duration) if it has one. */
export function moveToDay(id, day) {
  const { items, update } = useStore.getState();
  const it = items.find((i) => i.id === id);
  if (!it || !day) return;
  const next = startOfDay(day);
  if (it.start && !it.allDay) {
    const old = new Date(it.start);
    next.setHours(old.getHours(), old.getMinutes());
    const end = it.end ? new Date(next.getTime() + (new Date(it.end) - old)).toISOString() : null;
    update(id, { start: next.toISOString(), end, someday: false });
  } else update(id, { start: next.toISOString(), allDay: true, someday: false });
}

/** Where on a row the pointer is: top quarter = before, bottom quarter = after, middle = inside. */
export function zoneAt(el, clientY) {
  const r = el.getBoundingClientRect();
  const y = (clientY - r.top) / r.height;
  return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
}

/** Moves `id` inside `targetId`, or right before/after it among its siblings. One undo step. */
export function moveRelative(id, targetId, zone) {
  const { items, reorder, update, toast } = useStore.getState();
  const it = items.find((i) => i.id === id);
  const target = items.find((i) => i.id === targetId);
  if (!it || !target || id === targetId) return;
  if (descendantIds(items, id).includes(targetId)) return toast("Can't move an item inside itself", { tone: 'error' });

  const parent = zone === 'inside' ? targetId : target.parent || null;
  const siblings = (childrenMap(items).get(parent) || []).filter((i) => i.id !== id);
  const at = zone === 'inside' ? siblings.length : siblings.findIndex((i) => i.id === targetId) + (zone === 'after' ? 1 : 0);
  siblings.splice(at, 0, it);
  const moves = siblings
    .map((s, order) => ({ id: s.id, parent, order, changed: s.order !== order || (s.parent || null) !== parent }))
    .filter((m) => m.changed)
    .map(({ changed, ...m }) => m);

  // Landing among top-level "Later" items (or leaving them) flips the someday flag.
  const someday = zone !== 'inside' && !parent ? !!target.someday : false;
  if (!!it.someday !== someday) update(id, { someday });
  if (zone === 'inside' && target.collapsed) update(targetId, { collapsed: false });
  reorder(moves);
  if (zone === 'inside' && (it.parent || null) !== targetId) toast(`“${it.title}” → ${target.title}`);
}

/**
 * Applies a drop on a sidebar target: "tasks" | "today" | "later" | "project:<id>|<zone>".
 */
export function dropOn(target, id) {
  const { items, update, toast } = useStore.getState();
  const it = items.find((i) => i.id === id);
  if (!it || !target) return;
  const lastOrder = (parent) =>
    Math.max(-1, ...items.filter((i) => (i.parent || null) === parent && i.id !== id).map((i) => i.order)) + 1;

  if (target === 'today') {
    moveToDay(id, new Date());
    toast(`“${it.title}” → Today`);
  } else if (target === 'later') {
    update(id, { someday: true, start: null, end: null, parent: null, order: lastOrder(null) });
    toast(`“${it.title}” → Later`);
  } else if (target === 'tasks') {
    update(id, { someday: false, parent: null, order: lastOrder(null) });
    toast(`“${it.title}” → Tasks`);
  } else if (target.startsWith('project:')) {
    const [key, zone = 'inside'] = target.split('|');
    moveRelative(id, key.slice(8), zone);
  }
}

/** Props that make an element a native drop zone for dragged items (calendar chips, Today rows). */
export function nativeDropProps(onDropId, setOver) {
  return {
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes('text/plain')) return;
      e.preventDefault();
      setOver?.(true);
    },
    onDragLeave: () => setOver?.(false),
    onDrop: (e) => {
      e.preventDefault();
      setOver?.(false);
      const id = e.dataTransfer.getData('text/plain');
      if (id) onDropId(id);
    },
  };
}

/** Pointer position → sidebar drop target key; rows with data-drop-zones add "|before|inside|after". */
export function dropTargetAt(x, y) {
  for (const el of document.elementsFromPoint(x, y)) {
    const t = el.closest?.('[data-drop]');
    if (t) return 'dropZones' in t.dataset ? `${t.dataset.drop}|${zoneAt(t, y)}` : t.dataset.drop;
  }
  return null;
}

const DRAG_TYPE = 'application/x-flowboard-item';

/** Props for a native draggable item. */
export const dragProps = (id) => ({
  draggable: true,
  onDragStart: (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setData(DRAG_TYPE, id);
    e.dataTransfer.effectAllowed = 'move';
  },
});

/** Native drop with before/inside/after zones on a row. `setZone` drives the indicator. */
export function zoneDropProps(targetId, setZone) {
  const ok = (e) => e.dataTransfer.types.includes(DRAG_TYPE) || e.dataTransfer.types.includes('text/plain');
  return {
    onDragOver: (e) => {
      if (!ok(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setZone(zoneAt(e.currentTarget, e.clientY));
    },
    onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setZone(null),
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const zone = zoneAt(e.currentTarget, e.clientY);
      setZone(null);
      const id = e.dataTransfer.getData(DRAG_TYPE) || e.dataTransfer.getData('text/plain');
      if (id && id !== targetId) moveRelative(id, targetId, zone);
    },
  };
}

/** While `active` stays true for `delay` ms (a drag hovering a closed folder), calls `onExpand`. */
export function useHoverExpand(active, onExpand, delay = 550) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(onExpand, delay);
    return () => clearTimeout(t);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
}
