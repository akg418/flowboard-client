import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { create } from 'zustand';
import clsx from 'clsx';
import {
  Check, ChevronsDownUp, Link2, ChevronsUpDown, Copy, FolderClosed, Hourglass, ListTodo, Pause, PanelRightOpen,
  Pencil, Play, Plus, RotateCcw, ListChecks, Sunrise, Trash2,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { applyTitleEdit, confirmDelete, createFromText, foldInside } from '../lib/actions';
import { dropOn } from '../lib/drop';
import { innerFoldMap } from '../lib/tree';
import { pauseTimer, startTimer } from '../lib/timer';
import { ask } from './ui/Dialog';
import Popover from './ui/Popover';
import { DepsPanel } from './DepsChip';

const useMenu = create(() => ({ current: null, deps: null }));

/** onContextMenu handler: opens the app's menu for `item` instead of the browser's. */
export function openContextMenu(e, item) {
  e.preventDefault();
  e.stopPropagation();
  useMenu.setState({ current: { x: e.clientX, y: e.clientY, id: item.id } });
}

const close = () => useMenu.setState({ current: null });

function entries(it, items, at) {
  const isProject = it.kind === 'project';
  const hasKids = items.some((i) => i.parent === it.id);
  const inner = innerFoldMap(items).get(it.id);
  const { update, openDrawer, toast } = useStore.getState();
  const running = !!it.timerStartedAt;
  return [
    [
      { label: 'Open details', icon: PanelRightOpen, run: () => openDrawer(it.id) },
      {
        label: 'Rename…',
        icon: Pencil,
        run: async () => {
          const text = await ask({ title: 'Rename', input: true, defaultValue: it.title, confirmText: 'Save' });
          if (text && text !== it.title) applyTitleEdit(it, text);
        },
      },
      {
        label: isProject ? 'Add task inside…' : 'Add subtask…',
        icon: Plus,
        run: async () => {
          const text = await ask({ title: `Add inside “${it.title}”`, input: true, placeholder: 'e.g. call Omar tomorrow 5pm', confirmText: 'Add' });
          if (!text) return;
          if (it.collapsed) update(it.id, { collapsed: false });
          createFromText(text, { parent: it.id });
        },
      },
    ],
    [
      !isProject && {
        label: it.dependsOn.length ? `Dependencies (${it.dependsOn.length})…` : 'Add dependency…',
        icon: Link2,
        run: () => useMenu.setState({ deps: { id: it.id, ...at } }),
      },
      !isProject && (running
        ? { label: 'Pause timer', icon: Pause, run: () => pauseTimer(it) }
        : { label: 'Start — in progress', icon: Play, run: () => startTimer(it) }),
      !isProject && (it.done
        ? { label: 'Mark not done', icon: RotateCcw, run: () => update(it.id, { done: false }) }
        : { label: 'Mark done', icon: Check, run: () => update(it.id, { done: true }) }),
      hasKids && {
        label: it.collapsed ? 'Expand' : 'Collapse',
        icon: it.collapsed ? ChevronsUpDown : ChevronsDownUp,
        run: () => update(it.id, { collapsed: !it.collapsed }),
      },
      inner?.ids.length > 0 && {
        label: inner.anyOpen ? 'Collapse everything inside' : 'Expand everything inside',
        icon: inner.anyOpen ? ChevronsDownUp : ChevronsUpDown,
        run: () => foldInside(it, inner),
      },
    ],
    [
      !isProject && { label: 'Move to Today', icon: Sunrise, run: () => dropOn('today', it.id) },
      !it.someday && { label: 'Move to Later', icon: Hourglass, run: () => dropOn('later', it.id) },
      (it.parent || it.someday) && { label: 'Move to top level', icon: ListTodo, run: () => dropOn('tasks', it.id) },
      isProject
        ? { label: 'Turn into task', icon: ListChecks, run: () => update(it.id, { kind: 'task' }) }
        : { label: 'Turn into project', icon: FolderClosed, run: () => update(it.id, { kind: 'project' }) },
      {
        label: 'Copy title',
        icon: Copy,
        run: () => navigator.clipboard?.writeText(it.title).then(() => toast('Copied', { duration: 1200 })),
      },
    ],
    [{ label: 'Delete', icon: Trash2, danger: true, run: () => confirmDelete(it) }],
  ]
    .map((group) => group.filter(Boolean))
    .filter((group) => group.length);
}

export default function ContextMenuHost() {
  const cur = useMenu((s) => s.current);
  const item = useStore((s) => (cur ? s.items.find((i) => i.id === cur.id) : null));
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const [active, setActive] = useState(-1);

  const groups = item ? entries(item, useStore.getState().items, { x: cur.x, y: cur.y }) : [];
  const flat = groups.flat();

  useLayoutEffect(() => {
    if (!cur) return setPos(null);
    const el = ref.current;
    const w = el?.offsetWidth || 220, h = el?.offsetHeight || 320;
    setPos({
      left: Math.max(8, Math.min(cur.x, window.innerWidth - w - 8)),
      top: cur.y + h + 8 > window.innerHeight ? Math.max(8, cur.y - h) : cur.y,
    });
    setActive(-1);
  }, [cur]);

  useEffect(() => {
    if (!cur) return;
    const onDown = (e) => !ref.current?.contains(e.target) && close();
    const onKey = (e) => {
      if (e.key === 'Escape') return e.stopPropagation(), close();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((a) => (a + step + flat.length) % flat.length);
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        run(flat[active]);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('blur', close);
    };
  });

  useEffect(() => {
    if (cur && !item) close(); // item deleted while open
  }, [cur, item]);

  const run = (entry) => {
    close();
    entry.run();
  };

  let n = -1;
  return createPortal(
    <>
    <DepsPopover />
    <AnimatePresence>
      {cur && item && (
        <motion.div
          ref={ref}
          key={`${cur.id}-${cur.x}-${cur.y}`}
          role="menu"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
          transition={{ duration: 0.12 }}
          onContextMenu={(e) => e.preventDefault()}
          style={{ position: 'fixed', left: pos?.left ?? cur.x, top: pos?.top ?? cur.y, visibility: pos ? 'visible' : 'hidden', transformOrigin: 'top left' }}
          className="z-[65] w-56 rounded-2xl border border-white/10 bg-stone-900/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <div dir="auto" className="truncate px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-stone-500">{item.title}</div>
          {groups.map((group, g) => (
            <div key={g} className={clsx(g > 0 && 'mt-1 border-t border-white/5 pt-1')}>
              {group.map((entry) => {
                const i = ++n;
                return (
                  <button
                    key={entry.label}
                    role="menuitem"
                    onClick={() => run(entry)}
                    onPointerEnter={() => setActive(i)}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
                      entry.danger ? 'text-rose-300' : 'text-stone-300',
                      active === i && (entry.danger ? 'bg-rose-500/15 text-rose-200' : 'bg-white/[.07] text-white')
                    )}
                  >
                    <entry.icon size={15} className="shrink-0 opacity-80" />
                    <span className="flex-1">{entry.label}</span>
                    {entry.hint && <kbd className="text-[10px] text-stone-500">{entry.hint}</kbd>}
                  </button>
                );
              })}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
    </>,
    document.body
  );
}

/** "Depends on" panel opened from the menu, floating where the menu was. */
function DepsPopover() {
  const deps = useMenu((s) => s.deps);
  const items = useStore((s) => s.items);
  const item = deps && items.find((i) => i.id === deps.id);
  const list = useMemo(() => (item ? item.dependsOn.map((d) => items.find((i) => i.id === d)).filter(Boolean) : []), [item, items]);
  // A point-sized anchor at the click position.
  const anchor = useMemo(
    () => ({ current: deps && { getBoundingClientRect: () => new DOMRect(deps.x, deps.y, 0, 0), contains: () => false } }),
    [deps]
  );
  return (
    <Popover open={!!item} onClose={() => useMenu.setState({ deps: null })} anchorRef={anchor} width={320}>
      {item && <DepsPanel item={item} deps={list} items={items} />}
    </Popover>
  );
}
