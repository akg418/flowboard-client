import { motion } from 'motion/react';
import clsx from 'clsx';

export default function Checkbox({ checked, onChange, color, size = 20, inProgress }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      whileTap={{ scale: 0.8 }}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={clsx(
        'relative grid shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
        checked
          ? 'border-transparent bg-accent-500'
          : inProgress
            ? 'border-amber-400 bg-[conic-gradient(var(--color-amber-400)_0_50%,transparent_50%_100%)]'
            : 'border-stone-300 hover:border-accent-400 hover:bg-accent-50 dark:border-stone-600 dark:hover:bg-accent-500/10'
      )}
      style={{ width: size, height: size, ...(checked && color ? { background: color } : {}) }}
    >
      <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" fill="none">
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </svg>
      {checked && (
        <motion.span
          className="absolute inset-0 rounded-full bg-accent-400"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.button>
  );
}
