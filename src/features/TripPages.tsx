/**
 * Trips list, trip home, and the day index.
 *
 * The trip home answers the questions a first-time traveller actually has before they
 * know their way around the app: where am I going, what's next, where do I sleep tonight,
 * and where are my tickets. Everything else - what still needs booking, what is worth a
 * second look - is one compact row, not a dashboard.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  Copy,
  FolderOpen,
  Info,
  Map as MapIcon,
  Sunrise,
  X,
} from 'lucide-react';
import {
  Button,
  Card,
  CategoryIcon,
  Chip,
  EmptyState,
  LinkCard,
  OutLink,
  PageHeader,
  Row,
  Section,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { accommodationForDate, dayForDate, itemsForDay, orderedDays } from '@/domain/bundle';
import { daysBetween, formatDayLabel } from '@/domain/time';
import { useAudit, useToday, useTripBundle, useTrips } from '@/hooks/useTrip';
import { CATEGORY_META, bookingCategory, itemCategory, type Category } from '@/domain/categories';
import type {
  Accommodation,
  Booking,
  BookingKind,
  Day,
  Essential,
  TripBundle,
} from '@/domain/types';

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
 * The one-time tour. It used to be a README nobody opened; now it is the first thing on
 * the screen, and it gets out of the way for good once it has been read.
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
          {/* One sentence per line rather than a bold label: a label matching "Documents"
              or "Home" word for word would be indistinguishable from the nav item of the
              same name to anything - assistive tech included - that looks for exact text. */}
          <ul className="mt-1.5 space-y-1 text-sm text-slate-500 dark:text-slate-400">
            <li>Home is the overview.</li>
            <li>Days is what to do each day.</li>
            <li>Bookings is tickets and hotels by type.</li>
            <li>Documents is your PDFs.</li>
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
function tripTimingWords(daysAway: number, dayNumber: number, totalDays: number): string {
  if (daysAway > 1) return `Starts in ${daysAway} days`;
  if (daysAway === 1) return 'Tomorrow';
  if (daysAway === 0) return 'You leave today';
  return `Day ${dayNumber} of ${totalDays}`;
}

/** `Sat 26 Sep` -> `26 Sep`: the weekday earns its place on a day row, not a route summary. */
function shortDate(date: string): [day: string, month: string] {
  const [, day, month] = formatDayLabel(date).split(' ');
  return [day ?? '', month ?? ''];
}

/** `26–29 Sep`, or `30 Sep – 1 Oct` across a month boundary. */
function formatStopRange(checkIn: string, checkOut: string): string {
  const [inDay, inMonth] = shortDate(checkIn);
  const [outDay, outMonth] = shortDate(checkOut);
  if (inMonth === outMonth) return `${inDay}–${outDay} ${inMonth}`;
  return `${inDay} ${inMonth} – ${outDay} ${outMonth}`;
}

