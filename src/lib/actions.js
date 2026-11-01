import { useStore } from './store';
import { normalizeText, parseTask } from './parse';
import { descendantIds } from './tree';
import { ask } from '../components/ui/Dialog';

export const projectNames = (items) => items.filter((i) => i.kind === 'project').map((i) => i.title);

export const parseWithProjects = (text) => parseTask(text, new Date(), { projects: projectNames(useStore.getState().items) });

/** Asks, then deletes the item with everything inside it (undoable). */
export async function confirmDelete(item) {
  const { items, remove } = useStore.getState();
  const inside = descendantIds(items, item.id).length;
  const ok = await ask({
    title: `Delete “${item.title}”?`,
    message: `${inside ? `${inside} item${inside > 1 ? 's' : ''} inside will be deleted too. ` : ''}You can undo with Ctrl+Z.`,
    danger: true,
  });
  if (ok) remove(item.id);
  return ok;
}

/** Folds everything inside `item` (keeping it open), or unfolds it all if it's already folded. */
export function foldInside(item, { ids, anyOpen }) {
  const { items, setCollapsed } = useStore.getState();
  const byId = new Map(items.map((i) => [i.id, i]));
  setCollapsed(ids.filter((id) => !!byId.get(id)?.collapsed !== anyOpen), anyOpen);
  if (item.collapsed) setCollapsed([item.id], false);
}

/** Id of the project named `name`, creating it at the top level if needed. */
async function resolveProject(name) {
  const { items, create } = useStore.getState();
  const key = (s) => normalizeText(s).toLowerCase().trim();
  const found = items.find((i) => i.kind === 'project' && key(i.title) === key(name));
  return found ? found.id : (await create({ title: name, kind: 'project' }))?.id;
}

/** Parses free text and creates the item, resolving (or creating) a #project. */
export async function createFromText(text, defaults = {}) {
  const { create, toast } = useStore.getState();
  const p = parseWithProjects(text);
  const parent = (p.project && (await resolveProject(p.project))) || (defaults.parent ?? null);

  const item = await create({
    title: p.title,
    kind: p.kind,
    parent,
    start: p.start ?? defaults.start ?? null,
    end: p.end,
    allDay: p.start ? p.allDay : !!defaults.start,
    remindBefore: p.remindBefore,
    someday: defaults.someday ? !p.start : p.someday,
    repeat: p.repeat,
  });
  if (item && p.tokens.length) toast(`Added “${item.title}” · ${p.tokens.map((t) => t.label).join(' · ')}`);
  return item;
}

/**
 * Re-parses an edited title: applies any date/time, reminder, meeting, project or "later"
 * it finds, and saves the cleaned title. Fields not mentioned stay as they were.
 */
export async function applyTitleEdit(item, text) {
  const { items, update, toast } = useStore.getState();
  const p = parseWithProjects(text);
  const patch = { title: p.title };

  if (p.start)
    Object.assign(patch, {
      start: p.start.toISOString(),
      end: p.end ? p.end.toISOString() : null,
      allDay: p.allDay,
      someday: false,
      remindBefore: p.remindBefore,
    });
  else if (p.someday) Object.assign(patch, { someday: true, start: null, end: null });
  if (p.repeat) patch.repeat = p.repeat;
  if (p.kind === 'meeting' && item.kind === 'task') patch.kind = 'meeting';
  if (p.project) {
    const pid = await resolveProject(p.project);
    if (pid && pid !== item.id && pid !== item.parent && !descendantIds(items, item.id).includes(pid)) patch.parent = pid;
  }

  await update(item.id, patch);
  if (p.tokens.length) toast(p.tokens.map((t) => t.label).join(' · '), { title: 'Updated from title' });
  return p.title;
}
