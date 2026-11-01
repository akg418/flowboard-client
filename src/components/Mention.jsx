import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import Mention from '@tiptap/extension-mention';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import clsx from 'clsx';
import { CheckCircle2, Circle, FolderClosed, StickyNote, Timer, Video } from 'lucide-react';
import { useStore } from '../lib/store';
import { noteTitle, useNotes } from '../lib/notes';

function KindIcon({ kind, done, size = 13 }) {
  if (kind === 'project') return <FolderClosed size={size} className="shrink-0 text-accent-400" />;
  if (kind === 'note') return <StickyNote size={size} className="shrink-0 text-amber-300" />;
  if (kind === 'meeting') return <Video size={size} className="shrink-0 text-sky-400" />;
  if (kind === 'session') return <Timer size={size} className="shrink-0 text-violet-400" />;
  return done ? <CheckCircle2 size={size} className="shrink-0 text-accent-400" /> : <Circle size={size} className="shrink-0 text-stone-400" />;
}

/** What @ can point at: tasks, projects and notes (minus the note being written). */
function candidates(query, selfId) {
  const q = query.trim().toLowerCase();
  const items = useStore.getState().items.map((i) => ({ id: i.id, kind: i.kind, label: i.title, done: i.done }));
  const notes = useNotes.getState().notes.filter((n) => n.id !== selfId).map((n) => ({ id: n.id, kind: 'note', label: noteTitle(n) }));
  const all = [...items, ...notes].filter((c) => !q || c.label.toLowerCase().includes(q));
  // Open things first, then titles that start with the query.
  all.sort((a, b) => !!a.done - !!b.done || !a.label.toLowerCase().startsWith(q) - !b.label.toLowerCase().startsWith(q));
  return all.slice(0, 8);
}

// The open @ menu, shared by whichever editor is typing.
const useMenu = create(() => ({ open: false, items: [], index: 0, rect: null, command: null }));

function suggestion(selfId) {
  return {
    char: '@',
    allowSpaces: true,
    items: ({ query }) => candidates(query, selfId),
    render: () => ({
      onStart: (p) => useMenu.setState({ open: true, items: p.items, index: 0, rect: p.clientRect?.(), command: p.command }),
      onUpdate: (p) => useMenu.setState({ items: p.items, index: 0, rect: p.clientRect?.(), command: p.command }),
      onKeyDown: ({ event }) => {
        const { open, items, index, command } = useMenu.getState();
        if (!open) return false;
        if (event.key === 'Escape') return useMenu.setState({ open: false }), true;
        if (!items.length) return false;
        if (event.key === 'ArrowDown') return useMenu.setState({ index: (index + 1) % items.length }), true;
        if (event.key === 'ArrowUp') return useMenu.setState({ index: (index + items.length - 1) % items.length }), true;
        if (event.key === 'Enter' || event.key === 'Tab') return command(items[index]), true;
        return false;
      },
      onExit: () => useMenu.setState({ open: false }),
    }),
  };
}

export function MentionMenu() {
  const { open, items, index, rect, command } = useMenu();
  if (!open || !rect) return null;
  return createPortal(
    <div
      style={{ position: 'fixed', top: rect.bottom + 6, left: rect.left, zIndex: 100 }}
      className="w-72 overflow-hidden rounded-xl border border-white/10 bg-stone-900/95 p-1 shadow-2xl backdrop-blur-xl"
    >
      {!items.length && <div className="px-3 py-2 text-xs text-stone-500">No task, project or note matches</div>}
      {items.map((c, i) => (
        <button
          key={`${c.kind}-${c.id}`}
          type="button"
          onMouseDown={(e) => (e.preventDefault(), command(c))}
          onMouseEnter={() => useMenu.setState({ index: i })}
          className={clsx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm', i === index ? 'bg-white/10 text-white' : 'text-stone-300')}
        >
          <KindIcon kind={c.kind} done={c.done} />
          <span dir="auto" className={clsx('min-w-0 flex-1 truncate', c.done && 'text-stone-500 line-through')}>{c.label}</span>
          <span className="text-[10px] uppercase tracking-wider text-stone-500">{c.kind}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}

/** A mention chip: shows the current title and opens what it points at. */
function MentionView({ node }) {
  const { id, kind, label } = node.attrs;
  const navigate = useNavigate();
  const item = useStore((s) => (kind === 'note' ? null : s.items.find((i) => i.id === id)));
  const note = useNotes((s) => (kind === 'note' ? s.notes.find((n) => n.id === id) : null));
  const target = kind === 'note' ? note : item;
  const itemsLoaded = useStore((s) => s.loaded);
  const notesLoaded = useNotes((s) => s.loaded);
  const gone = (kind === 'note' ? notesLoaded : itemsLoaded) && !target;
  const title = target ? (kind === 'note' ? noteTitle(target) : target.title) : label;

  const open = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (gone) return;
    if (kind === 'note') navigate(`/notes/${id}`);
    else if (target.kind === 'project') navigate(`/p/${id}`);
    else useStore.getState().openDrawer(id);
  };

  return (
    <NodeViewWrapper
      as="span"
      onClick={open}
      title={gone ? 'This was deleted' : `Open ${kind}`}
      className={clsx(
        'mention inline-flex items-center gap-1 rounded-md px-1.5 py-px align-baseline text-[0.92em] font-medium transition-colors',
        gone ? 'cursor-default bg-white/5 text-stone-500 line-through' : 'cursor-pointer bg-accent-500/15 text-accent-200 hover:bg-accent-500/25'
      )}
    >
      <KindIcon kind={target?.kind === 'project' ? 'project' : kind} done={item?.done} size={12} />
      <span dir="auto" className={clsx(item?.done && 'line-through opacity-70')}>{title}</span>
    </NodeViewWrapper>
  );
}

/** @-mentions of tasks, projects and notes. `selfId`: the note being edited, left out of the list. */
export const mentionExtension = (selfId) =>
  Mention.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        kind: {
          default: 'task',
          parseHTML: (el) => el.getAttribute('data-kind'),
          renderHTML: (attrs) => ({ 'data-kind': attrs.kind }),
        },
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(MentionView);
    },
  }).configure({
    HTMLAttributes: { class: 'mention' },
    renderText: ({ node }) => `@${node.attrs.label}`,
    suggestion: {
      ...suggestion(selfId),
      command: ({ editor, range, props }) =>
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: 'mention', attrs: { id: props.id, label: props.label, kind: props.kind === 'project' || props.kind === 'note' ? props.kind : 'task' } },
            { type: 'text', text: ' ' },
          ])
          .run(),
    },
  });

/** Ids mentioned in a note's HTML, by kind. */
export function mentionsIn(html) {
  const out = [];
  for (const m of (html || '').matchAll(/<span[^>]*data-type="mention"[^>]*>/g)) {
    const id = m[0].match(/data-id="([^"]+)"/)?.[1];
    const kind = m[0].match(/data-kind="([^"]+)"/)?.[1] || 'task';
    if (id) out.push({ id, kind });
  }
  return out;
}

export const closeMentionMenu = () => useMenu.setState({ open: false });
