import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { StickyNote, Bell, CheckCheck, Layers, History, CalendarDays, FolderClosed, Hourglass, ListTodo, Network, PanelLeftClose, PanelLeftOpen, Sunrise, Moon, LogOut, BookOpen, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isToday, startOfDay } from 'date-fns';
import { useStore } from '../lib/store';
import { overlapsOf } from '../lib/archive';
import { liveWidth } from './ui/ResizeHandle';
import { dragProps, dropOn, nativeDropProps, useHoverExpand, zoneDropProps } from '../lib/drop';
import { openContextMenu } from './ContextMenu';
import { ask } from './ui/Dialog';
import Switch from './ui/Switch';
import DropLine from './ui/DropLine';

const NAV = [
  { to: '/', label: 'Tasks', icon: ListTodo, end: true, drop: 'tasks' },
  { to: '/today', label: 'Today', icon: Sunrise, drop: 'today' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/projects', label: 'Projects', icon: FolderClosed },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/later', label: 'Later', icon: Hourglass, drop: 'later' },
  { to: '/done', label: 'Done', icon: CheckCheck },
  { to: '/overlap', label: 'Overlap', icon: Layers },
  { to: '/graph', label: 'Map', icon: Network },
  { to: '/logs', label: 'Logs', icon: History },
  { to: '/guide', label: 'Writing guide', icon: BookOpen },
];

// The sidebar's content keeps one fixed width; collapsing only narrows the clip around it,
// so nothing inside re-lays out. Icons sit at the same x in both states and text fades.
const EASE = 'duration-300 ease-[cubic-bezier(.32,.72,0,1)]';
const ROW = `relative flex h-9 items-center gap-2.5 overflow-hidden rounded-xl pl-[15px] pr-3 text-sm font-medium transition-[width,padding,color,background-color] ${EASE}`;
const rowWidth = (collapsed) => (collapsed ? 'w-12' : 'w-full');

/** Text that fades with the sidebar instead of popping in / out. */
function Fade({ show, className, children }) {
  return (
    <span dir="auto" className={clsx('whitespace-nowrap transition-opacity', EASE, show ? 'opacity-100' : 'pointer-events-none opacity-0', className)}>
      {children}
    </span>
  );
}

function Pill() {
  return (
    <motion.span
      layoutId="nav-pill"
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="absolute inset-0 rounded-xl bg-white/[.08] shadow-sm ring-1 ring-white/10"
    />
  );
}

/**
 * Nav link that accepts dropped items (tree drags via data-drop, native drags via events).
 * With `itemId` (a project row) it is draggable itself and drops land before / inside / after it.
 */
function DropLink({ to, end, drop, itemId, collapsed, onNavigate, onExpand, title, style, children }) {
  const dropTarget = useStore((s) => s.dropTarget);
  const [nativeOver, setNativeOver] = useState(false);
  const [nativeZone, setNativeZone] = useState(null);
  const treeZone = itemId && dropTarget?.startsWith(`${drop}|`) ? dropTarget.split('|')[1] : null;
  const zone = itemId ? nativeZone || treeZone : null;
  const over = drop && (itemId ? zone === 'inside' : dropTarget === drop || nativeOver);
  useHoverExpand(!!onExpand && zone === 'inside', () => onExpand?.());
  const dndProps = itemId
    ? { ...dragProps(itemId), ...zoneDropProps(itemId, setNativeZone), 'data-drop-zones': '' }
    : drop
      ? nativeDropProps((id) => dropOn(drop, id), setNativeOver)
      : {};
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? title : undefined}
      data-drop={drop}
      onClick={onNavigate}
      onContextMenu={itemId ? (e) => openContextMenu(e, { id: itemId }) : undefined}
      style={style}
      {...dndProps}
      className={({ isActive }) =>
        clsx(
          'group/link',
          ROW,
          rowWidth(collapsed),
          isActive ? 'text-white' : 'text-stone-400 hover:bg-white/[.04] hover:text-stone-100',
          over && 'scale-[1.03] bg-accent-500/20 text-white ring-2 ring-accent-400/70'
        )
      }
    >
      {(state) => (
        <>
          {(zone === 'before' || zone === 'after') && <DropLine zone={zone} />}
          {children(state)}
        </>
      )}
    </NavLink>
  );
}


