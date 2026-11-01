import { Layers } from 'lucide-react';
import { useStore } from '../lib/store';
import { overlapsOf } from '../lib/archive';

/** Shows when the item's time clashes with another open item's. */
export default function OverlapBadge({ item }) {
  const others = useStore((s) => overlapsOf(s.items).get(item.id));
  if (!others?.length) return null;
  return (
    <span
      title={`Overlaps: ${others.map((o) => o.title).join(', ')}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[11px] font-medium text-orange-300"
    >
      <Layers size={11} />
      {others.length}
    </span>
  );
}
