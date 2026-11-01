import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { ArrowLeftRight } from 'lucide-react';
import PageHeader, { Empty } from '../components/PageHeader';
import ItemLine from '../components/ItemLine';
import { useStore } from '../lib/store';
import { overlaps } from '../lib/archive';

const range = (it) => {
  const s = new Date(it.start);
  if (!it.end) return format(s, 'h:mm a');
  const e = new Date(it.end);
  return `${format(s, 'h:mm a')} – ${format(e, isSameDay(s, e) ? 'h:mm a' : 'MMM d, h:mm a')}`;
};

export default function OverlapView() {
  const items = useStore((s) => s.items);
  const loaded = useStore((s) => s.loaded);

  // Pairs grouped by the day the clash starts.
  const days = useMemo(() => {
    const map = new Map();
    for (const [a, b] of overlaps(items)) {
      const key = format(new Date(b.start), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, { day: new Date(b.start), pairs: [] });
      map.get(key).pairs.push([a, b]);
    }
    return [...map.values()];
  }, [items]);

  const total = days.reduce((n, d) => n + d.pairs.length, 0);

  return (
    <>
      <PageHeader title="Overlap" subtitle={total ? `${total} clash${total > 1 ? 'es' : ''} between open, timed tasks` : 'Open tasks whose times clash'} />
      {loaded && !total && <Empty icon="🧩" title="No overlaps" text="Nothing you've scheduled runs into anything else." />}
      {days.map(({ day, pairs }) => (
        <section key={day.toISOString()} className="mb-6">
          <h2 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-stone-400">
            {format(day, 'EEEE, MMM d')} <span className="ml-1 font-normal opacity-70">{pairs.length}</span>
          </h2>
          <div className="space-y-2">
            {pairs.map(([a, b]) => (
              <div key={`${a.id}-${b.id}`} className="card p-1.5">
                <ItemLine item={a} />
                <div className="flex items-center gap-2 px-3 text-[11px] text-orange-300/80">
                  <ArrowLeftRight size={12} /> {range(a)} overlaps {range(b)}
                </div>
                <ItemLine item={b} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
