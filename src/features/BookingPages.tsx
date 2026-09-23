/**
 * The bookings board, the book-by queue, and one booking in detail.
 *
 * This is the screen that replaces the pile of confirmation emails, and the guide card is
 * what replaces searching for "is X worth booking in advance". The board groups by date,
 * not status - a traveller thinks "what's happening Tuesday", not "what's still on_site" -
 * with anything still to book pulled into one callout up top instead of its own section.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, Check, Copy, ExternalLink, Paperclip, Plus, X } from 'lucide-react';
import { allGuides } from '@/content/guides';
import {
  Button,
  Card,
  CategoryIcon,
  Chip,
  Disclosure,
  EmptyState,
  Fact,
  FilterChips,
  LinkCard,
  OutLink,
  PageHeader,
  Section,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { bookingsRepo } from '@/db/repo';
import { itemsOfBooking } from '@/domain/bundle';
import { bookingCategory, type Category } from '@/domain/categories';
import { daysBetween, formatDayLabel } from '@/domain/time';
import { AttachDocumentButton, DocumentRow } from '@/features/DocumentPages';
import { GuideCard } from '@/features/PlaybookPages';
import { bookingLinks, placeUrl } from '@/playbook/deepLinks';
import { matchGuides } from '@/playbook/match';
import { bookBy } from '@/playbook/bookBy';
import { useBookBy, useDocumentsFor, useToday, useTripBundle } from '@/hooks/useTrip';
import type {
  Accommodation,
  Booking,
  BookingKind,
  BookingStatus,
  ID,
  Passenger,
} from '@/domain/types';
import type { BookByEntry } from '@/playbook/bookBy';

const STATUS_WORDS: Record<BookingStatus, string> = {
  to_book: 'Still to book',
  booked: 'Booked',
  confirmed: 'Confirmed',
  on_site: 'Pay on the day',
  not_needed: 'Nothing to book',
  cancelled: 'Cancelled',
};

/** The board row's status chip uses shorter, plainer words than the full status list -
 * there is no room on a 56px row for "Confirmed" and "Nothing to book" both to fit. */
const ROW_STATUS_WORDS: Record<BookingStatus, string> = {
  to_book: 'Still to book',
  booked: 'Booked',
  confirmed: 'Booked',
  on_site: 'Buy on the day',
  not_needed: 'Not needed',
  cancelled: 'Cancelled',
};

/** The categories a booking can actually be filtered by on the board - "note" (kind
 * `other`) has no chip of its own and just shows up under every filter that isn't active. */
const CATEGORY_FILTERS: Array<{ value: Category; label: string }> = [
  { value: 'transport', label: 'Transport' },
  { value: 'stay', label: 'Hotels' },
  { value: 'activity', label: 'Sightseeing' },
  { value: 'food', label: 'Food' },
  { value: 'pass', label: 'Passes' },
];

const BOOKING_KINDS: BookingKind[] = [
  'flight',
  'train',
  'regional-train',
  'international-train',
  'ferry',
  'mountain-railway',
  'gondola',
  'bus',
  'hotel',
  'restaurant',
  'attraction',
  'pass',
  'city-card',
  'other',
];

const BOOKING_STATUSES: BookingStatus[] = [
  'to_book',
  'booked',
  'confirmed',
  'on_site',
  'not_needed',
  'cancelled',
];

const fieldClass =
  'w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800';

/** "Coach 5 · Seat 74", falling back to whichever half is actually known. */
function passengerSeatLine(passenger: Passenger): string | null {
  if (passenger.coach && passenger.seat) return `Coach ${passenger.coach} · Seat ${passenger.seat}`;
  if (passenger.coach) return `Coach ${passenger.coach}`;
  if (passenger.seat) return `Seat ${passenger.seat}`;
  return null;
}

function statusTone(status: BookingStatus) {
  if (status === 'to_book') return 'warn' as const;
  if (status === 'cancelled') return 'bad' as const;
  if (status === 'booked' || status === 'confirmed') return 'good' as const;
  return 'neutral' as const;
}

