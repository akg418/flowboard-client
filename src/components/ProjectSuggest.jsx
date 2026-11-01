import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { CornerDownLeft, FolderClosed } from 'lucide-react';
import { useStore } from '../lib/store';
import { ancestors } from '../lib/tree';
import { normalizeText } from '../lib/parse';

const key = (s) => normalizeText(s).toLowerCase();
// "#acc" anywhere, or "في acc" / "in acc" right before the caret.
const TRIGGER = /(?:#([^\s#]*)|(?:^|\s)(?:في|ف|in|into)\s+([^\s#]+))$/iu;

/**
 * Suggests project names while typing a task. Returns props for the input and the dropdown.
 */
export function useProjectSuggest(text, setText, inputRef) {
  const items = useStore((s) => s.items);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(null);

  const match = useMemo(() => {
    const m = text.slice(0, caret).match(TRIGGER);
    if (!m) return null;
    const hash = m[1] !== undefined;
    const q = hash ? m[1] : m[2];
    return { q, hash, start: caret - q.length - (hash ? 1 : 0) };
  }, [text, caret]);

  const suggestions = useMemo(() => {
    if (!match || (!match.hash && !match.q)) return [];
    const q = key(match.q.replace(/_/g, ' '));
    return items
      .filter((i) => i.kind === 'project' && key(i.title).includes(q))
      .sort((a, b) => key(a.title).indexOf(q) - key(b.title).indexOf(q) || a.title.length - b.title.length)
      .slice(0, 6)
      .map((p) => ({ ...p, path: ancestors(items, p.id).map((a) => a.title).join(' › ') }));
  }, [match, items]);

  const open = suggestions.length > 0 && dismissed !== text;

  const pick = (p) => {
    const tag = `#${p.title.trim().replace(/\s+/g, '_')} `;
    const next = text.slice(0, match.start) + tag + text.slice(caret).replace(/^\s+/, '');
    setText(next);
    const pos = match.start + tag.length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
    setActive(0);
  };

  const syncCaret = (e) => setCaret(e.target.selectionStart ?? e.target.value.length);

  const onKeyDown = (e) => {
    if (!open) return false;
    if (e.key === 'ArrowDown') setActive((a) => (a + 1) % suggestions.length);
    else if (e.key === 'ArrowUp') setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    else if (e.key === 'Enter' || e.key === 'Tab') pick(suggestions[Math.min(active, suggestions.length - 1)]);
    else if (e.key === 'Escape') setDismissed(text);
    else return false;
    e.preventDefault();
    return true;
  };

  return {
    inputProps: { onKeyUp: syncCaret, onClick: syncCaret, onSelect: syncCaret },
    onChange: (e) => {
      syncCaret(e);
      setActive(0);
    },
    onKeyDown,
    dropdown: <Suggestions open={open} items={suggestions} active={active} setActive={setActive} pick={pick} />,
  };
}

function Suggestions({ open, items, active, setActive, pick }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-stone-900/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="px-2.5 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Put it in…</div>
          {items.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep input focus
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(p)}
              className={clsx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors', i === active ? 'bg-white/[.07] text-white' : 'text-stone-300')}
            >
              <FolderClosed size={15} style={{ color: p.color || '#6f5cef' }} className="shrink-0" />
              <span dir="auto" className="truncate">{p.title}</span>
              {p.path && <span dir="auto" className="truncate text-[11px] text-stone-500">{p.path}</span>}
              {i === active && <CornerDownLeft size={13} className="ml-auto shrink-0 text-stone-500" />}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
