import { useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import clsx from 'clsx';
import { Check, Eye, EyeOff, Loader2, Lock, User, X } from 'lucide-react';
import { useStore } from '../lib/store';

// Same rules as the server.
const RULES = {
  username: [
    { test: (v) => v.trim().length >= 3, label: 'At least 3 characters' },
    { test: (v) => v.trim() !== '' && !/^\d/.test(v.trim()), label: "Doesn't start with a number" },
  ],
  password: [{ test: (v) => v.length >= 6, label: 'At least 6 characters' }],
};
const passes = (field, v) => RULES[field].every((r) => r.test(v));

function Field({ icon: Icon, children }) {
  return (
    <div className="group relative">
      <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 transition group-focus-within:text-accent-400" />
      {children}
    </div>
  );
}

function Hints({ field, value, show }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1 overflow-hidden px-1 pt-1.5">
          {RULES[field].map((r) => {
            const ok = r.test(value);
            return (
              <li key={r.label} className={clsx('flex items-center gap-1.5 text-xs transition-colors', ok ? 'text-emerald-400' : 'text-stone-500')}>
                {ok ? <Check size={12} /> : <X size={12} />} {r.label}
              </li>
            );
          })}
        </motion.ul>
      )}
    </AnimatePresence>
  );
}

export default function AuthView() {
  const signIn = useStore((s) => s.signIn);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shake = useAnimationControls();
  const register = mode === 'register';
  const valid = register ? passes('username', username) && passes('password', password) : username.trim() && password;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) {
      shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.35 } });
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(mode, username.trim(), password);
    } catch (err) {
      setError(err.message);
      shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.35 } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ambient relative isolate grid min-h-full place-items-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ rotate: -20, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
            className="mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-accent-400 to-accent-600 text-2xl text-white shadow-xl shadow-accent-500/30"
          >
            ✦
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight">Flowboard</h1>
          <p className="mt-1 text-sm text-stone-500">Your projects, tasks and time — calmly.</p>
        </div>

        <motion.form
          animate={shake}
          onSubmit={submit}
          className="space-y-4 rounded-3xl border border-white/[.07] bg-white/[.03] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl"
        >
          <div className="flex rounded-xl bg-white/5 p-1">
            {[['login', 'Sign in'], ['register', 'Create account']].map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => (setMode(m), setError(''))}
                className={clsx('relative flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors', mode === m ? 'text-white' : 'text-stone-500 hover:text-stone-300')}
              >
                {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-lg bg-white/10" />}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>

          <div>
            <Field icon={User}>
              <input
                autoFocus
                dir="auto"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="input py-2.5 pl-10"
              />
            </Field>
            <Hints field="username" value={username} show={register && username.length > 0} />
          </div>

          <div>
            <Field icon={Lock}>
              <input
                type={show ? 'text' : 'password'}
                autoComplete={register ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="input py-2.5 pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-500 hover:text-stone-300"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </Field>
            <Hints field="password" value={password} show={register && password.length > 0} />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.97 }}
            className={clsx('btn-primary w-full justify-center py-2.5 text-[15px]', !valid && 'opacity-50')}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {register ? 'Create account' : 'Sign in'}
          </motion.button>
        </motion.form>

        <a
          href="https://portfolio-akg418.vercel.app/"
          target="_blank"
          rel="noreferrer"
          className="mt-6 block text-center text-xs text-stone-600 transition hover:text-accent-300"
        >
          © {new Date().getFullYear()} Ahmed Khaled
        </a>
      </motion.div>
    </div>
  );
}
