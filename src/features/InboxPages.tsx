/**
 * The conflict inbox and settings.
 *
 * The inbox is the feature the whole app exists for: a list of things wrong with the plan
 * that you can work through and clear, rather than a suspicion that something is off.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  CalendarDays,
  Check,
  Download,
  EyeOff,
  ListChecks,
  RotateCcw,
  Ticket,
  Upload,
} from 'lucide-react';
import {
  Button,
  Card,
  Chip,
  Disclosure,
  EmptyState,
  PageHeader,
  Section,
  SeverityChip,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { europe2026 } from '@/seed/europe-2026';
import { findingsRepo, listTrips, remindersRepo, settingsRepo } from '@/db/repo';
import {
  ImportError,
  exportFileName,
  exportTrip,
  importTrip,
  parseExportFile,
  type ImportMode,
} from '@/db/transfer';
import { formatDayLabel } from '@/domain/time';
import { useAudit, useSettings, useToday, useTripBundle } from '@/hooks/useTrip';
import type { ResolvedFinding } from '@/lint/engine';
import type { ExportFile, TripBundle } from '@/domain/types';

/** One day's worth of findings, or the trip-level ones that belong to no single day. */
interface DayGroup {
  key: string;
  title: string;
  sortDate: string;
  items: ResolvedFinding[];
  hasError: boolean;
}

