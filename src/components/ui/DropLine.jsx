import clsx from 'clsx';

/** Insertion line shown above / below a row while dragging. */
export default function DropLine({ zone, inset = 8 }) {
  return (
    <span
      style={{ left: inset, right: inset }}
      className={clsx('pointer-events-none absolute z-10 h-0.5 rounded-full bg-accent-400 shadow-[0_0_8px] shadow-accent-400', zone === 'before' ? '-top-px' : '-bottom-px')}
    >
      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full border-2 border-accent-400 bg-stone-900" />
    </span>
  );
}
