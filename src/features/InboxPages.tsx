/**
 * The conflict inbox and settings.
 *
 * The inbox is the feature the whole app exists for: a list of things wrong with the plan
 * that you can work through and clear, rather than a suspicion that something is off.
 */
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Check, Download, EyeOff, RotateCcw, Upload } from 'lucide-react';
import { Button, Card, Chip, EmptyState, PageHeader, Section, SeverityChip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { europe2026 } from '@/seed/europe-2026';
import { findingsRepo, listTrips, remindersRepo, settingsRepo } from '@/db/repo';
import { ImportError, exportFileName, exportTrip, importTrip } from '@/db/transfer';
import { formatDayLabel } from '@/domain/time';
import { useAudit, useSettings, useToday, useTripBundle } from '@/hooks/useTrip';
import type { ResolvedFinding } from '@/lint/engine';

export function ConflictInboxPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const audit = useAudit(bundle, today);
  const [showResolved, setShowResolved] = useState(false);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;

  const visible = showResolved
    ? audit.findings.filter((f) => f.status !== 'open')
    : audit.actionable;
  const order: Array<ResolvedFinding['severity']> = ['error', 'warning', 'info'];
  const HEADINGS: Record<ResolvedFinding['severity'], string> = {
    error: 'Cannot happen as planned',
    warning: 'Worth checking before you go',
    info: 'Things the app noticed',
  };
  const grouped = order
    .map((severity) => ({ severity, items: visible.filter((f) => f.severity === severity) }))
    .filter((g) => g.items.length > 0);

  const resolve = (finding: ResolvedFinding, status: 'resolved' | 'dismissed') =>
    void findingsRepo.setState(bundle.trip.id, finding.key, finding.ruleId, status);
  const reopen = (finding: ResolvedFinding) =>
    void findingsRepo.reopen(bundle.trip.id, finding.key);

  return (
    <>
      <PageHeader
        title="What needs deciding"
        subtitle={
          showResolved
            ? `${audit.counts.resolved} already dealt with`
            : `${audit.counts.error} cannot happen as planned, ${audit.counts.warning} worth checking`
        }
        actions={
          <Button onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? 'Show open' : 'Show cleared'}
          </Button>
        }
      />

      {visible.length === 0 ? (
        <EmptyState title={showResolved ? 'Nothing cleared yet.' : 'Nothing outstanding.'}>
          {showResolved
            ? 'Findings you resolve or dismiss will collect here.'
            : 'The audit found nothing wrong with the plan as it stands.'}
        </EmptyState>
      ) : (
        grouped.map((group) => (
          <Section
            key={group.severity}
            title={`${HEADINGS[group.severity]} (${group.items.length})`}
          >
            <div className="space-y-3">
              {group.items.map((finding) => (
                <Card key={finding.key}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <SeverityChip severity={finding.severity} />
                    {finding.date ? <Chip>{formatDayLabel(finding.date)}</Chip> : null}
                    <Chip>{finding.ruleId}</Chip>
                    {finding.status !== 'open' ? <Chip tone="good">{finding.status}</Chip> : null}
                  </div>
                  <p className="font-semibold">{finding.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {finding.detail}
                  </p>
                  {finding.suggestedFix ? (
                    <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700 dark:bg-slate-700/50 dark:text-slate-200">
                      {finding.suggestedFix}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {finding.dayId ? (
                      <Link
                        to={`/t/${bundle.trip.id}/days/${finding.dayId}`}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 px-3 text-sm font-medium dark:border-slate-600"
                      >
                        Open the day
                      </Link>
                    ) : null}
                    {finding.itemIds[0] ? (
                      <Link
                        to={`/t/${bundle.trip.id}/items/${finding.itemIds[0]}`}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 px-3 text-sm font-medium dark:border-slate-600"
                      >
                        Open the item
                      </Link>
                    ) : null}
                    {finding.bookingIds?.[0] ? (
                      <Link
                        to={`/t/${bundle.trip.id}/bookings/${finding.bookingIds[0]}`}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 px-3 text-sm font-medium dark:border-slate-600"
                      >
                        Open the booking
                      </Link>
                    ) : null}

                    {finding.status === 'open' ? (
                      <>
                        <Button variant="primary" onClick={() => resolve(finding, 'resolved')}>
                          <Check size={15} aria-hidden /> Sorted
                        </Button>
                        <Button onClick={() => resolve(finding, 'dismissed')}>
                          <EyeOff size={15} aria-hidden /> Not a problem
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => reopen(finding)}>
                        <RotateCcw size={15} aria-hidden /> Reopen
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        ))
      )}

      {!showResolved && audit.notes.length > 0 ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <summary className="cursor-pointer text-sm font-medium">
            {audit.notes.length} smaller observations
          </summary>
          <p className="mt-1 mb-3 text-sm text-slate-500">
            Gaps in the day, places listed more than once, and similar. Nothing here is wrong, it is
            just what the plan does not say.
          </p>
          <ul className="space-y-2">
            {audit.notes.map((note) => (
              <li key={note.key} className="text-sm">
                <span className="font-medium">{note.title}</span>
                {note.date ? (
                  <span className="text-slate-400"> · {formatDayLabel(note.date)}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => resolve(note, 'dismissed')}
                  className="text-brand-700 dark:text-brand-300 ml-2 text-xs font-medium"
                >
                  hide
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
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
      <PageHeader
        title="Reminders"
        subtitle="Most of these fire the evening before the day they serve."
      />
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
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
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

  const upload = async (file: File) => {
    setProblems([]);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = await importTrip(parsed, { mode: 'copy' });
      setMessage(
        `Imported ${result.counts.days} days and ${result.counts.bookings} bookings as a new trip.`,
      );
    } catch (error) {
      if (error instanceof ImportError) {
        setMessage(error.message);
        setProblems(error.problems);
      } else {
        setMessage('That file could not be read as JSON.');
      }
    }
  };

  const resetToSample = async () => {
    setProblems([]);
    await importTrip(europe2026, { mode: 'replace' });
    setMessage('The sample trip has been restored.');
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Everything lives on this device." />

      <Section title="Your data">
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            TripDeck keeps the whole trip in this browser. Nothing is uploaded, and there is no
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
            <Button onClick={() => fileInput.current?.click()}>
              <Upload size={15} aria-hidden /> Import a trip file
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
          <p className="mt-2 text-xs text-slate-400">
            Exporting the itinerary only leaves out ticket files, which makes it small enough to
            send in a message to whoever you are travelling with.
          </p>
        </Card>
      </Section>

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
