import { AnimatePresence, motion } from 'motion/react';
import { BellRing, CheckCircle2, X, AlertCircle, Moon } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../lib/store';

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismiss);
  const openDrawer = useStore((s) => s.openDrawer);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = t.tone === 'zikr' ? Moon : t.tone === 'reminder' ? BellRing : t.tone === 'error' ? AlertCircle : CheckCircle2;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={() => t.itemId && openDrawer(t.itemId)}
              className={clsx(
                'pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-xl backdrop-blur',
                t.itemId && 'cursor-pointer',
                t.tone === 'zikr'
                  ? 'border-emerald-500/25 bg-stone-900/90 shadow-emerald-500/10'
                  : t.tone === 'reminder'
                  ? 'border-accent-200 bg-white/95 shadow-accent-500/10 dark:border-accent-500/30 dark:bg-stone-900/95'
                  : t.tone === 'error'
                    ? 'border-rose-200 bg-rose-50/95 dark:border-rose-500/30 dark:bg-rose-950/80'
                    : 'border-stone-200 bg-white/95 shadow-stone-900/5 dark:border-white/10 dark:bg-stone-900/95'
              )}
            >
              <motion.span
                animate={t.tone === 'reminder' ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
                transition={{ duration: 0.8, repeat: t.tone === 'reminder' ? 2 : 0 }}
                className={clsx(
                  'mt-0.5',
                  t.tone === 'zikr' ? 'text-emerald-400' : t.tone === 'reminder' ? 'text-accent-500' : t.tone === 'error' ? 'text-rose-500' : 'text-emerald-500'
                )}
              >
                <Icon size={18} />
              </motion.span>
              <div className="min-w-0 flex-1 text-sm">
                {t.title && <div dir="auto" className="font-semibold">{t.title}</div>}
                <div dir="auto" className={t.tone === 'zikr' ? 'text-[15px] leading-relaxed text-emerald-50' : 'text-stone-600 dark:text-stone-300'}>{t.message}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(t.id);
                }}
                className="text-stone-400 hover:text-stone-600"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
