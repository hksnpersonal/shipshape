/**
 * Trips list, trip home, and the day index.
 *
 * The trip home answers the two questions a traveller actually has before departure:
 * what do I have to book this week, and what is wrong with the plan. It answers them in
 * numbers you can tap rather than sentences you have to read.
 */
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BookOpen, Bell, CalendarDays, FolderOpen, Map, Sunrise } from 'lucide-react';
import {
  Button,
  Chip,
  EmptyState,
  LinkCard,
  PageHeader,
  Row,
  Section,
  SeverityChip,
  StatTile,
} from '@/components/ui';
import { itemsForDay, orderedDays } from '@/domain/bundle';
import { daysBetween, formatDayLabel } from '@/domain/time';
import { useAudit, useBookBy, useToday, useTripBundle, useTrips } from '@/hooks/useTrip';
import type { BookByEntry } from '@/playbook/bookBy';

export function TripsListPage() {
  const trips = useTrips();

  if (!trips) return <p className="text-slate-500">Loading.</p>;
  if (trips.length === 0) {
    return (
      <EmptyState title="No trips yet">
        Import a trip file from Settings, or reset to the sample itinerary.
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader title="Trips" />
      <div className="space-y-2">
        {trips.map((trip) => (
          <Row
            key={trip.id}
            icon={Map}
            to={`/t/${trip.id}`}
            title={trip.name}
            meta={`${formatDayLabel(trip.startDate)} to ${formatDayLabel(trip.endDate)}`}
            trailing={<Chip>{trip.countries.join(' ')}</Chip>}
          />
        ))}
      </div>
    </>
  );
}

function urgencyTone(entry: BookByEntry) {
  if (entry.result.urgency === 'overdue') return 'bad' as const;
  if (entry.result.urgency === 'now') return 'warn' as const;
  return 'neutral' as const;
}

function urgencyWords(entry: BookByEntry): string {
  const { urgency, daysLeft } = entry.result;
  if (urgency === 'overdue') return `${Math.abs(daysLeft ?? 0)}d late`;
  if (urgency === 'now') return `${daysLeft}d left`;
  if (urgency === 'soon') return `in ${daysLeft}d`;
  return urgency;
}

/**
 * The three side rooms. They used to carry a sentence each explaining what they were for;
 * an icon and a count say the same thing and leave the screen to the trip.
 */
function SideRooms({ tripId, reminders }: { tripId: string; reminders: number }) {
  const rooms = [
    { to: `/t/${tripId}/reminders`, icon: Bell, label: 'Reminders', count: reminders },
    { to: `/t/${tripId}/documents`, icon: FolderOpen, label: 'Documents' },
    { to: '/playbook', icon: BookOpen, label: 'Playbook' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {rooms.map((room) => (
        <Link
          key={room.to}
          to={room.to}
          className="hover:border-brand-400 relative flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800"
        >
          <room.icon size={20} className="text-slate-400" aria-hidden />
          <span className="text-xs font-medium">{room.label}</span>
          {room.count ? (
            <span className="bg-brand-600 absolute top-2 right-2 rounded-full px-1.5 text-[10px] font-semibold text-white">
              {room.count}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export function TripHomePage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const audit = useAudit(bundle, today);
  const bookBy = useBookBy(bundle, today);

  if (bundle === undefined) return <p className="text-slate-500">Loading.</p>;
  if (!bundle) return <EmptyState title="That trip is not on this device." />;

  const { trip } = bundle;
  const daysAway = daysBetween(today, trip.startDate);
  const days = orderedDays(bundle);
  const currentDay = days.find((d) => d.date === today);
  const nextDay = currentDay ?? days.find((d) => d.date > today);
  const needAttention = bookBy.filter(
    (e) => e.result.urgency === 'overdue' || e.result.urgency === 'now',
  );
  const soon = bookBy.filter((e) => e.result.urgency === 'soon').slice(0, 3);
  const pendingReminders = bundle.reminders.filter((r) => r.status === 'pending').length;
  const toBook = bundle.bookings.filter((b) => b.status === 'to_book').length;

  return (
    <>
      <PageHeader
        title={trip.name}
        subtitle={
          daysAway > 0
            ? `${daysAway} days to go`
            : daysAway === 0
              ? 'You leave today'
              : `Day ${1 - daysAway}`
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatTile
          value={audit.counts.actionable}
          label="to resolve"
          tone="bad"
          to={`/t/${trip.id}/conflicts`}
        />
        <StatTile value={toBook} label="still to book" tone="warn" to={`/t/${trip.id}/bookings`} />
        <StatTile value={bundle.items.length} label="planned" to={`/t/${trip.id}/days`} />
      </div>

      {nextDay ? (
        <Section title={currentDay ? 'Today' : 'Next'}>
          <LinkCard to={`/t/${trip.id}/days/${nextDay.id}`}>
            <p className="font-semibold">
              {formatDayLabel(nextDay.date)} in {nextDay.city}
            </p>
            {nextDay.theme ? <p className="text-sm text-slate-500">{nextDay.theme}</p> : null}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <CalendarDays size={13} aria-hidden />
              {itemsForDay(bundle, nextDay.id).length} items
            </p>
          </LinkCard>
        </Section>
      ) : null}

      {needAttention.length > 0 ? (
        <Section title="Book now">
          <div className="space-y-2">
            {needAttention.slice(0, 4).map((entry) => (
              <Row
                key={entry.booking.id}
                to={`/t/${trip.id}/bookings/${entry.booking.id}`}
                title={entry.booking.title}
                meta={`by ${entry.result.date}`}
                tone={entry.result.urgency === 'overdue' ? 'urgent' : 'default'}
                trailing={<Chip tone={urgencyTone(entry)}>{urgencyWords(entry)}</Chip>}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {soon.length > 0 ? (
        <Section title="Coming up">
          <div className="space-y-2">
            {soon.map((entry) => (
              <Row
                key={entry.booking.id}
                to={`/t/${trip.id}/bookings/${entry.booking.id}`}
                title={entry.booking.title}
                trailing={<Chip>{urgencyWords(entry)}</Chip>}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {audit.counts.actionable > 0 ? (
        <Section title="Problems">
          <div className="space-y-2">
            {audit.open
              .filter((f) => f.severity === 'error')
              .slice(0, 3)
              .map((finding) => (
                <Row
                  key={finding.key}
                  to={`/t/${trip.id}/conflicts`}
                  title={finding.title}
                  meta={finding.date ?? 'Whole trip'}
                  tone="urgent"
                  trailing={<SeverityChip severity="error" compact />}
                />
              ))}
            <Link
              to={`/t/${trip.id}/conflicts`}
              className="text-brand-700 dark:text-brand-300 block px-1 text-sm font-medium"
            >
              All {audit.counts.actionable} findings
            </Link>
          </div>
        </Section>
      ) : null}

      <SideRooms tripId={trip.id} reminders={pendingReminders} />
    </>
  );
}

export function DaysIndexPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const audit = useAudit(bundle, today);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;
  const days = orderedDays(bundle);

  return (
    <>
      <PageHeader
        title="Days"
        actions={
          <Link
            to={`/t/${bundle.trip.id}/today`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium dark:border-slate-600"
          >
            <Sunrise size={15} aria-hidden />
            Today
          </Link>
        }
      />
      <div className="space-y-2">
        {days.map((day, index) => {
          const items = itemsForDay(bundle, day.id);
          const problems = audit.open.filter((f) => f.dayId === day.id);
          const worst = problems.some((p) => p.severity === 'error')
            ? 'error'
            : problems.some((p) => p.severity === 'warning')
              ? 'warning'
              : 'info';
          // The day number orients better than a repeated pin icon would, and the label the
          // notes originally carried stays reachable rather than being dropped for brevity.
          const meta = [day.theme, day.originalLabel ? `was "${day.originalLabel}"` : null]
            .filter(Boolean)
            .join(' · ');
          return (
            <Row
              key={day.id}
              to={`/t/${bundle.trip.id}/days/${day.id}`}
              title={
                <>
                  <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500 tabular-nums dark:bg-slate-700 dark:text-slate-300">
                    {index}
                  </span>
                  {formatDayLabel(day.date)}
                  <span className="font-normal text-slate-400"> · {day.city}</span>
                  {day.date === today ? (
                    <span className="text-brand-600 dark:text-brand-400 ml-2 text-xs font-bold">
                      TODAY
                    </span>
                  ) : null}
                </>
              }
              meta={meta || undefined}
              trailing={
                <>
                  <span className="flex items-center gap-1 text-xs text-slate-400 tabular-nums">
                    <CalendarDays size={13} aria-hidden />
                    {items.length}
                  </span>
                  {problems.length > 0 ? <SeverityChip severity={worst} compact /> : null}
                </>
              }
            />
          );
        })}
      </div>
    </>
  );
}

/**
 * A redirect that redirects. It used to render a card asking you to press a button to go
 * where you had already asked to go; the button survives only as the fallback for the
 * moment before the effect runs.
 */
export function TodayRedirectPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const navigate = useNavigate();

  const days = bundle ? orderedDays(bundle) : [];
  const target = days.find((d) => d.date === today) ?? days.find((d) => d.date > today) ?? days[0];
  const targetPath = target ? `/t/${tripId}/days/${target.id}` : undefined;

  useEffect(() => {
    if (targetPath) void navigate(targetPath, { replace: true });
  }, [targetPath, navigate]);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;
  if (!target) return <EmptyState title="This trip has no days in it." />;
  return (
    <Button variant="primary" onClick={() => void navigate(`/t/${tripId}/days/${target.id}`)}>
      Open {formatDayLabel(target.date)}
    </Button>
  );
}
