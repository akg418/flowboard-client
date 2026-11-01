import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TaskDrawer from './components/TaskDrawer';
import Toasts from './components/Toasts';
import ResizeHandle, { liveWidth } from './components/ui/ResizeHandle';
import DialogHost from './components/ui/Dialog';
import ContextMenuHost from './components/ContextMenu';
import SessionDialog from './components/SessionDialog';
import TasksView from './views/TasksView';
import TodayView from './views/TodayView';
import LaterView from './views/LaterView';
import DoneView from './views/DoneView';
import OverlapView from './views/OverlapView';
import NotesView from './views/NotesView';
import ProjectsView from './views/ProjectsView';
import { MentionMenu } from './components/Mention';
import { useNotes } from './lib/notes';
import CalendarView from './views/CalendarView';
import GraphView from './views/GraphView';
import AuthView from './views/AuthView';
import GuideView from './views/GuideView';
import LogsView from './views/LogsView';
import { useStore } from './lib/store';
import { useReminders } from './lib/useReminders';
import { useAzkar } from './lib/azkar';

/** Ctrl/⌘+Z undo, Ctrl/⌘+Y or ⌘+Shift+Z redo — outside text fields, which keep their own undo. */
function useUndoKeys() {
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target;
      if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const { undo, redo } = useStore.getState();
      // e.code, not e.key, so it works with an Arabic keyboard layout too.
      if (e.code === 'KeyZ' && !e.shiftKey) (e.preventDefault(), undo());
      else if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) (e.preventDefault(), redo());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const GLASS = 'border-white/[.06] bg-white/[.03] backdrop-blur-2xl backdrop-saturate-150';

export default function App() {
  const user = useStore((s) => s.user);
  const authChecked = useStore((s) => s.authChecked);
  const restoreSession = useStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (!authChecked) return null;
  return (
    <>
      {user ? <Workspace key={user.id} /> : <AuthView />}
      <DialogHost />
      <ContextMenuHost />
    </>
  );
}

function Workspace() {
  const load = useStore((s) => s.load);
  const loadNotes = useNotes((s) => s.load);
  const collapsed = useStore((s) => s.navCollapsed);
  const navWidth = useStore((s) => s.navWidth);
  const location = useLocation();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    load();
    loadNotes();
  }, [load, loadNotes]);
  useReminders();
  useAzkar();
  useUndoKeys();

  // The page shifts with the sidebar by a transform only (FLIP): one re-layout, then a GPU slide.
  const pageRef = useRef(null);
  const lastLeft = useRef(null);
  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const left = el.getBoundingClientRect().left;
    const dx = lastLeft.current == null ? 0 : lastLeft.current - left;
    lastLeft.current = left;
    if (Math.abs(dx) > 0.5) el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.32,.72,0,1)' });
  }, [collapsed]);
  // A drag-resize already moved the page live; just remember where it ended up.
  useLayoutEffect(() => {
    lastLeft.current = pageRef.current?.getBoundingClientRect().left ?? null;
  }, [navWidth]);
  useEffect(() => {
    const sync = () => (lastLeft.current = pageRef.current?.getBoundingClientRect().left ?? null);
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const wide = ['/calendar', '/graph', '/notes'].some((p) => location.pathname.startsWith(p));

  return (
    <div className="ambient relative isolate flex h-full">
      {/* Fixed + CSS width transition: only the sidebar animates; the page re-lays out once. */}
      <aside
        data-resizable
        style={{ width: collapsed ? 72 : liveWidth('navWidth', navWidth) }}
        className={`fixed inset-y-2 left-2 z-20 hidden rounded-3xl border shadow-2xl shadow-black/20 transition-[width] duration-300 ease-[cubic-bezier(.32,.72,0,1)] [contain:layout_paint] md:block ${GLASS}`}
      >
        <div className="h-full overflow-hidden rounded-3xl">
          <Sidebar />
        </div>
        {!collapsed && <ResizeHandle prefKey="navWidth" clamp={(w) => Math.min(340, Math.max(220, w))} reset={260} />}
      </aside>

      <AnimatePresence>
        {menu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} className="fixed inset-0 z-30 bg-black/40 md:hidden" />
            <motion.aside
              initial={{ x: '-110%' }}
              animate={{ x: 0 }}
              exit={{ x: '-110%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className={`fixed inset-y-2 left-2 z-30 w-72 rounded-3xl border bg-stone-900/70 shadow-2xl md:hidden ${GLASS}`}
            >
              <Sidebar mobile onNavigate={() => setMenu(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main style={{ '--nav': collapsed ? '80px' : `calc(${liveWidth('navWidth', navWidth)} + 8px)` }} className="scroll-thin min-w-0 flex-1 overflow-y-auto md:pl-[var(--nav)]">
        <div className={`sticky top-0 z-20 flex items-center gap-2 border-b px-4 py-2 md:hidden ${GLASS}`}>
          <button onClick={() => setMenu(true)} className="btn-ghost p-1.5"><Menu size={20} /></button>
          <span className="font-semibold">Flowboard</span>
        </div>
        <div ref={pageRef} className={wide ? 'mx-auto max-w-7xl px-4 py-8 sm:px-8' : 'mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname.startsWith('/notes') ? '/notes' : location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <Routes location={location}>
                <Route path="/" element={<TasksView />} />
                <Route path="/p/:id" element={<TasksView />} />
                <Route path="/today" element={<TodayView />} />
                <Route path="/later" element={<LaterView />} />
                <Route path="/done" element={<DoneView />} />
                <Route path="/overlap" element={<OverlapView />} />
                <Route path="/projects" element={<ProjectsView />} />
                <Route path="/notes" element={<NotesView />} />
                <Route path="/notes/:id" element={<NotesView />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/graph" element={<GraphView />} />
                <Route path="/logs" element={<LogsView />} />
                <Route path="/guide" element={<GuideView />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <TaskDrawer />
      <SessionDialog />
      <Toasts />
      <MentionMenu />
    </div>
  );
}
