export default function PageHeader({ title, subtitle, children }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 dir="auto" className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-400">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function Empty({ icon = '🌿', title, text }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-3 text-4xl animate-[bounce_3s_ease-in-out_infinite]">{icon}</div>
      <div className="font-semibold text-stone-600 dark:text-stone-300">{title}</div>
      {text && <p className="mt-1 max-w-xs text-sm text-stone-400">{text}</p>}
    </div>
  );
}
