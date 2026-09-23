/**
 * The small set of visual pieces every screen reuses.
 *
 * Deliberately plain. A trip app is read one-handed on a station platform in bright sun,
 * so the priorities are contrast, tap-target size, and text that stays legible when the
 * phone is at arm's length.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ChevronDown, ChevronRight, Info, Search, X, XOctagon } from 'lucide-react';
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
  error: 'Blocked',
  warning: 'Check',
  info: 'Note',
};

const SEVERITY_ICONS: Record<Severity, typeof Info> = {
  error: XOctagon,
  warning: AlertTriangle,
  info: Info,
};

/**
 * The shape carries the meaning at a glance and the word confirms it, so severity survives
 * both a sideways glance and a colour-blind reader. `compact` drops to the icon alone for
 * dense rows, where the label goes to assistive technology instead.
 */
export function SeverityChip({ severity, compact }: { severity: Severity; compact?: boolean }) {
  const Icon = SEVERITY_ICONS[severity];
  const word = SEVERITY_WORDS[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        compact ? 'p-1' : 'px-2 py-0.5 text-[11px]',
        SEVERITY_STYLES[severity],
      )}
      title={compact ? word : undefined}
    >
      <Icon size={compact ? 14 : 12} aria-hidden />
      {compact ? <span className="sr-only">{word}</span> : word}
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

/**
 * A list row: leading icon, title, one line of meta, and something on the right. Six
 * screens were each rebuilding this out of flex utilities, which is why they had all
 * drifted apart by a few pixels. `to` makes it a link, `onClick` a button, neither a
 * plain row.
 */
export function Row({
  icon: Icon,
  title,
  meta,
  trailing,
  to,
  onClick,
  tone,
}: {
  icon?: typeof Info;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  onClick?: () => void;
  tone?: 'default' | 'urgent';
}) {
  const body = (
    <div className="flex items-center gap-3">
      {Icon ? (
        <Icon
          size={18}
          className={cn(
            'shrink-0',
            tone === 'urgent' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400',
          )}
          aria-hidden
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        {meta ? <p className="truncate text-sm text-slate-500">{meta}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
      {to || onClick ? (
        <ChevronRight size={16} className="shrink-0 text-slate-300" aria-hidden />
      ) : null}
    </div>
  );

  const base = cn(
    'block rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-800',
    tone === 'urgent'
      ? 'border-rose-200 dark:border-rose-800'
      : 'border-slate-200 dark:border-slate-700',
    to || onClick ? 'hover:border-brand-400 transition hover:shadow' : '',
  );

  if (to) {
    return (
      <Link to={to} className={base}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(base, 'w-full text-left')}>
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}

/**
 * Detail that earns its place only once someone asks for it. Native `details` rather than
 * a scripted accordion: it opens with no JavaScript, survives find-in-page, and is already
 * keyboard accessible, which matters on a phone at a ticket barrier.
 */
export function Disclosure({
  title,
  count,
  icon: Icon,
  defaultOpen,
  tone,
  children,
}: {
  title: string;
  count?: number;
  icon?: typeof Info;
  defaultOpen?: boolean;
  tone?: 'default' | 'warn';
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group rounded-xl border bg-white dark:bg-slate-800',
        tone === 'warn'
          ? 'border-amber-300 dark:border-amber-700'
          : 'border-slate-200 dark:border-slate-700',
      )}
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {Icon ? (
          <Icon
            size={16}
            className={cn(
              'shrink-0',
              tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400',
            )}
            aria-hidden
          />
        ) : null}
        <span className="flex-1">{title}</span>
        {count !== undefined ? (
          <span className="text-xs font-semibold text-slate-400">{count}</span>
        ) : null}
        <ChevronDown
          size={16}
          className="shrink-0 text-slate-400 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-slate-100 px-3 py-3 text-sm dark:border-slate-700">
        {children}
      </div>
    </details>
  );
}

/**
 * One fact from a two- or three-fact answer strip: the thing someone opened the screen
 * for, before any of the supporting detail.
 */
export function Fact({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const tones = {
    neutral: 'text-slate-900 dark:text-slate-100',
    good: 'text-emerald-700 dark:text-emerald-300',
    warn: 'text-amber-700 dark:text-amber-300',
    bad: 'text-rose-700 dark:text-rose-300',
  };
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <p className={cn('text-sm font-semibold', tones[tone])}>{value}</p>
    </div>
  );
}

/** The answer strip itself: facts side by side, above the fold, before any prose. */
export function FactStrip({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-100 p-3 sm:grid-cols-3 dark:bg-slate-800/60">
      {children}
    </div>
  );
}

/**
 * A filter row. Selecting nothing means everything, so there is no "All" pill to get out
 * of step with the chips beside it - the reset only appears once it would do something.
 */
export function FilterChips<T extends string>({
  options,
  active,
  onToggle,
  onClear,
  label,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  active: ReadonlySet<T>;
  onToggle: (value: T) => void;
  onClear: () => void;
  label: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((option) => {
        const isActive = active.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(option.value)}
            className={cn(
              'min-h-[32px] rounded-full border px-3 text-xs font-semibold transition',
              isActive
                ? 'border-brand-500 bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-100'
                : 'border-slate-300 text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:text-slate-400',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className="ml-1.5 opacity-60">{option.count}</span>
            ) : null}
          </button>
        );
      })}
      {active.size > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <X size={13} aria-hidden />
          Clear
        </button>
      ) : null}
    </div>
  );
}

/** Search that replaces a paragraph explaining how the list is organised. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative mb-3">
      <Search
        size={16}
        className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white pr-3 pl-9 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </div>
  );
}

/** A number worth tapping. Every count on the home screen leads somewhere. */
export function StatTile({
  value,
  label,
  to,
  tone = 'neutral',
}: {
  value: number;
  label: string;
  to?: string;
  tone?: 'neutral' | 'warn' | 'bad';
}) {
  const tones = {
    neutral: 'text-slate-900 dark:text-slate-100',
    warn: 'text-amber-600 dark:text-amber-400',
    bad: 'text-rose-600 dark:text-rose-400',
  };
  const body = (
    <>
      <p className={cn('text-2xl font-bold tabular-nums', tones[value === 0 ? 'neutral' : tone])}>
        {value}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </>
  );
  const base =
    'rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800';
  if (!to) return <div className={base}>{body}</div>;
  return (
    <Link to={to} className={cn(base, 'hover:border-brand-400 block transition hover:shadow')}>
      {body}
    </Link>
  );
}
