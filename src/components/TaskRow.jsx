import { memo, useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, FolderClosed, FolderOpen, GripVertical, Plus, Trash2, Video, AlignLeft, Timer, Hourglass } from 'lucide-react';
import { confirmDelete, foldInside } from '../lib/actions';
import Checkbox from './Checkbox';
import DateChip from './DateChip';
import TimerChip from './TimerChip';
import DepsChip from './DepsChip';
import OverlapBadge from './OverlapBadge';
import { useStore } from '../lib/store';
import { useHoverExpand, zoneDropProps } from '../lib/drop';
import { openContextMenu } from './ContextMenu';
import DropLine from './ui/DropLine';

export default memo(function TaskRow({ row, depth, indent, prog, handleProps, clone, ghost, onAddChild, inner }) {
  const update = useStore((s) => s.update);
  const openDrawer = useStore((s) => s.openDrawer);
  const isProject = row.kind === 'project';
  const hasKids = row.childCount > 0;
  const pct = prog?.total ? prog.done / prog.total : 0;
  const [zone, setZone] = useState(null); // native drop from sidebar / calendar / Today
  useHoverExpand(zone === 'inside' && row.collapsed && hasKids, () => update(row.id, { collapsed: false }));

  return (
    <div style={{ paddingLeft: clone ? 0 : depth * indent }} className={clsx(ghost && 'opacity-40')}>
      <div
        onClick={() => openDrawer(row.id)}
        onContextMenu={clone ? undefined : (e) => openContextMenu(e, row)}
        {...(!clone && zoneDropProps(row.id, setZone))}
        className={clsx(
          'group relative flex cursor-pointer items-center gap-2 rounded-xl px-1.5 py-[7px] transition-colors',
          zone === 'inside' && '!bg-accent-500/15 ring-2 ring-accent-400/60',
          clone
            ? 'bg-white shadow-xl shadow-stone-900/10 ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-white/10'
            : 'hover:bg-stone-100/80 dark:hover:bg-white/[.04]',
          ghost && 'bg-accent-50 ring-1 ring-dashed ring-accent-300 dark:bg-accent-500/10'
        )}
      >
        {(zone === 'before' || zone === 'after') && <DropLine zone={zone} inset={4} />}
        <button
          {...handleProps}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab touch-none text-stone-300 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing dark:text-stone-600 max-md:opacity-60"
          aria-label="Drag"
        >
          <GripVertical size={15} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            update(row.id, { collapsed: !row.collapsed });
          }}
          className={clsx('-ml-1 grid h-5 w-5 place-items-center rounded-md text-stone-400 hover:bg-stone-200/70 dark:hover:bg-white/10', !hasKids && 'invisible')}
        >
          <ChevronRight size={14} className={clsx('transition-transform duration-200', !row.collapsed && 'rotate-90')} />
        </button>

        {isProject ? (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md" style={{ color: row.color || 'var(--color-accent-500)' }}>
            {row.collapsed || !hasKids ? <FolderClosed size={17} /> : <FolderOpen size={17} />}
          </span>
        ) : (
          <Checkbox checked={row.done} inProgress={!!row.timerStartedAt} onChange={(done) => update(row.id, { done })} />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {row.kind === 'meeting' && <Video size={14} className="shrink-0 text-sky-500" />}
          {row.kind === 'session' && <Timer size={14} className="shrink-0 text-violet-400" />}
          <span
            dir="auto"
            className={clsx(
              'truncate text-[14.5px] transition-colors',
              isProject && 'font-semibold',
              row.done ? 'text-stone-400 line-through decoration-stone-300 dark:text-stone-500' : 'text-stone-700 dark:text-stone-200'
            )}
          >
            {row.title}
          </span>
          {row.description && <AlignLeft size={12} className="shrink-0 text-stone-300 dark:text-stone-600" />}
          {row.someday && depth > 0 && <Hourglass size={12} className="shrink-0 text-amber-500/70" />}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!isProject && !clone && <OverlapBadge item={row} />}
          {!isProject && !clone && <DepsChip item={row} />}
          {!isProject && <TimerChip item={row} always />}
          <DateChip item={row} className="max-sm:hidden" />
          {prog?.total > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-stone-400">
              <span className="h-1.5 w-12 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10 max-sm:hidden">
                <span className="block h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
              </span>
              {prog.done}/{prog.total}
            </span>
          )}
          {!clone && (
            <div className="flex items-center opacity-0 transition group-hover:opacity-100 max-md:opacity-100">
              {inner?.ids.length > 0 && (
                <button
                  title={inner.anyOpen ? 'Collapse everything inside' : 'Expand everything inside'}
                  onClick={(e) => {
                    e.stopPropagation();
                    foldInside(row, inner);
                  }}
                  className="rounded-lg p-1 text-stone-400 hover:bg-stone-200/70 hover:text-stone-700 dark:hover:bg-white/10 dark:hover:text-stone-200"
                >
                  {inner.anyOpen ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
                </button>
              )}
              {isProject && (
              <button
                title="Add inside"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild?.(row.id);
                }}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-200/70 hover:text-stone-700 dark:hover:bg-white/10 dark:hover:text-stone-200"
              >
                <Plus size={15} />
              </button>
              )}
              <button
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  confirmDelete(row);
                }}
                className="rounded-lg p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
