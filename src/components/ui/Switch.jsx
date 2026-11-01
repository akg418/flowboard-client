import clsx from 'clsx';
import { motion } from 'motion/react';

export default function Switch({ checked, onChange, label, className, size = 'md' }) {
  const w = size === 'sm' ? 30 : 36, h = size === 'sm' ? 18 : 21, k = h - 6;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx('inline-flex items-center gap-2 text-sm', className)}
    >
      <span
        style={{ width: w, height: h }}
        className={clsx('relative shrink-0 rounded-full p-[3px] transition-colors', checked ? 'bg-accent-500 shadow-[0_0_12px] shadow-accent-500/40' : 'bg-white/10')}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 32 }}
          style={{ width: k, height: k, marginLeft: checked ? w - k - 6 : 0 }}
          className="block rounded-full bg-white shadow"
        />
      </span>
      {label && <span className="text-stone-300">{label}</span>}
    </button>
  );
}