export default function Sidebar({ onNavigate, mobile }) {
  const items = useStore((s) => s.items);
  const setPref = useStore((s) => s.setPref);
  const azkarOn = useStore((s) => s.azkarOn);
  const privacy = useStore((s) => s.privacy);
  const setPrivacy = useStore((s) => s.setPrivacy);
  const collapsed = useStore((s) => s.navCollapsed) && !mobile;
  const navWidth = useStore((s) => s.navWidth);
  const realUser = useStore((s) => s.user);
  const signOut = useStore((s) => s.signOut);
  const toast = useStore((s) => s.toast);
  const user = privacy && realUser ? { ...realUser, username: 'demo user' } : realUser;
  const label = (text) => <Fade show={!collapsed} className="relative min-w-0 flex-1 truncate text-left">{text}</Fade>;

  // Turning privacy mode on warns that its changes are throwaway; leaving it needs the account password.
  const togglePrivacy = async () => {
    if (!privacy) {
      const ok = await ask({
        title: 'Turn on privacy mode?',
        message: 'Every device shows dummy titles, notes and dates. You can still add and edit, but those changes stay on this device only and are erased as soon as privacy mode is turned off — your real tasks come back unchanged.',
        confirmText: 'Turn on',
      });
      if (ok) setPrivacy(true).catch((e) => toast(e.message, { tone: 'error' }));
      return;
    }
    const password = await ask({ title: 'Turn off privacy mode', message: 'Enter your password to show your real tasks again. Changes made in privacy mode will be erased.', input: true, inputType: 'password', placeholder: 'Password', confirmText: 'Unlock' });
    if (!password) return;
    try {
      await setPrivacy(false, password);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const signOutAsk = async () => (await ask({ title: 'Sign out?', confirmText: 'Sign out' })) && signOut();

  const todayCount = useMemo(
    () => items.filter((i) => !i.done && i.start && (isToday(new Date(i.start)) || new Date(i.start) < startOfDay(new Date()))).length,
    [items]
  );
  const laterCount = useMemo(() => items.filter((i) => i.someday && !i.parent).length, [items]);
  const overlapCount = overlapsOf(items).size;
  const counts = { '/today': todayCount, '/later': laterCount, '/overlap': overlapCount };

  return (
    <div style={mobile ? undefined : { width: liveWidth('navWidth', navWidth) }} className="flex h-full flex-col gap-5 px-3 py-4">
      <div className="flex h-10 items-center gap-2.5 pl-1.5 pt-1">
        <button
          onClick={() => collapsed && setPref('navCollapsed', false)}
          title={collapsed ? 'Expand' : undefined}
          className={clsx('group/logo relative grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-lg text-white shadow-lg shadow-accent-500/30 transition-transform duration-200 hover:-rotate-6 hover:scale-105', !collapsed && 'cursor-default')}
        >
          <span className={clsx('transition-opacity duration-150', collapsed && 'group-hover/logo:opacity-0')}>✦</span>
          <PanelLeftOpen size={17} className={clsx('absolute opacity-0 transition-opacity duration-150', collapsed && 'group-hover/logo:opacity-100')} />
        </button>
        <Fade show={!collapsed} className="flex-1">
          <div className="font-bold tracking-tight">Flowboard</div>
          <div className="text-[11px] text-stone-500">calm planning</div>
        </Fade>
        {!mobile && (
          <button
            onClick={() => setPref('navCollapsed', true)}
            title="Collapse"
            tabIndex={collapsed ? -1 : 0}
            className={clsx('rounded-lg p-1.5 text-stone-500 transition hover:bg-white/5 hover:text-stone-200', EASE, collapsed && 'pointer-events-none opacity-0')}
          >
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>

      <nav className="space-y-0.5">
        {NAV.map((n) => (
          <DropLink key={n.to} {...n} title={n.label} collapsed={collapsed} onNavigate={onNavigate}>
            {({ isActive }) => (
              <>
                {isActive && <Pill />}
                <n.icon size={17} className={clsx('relative shrink-0', isActive && 'text-accent-400')} />
                {label(n.label)}
                {counts[n.to] > 0 && (
                  <>
                    <Fade show={!collapsed} className="relative rounded-full bg-white/10 px-1.5 text-[11px] tabular-nums text-stone-400">{counts[n.to]}</Fade>
                    <span className={clsx('absolute left-[34px] top-1.5 h-1.5 w-1.5 rounded-full bg-accent-400 transition-opacity', EASE, collapsed ? 'opacity-100' : 'opacity-0')} />
                  </>
                )}
              </>
            )}
          </DropLink>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="space-y-1 border-t border-white/5 pt-3">
        <Toggle
          icon={EyeOff}
          label="Privacy mode"
          on={privacy}
          tone="amber"
          collapsed={collapsed}
          onToggle={togglePrivacy}
          title={privacy ? 'Privacy mode is on — dummy data; changes stay on this device and are erased when it’s turned off. Turning it off needs your password.' : 'Show dummy titles, notes and dates on every device, so you can show the app without showing your tasks'}
        />
        <Toggle icon={Moon} label="أذكار" on={azkarOn} tone="emerald" collapsed={collapsed} onToggle={() => setPref('azkarOn', !azkarOn)} title={azkarOn ? 'Azkar on' : 'Azkar off'} />
        {'Notification' in window && Notification.permission === 'default' && (
          <button onClick={() => Notification.requestPermission()} title={collapsed ? 'Enable notifications' : undefined} className={clsx(ROW, rowWidth(collapsed), 'text-stone-400 hover:bg-white/[.04] hover:text-stone-100')}>
            <Bell size={16} className="shrink-0" />
            {label('Enable notifications')}
          </button>
        )}
        <div className="flex items-center gap-2 pl-2 pt-1">
          <button
            title={collapsed ? `${user?.username} · Sign out` : user?.username}
            onClick={collapsed ? signOutAsk : undefined}
            className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400/30 to-sky-400/20 text-xs font-semibold uppercase text-accent-100 ring-1 ring-white/10', !collapsed && 'cursor-default')}
          >
            {user?.username.slice(0, 2)}
          </button>
          <Fade show={!collapsed} className="min-w-0 flex-1 truncate text-sm text-stone-300">{user?.username}</Fade>
          <button title="Sign out" tabIndex={collapsed ? -1 : 0} onClick={signOutAsk} className={clsx('rounded-lg p-1.5 text-stone-500 transition hover:bg-white/5 hover:text-rose-300', EASE, collapsed && 'pointer-events-none opacity-0')}>
            <LogOut size={15} />
          </button>
        </div>
        <a
          href="https://portfolio-akg418.vercel.app/"
          target="_blank"
          rel="noreferrer"
          title="Ahmed Khaled"
          className="block whitespace-nowrap pl-[20px] text-[11px] text-stone-500 transition hover:text-accent-300"
        >
          ©<Fade show={!collapsed}> {new Date().getFullYear()} <span className="font-medium underline decoration-white/20 underline-offset-2">Ahmed Khaled</span></Fade>
        </a>
      </div>
    </div>
  );
}

/** A switch row; collapsed, the whole icon is the toggle and tints when on. */
function Toggle({ icon: Icon, label, on, tone, collapsed, onToggle, title }) {
  const tones = { amber: ['text-amber-300', 'bg-amber-500/15'], emerald: ['text-emerald-400', 'bg-emerald-500/15'] }[tone];
  return (
    <div
      role="switch"
      aria-checked={on}
      tabIndex={0}
      title={title}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle())}
      className={clsx(ROW, rowWidth(collapsed), 'cursor-pointer text-stone-400 hover:bg-white/[.04]', collapsed && on && tones[1])}
    >
      <Icon size={16} className={clsx('shrink-0 transition-colors', on && tones[0])} />
      <Fade show={!collapsed} className="flex-1 text-left">{label}</Fade>
      <Fade show={!collapsed} className="pointer-events-none flex">
        <Switch size="sm" checked={on} onChange={() => {}} />
      </Fade>
    </div>
  );
}
