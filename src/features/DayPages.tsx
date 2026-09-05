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
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  SkipForward,
} from 'lucide-react';
import { allGuides } from '@/content/guides';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  Section,
  TagChip,
  OutLink,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { bookingOf, itemsForDay, orderedDays } from '@/domain/bundle';
import { formatDayLabel } from '@/domain/time';
import { daysRepo, itemsRepo } from '@/db/repo';
import { describeHours } from '@/domain/hours';
import { itemLinks } from '@/playbook/deepLinks';
import { matchGuides } from '@/playbook/match';
import { useAudit, useToday, useTripBundle } from '@/hooks/useTrip';
import type { DaySwapPlan } from '@/domain/swap';
import type { Booking, ID, Item, ItemType, Tag, TimeLabel, TripBundle } from '@/domain/types';
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

/** A short word for what kind of thing this is, preferring the actual vehicle. */
function kindLabel(item: Item): string {
  if (item.travel) return item.travel.mode;
  const words: Record<Item['type'], string> = {
    transport: 'travel',
    transfer: 'travel',
    sight: 'see',
    meal: 'eat',
    shop: 'buy',
    admin: 'admin',
    reminder: 'note',
    freeform: '',
  };
  return words[item.type];
}

function ItemRow({
  item,
  bundle,
  isNext,
  onToggle,
  onMove,
}: {
  item: Item;
  bundle: TripBundle;
  isNext: boolean;
  onToggle: (status: Item['status']) => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const booking = bookingOf(bundle, item);
  const done = item.status === 'done';
  const skipped = item.status === 'skipped';

  const control = 'rounded-lg border border-slate-300 p-2 text-slate-400 dark:border-slate-600';

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        isNext
          ? 'border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/30'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
        (done || skipped) && 'opacity-50',
      )}
    >
      <div className="flex gap-3">
        <div className="w-14 shrink-0 pt-0.5 text-right">
          {item.time ? (
            <p className="text-sm font-semibold tabular-nums">
              {item.timeApprox ? '~' : ''}
              {item.time}
            </p>
          ) : item.timeLabel ? (
            <p className="text-xs text-slate-400 capitalize">{item.timeLabel}</p>
          ) : null}
          {item.timeEnd ? (
            <p className="text-xs text-slate-400 tabular-nums">{item.timeEnd}</p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <Link
            to={`/t/${bundle.trip.id}/items/${item.id}`}
            className={cn('font-medium', done && 'line-through')}
          >
            {item.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {kindLabel(item) ? <Chip>{kindLabel(item)}</Chip> : null}
            {item.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
            {booking ? (
              <Chip tone={booking.status === 'to_book' ? 'warn' : 'good'}>
                {booking.status === 'to_book' ? 'to book' : booking.status.replace('_', ' ')}
              </Chip>
            ) : null}
            {item.travel?.seatSide ? <Chip tone="brand">sit {item.travel.seatSide}</Chip> : null}
          </div>
          {item.notes ? (
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{item.notes}</p>
          ) : null}

          <div className="mt-2 flex items-center gap-1.5">
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
        </div>
      </div>
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

export function DayTimelinePage() {
  const { tripId, dayId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const audit = useAudit(bundle, today);
  const [params, setParams] = useSearchParams();
  const [swapResult, setSwapResult] = useState<DaySwapPlan | null>(null);
  const [addingItem, setAddingItem] = useState(false);

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
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              active.has(tag)
                ? 'border-brand-500 bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-100'
                : 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400',
            )}
          >
            {tag}
          </button>
        ))}
        {active.size > 0 ? (
          <Button
            variant="ghost"
            onClick={() => {
              params.delete('tags');
              setParams(params, { replace: true });
            }}
          >
            Show everything
          </Button>
        ) : null}
      </div>

      {problems.length > 0 ? (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30">
          <p className="text-sm font-medium">
            {problems.length} thing{problems.length === 1 ? '' : 's'} to resolve on this day
          </p>
          <Link
            to={`/t/${bundle.trip.id}/conflicts`}
            className="text-brand-700 dark:text-brand-300 text-sm font-medium"
          >
            Open the inbox
          </Link>
        </Card>
      ) : null}

      {swapPartners.length > 0 ? (
        <Card className="mb-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium">
            <ArrowLeftRight size={15} aria-hidden />
            This day can be swapped for the weather
          </p>
          {swapGroup?.rule ? (
            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{swapGroup.rule}</p>
          ) : null}
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
                Swap with {formatDayLabel(partner.date)}
              </Button>
            ))}
          </div>
          {swapResult ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
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
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="Nothing matches that filter.">
          Clear the tags to see the whole day.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              bundle={bundle}
              isNext={item.id === nextItem?.id}
              onToggle={(status) => void itemsRepo.setStatus(item.id, status)}
              onMove={(dir) => void itemsRepo.move(day.id, item.id, dir)}
            />
          ))}
        </div>
      )}

      {addingItem ? (
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
      )}
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
        <Section title="The journey">
          <Card>
            <p className="font-medium">
              {item.travel.from.name} to {item.travel.to.name}
            </p>
            <p className="text-sm text-slate-500">
              By {item.travel.mode}
              {item.travel.operator ? ` with ${item.travel.operator}` : ''}
              {item.travel.durationMins ? `, about ${item.travel.durationMins} minutes` : ''}
            </p>
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
        <Section title="Opening hours">
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
        <Section title="Open elsewhere">
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
        <Section title="How to book this">
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
