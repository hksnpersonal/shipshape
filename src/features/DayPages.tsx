/**
 * The day timeline and the detail view of one item.
 *
 * The timeline is the screen that gets used while standing up. The default view answers
 * "what's next" in a glance - a Next up card, tonight and tomorrow at a glance, and a
 * timeline where a walk to the next stop is a line between rows, not a row of its own.
 * Edit mode is a different screen behind an explicit toggle: full rows with done/skip/move,
 * the tag filter, and adding an item - the machinery nobody wants while reading the plan.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BedDouble,
  Bus,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Footprints,
  Navigation,
  Plus,
  SkipForward,
  Ticket,
  TrainFront,
} from 'lucide-react';
import { TZDate } from '@date-fns/tz';
import { trackEvent } from '@/analytics/track';
import { allGuides } from '@/content/guides';
import {
  Button,
  Card,
  CategoryIcon,
  Chip,
  Disclosure,
  EmptyState,
  FilterChips,
  PageHeader,
  Section,
  TagChip,
  OutLink,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { accommodationForDate, bookingOf, itemsForDay, orderedDays } from '@/domain/bundle';
import { daysBetween, dayTimeZone, formatDayLabel, toMinutes, weekdayOf } from '@/domain/time';
import { daysRepo, itemsRepo } from '@/db/repo';
import { describeHours } from '@/domain/hours';
import { itemLinks } from '@/playbook/deepLinks';
import { matchGuides } from '@/playbook/match';
import { useAudit, useToday, useTripBundle } from '@/hooks/useTrip';
import { bookingCategory, itemCategory } from '@/domain/categories';
import type { DaySwapPlan } from '@/domain/swap';
import type {
  Accommodation,
  Booking,
  Day,
  ID,
  Item,
  ItemType,
  Passenger,
  Tag,
  TimeLabel,
  TravelMode,
  TripBundle,
  Weekday,
} from '@/domain/types';
import { TAGS } from '@/domain/types';

const ITEM_TYPES: ItemType[] = [
  'transport',
  'transfer',
  'sight',
  'meal',
  'shop',
  'admin',
  'reminder',
  'freeform',
];

const TIME_LABELS: TimeLabel[] = ['morning', 'afternoon', 'evening'];

const fieldClass =
  'w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800';

/** Plain words for a tag chip on a compact row - nobody scanning a platform thinks "CONFLICT". */
const TAG_WORDS: Record<Tag, string> = {
  MUST: 'Must do',
  OPTIONAL: 'Optional',
  CHECK: 'Check',
  CONFLICT: 'Clash',
};

const TAG_TONES: Record<Tag, 'neutral' | 'good' | 'warn' | 'bad' | 'brand'> = {
  MUST: 'bad',
  OPTIONAL: 'brand',
  CHECK: 'warn',
  CONFLICT: 'bad',
};

/** The one word a compact row needs for a linked booking - nothing to book reads as nothing. */
function bookingWord(status: Booking['status']): string | null {
  // "on_site" means nothing is held yet: calling it booked would send a first-time
  // visitor to a museum queue expecting a ticket they do not have.
  if (status === 'to_book') return 'Still to book';
  if (status === 'on_site') return 'Buy on the day';
  if (status === 'booked' || status === 'confirmed') return 'Booked';
  return null;
}

/** The walks and hops between two stops - shown as a connector line, never a row of their own. */
const LOCAL_TRAVEL_MODES = new Set<TravelMode>(['walk', 'metro', 'tram', 'bus', 'taxi', 'shuttle']);

const MODE_WORDS: Partial<Record<TravelMode, string>> = {
  walk: 'Walk',
  metro: 'Metro',
  tram: 'Tram',
  bus: 'Bus',
  taxi: 'Taxi',
  shuttle: 'Shuttle',
};

const MODE_ICONS: Partial<Record<TravelMode, typeof Bus>> = {
  walk: Footprints,
  metro: TrainFront,
  tram: TrainFront,
  bus: Bus,
  taxi: Car,
  shuttle: Bus,
};

/** A transport/transfer item that is a local hop rather than the journey itself. */
function isLocalConnector(item: Item): boolean {
  return (
    (item.type === 'transport' || item.type === 'transfer') &&
    !!item.travel &&
    LOCAL_TRAVEL_MODES.has(item.travel.mode)
  );
}

const WEEKDAY_FULL: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "Sunday 27 September" - the header spells the date out in full; the nav buttons abbreviate. */
function formatFullDate(date: Day['date']): string {
  const parts = date.split('-');
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return `${WEEKDAY_FULL[weekdayOf(date)]} ${day} ${MONTH_FULL[month - 1] ?? ''}`;
}

/** "Sat 26 Sep" -> "Sat 26": all the prev/next buttons have room for. */
function shortNavDate(date: Day['date']): string {
  const [weekday, day] = formatDayLabel(date).split(' ');
  return `${weekday} ${day}`;
}

