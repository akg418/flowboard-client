import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { create } from 'zustand';

const useDialog = create(() => ({ current: null }));

export const isDialogOpen = () => !!useDialog.getState().current;

/**
 * Promise-based replacement for confirm()/prompt().
 *   await ask({ title, message, danger: true })          → true | false
 *   await ask({ title, input: true, placeholder })        → string | null
 *   await ask({ title, message, warn: true, list: [...] }) → true | false
 */
export function ask(opts) {
  return new Promise((resolve) => useDialog.setState({ current: { ...opts, resolve } }));
}

export default function DialogHost() {
  const d = useDialog((s) => s.current);
  const [text, setText] = useState('');
  useEffect(() => setText(d?.defaultValue || ''), [d]);

  const close = (result) => {
    d.resolve(result);
    useDialog.setState({ current: null });
  };
  const ok = () => (d.input ? text.trim() && close(text.trim()) : close(true));
  const cancel = () => close(d.input ? null : false);

  return (
    <AnimatePresence>
      {d && (
        <motion.div
          key="dlg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && cancel()}
          onKeyDown={(e) => e.key === 'Escape' && cancel()}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <motion.form
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            onSubmit={(e) => (e.preventDefault(), ok())}
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-stone-900/95 p-6 shadow-2xl"
          >
            <div className={clsx('mb-4 grid h-11 w-11 place-items-center rounded-2xl', d.danger ? 'bg-rose-500/15 text-rose-400' : d.warn ? 'bg-amber-500/15 text-amber-300' : 'bg-accent-500/15 text-accent-300')}>
              {d.danger || d.warn ? <AlertTriangle size={20} /> : <Sparkles size={20} />}
            </div>
            <h3 dir="auto" className="text-lg font-semibold">{d.title}</h3>
            {d.message && <p dir="auto" className="mt-1.5 text-sm leading-relaxed text-stone-400">{d.message}</p>}
            {d.list?.length > 0 && (
              <ul className="scroll-thin mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-white/[.04] p-2 text-sm">
                {d.list.map((t, i) => (
                  <li key={i} dir="auto" className="flex items-center gap-2 truncate text-stone-300">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    <span className="truncate">{t}</span>
                  </li>
                ))}
              </ul>
            )}
            {d.input && (
              <input
                autoFocus
                dir="auto"
                type={d.inputType || 'text'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={d.placeholder}
                className="input mt-4"
              />
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={cancel} className="btn-ghost">{d.cancelText || 'Cancel'}</button>
              <button
                autoFocus={!d.input}
                className={clsx('btn', d.danger ? 'bg-rose-500 text-white hover:bg-rose-600' : d.warn ? 'bg-amber-500 text-stone-950 hover:bg-amber-400' : 'bg-accent-500 text-white hover:bg-accent-600', d.input && !text.trim() && 'opacity-50')}
              >
                {d.confirmText || (d.danger ? 'Delete' : 'OK')}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
