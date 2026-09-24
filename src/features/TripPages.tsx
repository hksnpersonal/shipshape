/**
 * Trips list, trip home, and the day index.
 *
 * The trip home is the whole route at a glance: where the trip goes, one card per bed
 * slept in, grouped by country, with the leg that moves the traveller from one to the
 * next. What is happening right now lives on the Today tab; this screen answers "where
 * am I in the trip" instead.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { AlertTriangle, ChevronRight, Map as MapIcon, Sunrise, X } from 'lucide-react';
import {
  Button,
  Card,
  CategoryIcon,
  Chip,
  EmptyState,
  LinkCard,
  PageHeader,
  Row,
  Section,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { accommodationForDate, dayForDate, orderedDays } from '@/domain/bundle';
import { daysBetween, formatDayLabel } from '@/domain/time';
import { useAudit, useToday, useTripBundle, useTrips } from '@/hooks/useTrip';
import { CATEGORY_META, bookingCategory } from '@/domain/categories';
import type { Accommodation, Booking, Day, Trip, TripBundle } from '@/domain/types';

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

  // A first-time traveller landing on "/" should see their trip, not a list of one.
  if (trips.length === 1 && trips[0]) {
    return <Navigate replace to={`/t/${trips[0].id}`} />;
  }

  return (
    <>
      <PageHeader title="Trips" />
      <div className="space-y-2">
        {trips.map((trip) => (
          <Row
            key={trip.id}
            icon={MapIcon}
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

const WELCOME_DISMISSED_KEY = 'shipshape:home-welcome-dismissed';

/** localStorage can throw (private browsing, a full quota); the card just re-shows next time. */
function readWelcomeDismissed(): boolean {
  try {
    return localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The one-time tour. It used to be a README nobody opened; now it is compact and gets
 * out of the way for good once it has been read.
 */
function WelcomeCard() {
  const [dismissed, setDismissed] = useState(readWelcomeDismissed);
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
    } catch {
      // Not remembered, but dismissed for this session either way.
    }
  };

  return (
    <Card className="mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">How this app works</p>
          {/* One sentence per line rather than a bold label: a label matching "Today"
              or "Trip" word for word would be indistinguishable from the nav item of the
              same name to anything - assistive tech included - that looks for exact text. */}
          <ul className="mt-1.5 space-y-1 text-sm text-slate-500 dark:text-slate-400">
            <li>Today is what you&apos;re doing now.</li>
            <li>Trip is the whole route.</li>
            <li>Wallet has every ticket and hotel.</li>
            <li>More has emergency numbers, documents and the guide.</li>
          </ul>
          <p className="mt-1.5 text-xs text-slate-400">Works offline.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </Card>
  );
}

/** Words for the countdown a first-time traveller actually reads, not a signed integer. */
/**
 * Day numbers match the Days list and the traveller's notes: the departure day is day 0,
 * so the first day on the ground is Day 1. After the last day there is still the flight
 * home, then the trip is over - never "Day 0".
 */
function tripTimingWords(
  today: string,
  trip: { startDate: string; endDate: string },
  todayIndex: number,
  lastIndex: number,
  lastDate: string | undefined,
): string {
  const daysAway = daysBetween(today, trip.startDate);
  if (daysAway > 1) return `Starts in ${daysAway} days`;
  if (daysAway === 1) return 'Tomorrow';
  if (daysAway === 0) return 'You leave today';
  if (todayIndex >= 0) return `Day ${todayIndex} of ${lastIndex}`;
  if (lastDate && today > lastDate && today <= trip.endDate) return 'On the way home';
  return 'Trip finished';
}

/** `Sat 26 Sep` -> `26 Sep`: the weekday earns its place on a day row, not a route summary. */
function shortDate(date: string): [day: string, month: string] {
  const [, day, month] = formatDayLabel(date).split(' ');
  return [day ?? '', month ?? ''];
}

/** `26–29 Sep`, or `30 Sep – 1 Oct` across a month boundary. Used for a stop's nights and the
 *  trip's own dates in the header. */
