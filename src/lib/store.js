import { create } from 'zustand';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import { descendantIds } from './tree';
import { ask } from '../components/ui/Dialog';

let toastSeq = 0;

const HISTORY_LIMIT = 5;
const UI_ONLY = ['collapsed']; // view-state changes that shouldn't land in undo history

/** Applies a { upsert, remove } snapshot to the local list (removes take their subtrees). */
function applySnapshot(items, { upsert = [], remove = [] }) {
  const gone = new Set(remove.flatMap((id) => [id, ...descendantIds(items, id)]));
  const byId = new Map(upsert.map((d) => [d.id, d]));
  const kept = items.filter((i) => !gone.has(i.id)).map((i) => byId.get(i.id) ?? i);
  const known = new Set(kept.map((i) => i.id));
  return [...kept, ...upsert.filter((d) => !known.has(d.id))];
}

// Privacy mode is a sandbox: changes stay in this browser (never reach the server) and are
// erased when it's turned off. Other devices see the server's dummy data without them.
const sandboxKey = () => `flowboard.sandbox.${useStore.getState().user?.id}`;
const sandbox = {
  read: () => {
    try {
      return JSON.parse(localStorage.getItem(sandboxKey()));
    } catch {
      return null;
    }
  },
  save: (items) => {
    try {
      localStorage.setItem(sandboxKey(), JSON.stringify(items));
    } catch {}
  },
  clear: () => {
    try {
      localStorage.removeItem(sandboxKey());
    } catch {}
  },
};

let localSeq = 0;
const now = () => new Date().toISOString();

/** Stands in for the item routes while privacy mode is on; the store already applies the change locally. */
const local = {
  create: async (data) => {
    const { items } = useStore.getState();
    const parent = data.parent || null;
    const siblings = items.filter((i) => (i.parent || null) === parent);
    return {
      description: '', kind: 'task', order: siblings.length ? Math.max(...siblings.map((i) => i.order)) + 1 : 0,
      done: false, someday: false, start: null, end: null, allDay: false, remindBefore: null,
      dependsOn: [], color: null, collapsed: false, inProgress: false, timeSpent: 0, timerStartedAt: null,
      ...data,
      parent,
      id: `local-${Date.now()}-${++localSeq}`,
      completedAt: data.done ? now() : null,
      createdAt: now(),
      updatedAt: now(),
    };
  },
  update: async (id, patch) => {
    const item = useStore.getState().items.find((i) => i.id === id);
    const completedAt = 'done' in patch ? (patch.done ? now() : null) : item?.completedAt;
    return { ...item, ...patch, completedAt, updatedAt: now() };
  },
  remove: async () => ({}),
  sync: async () => ({ ok: true }),
  reorder: async () => ({ ok: true }),
};
const backend = () => (useStore.getState().privacy ? local : api);