/** `international-train` -> `International train`. Sentence case, not a slug. */
function kindWords(kind: BookingKind): string {
  return kind.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** The transport booking that moves the trip on a given date, if one has been booked. */
function transportBookingOn(bundle: TripBundle, date: string): Booking | undefined {
  return bundle.bookings
    .filter((b) => bookingCategory(b.kind) === 'transport' && b.date === date)
    .sort((a, b) => (a.depart ?? '').localeCompare(b.depart ?? ''))[0];
}

/** e.g. `Train · Frecciarossa 08:35`, read between one stop and the next. */
function connectorLabel(booking: Booking): string {
  const service = booking.title.split(',')[0];
  const time = booking.depart ? ` ${booking.depart}` : '';
  return `${kindWords(booking.kind)} · ${service}${time}`;
}

function ConnectorLine({ booking }: { booking: Booking }) {
  return (
    <p className="border-l border-dashed border-slate-300 py-1 pl-[1.6rem] text-xs text-slate-400 dark:border-slate-600 dark:text-slate-500">
      {connectorLabel(booking)}
    </p>
  );
}

/**
 * Accommodations in check-in order: the stops the route, and the day list, are both built
 * from. A stop's nights run `checkIn` inclusive to `checkOut` exclusive - the checkout day
 * belongs to whatever comes next, hotel or home.
 */
function tripStops(bundle: TripBundle): Accommodation[] {
  return bundle.accommodations.slice().sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

/**
 * The trip at a glance: one row per bed slept in, in order, with the leg that moved you
 * between them. Day trips (a day whose city changes but the hotel doesn't) never appear -
 * stops follow accommodation, not the day list.
 */
function RouteSection({ bundle, tripId }: { bundle: TripBundle; tripId: string }) {
  const stops = tripStops(bundle);
  if (stops.length === 0) return null;

  const firstDayDate = orderedDays(bundle)[0]?.date;
  const connectorBefore = firstDayDate ? transportBookingOn(bundle, firstDayDate) : undefined;
  const lastStop = stops[stops.length - 1] as Accommodation;
  const connectorAfter = transportBookingOn(bundle, lastStop.checkOut);

  return (
    <Section title="Your route">
      <div className="space-y-1.5">
        {connectorBefore ? <ConnectorLine booking={connectorBefore} /> : null}
        {stops.map((stop, index) => {
          const firstDay = dayForDate(bundle, stop.checkIn);
          const nights = daysBetween(stop.checkIn, stop.checkOut);
          const next = stops[index + 1];
          const connector = next ? transportBookingOn(bundle, next.checkIn) : undefined;
          return (
            <div key={stop.id}>
              <Row
                icon={CATEGORY_META.stay.icon}
                to={firstDay ? `/t/${tripId}/days/${firstDay.id}` : undefined}
                title={stop.place.city ?? stop.place.name}
                meta={`${formatStopRange(stop.checkIn, stop.checkOut)} · ${nights} night${nights === 1 ? '' : 's'} · ${stop.name}`}
              />
              {connector ? <ConnectorLine booking={connector} /> : null}
            </div>
          );
        })}
        {connectorAfter ? <ConnectorLine booking={connectorAfter} /> : null}
      </div>
    </Section>
  );
}

/** The day itself, today or the next one, with the two or three things that happen in it. */
function NextUpCard({
  bundle,
  tripId,
  current,
  day,
}: {
  bundle: TripBundle;
  tripId: string;
  current: boolean;
  day: Day;
}) {
  const items = itemsForDay(bundle, day.id)
    .filter((item) => item.time)
    .slice(0, 3);
  const tonight = accommodationForDate(bundle, day.date);

  return (
    <Section title={current ? 'Today' : 'Next up'}>
      <LinkCard to={`/t/${tripId}/days/${day.id}`}>
        <p className="font-semibold">
          {formatDayLabel(day.date)} · {day.city}
        </p>
        {day.theme ? <p className="text-sm text-slate-500">{day.theme}</p> : null}
        {items.length > 0 ? (
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <CategoryIcon category={itemCategory(item.type)} size="sm" />
                <span className="text-slate-400 tabular-nums">{item.time}</span>
                <span className="truncate">{item.title}</span>
              </div>
            ))}
          </div>
        ) : null}
        {tonight ? (
          <p className="mt-3 text-sm text-slate-500">{`Tonight: ${tonight.name}`}</p>
        ) : null}
      </LinkCard>
    </Section>
  );
}

function TileIcon({ icon: Icon }: { icon: typeof MapIcon }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
      <Icon size={18} aria-hidden />
    </span>
  );
}

interface QuickTile {
  key: string;
  label: string;
  to: string;
  category?: Category;
  icon?: typeof MapIcon;
}

/** One tap from a category on Home to the filtered list of it on Bookings, or the vault. */
function QuickTiles({ tripId }: { tripId: string }) {
  const tiles: QuickTile[] = [
    {
      key: 'transport',
      label: 'Transport',
      to: `/t/${tripId}/bookings?category=transport`,
      category: 'transport',
    },
    { key: 'stay', label: 'Hotels', to: `/t/${tripId}/bookings?category=stay`, category: 'stay' },
    {
      key: 'activity',
      label: 'Sightseeing',
      to: `/t/${tripId}/bookings?category=activity`,
      category: 'activity',
    },
    { key: 'food', label: 'Food', to: `/t/${tripId}/bookings?category=food`, category: 'food' },
    { key: 'documents', label: 'Documents', to: `/t/${tripId}/documents`, icon: FolderOpen },
    { key: 'essentials', label: 'Essentials', to: '#essentials', icon: Info },
  ];
  const tileClass =
    'hover:border-brand-400 flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800';
  return (
    <div className="mb-6 grid grid-cols-3 gap-3">
      {tiles.map((tile) =>
        tile.category ? (
          <Link key={tile.key} to={tile.to} className={tileClass}>
            <CategoryIcon category={tile.category} />
            <span className="text-xs font-medium">{tile.label}</span>
          </Link>
        ) : (
          // A plain anchor jumps to the Essentials card in place; a router Link would not.
          <a key={tile.key} href={tile.to} className={cn(tileClass, 'no-underline')}>
            <TileIcon icon={tile.icon ?? Info} />
            <span className="text-xs font-medium">{tile.label}</span>
          </a>
        ),
      )}
    </div>
  );
}