function formatDateRange(start: string, end: string): string {
  const [startDay, startMonth] = shortDate(start);
  const [endDay, endMonth] = shortDate(end);
  if (startMonth === endMonth) return `${startDay}–${endDay} ${startMonth}`;
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

/** `Sat 17 Oct` -> `Sat 17`: the month is redundant once the date sits beside another date. */
function weekdayDay(date: string): string {
  const [weekday, day] = formatDayLabel(date).split(' ');
  return `${weekday} ${day}`;
}

function travellerWords(trip: Trip): string {
  const count = trip.travellerNames?.length ?? trip.travellers;
  return `${count} traveller${count === 1 ? '' : 's'}`;
}

/** The kicker above the trip name: when it runs and who's on it. */
function tripKicker(trip: Trip): string {
  return `${formatDateRange(trip.startDate, trip.endDate)} · ${travellerWords(trip)}`;
}

/** The transport booking that moves the trip on a given date, if one has been booked. */
function transportBookingOn(bundle: TripBundle, date: string): Booking | undefined {
  return bundle.bookings
    .filter((b) => bookingCategory(b.kind) === 'transport' && b.date === date)
    .sort((a, b) => (a.depart ?? '').localeCompare(b.depart ?? ''))[0];
}

/** Where a leg sits relative to the stops it links: the ends get their own phrasing. */
type ConnectorPosition = 'before' | 'between' | 'after';

/**
 * e.g. `Frecciarossa 08:35 → 10:11` between two stops, `Fly in · lands 14:10` arriving at
 * the first, `Thai Airways 14:15 Sat 17 · lands Sydney 21:30 Sun 18` leaving the last - a
 * flight carries dates because it is the one leg likely to cross a day, everything else
 * on the ground happens same-day.
 */
function connectorLabel(booking: Booking, position: ConnectorPosition): string {
  if (booking.kind === 'flight') {
    if (position === 'before') return `Fly in · lands ${booking.arrive ?? '?'}`;
    const operator = booking.operator ?? booking.title.split(',')[0] ?? booking.title;
    const arriveCity = booking.to?.city ?? booking.to?.name ?? '';
    const departLabel = weekdayDay(booking.date);
    const arriveLabel = weekdayDay(booking.arriveDate ?? booking.date);
    return `${operator} ${booking.depart ?? ''} ${departLabel} · lands ${arriveCity} ${booking.arrive ?? ''} ${arriveLabel}`;
  }
  const service = booking.title.split(',')[0] ?? booking.title;
  if (booking.depart && booking.arrive) return `${service} ${booking.depart} → ${booking.arrive}`;
  if (booking.depart) return `${service} ${booking.depart}`;
  return service;
}

function ConnectorLine({
  booking,
  position,
  className,
}: {
  booking: Booking;
  position: ConnectorPosition;
  className?: string;
}) {
  const Icon = CATEGORY_META[bookingCategory(booking.kind)].icon;
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 py-1.5 pl-[0.95rem] text-[13px] text-slate-500 dark:text-slate-400',
        className,
      )}
    >
      <span className="h-[26px] w-0.5 shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden />
      <Icon size={15} className="shrink-0" aria-hidden />
      <span>{connectorLabel(booking, position)}</span>
    </div>
  );
}

const COUNTRY_NAMES: Record<string, string> = {
  IT: 'Italy',
  CH: 'Switzerland',
  FR: 'France',
  BE: 'Belgium',
  NL: 'Netherlands',
  AU: 'Australia',
};

/** The country a stop belongs to, by the day it's checked in on rather than the place
 *  record - the two agree in practice, but the day is the source of truth for the route. */
function countryNameForStop(bundle: TripBundle, stop: Accommodation): string {
  const code = dayForDate(bundle, stop.checkIn)?.countryCode ?? stop.place.countryCode ?? '';
  return COUNTRY_NAMES[code] ?? code;
}

