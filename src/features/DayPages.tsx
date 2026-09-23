/**
 * The day timeline and the detail view of one item.
 *
 * The timeline is the screen that gets used while standing up, so it carries the tag
 * filter that strips a day back to essentials, the done and skip controls, and the
 * weather swap.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Plus,
  SkipForward,
} from 'lucide-react';
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
import { formatDayLabel, toMinutes } from '@/domain/time';
import { daysRepo, itemsRepo } from '@/db/repo';
import { describeHours } from '@/domain/hours';
import { itemLinks } from '@/playbook/deepLinks';
import { matchGuides } from '@/playbook/match';
import { useAudit, useToday, useTripBundle } from '@/hooks/useTrip';
import { bookingCategory, itemCategory } from '@/domain/categories';
import type { DaySwapPlan } from '@/domain/swap';
import type {
  Booking,
  Day,
  ID,
  Item,
  ItemType,
  Passenger,
  Tag,
  TimeLabel,
  TripBundle,
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
 * once `editMode` says the traveller asked for it.
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
            onClick={() => onToggle(done ? 'planned' : 'done')}
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

/**
 * The one thing this screen was missing: where you sleep tonight, and what is already
 * booked today. Everything else on the day is negotiable; these two things are not, so
 * they sit above the fold instead of buried in a 2300px scroll.
 */
function DaySummaryCard({
  bundle,
  day,
  prevDay,
}: {
  bundle: TripBundle;
  day: Day;
  prevDay: Day | undefined;
}) {
  const tonight = accommodationForDate(bundle, day.date);
  const checkingOut = bundle.accommodations.find((a) => a.checkOut === day.date);
  const leaving = prevDay && prevDay.city !== day.city;
  const moveItem = leaving
    ? itemsForDay(bundle, day.id).find((i) => i.travel && i.time)
    : undefined;
  const tickets = bundle.bookings.filter(
    (b) => b.date === day.date && (b.status === 'booked' || b.status === 'confirmed'),
  );

  if (!tonight && !checkingOut && !moveItem && tickets.length === 0) return null;

  return (
    <Card className="mb-4">
      <div className="space-y-2.5">
        {checkingOut ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Check out by {checkingOut.checkOutTime ?? '10:00'}
          </p>
        ) : null}

        {moveItem?.travel && prevDay ? (
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <ArrowRight size={14} className="shrink-0 text-slate-400" aria-hidden />
            {prevDay.city} → {day.city} by {moveItem.travel.mode} {moveItem.time}
          </p>
        ) : null}

        {tonight ? (
          <div className="flex items-center gap-2">
            <CategoryIcon category="stay" size="sm" />
            <p className="min-w-0 text-sm">
              <span className="font-medium">Tonight: {tonight.name}</span>
              {tonight.checkIn === day.date && tonight.checkInTime ? (
                <span className="text-slate-500 dark:text-slate-400">
                  {' '}
                  · check-in from {tonight.checkInTime}
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        {tickets.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Tickets today
            </p>
            <div>
              {tickets.map((booking) => (
                <TicketRow key={booking.id} tripId={bundle.trip.id} booking={booking} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
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

  const nextItem = day.date === today ? items.find((i) => i.status === 'planned') : undefined;
  const problems = audit.actionable.filter((f) => f.dayId === day.id);
  const swapGroup = bundle.trip.swapGroups?.find((g) => g.dayIds.includes(day.id));
  const swapPartners = orderedDays(bundle).filter(
    (d) => swapGroup?.dayIds.includes(d.id) && d.id !== day.id,
  );

  const ordered = orderedDays(bundle);
  const dayIndex = ordered.findIndex((d) => d.id === day.id);
  const prevDay = dayIndex > 0 ? ordered[dayIndex - 1] : undefined;
  const nextDay =
    dayIndex >= 0 && dayIndex < ordered.length - 1 ? ordered[dayIndex + 1] : undefined;

  const groups = new Map<TimeGroup, Item[]>();
  for (const item of items) {
    const group = timeGroupOf(item);
    const list = groups.get(group);
    if (list) list.push(item);
    else groups.set(group, [item]);
  }

  return (
    <>
      <PageHeader
        title={formatDayLabel(day.date)}
        subtitle={
          <>
            {day.city}
            {day.theme ? ` · ${day.theme}` : ''}
          </>
        }
        actions={
          <>
            <Link
              to={prevDay ? `/t/${bundle.trip.id}/days/${prevDay.id}` : '#'}
              aria-label="Previous day"
              aria-disabled={!prevDay}
              onClick={(event) => {
                if (!prevDay) event.preventDefault();
              }}
              className={cn(
                'inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600',
                !prevDay && 'pointer-events-none opacity-30',
              )}
            >
              <ChevronLeft size={16} aria-hidden />
            </Link>
            <Link
              to={nextDay ? `/t/${bundle.trip.id}/days/${nextDay.id}` : '#'}
              aria-label="Next day"
              aria-disabled={!nextDay}
              onClick={(event) => {
                if (!nextDay) event.preventDefault();
              }}
              className={cn(
                'inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600',
                !nextDay && 'pointer-events-none opacity-30',
              )}
            >
              <ChevronRight size={16} aria-hidden />
            </Link>
            <Button onClick={() => setEditMode((v) => !v)}>
              {editMode ? 'Done editing' : 'Edit day'}
            </Button>
          </>
        }
      />

      <DaySummaryCard bundle={bundle} day={day} prevDay={prevDay} />

      {problems.length > 0 ? (
        <Link
          to={`/t/${bundle.trip.id}/conflicts`}
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium dark:border-amber-700 dark:bg-amber-900/30"
        >
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" aria-hidden />
          {problems.length} to resolve
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
      ) : (
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
                    isNext={item.id === nextItem?.id}
                    editMode={editMode}
                    onToggle={(status) => void itemsRepo.setStatus(item.id, status)}
                    onMove={(dir) => void itemsRepo.move(day.id, item.id, dir)}
                  />
                ))}
              </div>
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
        title={item.title}
        subtitle={day ? `${formatDayLabel(day.date)} · ${day.city}` : undefined}
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
          <p className="text-sm font-semibold tabular-nums">
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