function urgencyLabel(entry: BookByEntry): {
  text: string;
  tone: 'bad' | 'warn' | 'neutral' | 'good';
} {
  const { urgency, daysLeft, date } = entry.result;
  switch (urgency) {
    case 'overdue':
      return { text: `${Math.abs(daysLeft ?? 0)} days past the sensible date`, tone: 'bad' };
    case 'now':
      return { text: `Book within ${daysLeft} days`, tone: 'warn' };
    case 'soon':
      return { text: `Book by ${date}`, tone: 'neutral' };
    case 'on-site':
      return { text: 'Buy it on the day', tone: 'neutral' };
    case 'done':
      return { text: 'Sorted', tone: 'good' };
    default:
      return { text: date ? `Book by ${date}` : 'No deadline', tone: 'neutral' };
  }
}

/**
 * The whole of adding a booking: title, date, kind, status and the confirmation code -
 * nothing about the trip itself. It is not linked to any item; that stays a job for later.
 */
function AddBookingForm({
  tripId,
  onCancel,
  onAdded,
}: {
  tripId: ID;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<BookingKind>('other');
  const [status, setStatus] = useState<BookingStatus>('to_book');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A live preview, not a saved booking, so the advice shows up while someone is still
  // typing. The cast holds because `matchGuides` reads a booking through `isBooking`,
  // which only tests for `kind` and `status`, and guards every other field it touches. If
  // it ever needs something required, this is where that breaks - the guide-match test
  // covers it.
  const draftGuide = title.trim()
    ? matchGuides({ title, kind, status } as Booking, allGuides)[0]?.guide
    : undefined;

  const add = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Give it a title.');
      return;
    }
    if (!date) {
      setError('Give it a date.');
      return;
    }
    await bookingsRepo.add(tripId, {
      title: trimmedTitle,
      date,
      kind,
      status,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
    });
    onAdded();
  };

  return (
    <Card className="mb-4">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Frecciarossa to Florence"
            className={fieldClass}
          />
        </label>

        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Kind</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as BookingKind)}
              className={fieldClass}
            >
              {BOOKING_KINDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as BookingStatus)}
            className={fieldClass}
          >
            {BOOKING_STATUSES.map((option) => (
              <option key={option} value={option}>
                {STATUS_WORDS[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Reference (optional)
          </span>
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Confirmation code"
            className={fieldClass}
          />
        </label>

        {draftGuide ? (
          <Link
            to={`/playbook/${draftGuide.id}`}
            className="block rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-700/50"
          >
            <p className="font-medium">{draftGuide.title}</p>
            <p className="text-slate-500 dark:text-slate-400">{draftGuide.bookAdvice.note}</p>
          </Link>
        ) : null}

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

/** `26 Sep`, the weekday dropped - a board row already sits under a dated header that
 * carries it. */
function shortDate(date: string): string {
  return formatDayLabel(date).split(' ').slice(1).join(' ');
}

/** The one line of "when" a board row has room for: a time pair for anything timed, a
 * check-in date and a night count for a hotel, nothing at all for a booking with neither. */
function boardTimeLine(booking: Booking, accommodation?: Accommodation): string | null {
  if (booking.kind === 'hotel') {
    const checkIn = accommodation?.checkIn ?? booking.date;
    const checkOut = accommodation?.checkOut ?? booking.endDate;
    const nights = checkOut ? daysBetween(checkIn, checkOut) : null;
    return nights != null
      ? `Check-in ${shortDate(checkIn)} · ${nights} night${nights === 1 ? '' : 's'}`
      : `Check-in ${shortDate(checkIn)}`;
  }
  if (booking.depart && booking.arrive) return `${booking.depart} → ${booking.arrive}`;
  return booking.depart ?? null;
}

interface DateGroup {
  date: string;
  entries: BookByEntry[];
}

/** Board rows read top to bottom by date, the order a traveller actually needs things in
 * - not by booking status, which was the old layout's whole problem. */
function groupByDate(entries: BookByEntry[]): DateGroup[] {
  const byDate = new Map<string, BookByEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.booking.date) ?? [];
    list.push(entry);
    byDate.set(entry.booking.date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      entries: [...list].sort((a, b) =>
        (a.booking.depart ?? '').localeCompare(b.booking.depart ?? ''),
      ),
    }));
}

/** One line per booking: the category badge carries most of the meaning, the time or
 * check-in says whether it needs attention today, and the paperclip says whether the
 * ticket is already on the phone. Aims for well under 60px, not a card with big padding. */
function BookingRow({
  tripId,
  entry,
  accommodation,
  documentCount,
}: {
  tripId: ID;
  entry: BookByEntry;
  accommodation?: Accommodation;
  documentCount: number;
}) {
  const { booking } = entry;
  const timeLine = boardTimeLine(booking, accommodation);
  return (
    <Link
      to={`/t/${tripId}/bookings/${booking.id}`}
      className="hover:border-brand-400 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800"
    >
      <CategoryIcon category={bookingCategory(booking.kind)} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{booking.title}</p>
        {timeLine ? <p className="truncate text-xs text-slate-500">{timeLine}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {documentCount > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
            <Paperclip size={12} aria-hidden /> {documentCount}
          </span>
        ) : null}
        <Chip tone={statusTone(booking.status)}>{ROW_STATUS_WORDS[booking.status]}</Chip>
      </div>
    </Link>
  );
}

/** Everything still needing a booking, in one glance - not a full section of its own,
 * since a section per status is what made the old board four thousand pixels tall. */
function StillToBookCallout({ tripId, entries }: { tripId: ID; entries: BookByEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <Card className="mb-4 border-amber-300 dark:border-amber-700">
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-200">
        <AlertTriangle size={14} aria-hidden /> Still to book ({entries.length})
      </p>
      <div>
        {entries.map((entry) => {
          const label = urgencyLabel(entry);
          return (
            <Link
              key={entry.booking.id}
              to={`/t/${tripId}/bookings/${entry.booking.id}`}
              className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
            >
              <span className="min-w-0 truncate">{entry.booking.title}</span>
              <span className="shrink-0 text-xs text-amber-700 dark:text-amber-300">
                {label.text}
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

export function BookingsBoardPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const entries = useBookBy(bundle, today);
  const [addingBooking, setAddingBooking] = useState(false);
  const [params, setParams] = useSearchParams();

  if (!bundle) return <p className="text-slate-500">Loading.</p>;

  const activeParam = params.get('category');
  const active = new Set<Category>(
    activeParam && CATEGORY_FILTERS.some((f) => f.value === activeParam)
      ? [activeParam as Category]
      : [],
  );

  const toggleCategory = (value: Category) => {
    if (params.get('category') === value) params.delete('category');
    else params.set('category', value);
    setParams(params, { replace: true });
  };
  const clearCategory = () => {
    params.delete('category');
    setParams(params, { replace: true });
  };

  const filtered =
    active.size === 0
      ? entries
      : entries.filter((e) => active.has(bookingCategory(e.booking.kind)));
  const stillToBook = filtered.filter((e) => e.booking.status === 'to_book');
  const groups = groupByDate(filtered);

  const accommodationByBookingId = new Map(
    bundle.accommodations.filter((a) => a.bookingId).map((a) => [a.bookingId as ID, a]),
  );
  const documentCountByBookingId = new Map<ID, number>();
  for (const doc of bundle.documents) {
    if (doc.attachedTo?.kind !== 'booking') continue;
    documentCountByBookingId.set(
      doc.attachedTo.id,
      (documentCountByBookingId.get(doc.attachedTo.id) ?? 0) + 1,
    );
  }

  return (
    <>
      <PageHeader
        title="Bookings"
        actions={
          !addingBooking ? (
            <Button variant="primary" onClick={() => setAddingBooking(true)}>
              <Plus size={15} aria-hidden /> New
            </Button>
          ) : undefined
        }
      />

      {addingBooking ? (
        <AddBookingForm
          tripId={bundle.trip.id}
          onCancel={() => setAddingBooking(false)}
          onAdded={() => setAddingBooking(false)}
        />
      ) : null}

      <FilterChips
        label="Filter by category"
        options={CATEGORY_FILTERS.map((f) => ({
          value: f.value,
          label: f.label,
          count: entries.filter((e) => bookingCategory(e.booking.kind) === f.value).length,
        }))}
        active={active}
        onToggle={toggleCategory}
        onClear={clearCategory}
      />

      <StillToBookCallout tripId={bundle.trip.id} entries={stillToBook} />

      {groups.length === 0 ? (
        <EmptyState title="Nothing here yet.">
          {active.size > 0 ? 'Nothing in this category.' : 'Add a booking to get started.'}
        </EmptyState>
      ) : (
        groups.map((group) => {
          const city = bundle.days.find((d) => d.date === group.date)?.city;
          return (
            <div key={group.date} className="mb-4">
              <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {formatDayLabel(group.date)}
                {city ? ` · ${city}` : ''}
              </h2>
              <div className="space-y-1.5">
                {group.entries.map((entry) => (
                  <BookingRow
                    key={entry.booking.id}
                    tripId={bundle.trip.id}
                    entry={entry}
                    accommodation={accommodationByBookingId.get(entry.booking.id)}
                    documentCount={documentCountByBookingId.get(entry.booking.id) ?? 0}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

/**
 * Everything correctable about a booking already captured, mirroring ItemEditForm's
 * shape: Save and Cancel on the left, Delete pushed to the right since it is a different
 * kind of action from the rest of the form.
 */
function BookingEditForm({
  booking,
  onCancel,
  onSaved,
}: {
  booking: Booking;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(booking.title);
  const [date, setDate] = useState(booking.date);
  const [kind, setKind] = useState<BookingKind>(booking.kind);
  const [status, setStatus] = useState<BookingStatus>(booking.status);
  const [reference, setReference] = useState(booking.reference ?? '');
  const [notes, setNotes] = useState(booking.notes ?? '');
  const [passengers, setPassengers] = useState<Passenger[]>(booking.passengers ?? []);
  const [error, setError] = useState<string | null>(null);

  const addPassenger = () => setPassengers((current) => [...current, { name: '' }]);
  const removePassenger = (index: number) =>
    setPassengers((current) => current.filter((_, i) => i !== index));
  const updatePassenger = (index: number, patch: Partial<Passenger>) =>
    setPassengers((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  // Removing unlinks every item that pointed here and leaves documents alone - the
  // traveller needs to know that before confirming, not discover it afterwards.
  const remove = async () => {
    if (
      !window.confirm(
        `Remove ${booking.title}? Any item linked to it stays, and any document filed against it stays in the vault.`,
      )
    ) {
      return;
    }
    await bookingsRepo.remove(booking.id);
    navigate(`/t/${booking.tripId}/bookings`);
  };

  const save = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Give it a title.');
      return;
    }
    if (!date) {
      setError('Give it a date.');
      return;
    }
    // A row someone started and abandoned - name still blank - is dropped rather than
    // blocking the whole save. Everything else about a passenger is optional, so trimming
    // is the only cleanup a kept row needs.
    const cleanedPassengers: Passenger[] = passengers
      .map((p) => ({
        name: p.name.trim(),
        ...(p.seat?.trim() ? { seat: p.seat.trim() } : {}),
        ...(p.coach?.trim() ? { coach: p.coach.trim() } : {}),
        ...(p.ticketNumber?.trim() ? { ticketNumber: p.ticketNumber.trim() } : {}),
        ...(p.note?.trim() ? { note: p.note.trim() } : {}),
      }))
      .filter((p) => p.name !== '');
    await bookingsRepo.patch(booking.id, {
      title: trimmedTitle,
      date,
      kind,
      status,
      // An empty string, not undefined: Dexie's update does not reliably drop a key when
      // handed undefined, so clearing the field this way could leave the old value behind.
      reference,
      notes,
      passengers: cleanedPassengers,
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

        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Kind</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as BookingKind)}
              className={fieldClass}
            >
              {BOOKING_KINDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as BookingStatus)}
            className={fieldClass}
          >
            {BOOKING_STATUSES.map((option) => (
              <option key={option} value={option}>
                {STATUS_WORDS[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Reference</span>
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Confirmation code"
            className={fieldClass}
          />
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

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">Passengers</span>
          <div className="space-y-2">
            {passengers.map((passenger, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-600"
              >
                <div className="flex gap-2">
                  <input
                    value={passenger.name}
                    onChange={(event) => updatePassenger(index, { name: event.target.value })}
                    placeholder="Name"
                    aria-label="Passenger name"
                    className={fieldClass}
                  />
                  <Button variant="ghost" onClick={() => removePassenger(index)}>
                    <X size={15} aria-hidden />
                    <span className="sr-only">Remove passenger</span>
                  </Button>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={passenger.coach ?? ''}
                    onChange={(event) => updatePassenger(index, { coach: event.target.value })}
                    placeholder="Coach"
                    aria-label="Coach"
                    className={fieldClass}
                  />
                  <input
                    value={passenger.seat ?? ''}
                    onChange={(event) => updatePassenger(index, { seat: event.target.value })}
                    placeholder="Seat"
                    aria-label="Seat"
                    className={fieldClass}
                  />
                </div>
                <input
                  value={passenger.ticketNumber ?? ''}
                  onChange={(event) => updatePassenger(index, { ticketNumber: event.target.value })}
                  placeholder="Ticket number"
                  aria-label="Ticket number"
                  className={cn(fieldClass, 'mt-2')}
                />
                <input
                  value={passenger.note ?? ''}
                  onChange={(event) => updatePassenger(index, { note: event.target.value })}
                  placeholder="Note"
                  aria-label="Passenger note"
                  className={cn(fieldClass, 'mt-2')}
                />
              </div>
            ))}
          </div>
          <Button className="mt-2" onClick={addPassenger}>
            <Plus size={15} aria-hidden /> Add passenger
          </Button>
        </div>

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

/** One row per traveller named on the ticket, compact enough to sit above the fold. */
function PassengersCard({ passengers }: { passengers: Passenger[] }) {
  return (
    <Section title="Passengers">
      <Card>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {passengers.map((passenger, index) => {
            const seatLine = passengerSeatLine(passenger);
            return (
              <div key={index} className={index > 0 ? 'pt-2' : undefined}>
                <p className="font-medium">{passenger.name}</p>
                {seatLine ? <p className="text-sm text-slate-500">{seatLine}</p> : null}
                {passenger.ticketNumber ? (
                  <p className="font-mono text-xs text-slate-400">{passenger.ticketNumber}</p>
                ) : null}
                {passenger.note ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">{passenger.note}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </Section>
  );
}

/** The one fact worth reading out at a desk, large enough to read at arm's length, with
 * a Copy button so it never has to be retyped off a phone screen. */
function ReferenceFact({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(reference);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          Reference
        </p>
        <p className="truncate font-mono text-lg font-semibold">{reference}</p>
      </div>
      <Button onClick={() => void copy()}>
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

/**
 * The first screen a traveller needs at a barrier or a front desk: when, where, the
 * reference to read out, and who to blame if it goes wrong. A hotel gets check-in/out and
 * an address instead of a depart/arrive pair.
 */
function KeyFactsCard({
  booking,
  accommodation,
}: {
  booking: Booking;
  accommodation?: Accommodation;
}) {
  const isHotel = booking.kind === 'hotel';
  const providerLine = [booking.operator, booking.provider].filter(Boolean).join(' via ');

  return (
    <Card className="mb-4">
      <div className="space-y-3">
        {isHotel ? (
          <>
            <Fact
              label="Check-in"
              value={`${formatDayLabel(accommodation?.checkIn ?? booking.date)}${
                accommodation?.checkInTime ? ` · ${accommodation.checkInTime}` : ''
              }`}
            />
            <Fact
              label="Check-out"
              value={`${formatDayLabel(accommodation?.checkOut ?? booking.endDate ?? booking.date)}${
                accommodation?.checkOutTime ? ` · ${accommodation.checkOutTime}` : ''
              }`}
            />
            {accommodation?.place ? (
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                  Address
                </p>
                <p className="text-sm">{accommodation.place.address ?? accommodation.place.name}</p>
                <OutLink href={placeUrl(accommodation.place)}>
                  Open in Maps <ExternalLink size={13} className="ml-1.5" aria-hidden />
                </OutLink>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <Fact
              label="When"
              value={
                booking.depart
                  ? `${formatDayLabel(booking.date)} · ${booking.depart}${
                      booking.arrive ? ` → ${booking.arrive}` : ''
                    }${
                      booking.arriveDate && booking.arriveDate !== booking.date
                        ? ` (arrives ${formatDayLabel(booking.arriveDate)})`
                        : ''
                    }`
                  : formatDayLabel(booking.date)
              }
            />
            {booking.from && booking.to ? (
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                  Route
                </p>
                <p className="text-sm">
                  {booking.from.name} → {booking.to.name}
                </p>
                <OutLink href={placeUrl(booking.to)}>
                  {booking.to.name} on the map{' '}
                  <ExternalLink size={13} className="ml-1.5" aria-hidden />
                </OutLink>
              </div>
            ) : null}
          </>
        )}

        {booking.reference ? <ReferenceFact reference={booking.reference} /> : null}
        {providerLine ? <Fact label="Operator" value={providerLine} /> : null}
      </div>
    </Card>
  );
}

/** The booking's own refundable/changeable facts, in plain words - not the playbook's
 * generic fare-class advice, which has no idea which fare this particular booking is. */
function refundWords(booking: Booking): string | null {
  const bits: string[] = [];
  if (booking.refundable != null) bits.push(booking.refundable ? 'Refundable' : 'Not refundable');
  if (booking.changeable != null) {
    bits.push(booking.changeable ? 'can be changed' : 'cannot be changed');
  }
  return bits.length > 0 ? `${bits.join(', ')}.` : null;
}

export function BookingDetailPage() {
  const { tripId, bookingId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const navigate = useNavigate();
  const documents = useDocumentsFor('booking', bookingId);
  const [editing, setEditing] = useState(false);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;
  const booking = bundle.bookings.find((b) => b.id === bookingId);
  if (!booking) return <EmptyState title="No such booking." />;

  const accommodation = bundle.accommodations.find((a) => a.bookingId === booking.id);
  const guide = matchGuides(booking, allGuides)[0]?.guide;
  const result = bookBy(booking, allGuides, today);
  const links = bookingLinks(booking, guide);
  const linked = itemsOfBooking(bundle, booking.id);
  const refundLine = refundWords(booking);

  const setStatus = (status: BookingStatus) => void bookingsRepo.setStatus(booking.id, status);

  return (
    <>
      <PageHeader
        title={booking.title}
        subtitle={`${formatDayLabel(booking.date)}${booking.depart ? ` at ${booking.depart}` : ''}`}
        actions={
          <>
            {!editing ? <Button onClick={() => setEditing(true)}>Edit</Button> : null}
            <Button onClick={() => void navigate(-1)}>Back</Button>
          </>
        }
      />

      {editing ? (
        <BookingEditForm
          key={booking.id}
          booking={booking}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <>
          <KeyFactsCard booking={booking} accommodation={accommodation} />

          {booking.passengers?.length ? <PassengersCard passengers={booking.passengers} /> : null}

          <Section title="Documents">
            <div className="mb-2">
              <AttachDocumentButton
                tripId={bundle.trip.id}
                attachedTo={{ kind: 'booking', id: booking.id }}
                label="Attach a ticket or confirmation"
              />
            </div>
            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nothing filed against this booking yet.</p>
            )}
          </Section>

          {booking.notes ? (
            <Section title="Notes">
              <Card>
                <p className="text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                  {booking.notes}
                </p>
              </Card>
            </Section>
          ) : null}

          {refundLine ? (
            <p
              className={cn(
                'mb-4 text-sm font-medium',
                booking.refundable === false
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-slate-600 dark:text-slate-300',
              )}
            >
              {refundLine}
            </p>
          ) : null}

          <div className="mb-4 space-y-2">
            <Disclosure title="Change booking status">
              <div className="flex flex-wrap gap-2">
                {(
                  ['to_book', 'booked', 'confirmed', 'on_site', 'not_needed'] as BookingStatus[]
                ).map((status) => (
                  <Button
                    key={status}
                    variant={booking.status === status ? 'primary' : 'secondary'}
                    onClick={() => setStatus(status)}
                  >
                    {STATUS_WORDS[status]}
                  </Button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip tone={statusTone(booking.status)}>{STATUS_WORDS[booking.status]}</Chip>
                {result.date ? <Chip>Book by {result.date}</Chip> : <Chip>Bought on the day</Chip>}
                {result.opensOn ? <Chip>On sale from {result.opensOn}</Chip> : null}
              </div>
            </Disclosure>

            {guide ? (
              <Disclosure title="Booking tips">
                <GuideCard guideId={guide.id} refundable={booking.refundable ?? null} hideTitle />
              </Disclosure>
            ) : null}

            {links.length > 0 ? (
              <Disclosure title="Open elsewhere">
                <div className="flex flex-wrap gap-2">
                  {links
                    .filter((link, i) => links.findIndex((l) => l.url === link.url) === i)
                    .map((link) => (
                      <OutLink key={link.url} href={link.url}>
                        {link.label}
                        <ExternalLink size={13} className="ml-1.5" aria-hidden />
                      </OutLink>
                    ))}
                </div>
              </Disclosure>
            ) : null}

            {linked.length > 0 ? (
              <Disclosure title="On these days">
                <div className="space-y-2">
                  {linked.map((item) => {
                    const day = bundle.days.find((d) => d.id === item.dayId);
                    return (
                      <LinkCard key={item.id} to={`/t/${bundle.trip.id}/items/${item.id}`}>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-slate-500">
                          {day ? formatDayLabel(day.date) : ''} {item.time ?? ''}
                        </p>
                      </LinkCard>
                    );
                  })}
                </div>
              </Disclosure>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}

export type { Booking };
