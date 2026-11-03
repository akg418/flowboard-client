import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Check, Copy, KeyRound, Loader2, Lock } from 'lucide-react';
import { api } from '../lib/api';

const STATS = [
  ['users', 'Users'],
  ['activeToday', 'Active today'],
  ['projects', 'To-do lists (projects)'],
  ['tasks', 'Tasks'],
  ['notes', 'Notes'],
];

const ago = (d) => {
  if (!d) return 'never';
  const m = Math.round((Date.now() - new Date(d)) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return new Date(d).toLocaleDateString();
};

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // e.g. not https: the password stays on screen to copy by hand
  }
}

/** Resets the user's password to a random one and copies it. */
function ResetButton({ password, user }) {
  const [state, setState] = useState({ busy: false, pw: '', copied: false, error: '' });

  const reset = async () => {
    setState({ busy: true, pw: '', copied: false, error: '' });
    try {
      const { password: pw } = await api.analysisResetPassword(password, user.id);
      setState({ busy: false, pw, copied: await copy(pw), error: '' });
    } catch (err) {
      setState({ busy: false, pw: '', copied: false, error: err.message });
    }
  };

  if (state.pw)
    return (
      <button
        onClick={async () => {
          const copied = await copy(state.pw);
          setState((s) => ({ ...s, copied }));
        }}
        title="Copy again"
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-500/15 px-2 py-1 font-mono text-xs text-accent-200 select-all"
      >
        {state.pw}
        {state.copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    );
  return (
    <button
      onClick={reset}
      disabled={state.busy}
      title={state.error || `Reset ${user.username}'s password`}
      className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-stone-300 transition hover:bg-white/10 disabled:opacity-50"
    >
      {state.busy ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
      {state.error ? <span className="text-red-400">Failed</span> : 'Reset'}
    </button>
  );
}

/** Usernames, newest first, loading the next page as the bottom scrolls into view. */
function UserList({ password }) {
  const [users, setUsers] = useState([]);
  const [next, setNext] = useState(undefined); // undefined = not loaded yet, null = no more
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const sentinel = useRef(null);

  const loadMore = useCallback(async () => {
    if (busy.current || next === null) return;
    busy.current = true;
    setLoading(true);
    try {
      const page = await api.analysisUsers(password, next);
      setUsers((u) => [...u, ...page.users]);
      setNext(page.next);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [password, next]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || error) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, error]);

  return (
    <div className="mt-5">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">Users</h2>
      <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10 bg-white/[.02]">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
            <div className="min-w-0">
              <div dir="auto" className="truncate text-stone-200">{u.username}</div>
              <div className="text-xs tabular-nums text-stone-500">
                {u.tasks} task{u.tasks === 1 ? '' : 's'} · last seen{' '}
                <span title={u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : 'Not tracked yet'}>{ago(u.lastSeenAt)}</span>
                {' '}· joined {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>
            <ResetButton password={password} user={u} />
          </li>
        ))}
        {next !== null && (
          <li ref={sentinel} className="flex justify-center py-3 text-stone-500">
            {loading && <Loader2 size={15} className="animate-spin" />}
          </li>
        )}
        {error && (
          <li className="px-3.5 py-2 text-xs text-red-400">
            {error} · <button onClick={() => setError('')} className="underline">retry</button>
          </li>
        )}
      </ul>
    </div>
  );
}

/** Hidden stats page at /analysis — no nav tab, unlocked with ANALYSIS_PASSWORD. */
export default function AnalysisView() {
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      setStats(await api.analysis(password, midnight.toISOString()));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 text-stone-200">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[.03] p-6 backdrop-blur-2xl">
        <h1 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
          <BarChart3 size={18} className="text-accent-400" /> Analysis
        </h1>
        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STATS.map(([k, label]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-white/[.04] p-4">
                  <div className="text-3xl font-semibold tabular-nums text-white">{stats[k]}</div>
                  <div className="mt-1 text-xs text-stone-400">{label}</div>
                </div>
              ))}
            </div>
            <UserList password={password} />
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-white/10 bg-white/[.04] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent-500/60"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              disabled={busy || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 py-2.5 text-sm font-medium text-white transition hover:bg-accent-400 disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin" />} Open
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
