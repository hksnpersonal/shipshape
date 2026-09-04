/**
 * Trips list, trip home, and the day index.
 *
 * The trip home answers the two questions a traveller actually has before departure:
 * what do I have to book this week, and what is wrong with the plan.
 */
import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  LinkCard,
  PageHeader,
  Section,
  SeverityChip,
} from '@/components/ui';
import { itemsForDay, orderedDays } from '@/domain/bundle';
import { daysBetween, formatDayLabel } from '@/domain/time';
import { useAudit, useBookBy, useToday, useTripBundle, useTrips } from '@/hooks/useTrip';
import type { BookByEntry } from '@/playbook/bookBy';

export function TripsListPage() {
  const trips = useTrips();
  const navigate = useNavigate();

  if (!trips) return <p className="text-slate-500">Loading your trips.</p>;
  if (trips.length === 0) {
    return (
      <EmptyState title="No trips yet">
        Import a trip file from Settings, or reset to the sample itinerary.
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader title="Your trips" subtitle="Everything is stored on this device." />
      <div className="space-y-3">
        {trips.map((trip) => (
          <Card key={trip.id} onClick={() => void navigate(`/t/${trip.id}`)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{trip.name}</p>
                <p className="text-sm text-slate-500">
                  {formatDayLabel(trip.startDate)} to {formatDayLabel(trip.endDate)}
                </p>
                <p className="mt-1 text-xs text-slate-400">{trip.countries.join(' · ')}</p>
              </div>
              <ArrowRight size={18} className="text-slate-400" aria-hidden />
            </div>
          </Card>
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
  if (urgency === 'overdue') return `${Math.abs(daysLeft ?? 0)} days late`;
  if (urgency === 'now') return `${daysLeft} days left`;
  if (urgency === 'soon') return `in ${daysLeft} days`;
  return urgency;
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

  return (
    <>
      <PageHeader
        title={trip.name}
        subtitle={
          daysAway > 0
            ? `${daysAway} days until you leave, ${days.length} days planned`
            : daysAway === 0
              ? 'You leave today'
              : `Day ${1 - daysAway} of the trip`
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-2xl font-bold">{audit.counts.actionable}</p>
          <p className="text-xs text-slate-500">to resolve</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold">
            {bundle.bookings.filter((b) => b.status === 'to_book').length}
          </p>
          <p className="text-xs text-slate-500">still to book</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold">{bundle.items.length}</p>
          <p className="text-xs text-slate-500">things planned</p>
        </Card>
      </div>

      {nextDay ? (
        <Section title={currentDay ? 'Today' : 'Next day'}>
          <LinkCard to={`/t/${trip.id}/days/${nextDay.id}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {formatDayLabel(nextDay.date)} in {nextDay.city}
                </p>
                {nextDay.theme ? <p className="text-sm text-slate-500">{nextDay.theme}</p> : null}
                <p className="mt-1 text-xs text-slate-400">
                  {itemsForDay(bundle, nextDay.id).length} items
                </p>
              </div>
              <ArrowRight size={18} className="text-slate-400" aria-hidden />
            </div>
          </LinkCard>
        </Section>
      ) : null}

      {needAttention.length > 0 ? (
        <Section title="Book these now">
          <div className="space-y-2">
            {needAttention.slice(0, 4).map((entry) => (
              <LinkCard key={entry.booking.id} to={`/t/${trip.id}/bookings/${entry.booking.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.booking.title}</p>
                    <p className="text-sm text-slate-500">
                      Book by {entry.result.date} for {entry.booking.date}
                    </p>
                  </div>
                  <Chip tone={urgencyTone(entry)}>{urgencyWords(entry)}</Chip>
                </div>
              </LinkCard>
            ))}
          </div>
        </Section>
      ) : null}

      {soon.length > 0 ? (
        <Section title="Coming up">
          <div className="space-y-2">
            {soon.map((entry) => (
              <LinkCard key={entry.booking.id} to={`/t/${trip.id}/bookings/${entry.booking.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm">{entry.booking.title}</p>
                  <Chip>{urgencyWords(entry)}</Chip>
                </div>
              </LinkCard>
            ))}
          </div>
        </Section>
      ) : null}

      {audit.counts.actionable > 0 ? (
        <Section title="What the audit found">
          <div className="space-y-2">
            {audit.open
              .filter((f) => f.severity === 'error')
              .slice(0, 3)
              .map((finding) => (
                <LinkCard key={finding.key} to={`/t/${trip.id}/conflicts`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={18}
                      className="mt-0.5 shrink-0 text-rose-600"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{finding.title}</p>
                      <p className="text-sm text-slate-500">{finding.date ?? 'Whole trip'}</p>
                    </div>
                  </div>
                </LinkCard>
              ))}
            <Link
              to={`/t/${trip.id}/conflicts`}
              className="text-brand-700 dark:text-brand-300 block text-sm font-medium"
            >
              See all {audit.counts.actionable} findings
            </Link>
          </div>
        </Section>
      ) : null}
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
      <PageHeader title="Every day" subtitle={`${days.length} days`} />
      <div className="space-y-2">
        {days.map((day, index) => {
          const items = itemsForDay(bundle, day.id);
          const problems = audit.open.filter((f) => f.dayId === day.id);
          return (
            <LinkCard key={day.id} to={`/t/${bundle.trip.id}/days/${day.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400">
                    Day {index} {day.originalLabel ? `· was "${day.originalLabel}"` : ''}
                  </p>
                  <p className="font-semibold">
                    {formatDayLabel(day.date)}
                    {day.date === today ? (
                      <span className="text-brand-600 ml-2 text-xs font-bold">TODAY</span>
                    ) : null}
                  </p>
                  <p className="flex items-center gap-1 text-sm text-slate-500">
                    <MapPin size={13} aria-hidden />
                    {day.city}
                  </p>
                  {day.theme ? (
                    <p className="mt-0.5 truncate text-sm text-slate-400">{day.theme}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <CalendarDays size={13} aria-hidden />
                    {items.length}
                  </span>
                  {problems.length > 0 ? (
                    <SeverityChip
                      severity={
                        problems.some((p) => p.severity === 'error')
                          ? 'error'
                          : problems.some((p) => p.severity === 'warning')
                            ? 'warning'
                            : 'info'
                      }
                    />
                  ) : null}
                </div>
              </div>
            </LinkCard>
          );
        })}
      </div>
    </>
  );
}

export function TodayRedirectPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const navigate = useNavigate();

  if (!bundle) return <p className="text-slate-500">Loading.</p>;
  const days = orderedDays(bundle);
  const target = days.find((d) => d.date === today) ?? days.find((d) => d.date > today) ?? days[0];
  if (!target) return <EmptyState title="This trip has no days in it." />;
  return (
    <Card>
      <p className="mb-3">Jumping to {formatDayLabel(target.date)}.</p>
      <Button variant="primary" onClick={() => void navigate(`/t/${tripId}/days/${target.id}`)}>
        Open the day
      </Button>
    </Card>
  );
}