const SEVERITY_RANK: Record<ResolvedFinding['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/** Findings grouped by the day they land on, errors first within each day, days in date
 * order with the day-less ones (a passport, a trip-wide gap) leading. */
function groupByDay(findings: ResolvedFinding[], bundle: TripBundle): DayGroup[] {
  const byDay = new Map<string, ResolvedFinding[]>();
  for (const finding of findings) {
    const key = finding.dayId ?? 'general';
    const items = byDay.get(key) ?? [];
    items.push(finding);
    byDay.set(key, items);
  }

  const groups: DayGroup[] = [];
  for (const [key, items] of byDay) {
    items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    const day = key === 'general' ? undefined : bundle.days.find((d) => d.id === key);
    groups.push({
      key,
      title: day ? `${formatDayLabel(day.date)} · ${day.city}` : 'General',
      sortDate: day?.date ?? '',
      items,
      hasError: items.some((f) => f.severity === 'error'),
    });
  }

  groups.sort((a, b) => {
    if (a.key === 'general') return -1;
    if (b.key === 'general') return 1;
    return a.sortDate.localeCompare(b.sortDate);
  });
  return groups;
}

export function ConflictInboxPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const audit = useAudit(bundle, today);
  const [showResolved, setShowResolved] = useState(false);
  const [showMinorNotes, setShowMinorNotes] = useState(false);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;

  const shown = showResolved ? audit.findings.filter((f) => f.status !== 'open') : audit.open;
  // Places where the notes and the tickets disagree, flagged for the traveller to decide.
  // They lead the page in full, whatever their severity, instead of hiding in a folded day.
  const toReview = shown.filter((f) => f.key.includes('mc-review-'));
  const base = shown.filter((f) => !f.key.includes('mc-review-'));
  const infoCount = base.filter((f) => f.severity === 'info').length;
  const visible = showMinorNotes ? base : base.filter((f) => f.severity !== 'info');

  const resolve = (finding: ResolvedFinding, status: 'resolved' | 'dismissed') =>
    void findingsRepo.setState(bundle.trip.id, finding.key, finding.ruleId, status);
  const reopen = (finding: ResolvedFinding) =>
    void findingsRepo.reopen(bundle.trip.id, finding.key);

  const groups = groupByDay(visible, bundle);

  return (
    <>
      <PageHeader
        title="Plan check"
        subtitle="Things in the plan worth a second look. None of them stop the trip."
        actions={
          <div
            className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600"
            role="group"
            aria-label="Which findings to show"
          >
            {(
              [
                { key: false, label: 'Open', count: audit.counts.actionable },
                { key: true, label: 'Cleared', count: audit.counts.resolved },
              ] as const
            ).map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-pressed={showResolved === tab.key}
                onClick={() => setShowResolved(tab.key)}
                className={cn(
                  'min-h-[40px] px-3 text-sm font-medium',
                  showResolved === tab.key
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 dark:text-slate-300',
                )}
              >
                {tab.label}
                <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>
        }
      />

      {infoCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowMinorNotes((v) => !v)}
          className="text-brand-700 dark:text-brand-300 mb-4 text-sm font-medium"
        >
          {showMinorNotes ? 'Hide minor notes' : `Show minor notes (${infoCount})`}
        </button>
      ) : null}

      {toReview.length > 0 ? (
        <Section title={`To review (${toReview.length})`}>
          <p className="-mt-1 mb-3 text-sm text-slate-500 dark:text-slate-400">
            Where your notes and your tickets disagree. The day plans show the ticket times.
          </p>
          <div className="space-y-3">
            {toReview.map((finding) => (
              <FindingRow
                key={finding.key}
                finding={finding}
                tripId={bundle.trip.id}
                onResolve={resolve}
                onReopen={reopen}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {visible.length === 0 && toReview.length === 0 ? (
        <EmptyState title={showResolved ? 'Nothing cleared yet.' : 'Nothing outstanding.'}>
          {showResolved ? undefined : 'The plan checks out as it stands.'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Disclosure
              key={group.key}
              title={group.title}
              count={group.items.length}
              defaultOpen={group.hasError}
            >
              <div className="space-y-3">
                {group.items.map((finding) => (
                  <FindingRow
                    key={finding.key}
                    finding={finding}
                    tripId={bundle.trip.id}
                    onResolve={resolve}
                    onReopen={reopen}
                  />
                ))}
              </div>
            </Disclosure>
          ))}
        </div>
      )}
    </>
  );
}

/** One finding: title and a clamped line of detail until it is opened, the full detail,
 * suggested fix and actions once it is. Compact by default because a day with several
 * findings should not cost a whole screen of scrolling to read past. */
function FindingRow({
  finding,
  tripId,
  onResolve,
  onReopen,
}: {
  finding: ResolvedFinding;
  tripId: string;
  onResolve: (finding: ResolvedFinding, status: 'resolved' | 'dismissed') => void;
  onReopen: (finding: ResolvedFinding) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <SeverityChip severity={finding.severity} compact />
        {finding.status !== 'open' ? <Chip tone="good">{finding.status}</Chip> : null}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="block w-full text-left"
      >
        <p className="font-semibold">{finding.title}</p>
        <p
          className={cn('mt-1 text-sm text-slate-600 dark:text-slate-300', !expanded && 'truncate')}
        >
          {finding.detail}
        </p>
      </button>

      {expanded ? (
        <>
          {finding.suggestedFix ? (
            <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700 dark:bg-slate-700/50 dark:text-slate-200">
              {finding.suggestedFix}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {finding.dayId ? (
              <JumpLink to={`/t/${tripId}/days/${finding.dayId}`} icon={CalendarDays} label="Day" />
            ) : null}
            {finding.itemIds[0] ? (
              <JumpLink
                to={`/t/${tripId}/items/${finding.itemIds[0]}`}
                icon={ListChecks}
                label="Item"
              />
            ) : null}
            {finding.bookingIds?.[0] ? (
              <JumpLink
                to={`/t/${tripId}/bookings/${finding.bookingIds[0]}`}
                icon={Ticket}
                label="Booking"
              />
            ) : null}

            {finding.status === 'open' ? (
              <>
                <Button variant="primary" onClick={() => onResolve(finding, 'resolved')}>
                  <Check size={15} aria-hidden /> Sorted
                </Button>
                <Button onClick={() => onResolve(finding, 'dismissed')}>
                  <EyeOff size={15} aria-hidden /> Ignore
                </Button>
              </>
            ) : (
              <Button onClick={() => onReopen(finding)}>
                <RotateCcw size={15} aria-hidden /> Reopen
              </Button>
            )}
          </div>
        </>
      ) : null}
    </Card>
  );
}

/** One of the three places a finding can send you. The icon carries the "open"; the label
 * only has to name the destination. */
function JumpLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium dark:border-slate-600"
    >
      <Icon size={15} aria-hidden />
      {label}
    </Link>
  );
}

export function RemindersPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;

  const sorted = [...bundle.reminders].sort((a, b) => a.fireDate.localeCompare(b.fireDate));
  const upcoming = sorted.filter((r) => r.status === 'pending' && r.fireDate >= today);
  const past = sorted.filter((r) => r.status !== 'pending' || r.fireDate < today);

  return (
    <>
      <PageHeader title="Reminders" />
      <Section title={`Coming up (${upcoming.length})`}>
        <div className="space-y-2">
          {upcoming.map((reminder) => (
            <Card key={reminder.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{reminder.title}</p>
                  <p className="text-sm text-slate-500">
                    On {formatDayLabel(reminder.fireDate)}
                    {reminder.forDate ? ` for ${formatDayLabel(reminder.forDate)}` : ''}
                  </p>
                  {reminder.notes ? (
                    <p className="mt-1 text-sm text-slate-500">{reminder.notes}</p>
                  ) : null}
                </div>
                <Button onClick={() => void remindersRepo.setStatus(reminder.id, 'done')}>
                  Done
                </Button>
              </div>
            </Card>
          ))}
          {upcoming.length === 0 ? <EmptyState title="Nothing scheduled." /> : null}
        </div>
      </Section>
      {past.length > 0 ? (
        <Section title={`Earlier (${past.length})`}>
          <div className="space-y-2">
            {past.map((reminder) => (
              <Card key={reminder.id} className="opacity-60">
                <p className="text-sm">{reminder.title}</p>
                <p className="text-xs text-slate-400">{formatDayLabel(reminder.fireDate)}</p>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [pendingImport, setPendingImport] = useState<{
    file: ExportFile;
    existingTripName: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const download = async (includeDocuments: boolean) => {
    setProblems([]);
    const trips = await listTrips();
    const trip = trips[0];
    if (!trip) {
      setMessage('There is no trip to export yet.');
      return;
    }
    const file = await exportTrip(trip.id, { includeDocuments });
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFileName(file.bundle);
    anchor.click();
    URL.revokeObjectURL(url);
    await settingsRepo.patch({ lastExportAt: new Date().toISOString() });
    setMessage(`Saved ${anchor.download}.`);
  };

  const runImport = async (file: ExportFile, mode: ImportMode) => {
    setPendingImport(null);
    try {
      const result = await importTrip(file, { mode });
      navigate(`/t/${result.tripId}`);
      window.alert(
        `Imported ${result.counts.bookings} bookings and ${result.counts.documents} documents.`,
      );
    } catch (error) {
      if (error instanceof ImportError) {
        setMessage(error.message);
        setProblems(error.problems);
      } else {
        setMessage('That file could not be imported.');
      }
    }
  };

  const upload = async (file: File) => {
    setProblems([]);
    setMessage(null);
    setPendingImport(null);
    let parsed: ExportFile;
    try {
      const json: unknown = JSON.parse(await file.text());
      parsed = parseExportFile(json);
    } catch (error) {
      if (error instanceof ImportError) {
        setMessage(error.message);
        setProblems(error.problems);
      } else {
        setMessage('That file could not be read as JSON.');
      }
      return;
    }

    const trips = await listTrips();
    const existing = trips.find((t) => t.id === parsed.bundle.trip.id);
    if (existing) {
      setPendingImport({ file: parsed, existingTripName: existing.name });
      return;
    }
    await runImport(parsed, 'replace');
  };

  const resetToSample = async () => {
    setProblems([]);
    await importTrip(europe2026, { mode: 'replace' });
    setMessage('The sample trip has been restored.');
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Everything lives on this device." />

      <Section title="Load your trip file">
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Set this phone up with your itinerary, bookings and documents from a trip file.
          </p>
          <div className="mt-3">
            <Button variant="primary" onClick={() => fileInput.current?.click()}>
              <Upload size={15} aria-hidden /> Load your trip file
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            aria-label="Load your trip file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
        </Card>
      </Section>

      {pendingImport ? (
        <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20">
          <p className="text-sm font-medium">
            This replaces {pendingImport.existingTripName} on this phone, including any changes made
            here. Your tickets and documents come with it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void runImport(pendingImport.file, 'replace')}>
              Replace
            </Button>
            <Button onClick={() => void runImport(pendingImport.file, 'copy')}>Keep both</Button>
            <Button variant="ghost" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {message ? (
        <Card className={cn('mb-6', problems.length > 0 && 'border-rose-300 bg-rose-50')}>
          <p className="text-sm font-medium">{message}</p>
          {problems.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
              {problems.slice(0, 8).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Section title="Your data">
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Shipshape keeps the whole trip in this browser. Nothing is uploaded, and there is no
            account. That also means this device holds the only copy, so export regularly and keep
            the file somewhere safe.
          </p>
          {settings.lastExportAt ? (
            <p className="mt-2 text-xs text-slate-400">
              Last exported {new Date(settings.lastExportAt).toLocaleDateString()}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              You have never exported this trip.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void download(true)}>
              <Download size={15} aria-hidden /> Export everything
            </Button>
            <Button onClick={() => void download(false)}>
              <Download size={15} aria-hidden /> Export the itinerary only
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Exporting the itinerary only leaves out ticket files, which makes it small enough to
            send in a message to whoever you are travelling with.
          </p>
        </Card>
      </Section>

      <Section title="Live data">
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The app works entirely offline. Map and booking links open in your browser, and no keys
            are needed for that. Live transit times and an in-app assistant are not enabled in this
            version.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            If you add keys in a later version they stay on this device and are never included in an
            export.
          </p>
        </Card>
      </Section>

      <Section title="Pretend it is a different day">
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Useful before you travel: set a date and the Today view, countdown and reminders all
            behave as if the trip had started.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={settings.simulatedToday ?? ''}
              onChange={(event) =>
                void settingsRepo.patch({ simulatedToday: event.target.value || null })
              }
              className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            {settings.simulatedToday ? (
              <Button onClick={() => void settingsRepo.patch({ simulatedToday: null })}>
                Back to the real date
              </Button>
            ) : null}
          </div>
        </Card>
      </Section>

      <Section title="Start again">
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Replaces the sample trip with a fresh copy. Anything you changed on it is lost, and this
            cannot be undone.
          </p>
          <div className="mt-3">
            <Button variant="danger" onClick={() => void resetToSample()}>
              Reset the sample trip
            </Button>
          </div>
        </Card>
      </Section>
    </>
  );
}