const pref = (key, fallback) => {
  try {
    const v = localStorage.getItem(`flowboard.${key}`);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
const savePref = (key, value) => {
  try {
    localStorage.setItem(`flowboard.${key}`, JSON.stringify(value));
  } catch {}
};

export const useStore = create((set, get) => ({
  user: null,
  authChecked: !tokenStore.get(), // nothing to verify without a token
  items: [],
  loaded: false,
  drawerId: null,
  toasts: [],
  navCollapsed: pref('navCollapsed', false),
  navWidth: pref('navWidth', 260),
  notePreview: pref('notePreview', false),
  drawerWidth: pref('drawerWidth', 448),
  navFolded: pref('navFolded', []), // sidebar projects whose sub-projects are hidden
  projectsHidden: pref('projectsHidden', false), // the whole Projects list in the sidebar
  azkarOn: pref('azkarOn', true),
  privacy: false, // the account's privacy mode: the server sends dummy data and refuses changes
  dropTarget: null, // sidebar target under the pointer while dragging a tree row
  sessionOpen: false,
  sessionPreset: null,
  past: [], // undo stack: { label, before, after } snapshots
  future: [],

  setPref: (key, value) => {
    savePref(key, value);
    set({ [key]: value });
  },
  setDropTarget: (dropTarget) => get().dropTarget !== dropTarget && set({ dropTarget }),
  setSessionOpen: (sessionOpen, sessionPreset = null) => set({ sessionOpen, sessionPreset }),

  toast: (message, opts = {}) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, message, ...opts }] }));
    if (!opts.sticky) setTimeout(() => get().dismiss(id), opts.duration || 3500);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  openDrawer: (id) => set({ drawerId: id }),
  closeDrawer: () => set({ drawerId: null }),

  // Verifies a stored token on startup.
  restoreSession: async () => {
    if (!tokenStore.get()) return set({ authChecked: true });
    try {
      const { user } = await api.me();
      set({ user, privacy: !!user.privacy, authChecked: true });
      if (!user.privacy) sandbox.clear(); // turned off on another device
    } catch {
      tokenStore.set(null);
      set({ user: null, authChecked: true });
    }
  },

  signIn: async (mode, username, password) => {
    const { token, user } = await (mode === 'register' ? api.register(username, password) : api.login(username, password));
    tokenStore.set(token);
    set({ user, privacy: !!user.privacy, items: [], loaded: false });
  },

  // Turning privacy off needs the password. Either way the sandbox starts empty, the data is
  // reloaded (masked or real), and the undo history is dropped so it can't bring the other version back.
  setPrivacy: async (on, password) => {
    const user = await api.setPrivacy(on, password);
    set({ user, privacy: !!user.privacy, items: [], loaded: false, drawerId: null, past: [], future: [] });
    sandbox.clear();
    await get().load();
  },

  signOut: () => {
    if (get().user) sandbox.clear();
    tokenStore.set(null);
    set({ user: null, privacy: false, items: [], loaded: false, drawerId: null, toasts: [], past: [], future: [] });
  },

  load: async () => {
    try {
      const saved = get().privacy ? sandbox.read() : null;
      set({ items: Array.isArray(saved) ? saved : await api.list(), loaded: true });
    } catch (e) {
      set({ loaded: true });
      get().toast(`Can't reach the server: ${e.message}`, { tone: 'error' });
    }
  },

  record: (label, before, after) =>
    set((s) => ({ past: [...s.past, { label, before, after }].slice(-HISTORY_LIMIT), future: [] })),

  undo: () => get().travel('past', 'future', 'before', 'Undid'),
  redo: () => get().travel('future', 'past', 'after', 'Redid'),

  // Moves one entry between the undo and redo stacks and writes its snapshot back.
  travel: async (from, to, side, verb) => {
    const entry = get()[from].at(-1);
    if (!entry) return get().toast(from === 'past' ? 'Nothing to undo' : 'Nothing to redo', { duration: 1500 });
    set((s) => ({
      [from]: s[from].slice(0, -1),
      [to]: [...s[to], entry],
      items: applySnapshot(s.items, entry[side]),
    }));
    get().toast(`${verb}: ${entry.label}`, { duration: 2000 });
    try {
      await backend().sync({ ...entry[side], log: { action: from === 'past' ? 'undo' : 'redo', label: entry.label } });
    } catch (e) {
      get().toast(e.message, { tone: 'error' });
      get().load();
    }
  },

  create: async (data) => {
    try {
      const item = await backend().create(data);
      set((s) => ({ items: [...s.items, item] }));
      get().record(`add “${item.title}”`, { remove: [item.id] }, { upsert: [item] });
      return item;
    } catch (e) {
      get().toast(e.message, { tone: 'error' });
    }
  },

  update: async (id, patch) => {
    const prev = get().items;
    const before = prev.find((i) => i.id === id);
    // Starting or finishing a task that still waits on others asks first.
    const finishing = patch.done === true && !before?.done;
    const starting = patch.inProgress === true && !before?.inProgress && !patch.done;
    if (before && (finishing || starting)) {
      const open = before.dependsOn.map((d) => prev.find((i) => i.id === d)).filter((d) => d && !d.done);
      if (open.length) {
        const n = open.length;
        const ok = await ask({
          warn: true,
          title: `“${before.title}” is waiting on ${n} task${n > 1 ? 's' : ''}`,
          message: `It depends on ${n > 1 ? 'these tasks' : 'this task'}, and ${n > 1 ? 'they aren’t' : 'it isn’t'} done yet. ${finishing ? 'Mark it done' : 'Start it'} anyway?`,
          list: open.map((d) => d.title),
          confirmText: finishing ? 'Mark done anyway' : 'Start anyway',
        });
        if (!ok) return false;
      }
    }
    // Finishing a task stops its timer and keeps the time spent.
    if (patch.done === true && before) {
      patch = { ...patch, inProgress: false };
      if (before.timerStartedAt)
        Object.assign(patch, {
          timeSpent: Math.round((before.timeSpent || 0) + (Date.now() - new Date(before.timerStartedAt)) / 1000),
          timerStartedAt: null,
        });
    }
    set({ items: prev.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
    try {
      const item = await backend().update(id, patch);
      set((s) => ({ items: s.items.map((i) => (i.id === id ? item : i)) }));
      if (patch.done === true && item.repeat && !get().privacy) get().load(); // the server lined up the next occurrence
      if (before && !Object.keys(patch).every((k) => UI_ONLY.includes(k)))
        get().record(`edit “${item.title}”`, { upsert: [before] }, { upsert: [item] });
    } catch (e) {
      set({ items: prev });
      get().toast(e.message, { tone: 'error' });
    }
  },

  // Folds (or unfolds) many rows at once. View state only: no undo entry.
  setCollapsed: async (ids, collapsed) => {
    const change = new Set(ids);
    if (!change.size) return;
    const prev = get().items;
    set({ items: prev.map((i) => (change.has(i.id) ? { ...i, collapsed } : i)) });
    try {
      await Promise.all([...change].map((id) => backend().update(id, { collapsed })));
    } catch (e) {
      set({ items: prev });
      get().toast(e.message, { tone: 'error' });
    }
  },

  remove: async (id) => {
    const prev = get().items;
    const gone = new Set([id, ...descendantIds(prev, id)]);
    const dependents = prev.filter((i) => !gone.has(i.id) && i.dependsOn.some((d) => gone.has(d)));
    const unlinked = dependents.map((i) => ({ ...i, dependsOn: i.dependsOn.filter((d) => !gone.has(d)) }));
    set({
      items: applySnapshot(prev, { remove: [id], upsert: unlinked }),
      drawerId: gone.has(get().drawerId) ? null : get().drawerId,
    });
    try {
      await backend().remove(id);
      get().record(
        `delete “${prev.find((i) => i.id === id)?.title}”`,
        { upsert: [...prev.filter((i) => gone.has(i.id)), ...dependents] },
        { remove: [id], upsert: unlinked }
      );
    } catch (e) {
      set({ items: prev });
      get().toast(e.message, { tone: 'error' });
    }
  },

  reorder: async (moves) => {
    if (!moves.length) return;
    const prev = get().items;
    const byId = new Map(moves.map((m) => [m.id, m]));
    set({
      items: prev.map((i) =>
        byId.has(i.id) ? { ...i, parent: byId.get(i.id).parent, order: byId.get(i.id).order } : i
      ),
    });
    try {
      await backend().reorder(moves);
      const after = get().items;
      get().record(
        'move',
        { upsert: prev.filter((i) => byId.has(i.id)) },
        { upsert: after.filter((i) => byId.has(i.id)) }
      );
    } catch (e) {
      set({ items: prev });
      get().toast(e.message, { tone: 'error' });
    }
  },
}));

setUnauthorizedHandler(() => useStore.getState().user && useStore.getState().signOut());

// Keeps the privacy sandbox across reloads on this device.
useStore.subscribe((s, prev) => {
  if (s.privacy && s.loaded && s.items !== prev.items) sandbox.save(s.items);
});
