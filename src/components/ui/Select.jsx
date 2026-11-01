import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, Search } from 'lucide-react';
import Popover from './Popover';
import { normalizeText } from '../../lib/parse';

const norm = (s) => normalizeText(String(s)).toLowerCase();

/**
 * Searchable dropdown.
 * options: [{ value, label, icon?, depth?, hint?, color? }]
 * `extra(query)` may return an option to append (e.g. "Use 17:45").
 */
export default function Select({
  value, onChange, options, placeholder = 'Select…', searchPlaceholder = 'Search…',
  searchable = options.length > 6, className, renderValue, extra, width = 'anchor', icon: LeadIcon, keepOpen,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const list = q ? options.filter((o) => norm(o.label).includes(norm(q)) || (o.hint && norm(o.hint).includes(norm(q)))) : options;
    const add = q && extra?.(q);
    return add ? [...list, add] : list;
  }, [options, q, extra]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => setActive((a) => Math.min(a, Math.max(filtered.length - 1, 0))), [filtered.length]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (o) => {
    onChange(o.value, o);
    if (!keepOpen) setOpen(false);
    else setQ('');
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, filtered.length - 1)));
    else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
    else if (e.key === 'Enter' && filtered[active]) (e.preventDefault(), pick(filtered[active]));
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => !open && (e.key === 'ArrowDown' || e.key === 'Enter') && (e.preventDefault(), setOpen(true))}
        className={clsx('input flex items-center gap-2 text-left', open && 'border-accent-500 ring-4 ring-accent-500/20', className)}
      >
        {LeadIcon && <LeadIcon size={15} className="shrink-0 text-stone-400" />}
        <span dir="auto" className={clsx('min-w-0 flex-1 truncate', !selected && 'text-stone-500')}>
          {renderValue ? renderValue(selected) : selected ? (
            <span className="flex items-center gap-2">
              {selected.icon && <selected.icon size={14} style={{ color: selected.color }} className="shrink-0" />}
              <span dir="auto" className="truncate">{selected.label}</span>
            </span>
          ) : placeholder}
        </span>
        <ChevronDown size={15} className={clsx('shrink-0 text-stone-500 transition-transform', open && 'rotate-180')} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} width={width}>
        <div onKeyDown={onKey}>
          {searchable && (
            <div className="flex items-center gap-2 border-b border-white/5 px-3">
              <Search size={14} className="text-stone-500" />
              <input
                autoFocus
                dir="auto"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-stone-500"
              />
            </div>
          )}
          <div ref={listRef} tabIndex={searchable ? -1 : 0} autoFocus={!searchable} className="scroll-thin max-h-72 overflow-y-auto p-1.5 outline-none">
            {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-stone-500">Nothing matches “{q}”</div>}
            {filtered.map((o, i) => {
              const isSel = o.value === value;
              return (
                <button
                  key={String(o.value) + i}
                  data-i={i}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  style={{ paddingLeft: 10 + (q ? 0 : (o.depth || 0) * 14) }}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-lg py-2 pr-2.5 text-left text-sm transition-colors',
                    i === active ? 'bg-white/[.07] text-white' : 'text-stone-300',
                    o.muted && 'text-stone-500'
                  )}
                >
                  {o.icon && <o.icon size={14} style={{ color: o.color }} className="shrink-0 opacity-90" />}
                  <span dir="auto" className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span dir="auto" className="max-w-[45%] shrink-0 truncate text-[11px] text-stone-500">{o.hint}</span>}
                  {isSel && <Check size={14} className="shrink-0 text-accent-400" />}
                </button>
              );
            })}
          </div>
        </div>
      </Popover>
    </>
  );
}
