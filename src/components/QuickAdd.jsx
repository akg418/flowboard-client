import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CalendarDays, Folder, Repeat, Hourglass, Plus, Sparkles, Video } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { parseTask } from '../lib/parse';
import { createFromText, projectNames } from '../lib/actions';
import { useStore } from '../lib/store';
import { useProjectSuggest } from './ProjectSuggest';

export const ICONS = { reminder: Bell, date: CalendarDays, meeting: Video, project: Folder, later: Hourglass, repeat: Repeat };
export const TONES = {
  reminder: 'bg-white/5 text-stone-300',
  date: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  meeting: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  project: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  later: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  repeat: 'bg-violet-500/15 text-violet-300',
};

export default function QuickAdd({ defaults, placeholder }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const items = useStore((s) => s.items);
  const projects = useMemo(() => projectNames(items), [items]);
  const parsed = useMemo(() => (text.trim() ? parseTask(text, new Date(), { projects }) : null), [text, projects]);
  const suggest = useProjectSuggest(text, setText, ref);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    await createFromText(text, defaults);
    setText('');
    setBusy(false);
    ref.current?.focus();
  };

  return (
    <form onSubmit={submit} className="card group relative mb-5 p-1.5 transition focus-within:shadow-lg focus-within:shadow-accent-500/5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-50 text-accent-500 dark:bg-accent-500/15">
          <Plus size={17} />
        </span>
        <input
          ref={ref}
          dir="auto"
          value={text}
          {...suggest.inputProps}
          onChange={(e) => {
            setText(e.target.value);
            suggest.onChange(e);
          }}
          onKeyDown={(e) => suggest.onKeyDown(e)}
          placeholder={placeholder || 'Add a task… “meeting with Ali tomorrow 5pm #Website” — عربي كمان'}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:truncate placeholder:text-stone-400"
        />
        <AnimatePresence>
          {text.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileTap={{ scale: 0.94 }}
              className="btn-primary"
            >
              Add
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {suggest.dropdown}
      <AnimatePresence>
        {parsed && (parsed.tokens.length > 0 || parsed.title !== text.trim()) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1 pt-2 text-xs">
              <Link to="/guide" title="How to write tasks" className="order-last ml-auto text-[11px] text-stone-500 hover:text-accent-300">How does this work?</Link>
              <Sparkles size={13} className="text-accent-400" />
              <span dir="auto" className="font-medium text-stone-600 dark:text-stone-300">
                {parsed.title}
              </span>
              <AnimatePresence>
                {parsed.tokens.map((t) => {
                  const Icon = ICONS[t.type];
                  return (
                    <motion.span
                      key={t.type}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium', TONES[t.type])}
                    >
                      <Icon size={11} /> {t.label}
                    </motion.span>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