/**
 * Accommodations in check-in order: the stops the route, and the day list, are both built
 * from. A stop's nights run `checkIn` inclusive to `checkOut` exclusive - the checkout day
 * belongs to whatever comes next, hotel or home.
 */
function tripStops(bundle: TripBundle): Accommodation[] {
  return bundle.accommodations.slice().sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

/** Cities visited during a stay whose hotel doesn't change - Varenna out of Milan, Brussels
 *  out of Paris - in the order they're visited. */
function dayTripCities(bundle: TripBundle, stop: Accommodation): string[] {
  const stopCity = stop.place.city ?? stop.place.name;
  const cities: string[] = [];
  for (const day of orderedDays(bundle)) {
    if (day.date < stop.checkIn || day.date >= stop.checkOut) continue;
    if (day.city !== stopCity && !cities.includes(day.city)) cities.push(day.city);
  }
  return cities;
}

/** One stop on the route: the bed, the dates, and where you are relative to it now. */
function StopRow({
  bundle,
  tripId,
  stop,
  isCurrent,
}: {
  bundle: TripBundle;
  tripId: string;
  stop: Accommodation;
  isCurrent: boolean;
}) {
  const firstDay = dayForDate(bundle, stop.checkIn);
  const nights = daysBetween(stop.checkIn, stop.checkOut);
  const dayTrips = dayTripCities(bundle, stop);
  const hotelLine =
    dayTrips.length > 0 ? `${stop.name} · day trip to ${dayTrips.join(', ')}` : stop.name;
  const city = stop.place.city ?? stop.place.name;

  return (
    <Link
      to={firstDay ? `/t/${tripId}/days/${firstDay.id}` : `/t/${tripId}/days`}
      className={cn(
        'flex items-center gap-3 rounded-2xl border bg-white p-3.5 dark:bg-slate-800',
        isCurrent
          ? 'border-brand-600 border-2'
          : 'hover:border-brand-400 border-slate-200 transition dark:border-slate-700',
      )}
    >
      <CategoryIcon category="stay" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display truncate text-xl font-semibold">{city}</span>
          {isCurrent ? (
            <span className="bg-brand-600 inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-xs font-semibold text-white">
              You are here
            </span>
          ) : null}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatDateRange(stop.checkIn, stop.checkOut)} · {nights} night{nights === 1 ? '' : 's'}
        </p>
        <p className="mt-0.5 truncate text-sm">{hotelLine}</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-slate-300" aria-hidden />
    </Link>
  );
}

interface RouteGroup {
  country: string;
  entries: Array<{ stop: Accommodation; connector?: Booking; position: ConnectorPosition }>;
}

/** Stops folded into one group per country, in the order the trip actually visits them. */
function routeGroups(
  bundle: TripBundle,
  stops: Accommodation[],
  connectorBefore: Booking | undefined,
): RouteGroup[] {
  const groups: RouteGroup[] = [];
  stops.forEach((stop, index) => {
    const country = countryNameForStop(bundle, stop);
    const connector = index === 0 ? connectorBefore : transportBookingOn(bundle, stop.checkIn);
    const position: ConnectorPosition = index === 0 ? 'before' : 'between';
    const last = groups[groups.length - 1];
    if (last?.country === country) {
      last.entries.push({ stop, connector, position });
    } else {
      groups.push({ country, entries: [{ stop, connector, position }] });
    }
  });
  return groups;
}

/**
 * The trip at a glance: one card per bed slept in, grouped by country, with the leg that
 * moved you between them. Day trips (a day whose city changes but the hotel doesn't) never
 * appear as stops of their own - stops follow accommodation, not the day list.
 */
