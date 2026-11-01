import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { addMinutes, format, startOfDay } from 'date-fns';
import { FolderClosed, Timer } from 'lucide-react';
import { useStore } from '../lib/store';
import { childrenMap } from '../lib/tree';
import Select from './ui/Select';
import DatePicker from './ui/DatePicker';
import TimePicker from './ui/TimePicker';

const at = (day, hhmm) => {
  const d = new Date(day);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};
const nextSlot = () => {
  const d = addMinutes(new Date(), 30);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return format(d, 'HH:mm');
};

/** "I'll work on <project> on <day> from <time> to <time>" → a session item inside that project. */
export default function SessionDialog() {
  const open = useStore((s) => s.sessionOpen);
  const preset = useStore((s) => s.sessionPreset);
  const setOpen = useStore((s) => s.setSessionOpen);
  const items = useStore((s) => s.items);
  const create = useStore((s) => s.create);
  const toast = useStore((s) => s.toast);
  const [project, setProject] = useState(null);
  const [day, setDay] = useState(startOfDay(new Date()));
  const [from, setFrom] = useState(nextSlot());
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');

  const projects = useMemo(() => {
    const map = childrenMap(items);
    const out = [];
    const walk = (p, d) =>
      (map.get(p) || []).forEach((it) => {
        if (it.kind === 'project') out.push({ value: it.id, label: it.title, depth: d, icon: FolderClosed, color: it.color || '#6f5cef' });
        walk(it.id, it.kind === 'project' ? d + 1 : d);
      });
    walk(null, 0);
    return out;
  }, [items]);

  useEffect(() => {
    if (!open) return;
    setProject(preset?.project ?? null);
    setDay(preset?.day ?? startOfDay(new Date()));
    const f = nextSlot();
    setFrom(f);
    setTo(format(addMinutes(at(new Date(), f), 120), 'HH:mm'));
    setNote('');
  }, [open, preset]);

  const close = () => setOpen(false);
  const save = async (e) => {
    e.preventDefault();
    if (!project || !day || !from) return;
    const p = items.find((i) => i.id === project);
    const start = at(day, from);
    let end = to ? at(day, to) : null;
    if (end && end <= start) end = addMinutes(end, 24 * 60);
    const item = await create({
      title: note.trim() || `Work on ${p.title}`,
      kind: 'session',
      parent: project,
      start,
      end,
      allDay: false,
      remindBefore: 5,
    });
    if (item) {
      toast(`${format(start, 'EEE h:mm a')}${end ? ' – ' + format(end, 'h:mm a') : ''}`, { title: `Session planned · ${p.title}` });
      close();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && close()}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <motion.form
            onSubmit={save}
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-stone-900/95 p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
                <Timer size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Plan a work session</h3>
                <p className="text-sm text-stone-400">Block time to work on a project.</p>
              </div>
            </div>

            <Select
              value={project}
              onChange={setProject}
              options={projects}
              placeholder={projects.length ? 'Which project?' : 'No projects yet — create one first'}
              searchable
              searchPlaceholder="Search projects…"
              icon={projects.length ? undefined : FolderClosed}
            />
            <DatePicker value={day} onChange={(d) => d && setDay(d)} />
            <div className="flex items-center gap-2">
              <TimePicker value={from} onChange={(v) => v && setFrom(v)} className="flex-1" />
              <span className="text-stone-500">→</span>
              <TimePicker value={to} onChange={setTo} className="flex-1" emptyLabel="No end time" />
            </div>
            <input
              dir="auto"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What will you do? (optional)"
              className="input"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="btn-ghost">Cancel</button>
              <button disabled={!project} className="btn-primary disabled:opacity-40">Add session</button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
