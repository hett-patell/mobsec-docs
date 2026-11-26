import type { ReactNode } from 'react';

const variants = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  bad: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
} as const;

export function StatusBadge({
  variant = 'ok',
  children,
}: {
  variant?: keyof typeof variants;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
