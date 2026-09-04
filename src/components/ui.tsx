/**
 * The small set of visual pieces every screen reuses.
 *
 * Deliberately plain. A trip app is read one-handed on a station platform in bright sun,
 * so the priorities are contrast, tap-target size, and text that stays legible when the
 * phone is at arm's length.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import type { Severity, Tag } from '@/domain/types';

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const base =
    'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800';
  if (!onClick) return <div className={cn(base, className)}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={cn(base, 'w-full text-left', className)}>
      {children}
    </button>
  );
}

export function LinkCard({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'hover:border-brand-400 block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800',
        className,
      )}
    >
      {children}
    </Link>
  );
}

const TAG_STYLES: Record<Tag, string> = {
  MUST: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
  OPTIONAL: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  CHECK: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
  CONFLICT: 'bg-purple-100 text-purple-900 dark:bg-purple-900/50 dark:text-purple-200',
};

export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        TAG_STYLES[tag],
      )}
    >
      {tag}
    </span>
  );
}

const SEVERITY_STYLES: Record<Severity, string> = {
  error: 'bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  info: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

const SEVERITY_WORDS: Record<Severity, string> = {
  error: 'Cannot happen',
  warning: 'Worth checking',
  info: 'For information',
};

export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
        SEVERITY_STYLES[severity],
      )}
    >
      {SEVERITY_WORDS[severity]}
    </span>
  );
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'brand';
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
    bad: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
    brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-100',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  type = 'button',
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary:
      'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition disabled:opacity-40',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {children ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{children}</p>
      ) : null}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** External links always open away from the app and never leak the referrer. */
export function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-brand-700 hover:bg-brand-50 dark:text-brand-200 inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 px-3 text-sm font-medium dark:border-slate-600 dark:hover:bg-slate-700"
    >
      {children}
    </a>
  );
}