/** The two pages Home used to be the only door to. Small enough not to compete with it. */
function MoreLinks({ tripId }: { tripId: string }) {
  return (
    <div className="mb-6 flex gap-4 text-sm">
      <Link
        to={`/t/${tripId}/reminders`}
        className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1.5 font-medium"
      >
        <Bell size={14} aria-hidden />
        Reminders
      </Link>
      <Link
        to="/playbook"
        className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1.5 font-medium"
      >
        <BookOpen size={14} aria-hidden />
        Playbook
      </Link>
    </div>
  );
}

/** The one thing to do with an essential: call it, open it, or copy it to send on. */
function EssentialAction({ essential }: { essential: Essential }) {
  const [copied, setCopied] = useState(false);

  if (essential.kind === 'phone') {
    return (
      <a
        href={`tel:${essential.value.replace(/\s+/g, '')}`}
        className="text-brand-700 hover:bg-brand-50 dark:text-brand-200 inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 px-3 text-sm font-medium dark:border-slate-600 dark:hover:bg-slate-700"
      >
        Call
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

/** Numbers, links and facts worth reaching without hunting through notes for them. */
function EssentialsCard({ essentials }: { essentials: Essential[] }) {
  return (
    <Section title="Essentials">
      <div className="space-y-2">
        {essentials.map((essential) => (
          <Row
            key={essential.id}
            title={essential.label}
            meta={essential.note ?? essential.value}
            trailing={<EssentialAction essential={essential} />}
          />
        ))}
      </div>
    </Section>
  );
}

export function TripHomePage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const audit = useAudit(bundle, today);

  if (bundle === undefined) return <p className="text-slate-500">Loading.</p>;
  if (!bundle) return <EmptyState title="That trip is not on this device." />;

  const { trip } = bundle;
  const daysAway = daysBetween(today, trip.startDate);
  const days = orderedDays(bundle);
  const todayIndex = days.findIndex((d) => d.date === today);
  const currentDay = todayIndex >= 0 ? days[todayIndex] : undefined;
  const nextDay = currentDay ?? days.find((d) => d.date > today);
  const toBook = bundle.bookings.filter((b) => b.status === 'to_book').length;

  return (
    <>
      <WelcomeCard />

      <PageHeader
        title={trip.name}
        subtitle={tripTimingWords(daysAway, todayIndex + 1, days.length)}
      />

      {trip.travellerNames?.length ? (
        <p className="-mt-3 mb-4 text-sm text-slate-500 dark:text-slate-400">
          {trip.travellerNames.join(', ')}
        </p>
      ) : null}

      {bundle.documents.length === 0 ? (
        <LinkCard to="/settings" className="mb-4 border-amber-300 dark:border-amber-700">
          <p className="font-medium">Your tickets aren&apos;t loaded yet</p>
          <p className="text-sm text-slate-500">Import your trip file in More →</p>
        </LinkCard>
      ) : null}

      {nextDay ? (
        <NextUpCard bundle={bundle} tripId={trip.id} current={Boolean(currentDay)} day={nextDay} />
      ) : null}

      <RouteSection bundle={bundle} tripId={trip.id} />

      <QuickTiles tripId={trip.id} />

      <Link
        to={`/t/${trip.id}/guide`}
        className="hover:border-brand-400 mb-4 block rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800"
      >
        New to Europe? Read this first →
      </Link>

      {trip.essentials?.length ? (
        <div id="essentials">
          <EssentialsCard essentials={trip.essentials} />
        </div>
      ) : null}

      {toBook > 0 ? (
        <Link
          to={`/t/${trip.id}/bookings`}
          className="hover:border-brand-400 mb-2 block rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800"
        >
          {toBook} thing{toBook === 1 ? '' : 's'} still to book →
        </Link>
      ) : null}

      {audit.counts.actionable > 0 ? (
        <Link
          to={`/t/${trip.id}/conflicts`}
          className="hover:border-brand-400 mb-4 block rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800"
        >
          Plan check: {audit.counts.actionable} thing{audit.counts.actionable === 1 ? '' : 's'}{' '}
          worth a look →
        </Link>
      ) : null}

      <MoreLinks tripId={trip.id} />
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
        {stop.place.city ?? stop.place.name} · {formatStopRange(stop.checkIn, stop.checkOut)} ·{' '}
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