/** The wall-clock minute of day right now, in the zone the viewed day runs on. */
function nowMinutesInZone(timeZone: string): number {
  const now = new TZDate(new Date(), timeZone);
  return now.getHours() * 60 + now.getMinutes();
}

type TimeGroup = 'morning' | 'afternoon' | 'evening' | 'any';

const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  any: 'Any time',
};

const TIME_GROUP_ORDER: TimeGroup[] = ['morning', 'afternoon', 'evening', 'any'];

/** Which heading an item falls under: an exact time wins, then the fuzzy label, else "Any time". */
function timeGroupOf(item: Item): TimeGroup {
  const minutes = toMinutes(item.time);
  if (minutes !== null) {
    if (minutes < 12 * 60) return 'morning';
    if (minutes < 17 * 60) return 'afternoon';
    return 'evening';
  }
  if (item.timeLabel) return item.timeLabel;
  return 'any';
}

/**
 * "Coach 5 · Seats 73, 74" for the item's travel card - one line, coaches collapsed so a
 * party sitting together does not repeat itself.
 */
function passengerSeatSummary(passengers: Passenger[]): string | null {
  const withSeats = passengers.filter((p) => p.seat || p.coach);
  if (withSeats.length === 0) return null;

  const seatsByCoach = new Map<string, string[]>();
  for (const p of withSeats) {
    const coach = p.coach ?? '';
    const seats = seatsByCoach.get(coach) ?? [];
    if (p.seat) seats.push(p.seat);
    seatsByCoach.set(coach, seats);
  }

  return [...seatsByCoach.entries()]
    .map(([coach, seats]) => {
      const seatPart =
        seats.length > 0 ? `${seats.length > 1 ? 'Seats' : 'Seat'} ${seats.join(', ')}` : '';
      if (coach && seatPart) return `Coach ${coach} · ${seatPart}`;
      return coach ? `Coach ${coach}` : seatPart;
    })
    .join('; ');
}

/**
 * One line in the day, ~48-56px tall by default: icon, time, title, at most one note line,
 * and only the chips that earn their place. Everything else - done/skip/move - is edit
 * machinery, and edit machinery is what made a normal day 2300px tall, so it only appears
 * once `editMode` says the traveller asked for it. Used in edit mode only; the read view
 * below is `CompactRow`.
 */
