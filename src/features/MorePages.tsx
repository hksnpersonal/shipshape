/**
 * The More tab: emergency numbers, the plan check, every document, the guide and settings.
 */
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  FolderOpen,
  Globe,
  Phone,
  Settings as SettingsIcon,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import { Button, OutLink, PageHeader, Section } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CATEGORY_META } from '@/domain/categories';
import { useAudit, useToday, useTripBundle, useTripDocuments } from '@/hooks/useTrip';
import type { Essential } from '@/domain/types';

/**
 * One row in a More list: a 36px coloured icon tile, a title, a one-line sub, and whatever
 * belongs on the right - a chevron for a link, or an essential's own action. `Row` in
 * ui.tsx tints its icon a flat grey, which is right for a booking list but not for a page
 * that leans on colour to tell "call this" from "read this" at a glance.
 */
function MoreRow({
  icon: Icon,
  tone,
  title,
  meta,
  trailing,
  to,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  meta: string;
  trailing?: ReactNode;
  to?: string;
}) {
  const body = (
    <div className="flex items-center gap-3">
      <span
        className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone)}
      >
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{meta}</p>
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : to ? (
        <ChevronRight size={16} className="shrink-0 text-slate-300" aria-hidden />
      ) : null}
    </div>
  );

  const base =
    'block rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800';

  if (to) {
    return (
      <Link to={to} className={cn(base, 'hover:border-brand-400 transition hover:shadow')}>
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}

const ESSENTIAL_TONE: Record<Essential['kind'], string> = {
  phone: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  text: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  url: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};

const ESSENTIAL_ICON: Record<Essential['kind'], LucideIcon> = {
  phone: Phone,
  text: Copy,
  url: Globe,
};

/** The one thing to do with an essential: call it, open it, or copy it to send on. */
function EssentialTrailing({ essential }: { essential: Essential }) {
  const [copied, setCopied] = useState(false);

  if (essential.kind === 'phone') {
    return (
      <a
        href={`tel:${essential.value.replace(/\s+/g, '')}`}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-emerald-100 px-3 text-sm font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
      >
        <Phone size={14} aria-hidden />
        {essential.value === '112' ? '112' : 'Call'}
      </a>
    );
  }

  if (essential.kind === 'url') {
    return <OutLink href={essential.value}>Open</OutLink>;
  }

  const copy = async () => {
    await navigator.clipboard.writeText(essential.value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button onClick={() => void copy()}>
      {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

/** Always true, anywhere in Europe - on the page even before a trip file names an insurer
 * or an embassy, and still there if `essentials` is emptied out. */
const EMERGENCY_ESSENTIAL: Essential = {
  id: 'emergency-112',
  label: 'Emergency, anywhere in Europe',
  value: '112',
  kind: 'phone',
  note: '112 · police, ambulance, fire',
};

export function MorePage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const audit = useAudit(bundle, today);
  const documents = useTripDocuments(tripId);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;

  const { trip } = bundle;
  const essentials = trip.essentials?.length ? trip.essentials : [EMERGENCY_ESSENTIAL];
  const toDecide = audit.open.filter((f) => f.key.includes('mc-review-')).length;
  const pending = bundle.reminders.filter((r) => r.status === 'pending').length;

  return (
    <>
      <PageHeader title="More" />

      <Section title="In an emergency">
        <div className="space-y-2">
          {essentials.map((essential) => (
            <MoreRow
              key={essential.id}
              icon={ESSENTIAL_ICON[essential.kind]}
              tone={ESSENTIAL_TONE[essential.kind]}
              title={essential.label}
              meta={essential.note ?? essential.value}
              trailing={<EssentialTrailing essential={essential} />}
            />
          ))}
        </div>
      </Section>

      <Section title="Your trip">
        <div className="space-y-2">
          <MoreRow
            icon={AlertTriangle}
            tone="bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-100"
            title="Plan check"
            meta={`${toDecide} thing${toDecide === 1 ? '' : 's'} to decide`}
            to={`/t/${trip.id}/conflicts`}
          />
          <MoreRow
            icon={FolderOpen}
            tone={CATEGORY_META.transport.tone}
            title="All documents"
            meta={`${documents.length} file${documents.length === 1 ? '' : 's'} · work offline`}
            to={`/t/${trip.id}/documents`}
          />
          <MoreRow
            icon={BookOpen}
            tone={CATEGORY_META.activity.tone}
            title="New to Europe?"
            meta="Money, trains, plugs, safety, city notes"
            to={`/t/${trip.id}/guide`}
          />
          <MoreRow
            icon={Bell}
            tone="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
            title="Reminders"
            meta={pending === 0 ? 'Nothing pending' : `${pending} pending`}
            to={`/t/${trip.id}/reminders`}
          />
        </div>
      </Section>

      <Section title="App">
        <div className="space-y-2">
          <MoreRow
            icon={SettingsIcon}
            tone="bg-slate-200 text-slate-900 dark:bg-slate-600 dark:text-slate-100"
            title="Settings"
            meta="Home time, backups, pretend it is another day"
            to={`/t/${trip.id}/settings`}
          />
          <MoreRow
            icon={Ticket}
            tone={CATEGORY_META.pass.tone}
            title="Playbook"
            meta="How to book everything, and what to watch for"
            to={`/t/${trip.id}/playbook`}
          />
        </div>
      </Section>
    </>
  );
}