function RouteSection({
  bundle,
  tripId,
  today,
}: {
  bundle: TripBundle;
  tripId: string;
  today: string;
}) {
  const stops = tripStops(bundle);
  if (stops.length === 0) return null;

  const firstDayDate = orderedDays(bundle)[0]?.date;
  const connectorBefore = firstDayDate ? transportBookingOn(bundle, firstDayDate) : undefined;
  const lastStop = stops[stops.length - 1] as Accommodation;
  const connectorAfter = transportBookingOn(bundle, lastStop.checkOut);
  const currentStop = accommodationForDate(bundle, today);
  const groups = routeGroups(bundle, stops, connectorBefore);

  return (
    <>
      {groups.map((group) => (
        <Section key={group.country} title={group.country}>
          <div className="space-y-1.5">
            {group.entries.map(({ stop, connector, position }) => (
              <div key={stop.id}>
                {connector ? <ConnectorLine booking={connector} position={position} /> : null}
                <StopRow
                  bundle={bundle}
                  tripId={tripId}
                  stop={stop}
                  isCurrent={stop.id === currentStop?.id}
                />
              </div>
            ))}
          </div>
        </Section>
      ))}
      {connectorAfter ? (
        <ConnectorLine booking={connectorAfter} position="after" className="mb-6" />
      ) : null}
    </>
  );
}

/** "Day N of M", or the words for before/after the trip - the progress bar fills the same way. */
function ProgressCard({
  trip,
  today,
  todayIndex,
  lastIndex,
  lastDate,
  cityCount,
  countryCount,
}: {
  trip: Trip;
  today: string;
  todayIndex: number;
  lastIndex: number;
  lastDate: string | undefined;
  cityCount: number;
  countryCount: number;
}) {
  const label = tripTimingWords(today, trip, todayIndex, lastIndex, lastDate);
  const percent =
    todayIndex >= 0
      ? lastIndex > 0
        ? Math.min(100, (todayIndex / lastIndex) * 100)
        : 100
      : lastDate && today > lastDate
        ? 100
        : 0;

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between text-[13px] text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-900 dark:text-slate-100">{label}</span>
        <span>
          {cityCount} cit{cityCount === 1 ? 'y' : 'ies'} · {countryCount} countr
          {countryCount === 1 ? 'y' : 'ies'}
        </span>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="bg-brand-600 h-2 rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </Card>
  );
}

export function TripHomePage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);

  if (bundle === undefined) return <p className="text-slate-500">Loading.</p>;
  if (!bundle) return <EmptyState title="That trip is not on this device." />;

  const { trip } = bundle;
  const days = orderedDays(bundle);
  const todayIndex = days.findIndex((d) => d.date === today);
  const lastIndex = days.length - 1;
  const lastDate = days.at(-1)?.date;
  const stops = tripStops(bundle);
  const countryCount = new Set(stops.map((stop) => countryNameForStop(bundle, stop))).size;

  return (
    <>
      {/* First, above everything: a newcomer needs to know what the tabs are for before
          the route means anything. Dismissed once, it stays gone. */}
      <WelcomeCard />

      <PageHeader
        kicker={tripKicker(trip)}
        title={trip.name}
        actions={
          <Link
            to={`/t/${trip.id}/days`}
            className="text-brand-700 dark:text-brand-300 inline-flex min-h-[36px] items-center text-sm font-semibold"
          >
            All days
          </Link>
        }
      />

      <ProgressCard
        trip={trip}
        today={today}
        todayIndex={todayIndex}
        lastIndex={lastIndex}
        lastDate={lastDate}
        cityCount={stops.length}
        countryCount={countryCount}
      />

      <RouteSection bundle={bundle} tripId={trip.id} today={today} />

      {bundle.documents.length === 0 ? (
        <LinkCard
          to={`/t/${trip.id}/settings`}
          className="mb-4 border-amber-300 dark:border-amber-700"
        >
          <p className="font-medium">Your tickets aren&apos;t loaded yet</p>
          <p className="text-sm text-slate-500">Import your trip file in More →</p>
        </LinkCard>
      ) : null}

      <Link
        to={`/t/${trip.id}/guide`}
        className="hover:border-brand-400 mb-4 block rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800"
      >
        New to Europe? Read this first →
      </Link>
    </>
  );
}

