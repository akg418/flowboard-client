import { arrayMove } from '@dnd-kit/sortable';

export const sortByOrder = (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt);

export function childrenMap(items) {
  const map = new Map();
  for (const it of items) {
    const p = it.parent || null;
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(it);
  }
  for (const list of map.values()) list.sort(sortByOrder);
  return map;
}

export function descendantIds(items, id) {
  const map = childrenMap(items);
  const out = [];
  const stack = [id];
  while (stack.length) {
    const kids = map.get(stack.pop()) || [];
    for (const k of kids) {
      out.push(k.id);
      stack.push(k.id);
    }
  }
  return out;
}

export function ancestors(items, id) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = [];
  let cur = byId.get(id)?.parent;
  while (cur && byId.has(cur)) {
    out.unshift(byId.get(cur));
    cur = byId.get(cur).parent;
  }
  return out;
}

/** Progress of an item's subtree: { done, total } */
export function progress(items, id) {
  const ids = new Set(descendantIds(items, id));
  let done = 0;
  for (const it of items) if (ids.has(it.id) && it.done) done++;
  return { done, total: ids.size };
}

/** { done, total } for every item's subtree, in one pass. */
export function progressMap(items) {
  const map = childrenMap(items);
  const out = new Map();
  const walk = (id) => {
    let done = 0, total = 0;
    for (const k of map.get(id) || []) {
      const sub = walk(k.id);
      done += sub.done + (k.done ? 1 : 0);
      total += sub.total + 1;
    }
    const res = { done, total };
    if (id) out.set(id, res);
    return res;
  };
  walk(null);
  return out;
}

/** Blocked = has a dependency that's not done yet. */
export function isBlocked(item, byId) {
  return item.dependsOn.some((d) => byId.get(d) && !byId.get(d).done);
}

/**
 * Flattens the tree under `rootId` (null = top level) into rows with depth.
 * `rootFilter` decides which top-level children show; collapsed items hide their subtree.
 */
/** id → { ids, anyOpen }: the rows inside each item (at any depth) that have something inside them. */
export function innerFoldMap(items) {
  const map = childrenMap(items);
  const out = new Map();
  const visit = (id) => {
    if (out.has(id)) return out.get(id);
    const ids = [];
    let anyOpen = false;
    for (const k of map.get(id) || []) {
      if (!map.has(k.id)) continue;
      ids.push(k.id);
      anyOpen ||= !k.collapsed;
      const sub = visit(k.id);
      ids.push(...sub.ids);
      anyOpen ||= sub.anyOpen;
    }
    const r = { ids, anyOpen };
    out.set(id, r);
    return r;
  };
  for (const it of items) visit(it.id);
  return out;
}

export function flatten(items, rootId = null, rootFilter = () => true) {
  const map = childrenMap(items);
  const rows = [];
  const walk = (parentId, depth) => {
    for (const it of map.get(parentId) || []) {
      if (depth === 0 && !rootFilter(it)) continue;
      const kids = map.get(it.id) || [];
      rows.push({ ...it, depth, parentId, childCount: kids.length });
      if (!it.collapsed) walk(it.id, depth + 1);
    }
  };
  walk(rootId, 0);
  return rows;
}

export function removeChildrenOf(rows, ids) {
  const exclude = new Set(ids);
  return rows.filter((r) => {
    if (r.parentId && exclude.has(r.parentId)) {
      exclude.add(r.id);
      return false;
    }
    return true;
  });
}

/** Where would the dragged row land (depth + parent) given the horizontal offset. */
export function getProjection(rows, activeId, overId, offsetX, indent, rootId) {
  const overIndex = rows.findIndex((r) => r.id === overId);
  const activeIndex = rows.findIndex((r) => r.id === activeId);
  const active = rows[activeIndex];
  const moved = arrayMove(rows, activeIndex, overIndex);
  const prev = moved[overIndex - 1];
  const next = moved[overIndex + 1];
  const projected = active.depth + Math.round(offsetX / indent);
  // Don't drop into a collapsed row: its hidden children would clash on order.
  const maxDepth = prev ? prev.depth + (prev.collapsed && prev.childCount ? 0 : 1) : 0;
  const minDepth = next ? next.depth : 0;
  const depth = Math.min(Math.max(projected, minDepth), maxDepth);

  let parentId = rootId;
  if (depth > 0 && prev) {
    if (depth === prev.depth) parentId = prev.parentId;
    else if (depth > prev.depth) parentId = prev.id;
    else
      parentId =
        moved.slice(0, overIndex).reverse().find((r) => r.depth === depth)?.parentId ?? rootId;
  }
  return { depth, parentId };
}

/** Builds the minimal list of {id,parent,order} writes after a drop. */
export function computeMoves(rows, activeId, overId, projection) {
  const activeIndex = rows.findIndex((r) => r.id === activeId);
  const overIndex = rows.findIndex((r) => r.id === overId);
  const next = arrayMove(
    rows.map((r) => (r.id === activeId ? { ...r, depth: projection.depth, parentId: projection.parentId } : r)),
    activeIndex,
    overIndex
  );
  const counters = new Map();
  const moves = [];
  for (const r of next) {
    const order = counters.get(r.parentId) ?? 0;
    counters.set(r.parentId, order + 1);
    if (r.order !== order || (r.parent || null) !== (r.parentId || null))
      moves.push({ id: r.id, parent: r.parentId || null, order });
  }
  return moves;
}
