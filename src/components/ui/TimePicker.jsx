import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import Select from './Select';

const fmt = (h, m) => {
  const am = h < 12;
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
};

// Every 15 minutes; also accepts typed times like "17:45", "5:45pm", "9".
const OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4), m = (i % 4) * 15;
  const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { value: v, label: fmt(h, m), hint: v };
});

function parseTyped(q) {
  const m = q.trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p|ص|م)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (h > 23 || min > 59) return null;
  if (/^(pm|p|م)$/.test(m[3] || '') && h < 12) h += 12;
  if (/^(am|a|ص)$/.test(m[3] || '') && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export default function TimePicker({ value, onChange, disabled, className, emptyLabel = 'All day' }) {
  const options = useMemo(() => [{ value: '', label: emptyLabel, muted: true }, ...OPTIONS], [emptyLabel]);
  if (disabled)
    return (
      <div className={`input flex items-center gap-2 text-stone-600 ${className || ''}`}>
        <Clock size={15} /> Time
      </div>
    );
  return (
    <Select
      value={value || ''}
      onChange={onChange}
      options={options}
      icon={Clock}
      searchable
      searchPlaceholder="Type a time… 17:45"
      className={className}
      width={220}
      extra={(q) => {
        const v = parseTyped(q);
        if (!v) return null;
        const [h, m] = v.split(':').map(Number);
        return { value: v, label: `Use ${fmt(h, m)}`, hint: v };
      }}
    />
  );
}