function ItemRow({
  item,
  bundle,
  isNext,
  editMode,
  onToggle,
  onMove,
}: {
  item: Item;
  bundle: TripBundle;
  isNext: boolean;
  editMode: boolean;
  onToggle: (status: Item['status']) => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const booking = bookingOf(bundle, item);
  const done = item.status === 'done';
  const skipped = item.status === 'skipped';
  const bookingWordText = booking ? bookingWord(booking.status) : null;

  const control = 'rounded-lg border border-slate-300 p-2 text-slate-400 dark:border-slate-600';

  return (
    <div
      className={cn(
        'rounded-xl border',
        isNext
          ? 'border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/30'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
        (done || skipped) && 'opacity-50',
      )}
    >
      <Link
        to={`/t/${bundle.trip.id}/items/${item.id}`}
        className="flex min-h-[48px] items-center gap-2.5 p-2.5"
      >
        <CategoryIcon category={itemCategory(item.type)} size="sm" />
        <div className="w-11 shrink-0 text-right">
          {item.time ? (
            <p className="text-xs font-semibold tabular-nums">
              {item.timeApprox ? '~' : ''}
              {item.time}
            </p>
          ) : item.timeLabel ? (
            <p className="text-[11px] text-slate-400 capitalize">{item.timeLabel}</p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium', done && 'line-through')}>{item.title}</p>
          {item.notes ? (
            <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{item.notes}</p>
          ) : null}
        </div>

        {item.tags.length > 0 || bookingWordText ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {item.tags.map((tag) => (
              <Chip key={tag} tone={TAG_TONES[tag]}>
                {TAG_WORDS[tag]}
              </Chip>
            ))}
            {bookingWordText ? (
              <Chip tone={bookingWordText === 'Booked' ? 'good' : 'warn'}>{bookingWordText}</Chip>
            ) : null}
          </div>
        ) : null}
      </Link>

      {editMode ? (
        <div className="flex items-center gap-1.5 border-t border-slate-100 px-2.5 py-1.5 dark:border-slate-700">
          <button
            type="button"
            aria-label={done ? 'Mark as still to do' : 'Mark as done'}
            onClick={() => {
              if (!done) trackEvent('item_ticked');
              onToggle(done ? 'planned' : 'done');
            }}
            className={cn(
              control,
              done && 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-500',
            )}
          >
            <Check size={15} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={skipped ? 'Put back in the plan' : 'Skip this'}
            onClick={() => onToggle(skipped ? 'planned' : 'skipped')}
            className={cn(
              control,
              skipped && 'border-slate-500 bg-slate-500 text-white dark:border-slate-500',
            )}
          >
            <SkipForward size={15} aria-hidden />
          </button>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Move earlier"
            onClick={() => onMove('up')}
            className={control}
          >
            <ChevronUp size={15} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Move later"
            onClick={() => onMove('down')}
            className={control}
          >
            <ChevronDown size={15} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A row in the read view: time, a status dot, title with at most one note line and its
 * chips, and the category icon. No controls - tapping it opens the item.
 */
function CompactRow({
  item,
  bundle,
  isCurrent,
}: {
  item: Item;
  bundle: TripBundle;
  isCurrent: boolean;
}) {
  const booking = bookingOf(bundle, item);
  const done = item.status === 'done';
  const skipped = item.status === 'skipped';
  const bookingWordText = booking ? bookingWord(booking.status) : null;

  return (
    <Link
      to={`/t/${bundle.trip.id}/items/${item.id}`}
      className={cn(
        'grid grid-cols-[44px_22px_minmax(0,1fr)_32px] items-start gap-x-2.5 py-2.5',
        skipped && 'opacity-50',
      )}
    >
      <span className="pt-px text-right text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
        {/* The section heading already says morning or afternoon; only a real time earns
            the column. */}
        {item.time ? `${item.timeApprox ? '~' : ''}${item.time}` : ''}
      </span>
      <span
        className={cn(
          'mt-px box-border flex h-5 w-5 items-center justify-center rounded-full border-2',
          done
            ? 'border-emerald-400 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-900/40'
            : isCurrent
              ? 'border-brand-600 bg-brand-600 ring-brand-100 dark:ring-brand-900/40 ring-4'
              : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800',
        )}
      >
        {done ? (
          <Check size={12} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
        ) : null}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block font-medium',
            done && 'text-slate-500 line-through dark:text-slate-400',
          )}
        >
          {item.title}
        </span>
        {item.notes ? (
          <span className="mt-0.5 line-clamp-1 block text-sm text-slate-500 dark:text-slate-400">
            {item.notes}
          </span>
        ) : null}
        {item.tags.length > 0 || bookingWordText ? (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <Chip key={tag} tone={TAG_TONES[tag]}>
                {TAG_WORDS[tag]}
              </Chip>
            ))}
            {bookingWordText ? (
              <Chip tone={bookingWordText === 'Booked' ? 'good' : 'warn'}>{bookingWordText}</Chip>
            ) : null}
          </span>
        ) : null}
      </span>
      <CategoryIcon category={itemCategory(item.type)} size="sm" />
    </Link>
  );
}

/** A local hop between two rows: "Walk 6 min", never a tap target of its own. */
function ConnectorLine({ item }: { item: Item }) {
  const mode = item.travel?.mode;
  if (!mode) return null;
  const mins = item.travel?.durationMins ?? item.durationMins;
  const Icon = MODE_ICONS[mode] ?? ArrowRight;
  const label = MODE_WORDS[mode] ?? mode;

  return (
    <div className="grid grid-cols-[44px_22px_minmax(0,1fr)] items-center gap-x-2.5 py-1 text-xs text-slate-500 dark:text-slate-400">
      <span />
      <span className="flex justify-center">
        <span className="h-6 w-0.5 bg-slate-200 dark:bg-slate-600" />
      </span>
      <span className="flex items-center gap-1.5">
        <Icon size={14} aria-hidden />
        {label}
        {mins ? ` ${mins} min` : ''}
      </span>
    </div>
  );
}

/**
 * The whole of adding a line: a title and, optionally, when it starts. Everything else
 * an item can carry is reachable afterwards through Edit, which is the point - a
 * twelve-field form before someone can write down "dinner at 8" is exactly the friction
 * this exists to remove.
 */
function AddItemForm({
  tripId,
  dayId,
  onCancel,
  onAdded,
}: {
  tripId: ID;
  dayId: ID;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Give it a title.');
      return;
    }
    await itemsRepo.add(tripId, dayId, { title: trimmed, time: time === '' ? null : time });
    onAdded();
  };

  return (
    <Card className="mt-2">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Dinner at 8"
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Start time (optional)
          </span>
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className={fieldClass}
          />
        </label>
        {error ? (
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
        ) : null}
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void add()}>
            Add
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}

/** A booked ticket for today: icon, time if there is one, title, straight to the booking. */
function TicketRow({ tripId, booking }: { tripId: ID; booking: Booking }) {
  return (
    <Link
      to={`/t/${tripId}/bookings/${booking.id}`}
      className="-mx-1 flex min-h-[36px] items-center gap-2 rounded-lg px-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
    >
      <CategoryIcon category={bookingCategory(booking.kind)} size="sm" />
      <span className="w-11 shrink-0 text-right text-xs font-semibold text-slate-500 tabular-nums">
        {booking.depart ?? ''}
      </span>
      <span className="min-w-0 flex-1 truncate">{booking.title}</span>
    </Link>
  );
}

