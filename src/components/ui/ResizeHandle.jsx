import clsx from 'clsx';
import { useStore } from '../../lib/store';

/** Width as CSS: the live drag value (a CSS variable named after the pref) or the saved one. */
export const liveWidth = (prefKey, saved) => `var(--${prefKey}, ${saved}px)`;

/**
 * Drag an edge to resize. `edge` is the side the handle sits on; `clamp` bounds the width.
 * While dragging only a CSS variable changes (no re-render), once per frame; the width is
 * saved as a pref on release. Double-click resets.
 */
export default function ResizeHandle({ prefKey, edge = 'right', clamp, reset, className }) {
  const onPointerDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = useStore.getState()[prefKey];
    const root = document.documentElement;
    let w = start;
    let frame = 0;
    root.dataset.resizing = '';
    const move = (ev) => {
      w = clamp(start + (edge === 'right' ? ev.clientX - startX : startX - ev.clientX));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.style.setProperty(`--${prefKey}`, `${w}px`));
    };
    const up = () => {
      cancelAnimationFrame(frame);
      delete root.dataset.resizing;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      useStore.getState().setPref(prefKey, w);
      root.style.removeProperty(`--${prefKey}`);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={() => useStore.getState().setPref(prefKey, reset)}
      className={clsx(
        'group/resize absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none max-md:hidden',
        edge === 'right' ? 'right-0' : 'left-0',
        className
      )}
    >
      <span className="absolute inset-y-6 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-accent-400/0 transition-colors group-hover/resize:bg-accent-400/60" />
    </div>
  );
}
