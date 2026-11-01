import { useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import QuickAdd from '../components/QuickAdd';
import TreeList from '../components/TreeList';
import PageHeader, { Empty } from '../components/PageHeader';
import { useStore } from '../lib/store';
import { progress } from '../lib/tree';
import { Trash2 } from 'lucide-react';
import { confirmDelete } from '../lib/actions';

const plainText = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);

const notLater = (it) => !it.someday;
const all = () => true;

export default function TasksView() {
  const { id } = useParams();
  const items = useStore((s) => s.items);
  const loaded = useStore((s) => s.loaded);
  const openDrawer = useStore((s) => s.openDrawer);
  const project = id ? items.find((i) => i.id === id) : null;
  const prog = useMemo(() => (project ? progress(items, project.id) : null), [items, project]);

  if (id && loaded && !project) return <Navigate to="/" replace />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      {project ? (
        <PageHeader
          title={project.title}
          subtitle={plainText(project.description) || `${prog.done} of ${prog.total} done`}
        >
          <div className="flex items-center gap-1">
            <button onClick={() => openDrawer(project.id)} className="btn-ghost">Edit project</button>
            <button
              onClick={() => confirmDelete(project)}
              className="btn-ghost hover:!bg-rose-500/10 hover:!text-rose-300"
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </PageHeader>
      ) : (
        <PageHeader title={`${greeting} ✨`} subtitle={format(new Date(), 'EEEE, MMMM d')} />
      )}
      <QuickAdd defaults={{ parent: project?.id ?? null }} />
      <TreeList
        rootId={project?.id ?? null}
        rootFilter={project ? all : notLater}
        empty={
          loaded && (
            <Empty
              title={project ? 'Nothing here yet' : 'A clear mind'}
              text="Add tasks above. Drag them onto each other (move right) to nest — tasks can hold tasks and projects can hold projects."
            />
          )
        }
      />
    </>
  );
}
