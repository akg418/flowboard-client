import { openContextMenu } from '../components/ContextMenu';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, applyNodeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import clsx from 'clsx';
import { CheckCircle2, Circle, Lock, Video } from 'lucide-react';
import PageHeader, { Empty } from '../components/PageHeader';
import { useStore } from '../lib/store';
import { descendantIds, isBlocked } from '../lib/tree';
import DateChip from '../components/DateChip';
import Select from '../components/ui/Select';
import Switch from '../components/ui/Switch';
import { FolderClosed, Layers } from 'lucide-react';

const W = 230, H = 74;

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function TaskNode({ data }) {
  const { item, status, parentTitle } = data;
  const styles = {
    done: 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-500/40 dark:bg-emerald-500/10',
    blocked: 'border-amber-300 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-500/10',
    ready: 'border-accent-300 bg-white dark:border-accent-500/50 dark:bg-stone-800',
  };
  const Icon = status === 'done' ? CheckCircle2 : status === 'blocked' ? Lock : Circle;
  return (
    <div style={{ width: W }} className={clsx('rounded-2xl border-2 px-3 py-2.5 shadow-sm transition-shadow hover:shadow-lg', styles[status])}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-stone-400" />
      <div className="flex items-start gap-2">
        <Icon size={16} className={clsx('mt-0.5 shrink-0', status === 'done' ? 'text-emerald-500' : status === 'blocked' ? 'text-amber-500' : 'text-accent-500')} />
        <div className="min-w-0 flex-1">
          <div dir="auto" className={clsx('truncate text-sm font-semibold', status === 'done' && 'text-stone-400 line-through')}>
            {item.kind === 'meeting' && <Video size={12} className="mr-1 inline text-sky-500" />}
            {item.title}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {parentTitle && <span dir="auto" className="truncate text-[11px] text-stone-400">{parentTitle}</span>}
            <DateChip item={item} className="!px-1.5 !py-0" />
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-accent-500" />
    </div>
  );
}
const nodeTypes = { task: TaskNode };

function layout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: W, height: H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - W / 2, y: p.y - H / 2 } };
  });
}

export default function GraphView() {
  const items = useStore((s) => s.items);
  const update = useStore((s) => s.update);
  const openDrawer = useStore((s) => s.openDrawer);
  const dark = useIsDark();
  const [scope, setScope] = useState('');
  const [linkedOnly, setLinkedOnly] = useState(true);
  const [nodes, setNodes] = useState([]);

  const projects = items.filter((i) => i.kind === 'project');
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const { baseNodes, edges } = useMemo(() => {
    const inScope = scope ? new Set(descendantIds(items, scope)) : null;
    let pool = items.filter((i) => i.kind !== 'project' && (!inScope || inScope.has(i.id)));
    const ids = new Set(pool.map((i) => i.id));
    const edges = [];
    for (const it of pool)
      for (const d of it.dependsOn)
        if (ids.has(d)) {
          const src = byId.get(d);
          edges.push({
            id: `${d}->${it.id}`,
            source: d,
            target: it.id,
            animated: !src.done,
            markerEnd: { type: MarkerType.ArrowClosed, color: src.done ? '#10b981' : '#f59e0b' },
            style: { stroke: src.done ? '#10b981' : '#f59e0b', strokeWidth: 2 },
          });
        }
    if (linkedOnly) {
      const linked = new Set(edges.flatMap((e) => [e.source, e.target]));
      pool = pool.filter((i) => linked.has(i.id));
    }
    const baseNodes = pool.map((item) => ({
      id: item.id,
      type: 'task',
      position: { x: 0, y: 0 },
      data: {
        item,
        status: item.done ? 'done' : isBlocked(item, byId) ? 'blocked' : 'ready',
        parentTitle: item.parent ? byId.get(item.parent)?.title : null,
      },
    }));
    return { baseNodes, edges };
  }, [items, byId, scope, linkedOnly]);

  // Re-layout only when the graph's shape changes; keep user-dragged positions otherwise.
  const shape = baseNodes.map((n) => n.id).join() + '|' + edges.map((e) => e.id).join();
  useEffect(() => {
    setNodes(layout(baseNodes, edges));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);
  useEffect(() => {
    const data = new Map(baseNodes.map((n) => [n.id, n.data]));
    setNodes((ns) => ns.map((n) => (data.has(n.id) ? { ...n, data: data.get(n.id) } : n)));
  }, [baseNodes]);

  const onNodesChange = useCallback((changes) => setNodes((ns) => applyNodeChanges(changes, ns)), []);
  const onConnect = useCallback(
    ({ source, target }) => {
      const t = byId.get(target);
      if (t && source !== target && !t.dependsOn.includes(source)) update(target, { dependsOn: [...t.dependsOn, source] });
    },
    [byId, update]
  );
  const onEdgesDelete = useCallback(
    (removed) =>
      removed.forEach((e) => {
        const t = byId.get(e.target);
        if (t) update(t.id, { dependsOn: t.dependsOn.filter((d) => d !== e.source) });
      }),
    [byId, update]
  );

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col">
      <PageHeader title="Map" subtitle="What comes before what. Drag from a task's right dot to another task to make it wait.">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={scope}
            onChange={setScope}
            className="w-56"
            searchable
            searchPlaceholder="Search projects…"
            options={[
              { value: '', label: 'All projects', icon: Layers },
              ...projects.map((p) => ({ value: p.id, label: p.title, icon: FolderClosed, color: p.color || '#6f5cef' })),
            ]}
          />
          <Switch checked={!linkedOnly} onChange={(v) => setLinkedOnly(!v)} label="Show unlinked" />
        </div>
      </PageHeader>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><Circle size={12} className="text-accent-500" /> Ready to do</span>
        <span className="flex items-center gap-1.5"><Lock size={12} className="text-amber-500" /> Waiting on something</span>
        <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500" /> Done</span>
        <span className="text-stone-400">Select an arrow + Backspace to remove it.</span>
      </div>

      <div className="card relative min-h-[360px] flex-1 overflow-hidden">
        {nodes.length === 0 ? (
          <Empty icon="🕸️" title="No links yet" text="Tick “Show unlinked tasks”, then drag between tasks — or add dependencies from a task's details." />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodeDoubleClick={(_, n) => openDrawer(n.id)}
            onNodeClick={(_, n) => openDrawer(n.id)}
            onNodeContextMenu={(e, n) => openContextMenu(e, { id: n.id })}
            colorMode={dark ? 'dark' : 'light'}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1.2} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
