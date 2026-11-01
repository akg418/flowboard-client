import { useEffect, useState } from 'react';
import { childrenMap } from './tree';

/** Done items leave the lists this long after they were finished; they live on in Done. */
export const ARCHIVE_AFTER = 10 * 60_000;

export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const isArchived = (it, now) =>
  it.done && (!it.completedAt || now - new Date(it.completedAt) >= ARCHIVE_AFTER);

/** Drops archived items whose whole subtree is archived too (an open task inside keeps its parent visible). */
export function hideArchived(items, now) {
  const map = childrenMap(items);
  const keep = new Map();
  const visit = (it) => {
    if (keep.has(it.id)) return keep.get(it.id);
    let k = !isArchived(it, now);
    for (const c of map.get(it.id) || []) if (visit(c)) k = true;
    keep.set(it.id, k);
    return k;
  };
  return items.filter(visit);
}

const isTimed = (it) => it.start && !it.allDay && !it.done && it.kind !== 'project';
const span = (it) => {
  const s = new Date(it.start).getTime();
  const e = it.end ? new Date(it.end).getTime() : 0;
  return [s, e > s ? e : s + 60_000]; // no end = a one-minute point
};

/** Pairs of open, timed items whose times overlap. Items nested in one another (a session and its tasks) don't count. */
export function overlaps(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const isAncestor = (a, b) => {
    for (let p = byId.get(b.id)?.parent; p; p = byId.get(p)?.parent) if (p === a.id) return true;
    return false;
  };
  const timed = items.filter(isTimed).map((it) => ({ it, s: span(it) })).sort((a, b) => a.s[0] - b.s[0]);
  const pairs = [];
  for (let i = 0; i < timed.length; i++)
    for (let j = i + 1; j < timed.length && timed[j].s[0] < timed[i].s[1]; j++) {
      const a = timed[i].it, b = timed[j].it;
      if (!isAncestor(a, b) && !isAncestor(b, a)) pairs.push([a, b]);
    }
  return pairs;
}

/** id → the items it overlaps. */
export function overlapMap(items) {
  const out = new Map();
  for (const [a, b] of overlaps(items)) {
    out.set(a.id, [...(out.get(a.id) || []), b]);
    out.set(b.id, [...(out.get(b.id) || []), a]);
  }
  return out;
}

let cache = { items: null, map: new Map() };
/** overlapMap of the store's items, computed once per change and shared by every row. */
export function overlapsOf(items) {
  if (cache.items !== items) cache = { items, map: overlapMap(items) };
  return cache.map;
}
