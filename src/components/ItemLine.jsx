import clsx from 'clsx';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { FolderClosed, GripVertical, Lock, Timer, Trash2, Video } from 'lucide-react';
import { confirmDelete } from '../lib/actions';
import { openContextMenu } from './ContextMenu';
import Checkbox from './Checkbox';
import TimerChip from './TimerChip';
import OverlapBadge from './OverlapBadge';
import { useStore } from '../lib/store';
import { ancestors } from '../lib/tree';

/** A flat, card-style row used by Today and other list summaries. */
export default function ItemLine({ item, showDate }) {
  const items = useStore((s) => s.items);
  const update = useStore((s) => s.update);
  const openDrawer = useStore((s) => s.openDrawer);
  const path = ancestors(items, item.id);
  const blocked = !item.done && item.dependsOn.some((d) => items.find((i) => i.id === d)?.done === false);
  const d = item.start ? new Date(item.start) : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', item.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => openDrawer(item.id)}
        onContextMenu={(e) => openContextMenu(e, item)}
        className="group flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[.04] active:cursor-grabbing"
      >
        <GripVertical size={14} className="-mr-2 shrink-0 cursor-grab text-stone-600 opacity-0 transition group-hover:opacity-100" />
        <div className="w-16 shrink-0 text-right text-xs tabular-nums text-stone-400">
          {d && (item.allDay ? (showDate ? format(d, 'MMM d') : 'All day') : format(d, showDate ? 'MMM d' : 'h:mm a'))}
          {d && item.end && !item.allDay && !showDate && <div className="text-[10px] text-stone-600">→ {format(new Date(item.end), 'h:mm a')}</div>}
        </div>
        {item.kind === 'project' ? (
          <FolderClosed size={18} className="text-accent-500" />
        ) : (
          <Checkbox checked={item.done} inProgress={!!item.timerStartedAt} onChange={(done) => update(item.id, { done })} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.kind === 'meeting' && <Video size={14} className="shrink-0 text-sky-500" />}
            {item.kind === 'session' && <Timer size={14} className="shrink-0 text-violet-400" />}
            <span dir="auto" className={clsx('truncate text-[14.5px]', item.done && 'text-stone-400 line-through')}>
              {item.title}
            </span>
            {blocked && <Lock size={12} className="shrink-0 text-amber-500" />}
            <OverlapBadge item={item} />
            {item.kind !== 'project' && <TimerChip item={item} always className="ml-auto" />}
            <button
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                confirmDelete(item);
              }}
              className={clsx(
                'shrink-0 rounded-lg p-1 text-stone-500 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100 max-md:opacity-100',
                item.kind === 'project' && 'ml-auto'
              )}
            >
              <Trash2 size={14} />
            </button>
          </div>
          {path.length > 0 && (
            <div dir="auto" className="truncate text-[11px] text-stone-400">{path.map((p) => p.title).join(' › ')}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