interface DayGroup {
  key: string;
  /** Undefined for the travel days before the first stay or after the last. */
  stop?: Accommodation;
  days: Day[];
}

/**
 * The day list, grouped the way the route is: one block per stay, in check-in order, plus
 * a block for whatever falls outside every stay (the outbound flight day, the day home).
 * Consecutive days sharing a stop merge into one group; a run of unstopped days does too,
 * since only adjacency (not the shared `undefined` stop) decides where a group ends.
 */
function groupDaysByStay(bundle: TripBundle): DayGroup[] {
  const stops = tripStops(bundle);
  const groups: DayGroup[] = [];
  for (const day of orderedDays(bundle)) {
    const stop = stops.find((s) => day.date >= s.checkIn && day.date < s.checkOut);
    const key = stop?.id ?? 'travel';
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.days.push(day);
    } else {
      groups.push({ key, stop, days: [day] });
    }
  }
  return groups;
}

function StayBlockHeading({ stop }: { stop: Accommodation }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 px-1">
      <CategoryIcon category="stay" size="sm" />
      <p className="text-sm font-semibold">
        {stop.place.city ?? stop.place.name} · {formatDateRange(stop.checkIn, stop.checkOut)} ·{' '}
        {stop.name}
      </p>
    </div>
  );
}

function TravelBlockHeading({ count }: { count: number }) {
  return (
    <p className="mb-1.5 px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
      {count === 1 ? 'Travel day' : 'Travel days'}
    </p>
  );
}

/** One ~48px row: which day it is, the date, where it happens, and whether it needs a look. */
function DayRow({
  tripId,
  day,
  index,
  today,
  dayTripCity,
  hasError,
}: {
  tripId: string;
  day: Day;
  index: number;
  today: string;
  dayTripCity: string | null;
  hasError: boolean;
}) {
  return (
    <Row
      to={`/t/${tripId}/days/${day.id}`}
      title={
        <>
          <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500 tabular-nums dark:bg-slate-700 dark:text-slate-300">
            {index}
          </span>
          {formatDayLabel(day.date)}
          {day.date === today ? (
            <span className="text-brand-600 dark:text-brand-400 ml-2 text-xs font-bold">TODAY</span>
          ) : null}
        </>
      }
      meta={dayTripCity ? `Day trip to ${dayTripCity}` : day.theme}
      trailing={
        hasError ? (
          <span title="Needs a look">
            <AlertTriangle size={15} className="text-rose-500 dark:text-rose-400" aria-hidden />
            <span className="sr-only">Needs a look</span>
          </span>
        ) : null
      }
    />
  );
}

export function DaysIndexPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const audit = useAudit(bundle, today);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;
  const days = orderedDays(bundle);
  const dayIndex = new Map(days.map((day, index) => [day.id, index]));
  const errorDayIds = new Set(
    audit.open.filter((f) => f.severity === 'error' && f.dayId).map((f) => f.dayId),
  );
  const groups = groupDaysByStay(bundle);

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
      <div className="space-y-4">
        {groups.map((group) => {
          const stopCity = group.stop ? (group.stop.place.city ?? group.stop.place.name) : null;
          return (
            <div key={`${group.key}-${group.days[0]?.id}`}>
              {group.stop ? (
                <StayBlockHeading stop={group.stop} />
              ) : (
                <TravelBlockHeading count={group.days.length} />
              )}
              <div className="space-y-1.5">
                {group.days.map((day) => (
                  <DayRow
                    key={day.id}
                    tripId={bundle.trip.id}
                    day={day}
                    index={dayIndex.get(day.id) ?? 0}
                    today={today}
                    dayTripCity={stopCity && day.city !== stopCity ? day.city : null}
                    hasError={errorDayIds.has(day.id)}
                  />
                ))}
              </div>
            </div>
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
  // After the last day, the last day is the useful one to land on, not the first.
  const target =
    days.find((d) => d.date === today) ?? days.find((d) => d.date > today) ?? days.at(-1);
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
