import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import clsx from 'clsx';
import {
  Bold, Code, ExternalLink, Heading2, Heading3, Italic, Link2, List, ListChecks, ListOrdered, Quote, RemoveFormatting,
  Strikethrough, Underline, Unlink,
} from 'lucide-react';
import Popover from './ui/Popover';
import { closeMentionMenu, mentionExtension } from './Mention';

const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;
const normalizeUrl = (raw) => {
  const url = raw.trim();
  if (!url) return null;
  if (SAFE_URL.test(url)) return url;
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(url)) return `mailto:${url}`;
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return null; // javascript:, data:, …
  return `https://${url}`;
};

// Old notes were plain text; wrap them in paragraphs.
const toHtml = (text) =>
  !text || /^\s*</.test(text)
    ? text || ''
    : text
        .split(/\n/)
        .map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
        .join('');

function Btn({ on, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx('grid h-7 w-7 place-items-center rounded-lg transition-colors', on ? 'bg-accent-500/25 text-accent-200' : 'text-stone-400 hover:bg-white/[.07] hover:text-stone-100')}
    >
      {children}
    </button>
  );
}

function LinkButton({ editor, active }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);

  const openBox = () => {
    setUrl(editor.getAttributes('link').href || '');
    setError(false);
    setOpen(true);
  };
  const apply = (e) => {
    e.preventDefault();
    const href = normalizeUrl(url);
    if (!href) return setError(true);
    const chain = editor.chain().focus().extendMarkRange('link');
    if (editor.state.selection.empty && !editor.isActive('link'))
      chain.insertContent({ type: 'text', text: url.trim(), marks: [{ type: 'link', attrs: { href } }] }).run();
    else chain.setLink({ href }).run();
    setOpen(false);
  };

  return (
    <>
      <span ref={ref}>
        <Btn on={active} title="Link (⌘K)" onClick={openBox}>
          <Link2 size={14} />
        </Btn>
      </span>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={300}>
        <form onSubmit={apply} className="space-y-2 p-3">
          <input
            autoFocus
            value={url}
            onChange={(e) => (setUrl(e.target.value), setError(false))}
            placeholder="Paste a link… example.com"
            className={clsx('input py-1.5', error && '!border-rose-500/60')}
          />
          {error && <p className="text-xs text-rose-300">That doesn't look like a valid link.</p>}
          <div className="flex items-center gap-1.5">
            <button className="btn-primary py-1 text-xs">{active ? 'Update' : 'Add link'}</button>
            {active && (
              <>
                <button
                  type="button"
                  onClick={() => window.open(editor.getAttributes('link').href, '_blank', 'noopener')}
                  className="btn-ghost py-1 text-xs"
                >
                  <ExternalLink size={12} /> Open
                </button>
                <button
                  type="button"
                  onClick={() => (editor.chain().focus().extendMarkRange('link').unsetLink().run(), setOpen(false))}
                  className="btn-ghost py-1 text-xs hover:!text-rose-300"
                >
                  <Unlink size={12} /> Remove
                </button>
              </>
            )}
          </div>
        </form>
      </Popover>
    </>
  );
}

/**
 * Rich-text notes. Saves HTML on blur (and while typing with `autosave`). Cmd/Ctrl-click opens links.
 * @ mentions a task, project or note; `selfId` is the note being edited.
 */
export default function NotesEditor({ value, onSave, readOnly, autosave, selfId, placeholder, className }) {
  const [focused, setFocused] = useState(false);
  const saved = useRef(value || '');
  const timer = useRef(null);
  const save = (ed) => {
    clearTimeout(timer.current);
    const html = ed.isEmpty ? '' : ed.getHTML();
    if (!readOnly && html !== saved.current) {
      saved.current = html;
      onSave(html);
    }
  };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => SAFE_URL.test(url),
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder || 'Add details, links, ideas… type @ to mention a task, project or note' }),
      mentionExtension(selfId),
    ],
    content: toHtml(value),
    editable: !readOnly,
    editorProps: {
      attributes: { class: 'notes-editor', dir: 'auto' },
      handleClick: (_view, _pos, event) => {
        const a = event.target.closest?.('a[href]');
        if (a && (event.metaKey || event.ctrlKey)) {
          window.open(a.href, '_blank', 'noopener');
          return true;
        }
        return false;
      },
    },
    onFocus: () => setFocused(true),
    onUpdate: ({ editor: ed }) => {
      if (!autosave) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => save(ed), 700);
    },
    onBlur: ({ editor: ed }) => {
      setFocused(false);
      save(ed);
    },
  });

  // Leaving (closing the drawer, switching notes) keeps what was typed.
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => () => {
    closeMentionMenu();
    if (editor && !editor.isDestroyed) latest.current(editor);
  }, [editor]);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
        code: e.isActive('code'), h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }),
        bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), task: e.isActive('taskList'),
        quote: e.isActive('blockquote'), link: e.isActive('link'),
      },
  });

  useEffect(() => {
    if (!editor) return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && editor.isFocused) {
        e.preventDefault();
        document.querySelector('[title="Link (⌘K)"]')?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor]);

  if (!editor || !s) return null;
  const c = () => editor.chain().focus();

  return (
    <div className={clsx('rounded-xl border transition', focused ? 'border-accent-500 ring-4 ring-accent-500/20' : 'border-white/10 bg-white/[.03]')}>
      {!readOnly && <div className="flex flex-wrap items-center gap-0.5 border-b border-white/5 p-1">
        <Btn on={s.bold} title="Bold (⌘B)" onClick={() => c().toggleBold().run()}><Bold size={14} /></Btn>
        <Btn on={s.italic} title="Italic (⌘I)" onClick={() => c().toggleItalic().run()}><Italic size={14} /></Btn>
        <Btn on={s.underline} title="Underline (⌘U)" onClick={() => c().toggleUnderline().run()}><Underline size={14} /></Btn>
        <Btn on={s.strike} title="Strikethrough" onClick={() => c().toggleStrike().run()}><Strikethrough size={14} /></Btn>
        <Btn on={s.code} title="Code" onClick={() => c().toggleCode().run()}><Code size={14} /></Btn>
        <LinkButton editor={editor} active={s.link} />
        <span className="mx-1 h-4 w-px bg-white/10" />
        <Btn on={s.h2} title="Heading" onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></Btn>
        <Btn on={s.h3} title="Subheading" onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></Btn>
        <Btn on={s.bullet} title="Bullet list" onClick={() => c().toggleBulletList().run()}><List size={14} /></Btn>
        <Btn on={s.ordered} title="Numbered list" onClick={() => c().toggleOrderedList().run()}><ListOrdered size={14} /></Btn>
        <Btn on={s.task} title="Checklist" onClick={() => c().toggleTaskList().run()}><ListChecks size={14} /></Btn>
        <Btn on={s.quote} title="Quote" onClick={() => c().toggleBlockquote().run()}><Quote size={14} /></Btn>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <Btn title="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={14} /></Btn>
      </div>}
      <EditorContent editor={editor} className={clsx('scroll-thin overflow-y-auto px-3 py-2.5', className ?? 'max-h-[50vh]')} />
    </div>
  );
}