/** Everything already booked today: Wallet covers the rest, so this is a short list. */
function TicketsTodayCard({ tripId, tickets }: { tripId: ID; tickets: Booking[] }) {
  if (tickets.length === 0) return null;
  return (
    <Card className="mb-4">
      <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        Tickets today
      </p>
      <div>
        {tickets.map((booking) => (
          <TicketRow key={booking.id} tripId={tripId} booking={booking} />
        ))}
      </div>
    </Card>
  );
}

interface NextUpDetails {
  item: Item;
  label: 'Next' | 'First';
  travelHint: string | null;
  detail: string;
  bookingHref: string;
  directionsUrl: string | null;
}

/**
 * The one thing to do right now (or, off the day itself, the first thing on it): a chip
 * with the time, how far the previous leg was, the category, the title, one line of
 * detail, and the two taps that follow from it - get there, or see the booking.
 */
function NextUpCard({ info }: { info: NextUpDetails }) {
  const { item, label, travelHint, detail, bookingHref, directionsUrl } = info;

  return (
    <Card className="border-brand-200 dark:border-brand-700 mb-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="bg-brand-600 inline-flex h-[22px] items-center rounded-full px-2 text-xs font-semibold whitespace-nowrap text-white">
          {label} · {item.time}
        </span>
        {travelHint ? (
          <span className="text-sm text-slate-500 dark:text-slate-400">{travelHint} from here</span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <CategoryIcon category={itemCategory(item.type)} />
        <div className="min-w-0">
          <p className="font-display text-[22px] leading-[1.15] font-semibold">{item.title}</p>
          {detail ? (
            <p className="mt-0.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          >
            <Navigation size={16} aria-hidden />
            Directions
          </a>
        ) : (
          <span />
        )}
        <Link
          to={bookingHref}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <Ticket size={16} aria-hidden />
          Booking
        </Link>
      </div>
    </Card>
  );
}

/** Where you sleep tonight: the hotel and which night of the stay this is. */
function TonightTile({ accommodation, day }: { accommodation: Accommodation; day: Day }) {
  const nightNumber = daysBetween(accommodation.checkIn, day.date) + 1;
  const totalNights = daysBetween(accommodation.checkIn, accommodation.checkOut);

  return (
    <Card>
      <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#6a4c93] uppercase dark:text-[#c9b3e0]">
        <BedDouble size={15} aria-hidden />
        Tonight
      </div>
      <p className="mt-1.5 leading-tight font-medium">{accommodation.name}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Night {nightNumber} of {totalNights}
      </p>
    </Card>
  );
}

/** The one thing worth knowing about tomorrow before it starts: what's first, and a warning. */
function TomorrowTile({ firstItem, noteLine }: { firstItem: Item; noteLine: string | null }) {
  return (
    <Card>
      <div className="text-brand-600 dark:text-brand-300 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
        <AlertTriangle size={15} aria-hidden />
        Tomorrow
      </div>
      <p className="mt-1.5 leading-tight font-medium">
        {firstItem.title}
        {firstItem.time ? ` at ${firstItem.time}` : ''}
      </p>
      {noteLine ? (
        <p className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{noteLine}</p>
      ) : null}
    </Card>
  );
}

export function DayTimelinePage() {
  const { tripId, dayId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const audit = useAudit(bundle, today);
  const [params, setParams] = useSearchParams();
  const [swapResult, setSwapResult] = useState<DaySwapPlan | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [editMode, setEditMode] = useState(false);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;
  const day = bundle.days.find((d) => d.id === dayId);
  if (!day) return <EmptyState title="No such day." />;

  const active = new Set((params.get('tags') ?? '').split(',').filter(Boolean) as Tag[]);
  const allItems = itemsForDay(bundle, day.id);
  const items =
    active.size === 0 ? allItems : allItems.filter((i) => i.tags.some((t) => active.has(t)));

  const toggleTag = (tag: Tag) => {
    const next = new Set(active);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    if (next.size === 0) params.delete('tags');
    else params.set('tags', [...next].join(','));
    setParams(params, { replace: true });
  };

  const problems = audit.actionable.filter((f) => f.dayId === day.id);
  const swapGroup = bundle.trip.swapGroups?.find((g) => g.dayIds.includes(day.id));
  const swapPartners = orderedDays(bundle).filter(
    (d) => swapGroup?.dayIds.includes(d.id) && d.id !== day.id,
  );

  const ordered = orderedDays(bundle);
  const dayIndex = ordered.findIndex((d) => d.id === day.id);
  const totalIndex = ordered.length - 1;
  const prevDay = dayIndex > 0 ? ordered[dayIndex - 1] : undefined;
  const nextDay =
    dayIndex >= 0 && dayIndex < ordered.length - 1 ? ordered[dayIndex + 1] : undefined;

  // The journey that moves you, not the walk to the station: prefer a booked long-distance
  // leg, then any long-distance leg, and never a walk or a metro hop.
  const leaving = prevDay && prevDay.city !== day.city;
  const longLegs = leaving
    ? allItems.filter((i) => i.travel && i.time && !LOCAL_TRAVEL_MODES.has(i.travel.mode))
    : [];
  const moveItem = longLegs.find((i) => i.bookingId) ?? longLegs[0];
  const checkingOut = bundle.accommodations.find((a) => a.checkOut === day.date);
  const tonight = accommodationForDate(bundle, day.date);
  const tickets = bundle.bookings
    .filter((b) => b.date === day.date && (b.status === 'booked' || b.status === 'confirmed'))
    .sort((a, b) => (a.depart ?? '99:99').localeCompare(b.depart ?? '99:99'));

  // The next (or, off today, the first) timed thing that is not travel itself - a walk or
  // a train is how you get to the thing, not the thing.
  const isToday = day.date === today;
  const timedCandidates = items
    .filter((i) => i.time && i.type !== 'transport' && i.type !== 'transfer')
    .sort((a, b) => (toMinutes(a.time) ?? 0) - (toMinutes(b.time) ?? 0));
  const nowMins = isToday ? nowMinutesInZone(dayTimeZone(bundle.trip, day)) : null;
  const nextUpItem = isToday
    ? timedCandidates.find((i) => (toMinutes(i.time) ?? -1) >= (nowMins ?? 0))
    : timedCandidates[0];

  let nextUpDetails: NextUpDetails | undefined;
  if (nextUpItem) {
    const nextUpBooking = bookingOf(bundle, nextUpItem);
    const nextUpIndex = items.findIndex((i) => i.id === nextUpItem.id);
    const precedingLeg = nextUpIndex > 0 ? items[nextUpIndex - 1] : undefined;
    const legMins = precedingLeg?.travel?.durationMins ?? precedingLeg?.durationMins;
    const travelHint =
      precedingLeg?.travel && legMins ? `${legMins} min by ${precedingLeg.travel.mode}` : null;
    const detail = [
      nextUpBooking ? bookingWord(nextUpBooking.status) : null,
      nextUpItem.orderNotes?.[0] ?? nextUpItem.notes,
    ]
      .filter(Boolean)
      .join(' · ');
    const directionsLink = itemLinks(nextUpItem, day.date, nextUpBooking).find(
      (l) => l.kind === 'directions' || l.kind === 'map',
    );
    nextUpDetails = {
      item: nextUpItem,
      label: isToday ? 'Next' : 'First',
      travelHint,
      detail,
      bookingHref: nextUpBooking
        ? `/t/${bundle.trip.id}/bookings/${nextUpBooking.id}`
        : `/t/${bundle.trip.id}/items/${nextUpItem.id}`,
      directionsUrl: directionsLink?.url ?? null,
    };
  }

  const nextDayItems = nextDay ? itemsForDay(bundle, nextDay.id) : [];
  const tomorrowFirstItem = [...nextDayItems]
    .filter((i) => i.time)
    .sort((a, b) => (toMinutes(a.time) ?? 0) - (toMinutes(b.time) ?? 0))[0];
  const tomorrowNoteItem = nextDayItems.find(
    (i) => i.tags.includes('MUST') || i.type === 'reminder',
  );
  const tomorrowNote = tomorrowNoteItem?.notes ?? tomorrowNoteItem?.title ?? null;

  // Items are in plan order. One with no time of its own belongs with the stop before it:
  // the Colosseum listed after "Hotel to the Colosseum (morning)" is a morning sight, not
  // an "any time" one. Only items before anything is timed fall under Any time.
  const groups = new Map<TimeGroup, Item[]>();
  let carried: TimeGroup = 'any';
  for (const item of items) {
    const own = timeGroupOf(item);
    const group: TimeGroup = own === 'any' ? carried : own;
    carried = group;
    const list = groups.get(group);
    if (list) list.push(item);
    else groups.set(group, [item]);
  }

  return (
    <>
      <PageHeader
        kicker={
          <>
            {formatFullDate(day.date)} · Day {dayIndex} of {totalIndex}
          </>
        }
        title={day.city}
        subtitle={day.theme}
      />

      {checkingOut || moveItem ? (
        <div className="mb-4 space-y-1 text-sm text-slate-500 dark:text-slate-400">
          {checkingOut ? <p>Check out by {checkingOut.checkOutTime ?? '10:00'}</p> : null}
          {moveItem?.travel && prevDay ? (
            <p className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
              <ArrowRight size={14} className="shrink-0 text-slate-400" aria-hidden />
              {prevDay.city} → {day.city} by {moveItem.travel.mode} {moveItem.time}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Edit mode is a different screen - the reading aids give way to the full list below. */}
      {nextUpDetails && !editMode ? <NextUpCard info={nextUpDetails} /> : null}

      {tonight || (tomorrowFirstItem && nextDay) ? (
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          {tonight ? <TonightTile accommodation={tonight} day={day} /> : null}
          {tomorrowFirstItem && nextDay ? (
            <TomorrowTile firstItem={tomorrowFirstItem} noteLine={tomorrowNote} />
          ) : null}
        </div>
      ) : null}

      <TicketsTodayCard tripId={bundle.trip.id} tickets={tickets} />

      {problems.length > 0 ? (
        <Link
          to={`/t/${bundle.trip.id}/conflicts`}
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium dark:border-amber-700 dark:bg-amber-900/30"
        >
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" aria-hidden />
          {problems.length} {problems.length === 1 ? 'thing' : 'things'} to look at
          <ChevronRight
            size={16}
            className="ml-auto text-amber-600 dark:text-amber-400"
            aria-hidden
          />
        </Link>
      ) : null}

      {swapPartners.length > 0 ? (
        <div className="mb-4">
          <Disclosure title="Swap for weather" icon={ArrowLeftRight}>
            <div className="flex flex-wrap gap-2">
              {swapPartners.map((partner) => (
                <Button
                  key={partner.id}
                  onClick={() => {
                    void daysRepo
                      .swapContents(bundle.trip.id, day.id, partner.id)
                      .then((plan) => setSwapResult(plan));
                  }}
                >
                  {formatDayLabel(partner.date)}
                </Button>
              ))}
            </div>
            {swapGroup?.rule ? (
              <p className="mt-2 text-slate-600 dark:text-slate-300">{swapGroup.rule}</p>
            ) : null}
            {swapResult ? (
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                {swapResult.moves.length} items moved.
                {swapResult.heldBack.length > 0
                  ? ` ${swapResult.heldBack.map((h) => h.title).join(', ')} stayed put because ${
                      swapResult.heldBack[0]?.reason === 'booked'
                        ? 'they are already booked'
                        : 'they are pinned to the date'
                    }.`
                  : ''}
              </p>
            ) : null}
          </Disclosure>
        </div>
      ) : null}

      {editMode ? (
        <FilterChips
          label="Filter this day by tag"
          options={TAGS.map((tag) => ({
            value: tag,
            label: tag,
            count: allItems.filter((i) => i.tags.includes(tag)).length,
          }))}
          active={active}
          onToggle={toggleTag}
          onClear={() => {
            params.delete('tags');
            setParams(params, { replace: true });
          }}
        />
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="Nothing matches that filter." />
      ) : editMode ? (
        TIME_GROUP_ORDER.map((group) => {
          const groupItems = groups.get(group);
          if (!groupItems || groupItems.length === 0) return null;
          return (
            <Section key={group} title={TIME_GROUP_LABELS[group]}>
              <div className="space-y-2">
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    bundle={bundle}
                    isNext={item.id === nextUpItem?.id}
                    editMode={editMode}
                    onToggle={(status) => void itemsRepo.setStatus(item.id, status)}
                    onMove={(dir) => void itemsRepo.move(day.id, item.id, dir)}
                  />
                ))}
              </div>
            </Section>
          );
        })
      ) : (
        TIME_GROUP_ORDER.map((group) => {
          const groupItems = groups.get(group);
          if (!groupItems || groupItems.length === 0) return null;
          return (
            <Section key={group} title={TIME_GROUP_LABELS[group]}>
              <Card>
                {groupItems.map((item) =>
                  isLocalConnector(item) ? (
                    <ConnectorLine key={item.id} item={item} />
                  ) : (
                    <CompactRow
                      key={item.id}
                      item={item}
                      bundle={bundle}
                      isCurrent={item.id === nextUpItem?.id}
                    />
                  ),
                )}
              </Card>
            </Section>
          );
        })
      )}

      {editMode ? (
        addingItem ? (
          <AddItemForm
            tripId={bundle.trip.id}
            dayId={day.id}
            onCancel={() => setAddingItem(false)}
            onAdded={() => {
              setAddingItem(false);
              // A new line carries no tags, so under an active filter it would land somewhere
              // the user cannot see. Appearing to swallow what someone just typed is the one
              // thing this must not do, so the filter gives way to the new item.
              if (active.size > 0) {
                params.delete('tags');
                setParams(params, { replace: true });
              }
            }}
          />
        ) : (
          <Button className="mt-2" onClick={() => setAddingItem(true)}>
            <Plus size={15} aria-hidden /> Add an item
          </Button>
        )
      ) : null}

      <div className="mt-4 flex gap-2.5">
        <Link
          to={prevDay ? `/t/${bundle.trip.id}/days/${prevDay.id}` : '#'}
          aria-label="Previous day"
          aria-disabled={!prevDay}
          onClick={(event) => {
            if (!prevDay) event.preventDefault();
          }}
          className={cn(
            'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 font-semibold dark:border-slate-600',
            !prevDay && 'pointer-events-none opacity-30',
          )}
        >
          <ChevronLeft size={16} aria-hidden />
          {prevDay ? shortNavDate(prevDay.date) : ''}
        </Link>
        <Link
          to={nextDay ? `/t/${bundle.trip.id}/days/${nextDay.id}` : '#'}
          aria-label="Next day"
          aria-disabled={!nextDay}
          onClick={(event) => {
            if (!nextDay) event.preventDefault();
          }}
          className={cn(
            'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 font-semibold dark:border-slate-600',
            !nextDay && 'pointer-events-none opacity-30',
          )}
        >
          {nextDay ? shortNavDate(nextDay.date) : ''}
          <ChevronRight size={16} aria-hidden />
        </Link>
        <Button onClick={() => setEditMode((v) => !v)}>
          {editMode ? 'Done editing' : 'Edit day'}
        </Button>
      </div>
    </>
  );
}

/**
 * Everything correctable without touching the seed file. Travel legs, locations, costs
 * and opening hours stay out of reach here - they need their own editors, not this one.
 */
function ItemEditForm({
  item,
  bookings,
  onCancel,
  onSaved,
}: {
  item: Item;
  bookings: Booking[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(item.title);
  const [type, setType] = useState<ItemType>(item.type);
  // Wall-clock strings, exactly as typed. Never routed through a Date or a timezone.
  const [time, setTime] = useState(item.time ?? '');
  const [timeEnd, setTimeEnd] = useState(item.timeEnd ?? '');
  const [timeLabel, setTimeLabel] = useState<TimeLabel | ''>(item.timeLabel ?? '');
  const [approx, setApprox] = useState(item.timeApprox ?? false);
  const [tags, setTags] = useState<Tag[]>(item.tags);
  // A select's value is always a string, so "not linked" is '' here and becomes null on
  // save - never the empty string itself, which several rules and bookingOf test against.
  const [bookingId, setBookingId] = useState(item.bookingId ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const sortedBookings = [...bookings].sort((a, b) => a.date.localeCompare(b.date));

  // The booking outlives the line that pointed at it, so removal touches only this row.
  const remove = async () => {
    if (!window.confirm(`Remove ${item.title}? This cannot be undone.`)) return;
    await itemsRepo.remove(item.id);
    navigate(`/t/${item.tripId}/days/${item.dayId}`);
  };

  const toggleTag = (tag: Tag) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  };

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Give it a title.');
      return;
    }
    await itemsRepo.patch(item.id, {
      title: trimmed,
      type,
      time: time === '' ? null : time,
      timeEnd: timeEnd === '' ? null : timeEnd,
      // Only meaningful once there is no exact time to show instead.
      timeLabel: time === '' ? timeLabel || null : null,
      // The seed marks a time the source notes gave as "~14:00", and the timeline renders
      // that tilde. The checkbox governs it now; with no time there is nothing to be
      // approximate about.
      timeApprox: time === '' ? false : approx,
      tags,
      bookingId: bookingId === '' ? null : bookingId,
      notes,
    });
    onSaved();
  };

  return (
    <Card className="mb-4">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as ItemType)}
            className={fieldClass}
          >
            {ITEM_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Start time</span>
            <input
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
                // A time someone has just typed is an exact one. The checkbox below is
                // right there to say otherwise, so this is a visible default, not a
                // silent rewrite of what they meant.
                setApprox(false);
              }}
              className={fieldClass}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">End time</span>
            <input
              type="time"
              value={timeEnd}
              onChange={(event) => setTimeEnd(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        {time !== '' ? (
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={approx} onChange={() => setApprox(!approx)} />
            Around this time, not exactly
          </label>
        ) : null}

        {time === '' ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Roughly when</span>
            <select
              value={timeLabel}
              onChange={(event) => setTimeLabel(event.target.value as TimeLabel | '')}
              className={fieldClass}
            >
              <option value="">No particular time</option>
              {TIME_LABELS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">Tags</span>
          <div className="flex flex-wrap gap-3">
            {TAGS.map((tag) => (
              <label key={tag} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={tags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Booking</span>
          <select
            value={bookingId}
            onChange={(event) => setBookingId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Not linked</option>
            {sortedBookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.title} · {formatDayLabel(booking.date)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        {error ? (
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
        ) : null}

        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void save()}>
            Save
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
          <span className="flex-1" />
          <Button variant="danger" onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ItemDetailPage() {
  const { tripId, itemId } = useParams();
  const bundle = useTripBundle(tripId);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;
  const item = bundle.items.find((i) => i.id === itemId);
  if (!item) return <EmptyState title="No such item." />;

  const day = bundle.days.find((d) => d.id === item.dayId);
  const booking = bookingOf(bundle, item);
  const guide = matchGuides(item, allGuides)[0]?.guide;
  const links = itemLinks(item, day?.date, booking, guide);
  const seatSummary = booking?.passengers ? passengerSeatSummary(booking.passengers) : null;

  return (
    <>
      <PageHeader
        kicker={day ? `${formatDayLabel(day.date)} · ${day.city}` : undefined}
        title={item.title}
        actions={
          <>
            {!editing ? <Button onClick={() => setEditing(true)}>Edit</Button> : null}
            <Button onClick={() => void navigate(-1)}>Back</Button>
          </>
        }
      />

      <div className="mb-3 flex items-center gap-2">
        <CategoryIcon category={itemCategory(item.type)} />
        {item.time ? (
          <p className="text-lg font-semibold tabular-nums">
            {item.timeApprox ? '~' : ''}
            {item.time}
            {item.timeEnd ? `–${item.timeEnd}` : ''}
          </p>
        ) : item.timeLabel ? (
          <p className="text-sm text-slate-400 capitalize">{item.timeLabel}</p>
        ) : null}
      </div>

      {editing ? (
        <ItemEditForm
          key={item.id}
          item={item}
          bookings={bundle.bookings}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
            <Chip>{item.type}</Chip>
            {item.status !== 'planned' ? <Chip tone="good">{item.status}</Chip> : null}
          </div>

          {item.notes ? (
            <Card className="mb-4">
              <p className="text-sm">{item.notes}</p>
            </Card>
          ) : null}
        </>
      )}

      {item.travel ? (
        <Section title="Journey">
          <Card>
            <p className="font-medium">
              {item.travel.from.name} to {item.travel.to.name}
            </p>
            <p className="text-sm text-slate-500">
              By {item.travel.mode}
              {item.travel.operator ? ` with ${item.travel.operator}` : ''}
              {item.travel.durationMins ? `, about ${item.travel.durationMins} minutes` : ''}
            </p>
            {seatSummary ? <p className="text-sm text-slate-500">{seatSummary}</p> : null}
            {item.travel.seatSide ? (
              <p className="text-brand-700 dark:text-brand-300 mt-1 text-sm font-medium">
                Sit on the {item.travel.seatSide}
                {item.travel.seatSideNote ? `. ${item.travel.seatSideNote}` : ''}
              </p>
            ) : null}
            {item.travel.passCoverage === 'covered' ? (
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                Covered by your pass
              </p>
            ) : item.travel.passCoverage === 'discount' ? (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Discounted by your pass, not free
              </p>
            ) : null}
            {item.travel.platformNote ? (
              <p className="mt-1 text-sm text-slate-500">{item.travel.platformNote}</p>
            ) : null}
            {item.travel.alternatives?.length ? (
              <p className="mt-1 text-sm text-slate-500">
                Alternatives: {item.travel.alternatives.join('; ')}
              </p>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {item.orderNotes?.length ? (
        <Section title="What to order">
          <Card>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {item.orderNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      {item.openingHours ? (
        <Section title="Hours">
          <Card>
            <p className="text-sm">{describeHours(item.openingHours)}</p>
            {item.openingHours.rawText ? (
              <p className="mt-1 text-xs text-slate-400">
                Recorded as "{item.openingHours.rawText}" ({item.openingHours.confidence})
              </p>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {booking ? (
        <Section title="Booking">
          <Link
            to={`/t/${bundle.trip.id}/bookings/${booking.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="font-medium">{booking.title}</p>
            <p className="text-sm text-slate-500">
              {booking.status.replace('_', ' ')} · {booking.date}
            </p>
          </Link>
        </Section>
      ) : null}

      {links.length > 0 ? (
        <Section title="Links">
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <OutLink key={link.url} href={link.url}>
                {link.label}
                <ExternalLink size={13} className="ml-1.5" aria-hidden />
              </OutLink>
            ))}
          </div>
        </Section>
      ) : null}

      {guide ? (
        <Section title="Booking guide">
          <Card>
            <p className="font-medium">{guide.title}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{guide.summary}</p>
            <p className="mt-2 text-sm">{guide.bookAdvice.note}</p>
            <Link
              to={`/playbook/${guide.id}`}
              className="text-brand-700 dark:text-brand-300 mt-2 inline-block text-sm font-medium"
            >
              Read the full guide
            </Link>
          </Card>
        </Section>
      ) : null}

      {item.sourceRef ? (
        <p className="mt-6 text-xs text-slate-400">From your notes: {item.sourceRef}</p>
      ) : null}
    </>
  );
}
