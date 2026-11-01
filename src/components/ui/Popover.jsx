import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

/**
 * Anchored floating panel rendered in a portal. Flips above the trigger when
 * there's no room below and closes on outside click / Escape.
 */
export default function Popover({ open, onClose, anchorRef, children, width, align = 'start' }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const place = () => {
      const r = anchorRef.current.getBoundingClientRect();
      const w = width === 'anchor' ? r.width : width || 280;
      const h = panelRef.current?.offsetHeight || 320;
      const below = window.innerHeight - r.bottom;
      const up = below < h + 12 && r.top > below;
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      setPos({ left, width: w, top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined, up });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef, width, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, anchorRef]);

  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, transformOrigin: pos.up ? 'bottom' : 'top' }}
          className="z-[60] overflow-hidden rounded-2xl border border-white/10 bg-stone-900/90 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
