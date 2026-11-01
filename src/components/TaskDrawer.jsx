import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { addMinutes, format } from 'date-fns';
import { Bell, CheckSquare, ChevronRight, FolderClosed, Hourglass, Link2, Trash2, Video, X, Plus, Timer, Layers, Sparkles, Repeat } from 'lucide-react';
import { applyTitleEdit, confirmDelete, parseWithProjects } from '../lib/actions';
import { useProjectSuggest } from './ProjectSuggest';
import NotesEditor from './NotesEditor';
import { isDialogOpen } from './ui/Dialog';
import TimeTracker from './TimeTracker';
import { ICONS, TONES } from './QuickAdd';
import { useStore } from '../lib/store';
import { describeRepeat } from '../lib/parse';
import { ancestors, childrenMap, descendantIds, isBlocked } from '../lib/tree';
import Checkbox from './Checkbox';
import Select from './ui/Select';
import DatePicker from './ui/DatePicker';
import TimePicker from './ui/TimePicker';
import ResizeHandle, { liveWidth } from './ui/ResizeHandle';

const KINDS = [
  { id: 'task', label: 'Task', icon: CheckSquare },
  { id: 'project', label: 'Project', icon: FolderClosed },
  { id: 'meeting', label: 'Meeting', icon: Video },
  { id: 'session', label: 'Session', icon: Timer },
];
const KIND_ICON = Object.fromEntries(KINDS.map((k) => [k.id, k.icon]));
const REMINDERS = [
  [null, 'No reminder'], [0, 'At start time'], [5, '5 min before'], [10, '10 min before'],
  [15, '15 min before'], [30, '30 min before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before'],
].map(([value, label]) => ({ value, label }));
const COLORS = ['#6f5cef', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#64748b'];

const hhmm = (d) => (d ? format(d, 'HH:mm') : '');
const withTime = (day, t) => {
  const d = new Date(day);
  const [h, m] = t.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

function Section({ label, icon: Icon, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {Icon && <Icon size={12} />} {label}
      </div>
      {children}
    </div>
  );
}

function Drawer({ item }) {
  const items = useStore((s) => s.items);
  const update = useStore((s) => s.update);
  const remove = useStore((s) => s.remove);
  const create = useStore((s) => s.create);
  const close = useStore((s) => s.closeDrawer);
  const openDrawer = useStore((s) => s.openDrawer);
  const [title, setTitle] = useState(item.title);
  const [sub, setSub] = useState('');
  const titleRef = useRef(null);
  const suggest = useProjectSuggest(title, setTitle, titleRef);
  const titleParse = useMemo(() => (title.trim() && title !== item.title ? parseWithProjects(title) : null), [title, item.title]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const crumbs = ancestors(items, item.id);
  const kids = childrenMap(items).get(item.id) || [];
  const excluded = useMemo(() => new Set([item.id, ...descendantIds(items, item.id)]), [items, item.id]);

  const treeOptions = useMemo(() => {
    const map = childrenMap(items);
    const out = [];
    const walk = (p, d, path) =>
      (map.get(p) || []).forEach((it) => {
        out.push({ it, d, path });
        walk(it.id, d + 1, path ? `${path} › ${it.title}` : it.title);
      });
    walk(null, 0, '');
    return out;
  }, [items]);
  const parentOptions = useMemo(
    () => [
      { value: null, label: 'Top level', icon: Layers, muted: true },
      ...treeOptions
        .filter(({ it }) => !excluded.has(it.id))
        .map(({ it, d }) => ({ value: it.id, label: it.title, depth: d, icon: KIND_ICON[it.kind], color: it.kind === 'project' ? it.color || '#6f5cef' : undefined })),
    ],
    [treeOptions, excluded]
  );
  const depOptions = useMemo(
    () =>
      treeOptions
        .filter(({ it }) => it.id !== item.id && !item.dependsOn.includes(it.id) && it.kind !== 'project')
        .map(({ it, path }) => ({ value: it.id, label: it.title, hint: path, icon: KIND_ICON[it.kind] })),
    [treeOptions, item.id, item.dependsOn]
  );

  const deps = item.dependsOn.map((d) => byId.get(d)).filter(Boolean);
  const blocks = items.filter((i) => i.dependsOn.includes(item.id));
  const start = item.start ? new Date(item.start) : null;
  const end = item.end ? new Date(item.end) : null;
  const timed = start && !item.allDay;

  const setWhen = (day, time) => {
    if (!day) return update(item.id, { start: null, end: null, allDay: false });
    if (!time) return update(item.id, { start: new Date(day).toISOString(), end: null, allDay: true, someday: false });
    const s = withTime(day, time);
    const dur = timed && end ? end - start : null;
    update(item.id, {
      start: s.toISOString(),
      end: dur ? new Date(s.getTime() + dur).toISOString() : null,
      allDay: false,
      someday: false,
      remindBefore: item.remindBefore ?? (item.kind === 'meeting' ? 10 : 0),
    });
  };
  const setEnd = (t) => {
    if (!t) return update(item.id, { end: null });
    let e = withTime(start, t);
    if (e <= start) e = addMinutes(e, 24 * 60);
    update(item.id, { end: e.toISOString() });
  };

  const del = () => confirmDelete(item);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-stone-500">
          {crumbs.length === 0 && <span>{item.someday ? 'Later' : 'Tasks'}</span>}
          {crumbs.map((c, i) => (
            <span key={c.id} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight size={12} />}
              <button dir="auto" onClick={() => openDrawer(c.id)} className="truncate hover:text-accent-400">{c.title}</button>
            </span>
          ))}
        </div>
        <button onClick={del} title="Delete (Del)" className="btn-ghost p-1.5 hover:!bg-rose-500/10 hover:!text-rose-300"><Trash2 size={16} /></button>
        <button onClick={close} title="Close (Esc)" className="btn-ghost p-1.5"><X size={18} /></button>
      </div>

      <div className="scroll-thin flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="flex items-start gap-3">
          {item.kind !== 'project' && (
            <div className="pt-1.5">
              <Checkbox size={22} checked={item.done} inProgress={!!item.timerStartedAt} onChange={(done) => update(item.id, { done })} />
            </div>
          )}
          <div className="relative min-w-0 flex-1">
            <textarea
              ref={titleRef}
              dir="auto"
              rows={1}
              value={title}
              {...suggest.inputProps}
              onChange={(e) => {
                setTitle(e.target.value);
                suggest.onChange(e);
              }}
              onBlur={async () => {
                if (!title.trim() || title === item.title) return;
                setTitle(await applyTitleEdit(item, title.trim()));
              }}
              onKeyDown={(e) => !suggest.onKeyDown(e) && e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
              className="field-sizing-content w-full resize-none bg-transparent text-xl font-semibold outline-none"
            />
            {suggest.dropdown}
            <AnimatePresence>
              {titleParse?.tokens.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 text-[11px]">
                    <Sparkles size={12} className="text-accent-400" />
                    {titleParse.tokens.map((t) => {
                      const Icon = ICONS[t.type];
                      return (
                        <span key={t.type} className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium', TONES[t.type])}>
                          <Icon size={11} /> {t.label}
                        </span>
                      );
                    })}
                    <span className="text-stone-500">· applies when you press Enter</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl bg-white/5 p-1">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => update(item.id, { kind: k.id })}
              className={clsx(
                'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors sm:text-sm',
                item.kind === k.id ? 'text-white' : 'text-stone-500 hover:text-stone-300'
              )}
            >
              {item.kind === k.id && <motion.span layoutId="kind-pill" className="absolute inset-0 rounded-lg bg-white/10 shadow-sm" />}
              <k.icon size={14} className="relative" />
              <span className="relative">{k.label}</span>
            </button>
          ))}
        </div>

        {item.kind !== 'project' && (
          <Section label="Status & time">
            <TimeTracker item={item} />
          </Section>
        )}

        <Section label="When">
          <DatePicker value={start} onChange={(d) => setWhen(d, timed ? hhmm(start) : '')} placeholder="No date" />
          <div className="flex items-center gap-2">
            <TimePicker disabled={!start} value={timed ? hhmm(start) : ''} onChange={(t) => setWhen(start, t)} className="flex-1" />
            {timed && (
              <>
                <span className="text-stone-600">→</span>
                <TimePicker value={hhmm(end)} onChange={setEnd} emptyLabel="No end" className="flex-1" />
              </>
            )}
          </div>
          <button
            onClick={() => update(item.id, { someday: !item.someday, ...(item.someday ? {} : { start: null, end: null }) })}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition',
              item.someday ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-white/10 text-stone-400 hover:border-amber-500/40 hover:text-amber-300'
            )}
          >
            <Hourglass size={11} /> {item.someday ? 'In Later' : 'Move to Later'}
          </button>
          {start && (
            <Select value={item.remindBefore} onChange={(v) => update(item.id, { remindBefore: v })} options={REMINDERS} icon={Bell} />
          )}
          {item.kind !== 'project' && (
            <Select
              value={item.repeat ? `${item.repeat.every}:${item.repeat.interval || 1}` : null}
              onChange={(v) => {
                if (!v) return update(item.id, { repeat: null });
                const [every, n] = v.split(':');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                // Repeating needs a date: start today if there's none.
                update(item.id, { repeat: { every, interval: +n }, ...(!start && { start: today.toISOString(), allDay: true, someday: false }) });
              }}
              options={[null, 'day:1', 'week:1', 'week:2', 'month:1', 'year:1'].map((v) => ({
                value: v,
                label: v ? describeRepeat({ every: v.split(':')[0], interval: +v.split(':')[1] }, start) : 'Does not repeat',
              }))}
              icon={Repeat}
            />
          )}
        </Section>

        <Section label="Notes">
          <NotesEditor value={item.description} onSave={(description) => update(item.id, { description })} />
        </Section>

        <Section label={`Inside (${kids.length})`}>
          <div className="space-y-1">
            {kids.map((k) => {
              const Icon = KIND_ICON[k.kind];
              return (
                <div key={k.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/5">
                  {k.kind === 'project' ? <Icon size={16} style={{ color: k.color || '#6f5cef' }} /> : <Checkbox size={16} checked={k.done} onChange={(done) => update(k.id, { done })} />}
                  <button dir="auto" onClick={() => openDrawer(k.id)} className={clsx('flex-1 truncate text-start text-sm', k.done && 'text-stone-500 line-through')}>
                    {k.title}
                  </button>
                </div>
              );
            })}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!sub.trim()) return;
                await create({ title: sub.trim(), parent: item.id });
                setSub('');
              }}
              className="flex items-center gap-2 px-1"
            >
              <Plus size={16} className="text-stone-600" />
              <input dir="auto" value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Add a subtask" className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-600" />
            </form>
          </div>
        </Section>

        <Section label="Depends on" icon={Link2}>
          {isBlocked(item, byId) && !item.done && (
            <p className="text-xs text-amber-400">Waiting on {deps.filter((d) => !d.done).length} unfinished task(s).</p>
          )}
          {deps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {deps.map((d) => (
                <motion.span
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={d.id}
                  className={clsx('inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs', d.done ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300')}
                >
                  <button dir="auto" onClick={() => openDrawer(d.id)}>{d.title}</button>
                  <button onClick={() => update(item.id, { dependsOn: item.dependsOn.filter((x) => x !== d.id) })} className="rounded-full p-0.5 hover:bg-white/10">
                    <X size={11} />
                  </button>
                </motion.span>
              ))}
            </div>
          )}
          <Select
            value={null}
            onChange={(v) => update(item.id, { dependsOn: [...item.dependsOn, v] })}
            options={depOptions}
            placeholder="Add a task this waits on…"
            searchable
            searchPlaceholder="Search tasks…"
            icon={Plus}
          />
          {blocks.length > 0 && (
            <p className="text-xs text-stone-500">
              Blocks:{' '}
              {blocks.map((b, i) => (
                <button key={b.id} onClick={() => openDrawer(b.id)} className="hover:text-accent-400">
                  {b.title}{i < blocks.length - 1 && ', '}
                </button>
              ))}
            </p>
          )}
        </Section>

        <Section label="Lives in">
          <Select
            value={item.parent || null}
            onChange={(v) => update(item.id, { parent: v })}
            options={parentOptions}
            searchable
            searchPlaceholder="Search projects & tasks…"
          />
        </Section>

        {item.kind === 'project' && (
          <Section label="Color">
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <motion.button
                  key={c}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => update(item.id, { color: c })}
                  className={clsx('h-6 w-6 rounded-full ring-offset-2 ring-offset-stone-900', (item.color || COLORS[0]) === c && 'ring-2 ring-white/60')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/5 px-5 py-3 text-xs text-stone-500">
        <span>Created {format(new Date(item.createdAt), 'MMM d, yyyy')}</span>
        <button onClick={del} className="btn text-rose-400 hover:bg-rose-500/10">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}

export default function TaskDrawer() {
  const item = useStore((s) => s.items.find((i) => i.id === s.drawerId));
  const privacy = useStore((s) => s.privacy);
  const close = useStore((s) => s.closeDrawer);
  const drawerWidth = useStore((s) => s.drawerWidth);

  // Esc closes; Delete / Backspace deletes (outside text fields and open dialogs).
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable="true"]') || isDialogOpen()) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'Delete' || e.key === 'Backspace') (e.preventDefault(), confirmDelete(item));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, close]);
  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            data-scrim
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            data-resizable
            style={{ width: liveWidth('drawerWidth', drawerWidth), maxWidth: 'min(100vw, max(360px, 50vw))' }}
            className="fixed inset-y-0 right-0 z-40 border-l border-white/[.06] bg-stone-900/80 shadow-2xl backdrop-blur-2xl"
          >
            <ResizeHandle
              prefKey="drawerWidth"
              edge="left"
              clamp={(w) => Math.round(Math.min(Math.max(360, window.innerWidth * 0.5), Math.max(360, w)))}
              reset={448}
            />
            <Drawer key={`${item.id}-${privacy}`} item={item} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
