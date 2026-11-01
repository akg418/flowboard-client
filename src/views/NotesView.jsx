import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { Eye, Pencil, Plus, Search, StickyNote, Trash2 } from 'lucide-react';
import PageHeader, { Empty } from '../components/PageHeader';
import NotesEditor from '../components/NotesEditor';
import { mentionsIn } from '../components/Mention';
import { ask } from '../components/ui/Dialog';
import { useStore } from '../lib/store';
import { noteTitle, useNotes } from '../lib/notes';
import { renderTypedMarkdown } from '../lib/markdown';

const plain = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function NoteEditor({ note }) {
  const preview = useStore((s) => s.notePreview);
  const setPref = useStore((s) => s.setPref);
  const update = useNotes((s) => s.update);
  const remove = useNotes((s) => s.remove);
  const notes = useNotes((s) => s.notes);
  const navigate = useNavigate();
  const [title, setTitle] = useState(note.title);
  // Other notes that mention this one.
  const backlinks = notes.filter((n) => n.id !== note.id && mentionsIn(n.content).some((m) => m.id === note.id));

  const del = async () => {
    if (!(await ask({ title: `Delete “${noteTitle(note)}”?`, message: 'This note will be gone for good.', confirmText: 'Delete', danger: true }))) return;
    await remove(note.id);
    navigate('/notes', { replace: true });
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3 flex items-center gap-2">
        <input
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== note.title && update(note.id, { title })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder="Untitled note"
          className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-stone-100 outline-none placeholder:text-stone-600"
        />
        <button
          onClick={() => setPref('notePreview', !preview)}
          className={clsx('btn-ghost py-1 text-xs', preview && '!bg-accent-500/15 !text-accent-200')}
        >
          {preview ? <><Pencil size={13} /> Edit</> : <><Eye size={13} /> Preview</>}
        </button>
        <button title="Delete note" onClick={del} className="rounded-lg p-1.5 text-stone-500 transition hover:bg-rose-500/10 hover:text-rose-300">
          <Trash2 size={16} />
        </button>
      </div>
      {preview ? (
        <div onDoubleClick={() => setPref('notePreview', false)} title="Double-click to edit">
          <NotesEditor
            key="preview"
            readOnly
            value={renderTypedMarkdown(note.content)}
            className="min-h-[55vh] max-h-[70vh] !px-5 !py-4"
          />
        </div>
      ) : (
      <NotesEditor
        key="edit"
        value={note.content}
        selfId={note.id}
        autosave
        className="min-h-[55vh] max-h-[70vh]"
        placeholder="Write freely… type @ to mention a task, project or another note"
        onSave={(content) => update(note.id, { content })}
      />
      )}
      {backlinks.length > 0 && (
        <div className="mt-4 text-xs text-stone-500">
          Mentioned in{' '}
          {backlinks.map((n, i) => (
            <span key={n.id}>
              {i > 0 && ', '}
              <button onClick={() => navigate(`/notes/${n.id}`)} className="text-amber-300/90 hover:underline">{noteTitle(n)}</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotesView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notes = useNotes((s) => s.notes);
  const loaded = useNotes((s) => s.loaded);
  const create = useNotes((s) => s.create);
  const privacy = useStore((s) => s.privacy);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return t ? sorted.filter((n) => noteTitle(n).toLowerCase().includes(t) || plain(n.content).toLowerCase().includes(t)) : sorted;
  }, [notes, q]);
  const note = id ? notes.find((n) => n.id === id) : null;

  if (loaded && !id && notes.length) return <Navigate to={`/notes/${list[0]?.id ?? notes[0].id}`} replace />;
  if (loaded && id && !note) return <Navigate to="/notes" replace />;

  const add = async () => {
    const n = await create({ title: '' });
    if (n) navigate(`/notes/${n.id}`);
  };

  return (
    <>
      <PageHeader title="Notes" subtitle="Write anything. Type @ to link a task, project or another note.">
        <button onClick={add} disabled={privacy} className="btn-primary disabled:opacity-40">
          <Plus size={15} /> New note
        </button>
      </PageHeader>
      {loaded && !notes.length ? (
        <Empty icon="📝" title="No notes yet" text="Start one with “New note” — and @ anything you're working on." />
      ) : (
        <div className="flex flex-col gap-5 md:flex-row">
          <aside className="md:w-64 md:shrink-0">
            <label className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 py-1.5">
              <Search size={14} className="text-stone-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <div className="scroll-thin space-y-0.5 max-md:max-h-48 max-md:overflow-y-auto md:max-h-[70vh] md:overflow-y-auto">
              {list.map((n) => (
                <button
                  key={n.id}
                  onClick={() => navigate(`/notes/${n.id}`)}
                  className={clsx('flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors', n.id === id ? 'bg-white/[.08] ring-1 ring-white/10' : 'hover:bg-white/[.04]')}
                >
                  <StickyNote size={14} className="mt-0.5 shrink-0 text-amber-300/80" />
                  <span className="min-w-0 flex-1">
                    <span dir="auto" className={clsx('block truncate text-sm font-medium', n.title.trim() ? 'text-stone-200' : 'text-stone-500')}>{noteTitle(n)}</span>
                    <span dir="auto" className="block truncate text-xs text-stone-500">{plain(n.content) || 'Empty'}</span>
                    <span className="block text-[10px] text-stone-600">{formatDistanceToNow(new Date(n.updatedAt), { addSuffix: true })}</span>
                  </span>
                </button>
              ))}
              {!list.length && <div className="px-3 py-2 text-xs text-stone-500">No note matches.</div>}
            </div>
          </aside>
          {note && <NoteEditor key={note.id} note={note} />}
        </div>
      )}
    </>
  );
}
