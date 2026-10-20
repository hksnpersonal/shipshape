/**
 * The Wallet: every ticket, pass and booking in one board, and one booking in detail.
 *
 * The board leads with what is actually coming up - a handful of pass-styled cards for
 * the next few days, plain rows for the rest - with everything still to book folded into
 * one line instead of its own section, and everything already past tucked out of the way.
 * The detail screen is shaped by what the booking actually is: a ticket wants a departure
 * and arrival, a hotel wants a check-in and an address, and everything else gets the same
 * plain facts. The guide card is what replaces searching for "is X worth booking in
 * advance".
 */
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  MapPin,
  Paperclip,
  Plus,
  X,
} from 'lucide-react';
import { allGuides } from '@/content/guides';
import {
  Button,
  Card,
  CategoryIcon,
  Chip,
  Disclosure,
  EmptyState,
  Fact,
  LinkCard,
  OutLink,
  PageHeader,
  Section,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { bookingsRepo } from '@/db/repo';
import { itemsOfBooking } from '@/domain/bundle';
import { bookingCategory, CATEGORY_META, type Category } from '@/domain/categories';
import { daysBetween, formatDayLabel, toMinutes } from '@/domain/time';
import { AttachDocumentButton, DocumentRow } from '@/features/DocumentPages';
import { GuideCard } from '@/features/PlaybookPages';
import { bookingLinks, placeUrl } from '@/playbook/deepLinks';
import { matchGuides } from '@/playbook/match';
import { bookBy } from '@/playbook/bookBy';
import { useAudit, useBookBy, useDocumentsFor, useToday, useTripBundle } from '@/hooks/useTrip';
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

/** The board's status chip uses shorter, plainer words than the full status list -
 * there is no room on a compact row or a pass card for "Confirmed" and "Nothing to book"
 * both to fit. */
const ROW_STATUS_WORDS: Record<BookingStatus, string> = {
  to_book: 'Still to book',
  booked: 'Booked',
  confirmed: 'Booked',
  on_site: 'Buy on the day',
  not_needed: 'Not needed',
  cancelled: 'Cancelled',
};

/** The plain word for what a booking actually is, used on the pass card's tinted header -
 * coarser than the full kind list, which is too precise to read at a glance. */
const KIND_WORDS: Record<BookingKind, string> = {
  flight: 'Flight',
  train: 'Train',
  'regional-train': 'Train',
  'international-train': 'Train',
  ferry: 'Ferry',
  'mountain-railway': 'Mountain railway',
  gondola: 'Gondola',
  bus: 'Bus',
  hotel: 'Hotel',
  restaurant: 'Restaurant',
  attraction: 'Ticket',
  pass: 'Pass',
  'city-card': 'City card',
  other: 'Booking',
};

/** The board's own category row: All plus one pill per bucket. "note" (kind `other`) has
 * no chip of its own and just shows up under every filter that isn't active. */
const CATEGORY_TABS: Array<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'transport', label: 'Transport' },
  { value: 'stay', label: 'Hotels' },
  { value: 'activity', label: 'Sights' },
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

/** `26 Sep`, the weekday dropped - used where the date already sits beside a weekday
 * elsewhere on the same line. */
function shortDate(date: string): string {
  return formatDayLabel(date).split(' ').slice(1).join(' ');
}

/** "1 h 25" / "45 min" between a booking's depart and arrive, allowing for an overnight
 * arrival date. Null when either time is missing, so nothing is guessed at. */
function durationLabel(booking: Booking): string | null {
  if (!booking.depart || !booking.arrive) return null;
  const start = toMinutes(booking.depart);
  const end = toMinutes(booking.arrive);
  if (start == null || end == null) return null;
  const overnightMins =
    booking.arriveDate && booking.arriveDate !== booking.date
      ? daysBetween(booking.date, booking.arriveDate) * 1440
      : 0;
  const total = end - start + overnightMins;
  if (total <= 0) return null;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes}`;
}

/** All but the last two characters replaced with a bullet, grouped in pairs for
 * readability - "PNR-9490" becomes "•• •• •• 90". A short reference is left alone: there
 * is nothing meaningful left to hide. */
function maskReference(reference: string): string {
  const visible = reference.slice(-2);
  const hiddenLength = Math.max(reference.length - visible.length, 0);
  const combined = '•'.repeat(hiddenLength) + visible;
  return combined.match(/.{1,2}/g)?.join(' ') ?? combined;
}

/** A booking on the same date whose route runs the other way - the return half of a day
 * trip, worth a link straight from the outbound leg rather than a search through Later. */
function findSameDayReturn(bookings: Booking[], booking: Booking): Booking | undefined {
  if (!booking.from || !booking.to) return undefined;
  return bookings.find(
    (b) =>
      b.id !== booking.id &&
      b.date === booking.date &&
      b.from?.name === booking.to?.name &&
      b.to?.name === booking.from?.name,
  );
}

/** The pass card's big line: a time pair for anything timed, "Check in HH:mm" for a
 * hotel, the date alone when neither is known - never a guess. */
function passCardTimeLine(booking: Booking, accommodation?: Accommodation): string {
  if (booking.kind === 'hotel') {
    const time = accommodation?.checkInTime;
    return time ? `Check in ${time}` : 'Check in';
  }
  if (booking.depart && booking.arrive) return `${booking.depart} → ${booking.arrive}`;
  if (booking.depart) return booking.depart;
  return formatDayLabel(booking.date);
}

/** The pass card's smaller line: nights for a hotel, a seat summary for anyone with one,
 * a traveller count otherwise, or nothing when there is nothing to say. */
function passCardSubLine(booking: Booking, accommodation?: Accommodation): string | null {
  if (booking.kind === 'hotel') {
    const checkIn = accommodation?.checkIn ?? booking.date;
    const checkOut = accommodation?.checkOut ?? booking.endDate;
    if (!checkOut) return null;
    const nights = daysBetween(checkIn, checkOut);
    return `${nights} night${nights === 1 ? '' : 's'}`;
  }
  const passengers = booking.passengers ?? [];
  if (passengers.length === 0) return null;
  const coaches = new Set(passengers.map((p) => p.coach).filter(Boolean));
  if (coaches.size === 1 && passengers.every((p) => p.seat)) {
    const seats = passengers.map((p) => p.seat).join(', ');
    return `Coach ${passengers[0]?.coach} · Seat${passengers.length > 1 ? 's' : ''} ${seats}`;
  }
  const lines = passengers.map(passengerSeatLine).filter((line): line is string => line !== null);
  if (lines.length > 0) return lines.join(', ');
  return `${passengers.length} traveller${passengers.length === 1 ? '' : 's'}`;
}

/**
 * "Next up": the next three bookings worth seeing at a glance, styled like the ticket
 * itself rather than a plain list row - a tinted strip for what kind of thing it is, then
 * the one line that actually answers "when".
 */
function PassCard({
  tripId,
  booking,
  accommodation,
  documentCount,
}: {
  tripId: ID;
  booking: Booking;
  accommodation?: Accommodation;
  documentCount: number;
}) {
  const category = bookingCategory(booking.kind);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const subLine = passCardSubLine(booking, accommodation);
  return (
    <Link
      to={`/t/${tripId}/bookings/${booking.id}`}
      className="mb-3 block overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold tracking-wide uppercase',
          meta.tone,
        )}
      >
        <span className="flex items-center gap-1.5">
          <Icon size={15} aria-hidden />
          {KIND_WORDS[booking.kind]}
        </span>
        <span>{formatDayLabel(booking.date)}</span>
      </div>
      <div className="px-3.5 pt-3 pb-3.5">
        <p className="font-medium">{booking.title}</p>
        <p className="font-display mt-1 text-2xl font-semibold tracking-tight">
          {passCardTimeLine(booking, accommodation)}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm text-slate-500">{subLine}</span>
          <span className="flex shrink-0 items-center gap-2">
            <Chip tone={statusTone(booking.status)}>{ROW_STATUS_WORDS[booking.status]}</Chip>
            {documentCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
                <Paperclip size={12} aria-hidden /> {documentCount}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** The one line of "when" a compact row has room for: a date and time for anything
 * timed, a check-in date and night count for a hotel, the date alone otherwise. */
function laterRowMeta(booking: Booking, accommodation?: Accommodation): string | null {
  if (booking.kind === 'hotel') {
    const checkIn = accommodation?.checkIn ?? booking.date;
    const checkOut = accommodation?.checkOut ?? booking.endDate;
    if (!checkOut) return formatDayLabel(checkIn);
    const nights = daysBetween(checkIn, checkOut);
    return `${formatDayLabel(checkIn)} · ${nights} night${nights === 1 ? '' : 's'}`;
  }
  if (booking.depart) return `${formatDayLabel(booking.date)} · ${booking.depart}`;
  return formatDayLabel(booking.date);
}

/** One line per booking in "Later" and "Past": the category badge, the title, when it
 * is, and the one fact most worth a glance without opening it - a seat, or else the
 * status word the pass card already leads with. */
function BookingRow({
  tripId,
  booking,
  accommodation,
}: {
  tripId: ID;
  booking: Booking;
  accommodation?: Accommodation;
}) {
  const category = bookingCategory(booking.kind);
  const meta = laterRowMeta(booking, accommodation);
  const firstCoach = booking.passengers?.[0]?.coach;
  const fact = firstCoach ? `Coach ${firstCoach}` : ROW_STATUS_WORDS[booking.status];
  return (
    <Link
      to={`/t/${tripId}/bookings/${booking.id}`}
      className="flex min-h-[56px] items-center gap-3 border-t border-slate-100 py-2 first:border-t-0 dark:border-slate-700"
    >
      <CategoryIcon category={category} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{booking.title}</p>
        {meta ? <p className="truncate text-xs text-slate-500">{meta}</p> : null}
      </div>
      <span className="shrink-0 text-xs whitespace-nowrap text-slate-500">{fact}</span>
    </Link>
  );
}

/** The single line that replaces a whole section for "not yet booked": how many, and the
 * soonest one worth acting on. Everything still to book stays reachable from here, via
 * the status filter, rather than crowding the board with a list of its own. */
function StillToBookStrip({ tripId, entries }: { tripId: ID; entries: BookByEntry[] }) {
  const first = entries[0];
  if (!first) return null;
  const byDate = first.result.date ? `, by ${shortDate(first.result.date)}` : '';
  return (
    <Link
      to={`/t/${tripId}/bookings?status=to_book`}
      className="bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100 mb-4 flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-semibold"
    >
      <AlertTriangle size={17} className="shrink-0" aria-hidden />
      <span className="flex-1">
        {entries.length} still to book · {first.booking.title}
        {byDate}
      </span>
      <ChevronRight size={17} className="shrink-0" aria-hidden />
    </Link>
  );
}

/** The board's own category row: an "All" pill plus one per bucket, ink-filled when
 * selected rather than the app-wide FilterChips' brand tint - the board is dense enough
 * that the active filter needs the strongest possible contrast. */
function CategoryTabRow({
  active,
  onSelect,
  counts,
}: {
  active: Category | null;
  onSelect: (value: Category | null) => void;
  counts: Partial<Record<Category | 'all', number>>;
}) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Booking type">
      {CATEGORY_TABS.map((tab) => {
        const isActive = tab.value === 'all' ? active === null : active === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(tab.value === 'all' ? null : tab.value)}
            className={cn(
              'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition',
              isActive
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
            )}
          >
            {tab.label}
            <span className="opacity-60">{counts[tab.value] ?? 0}</span>
          </button>
        );
      })}
    </div>
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
  const active: Category | null =
    activeParam && CATEGORY_TABS.some((t) => t.value === activeParam)
      ? (activeParam as Category)
      : null;
  const statusParam = params.get('status');

  const setCategory = (value: Category | null) => {
    if (value) params.set('category', value);
    else params.delete('category');
    setParams(params, { replace: true });
  };

  const categoryFiltered = active
    ? entries.filter((e) => bookingCategory(e.booking.kind) === active)
    : entries;
  const filtered = statusParam
    ? categoryFiltered.filter((e) => e.booking.status === statusParam)
    : categoryFiltered;

  const stillToBook = categoryFiltered.filter((e) => e.booking.status === 'to_book');

  // Everything sits in date order, still-to-book included: the strip above is a summary,
  // not a hiding place. A booking someone has just added must be visible, or adding it
  // looks like it failed. Next up stays for held bookings only (see `isHeld`).
  const sectioned = filtered;
  const upcoming = sectioned
    .filter((e) => e.booking.date >= today)
    .sort(
      (a, b) =>
        a.booking.date.localeCompare(b.booking.date) ||
        (a.booking.depart ?? '').localeCompare(b.booking.depart ?? ''),
    );
  const past = sectioned
    .filter((e) => e.booking.date < today)
    .sort(
      (a, b) =>
        b.booking.date.localeCompare(a.booking.date) ||
        (b.booking.depart ?? '').localeCompare(a.booking.depart ?? ''),
    );
  // Next up is for things you hold a ticket or reservation for. "Buy on the day" sights
  // shown as ticket cards would send a first-time visitor to a queue expecting to walk in.
  const isHeld = (e: (typeof upcoming)[number]) =>
    e.booking.status === 'booked' || e.booking.status === 'confirmed';
  const nextUp = upcoming.filter(isHeld).slice(0, 3);
  const later = upcoming.filter((e) => !nextUp.includes(e));

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

  const nothingAtAll =
    nextUp.length === 0 && later.length === 0 && past.length === 0 && stillToBook.length === 0;

  return (
    <>
      <PageHeader
        title="Wallet"
        subtitle="Every ticket, pass and booking, ready to show"
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

      <CategoryTabRow
        active={active}
        onSelect={setCategory}
        counts={{
          all: entries.length,
          transport: entries.filter((e) => bookingCategory(e.booking.kind) === 'transport').length,
          stay: entries.filter((e) => bookingCategory(e.booking.kind) === 'stay').length,
          activity: entries.filter((e) => bookingCategory(e.booking.kind) === 'activity').length,
          food: entries.filter((e) => bookingCategory(e.booking.kind) === 'food').length,
          pass: entries.filter((e) => bookingCategory(e.booking.kind) === 'pass').length,
        }}
      />

      <StillToBookStrip tripId={bundle.trip.id} entries={stillToBook} />

      {nothingAtAll ? (
        <EmptyState title="Nothing here yet.">
          {active ? 'Nothing in this category.' : 'Add a booking to get started.'}
        </EmptyState>
      ) : (
        <>
          {nextUp.length > 0 ? (
            <div className="mb-5">
              <h2 className="mb-2.5 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Next up
              </h2>
              {nextUp.map((entry) => (
                <PassCard
                  key={entry.booking.id}
                  tripId={bundle.trip.id}
                  booking={entry.booking}
                  accommodation={accommodationByBookingId.get(entry.booking.id)}
                  documentCount={documentCountByBookingId.get(entry.booking.id) ?? 0}
                />
              ))}
            </div>
          ) : null}

          {later.length > 0 ? (
            <div className="mb-5">
              <h2 className="mb-2.5 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Later
              </h2>
              <div className="rounded-2xl border border-slate-200 bg-white px-3.5 dark:border-slate-700 dark:bg-slate-800">
                {later.map((entry) => (
                  <BookingRow
                    key={entry.booking.id}
                    tripId={bundle.trip.id}
                    booking={entry.booking}
                    accommodation={accommodationByBookingId.get(entry.booking.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {past.length > 0 ? (
            <Disclosure title={`Past (${past.length})`}>
              {past.map((entry) => (
                <BookingRow
                  key={entry.booking.id}
                  tripId={bundle.trip.id}
                  booking={entry.booking}
                  accommodation={accommodationByBookingId.get(entry.booking.id)}
                />
              ))}
            </Disclosure>
          ) : null}
        </>
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

/** The one fact worth reading out at a desk: masked by default so it survives being read
 * over someone's shoulder, with an eye to reveal it and a Copy button so it never has to
 * be retyped off a phone screen. Both controls are icon-only, so both carry an
 * `aria-label` that changes with their state. */
function ReferenceFact({ reference, label = 'Reference' }: { reference: string; label?: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused (no permission, an insecure context, an older
      // browser). The reference is still on screen and can be read out or typed by hand.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
        <p className="truncate font-mono text-lg font-semibold tracking-wide">
          {revealed ? reference : maskReference(reference)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {/* Button doesn't forward arbitrary props, so the accessible name has to be a
            visually-hidden child rather than an `aria-label` on the element itself. */}
        <Button onClick={() => setRevealed((r) => !r)}>
          {revealed ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          <span className="sr-only">{revealed ? 'Hide reference' : 'Show reference'}</span>
        </Button>
        <Button onClick={() => void copy()}>
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          <span className="sr-only">{copied ? 'Copied' : 'Copy reference'}</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * The ticket itself: departure and arrival side by side in the largest type on the
 * screen, a dashed tear line, then who is sitting where and the reference to read out at
 * the barrier.
 */
function TransportTicketCard({ booking }: { booking: Booking }) {
  const category = bookingCategory(booking.kind);
  const duration = durationLabel(booking);
  const passengers = booking.passengers ?? [];

  return (
    <section
      aria-label="Ticket"
      className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
    >
      <div className={cn('p-4', CATEGORY_META[category].tone)}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <p className="font-display text-4xl leading-none font-semibold text-slate-900 dark:text-slate-50">
              {booking.depart ?? '—'}
            </p>
            {booking.from ? (
              <p className="mt-1.5 text-sm font-semibold">{booking.from.name}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1 pb-1 text-xs font-semibold">
            <ArrowRight size={20} aria-hidden />
            {duration ? <span className="whitespace-nowrap">{duration}</span> : null}
          </div>
          <div className="text-right">
            <p className="font-display text-4xl leading-none font-semibold text-slate-900 dark:text-slate-50">
              {booking.arrive ?? '—'}
            </p>
            {booking.to ? <p className="mt-1.5 text-sm font-semibold">{booking.to.name}</p> : null}
          </div>
        </div>
      </div>

      {passengers.length > 0 ? (
        <>
          <div className="mx-3.5 border-t-2 border-dashed border-slate-200 dark:border-slate-700" />
          <div className="grid grid-cols-2 gap-3.5 p-4">
            {passengers.map((passenger, index) => (
              <Fact
                key={index}
                label={passenger.name}
                value={passengerSeatLine(passenger) ?? '—'}
              />
            ))}
          </div>
        </>
      ) : null}

      {booking.reference ? (
        <div
          className={cn(
            'p-4',
            passengers.length > 0 ? 'border-t border-slate-100 dark:border-slate-700' : '',
          )}
        >
          <ReferenceFact reference={booking.reference} />
        </div>
      ) : null}
    </section>
  );
}

/** Check-in and check-out side by side, tinted like a hotel, then the address, the way
 * there, and the reference. */
function HotelStayCard({
  booking,
  accommodation,
  documentCount,
  onOpenDocuments,
}: {
  booking: Booking;
  accommodation?: Accommodation;
  documentCount: number;
  onOpenDocuments: () => void;
}) {
  const checkIn = accommodation?.checkIn ?? booking.date;
  const checkOut = accommodation?.checkOut ?? booking.endDate;
  const nights = checkOut ? daysBetween(checkIn, checkOut) : null;
  const place = accommodation?.place ?? booking.to;

  return (
    <section
      aria-label="Stay"
      className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
    >
      <div className={cn('grid grid-cols-2', CATEGORY_META.stay.tone)}>
        <div className="border-r border-black/10 p-4 dark:border-white/10">
          <p className="text-[11px] font-bold tracking-wide uppercase">Check in</p>
          <p className="font-display mt-1 text-2xl font-semibold">{formatDayLabel(checkIn)}</p>
          {accommodation?.checkInTime ? (
            <p className="mt-0.5 text-xs opacity-80">from {accommodation.checkInTime}</p>
          ) : null}
        </div>
        <div className="p-4">
          <p className="text-[11px] font-bold tracking-wide uppercase">Check out</p>
          <p className="font-display mt-1 text-2xl font-semibold">
            {checkOut ? formatDayLabel(checkOut) : '—'}
          </p>
          {nights != null ? (
            <p className="mt-0.5 text-xs opacity-80">
              {nights} night{nights === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3.5 p-4">
        {place ? (
          <div className="flex items-start gap-2.5">
            <MapPin size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">{place.address ?? place.name}</p>
              {place.address ? (
                <p className="text-sm text-slate-500">
                  {[place.city, place.zone].filter(Boolean).join(' · ') || place.name}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {place || documentCount > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {place ? (
              <OutLink href={placeUrl(place)}>
                Directions <MapPin size={14} className="ml-1.5" aria-hidden />
              </OutLink>
            ) : null}
            {documentCount > 0 ? <Button onClick={onOpenDocuments}>Confirmation</Button> : null}
          </div>
        ) : null}

        {booking.reference ? (
          <ReferenceFact
            reference={booking.reference}
            label={booking.provider ? `${booking.provider} reference` : 'Reference'}
          />
        ) : null}
      </div>
    </section>
  );
}

/** Everything a simpler booking needs: when, the reference, and who it is for - a
 * museum ticket or a restaurant table has no ticket-shaped card of its own. */
function OtherKeyFactsCard({ booking }: { booking: Booking }) {
  const whenValue = booking.depart
    ? `${formatDayLabel(booking.date)} · ${booking.depart}${
        booking.arrive ? ` → ${booking.arrive}` : ''
      }`
    : formatDayLabel(booking.date);

  return (
    <Card className="mb-4">
      <div className="space-y-3">
        <Fact label="When" value={whenValue} />

        {booking.from && booking.to ? (
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              Route
            </p>
            <p className="text-sm">
              {booking.from.name} → {booking.to.name}
            </p>
            <OutLink href={placeUrl(booking.to)}>
              {booking.to.name} on the map <ExternalLink size={13} className="ml-1.5" aria-hidden />
            </OutLink>
          </div>
        ) : null}

        {booking.reference ? <ReferenceFact reference={booking.reference} /> : null}

        {booking.passengers?.length ? (
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              Passengers
            </p>
            <div className="mt-1 space-y-1.5">
              {booking.passengers.map((passenger, index) => {
                const seatLine = passengerSeatLine(passenger);
                return (
                  <p key={index} className="text-sm">
                    <span className="font-medium">{passenger.name}</span>
                    {seatLine ? <span className="text-slate-500"> · {seatLine}</span> : null}
                  </p>
                );
              })}
            </div>
          </div>
        ) : null}
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
  const audit = useAudit(bundle, today);
  const documents = useDocumentsFor('booking', bookingId);
  const [editing, setEditing] = useState(false);
  const documentsSectionRef = useRef<HTMLDivElement>(null);
  const firstDocumentRowRef = useRef<HTMLDivElement>(null);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;
  const booking = bundle.bookings.find((b) => b.id === bookingId);
  if (!booking) return <EmptyState title="No such booking." />;

  const accommodation = bundle.accommodations.find((a) => a.bookingId === booking.id);
  const guide = matchGuides(booking, allGuides)[0]?.guide;
  const result = bookBy(booking, allGuides, today);
  const links = bookingLinks(booking, guide);
  const linked = itemsOfBooking(bundle, booking.id);
  const refundLine = refundWords(booking);
  const category = bookingCategory(booking.kind);
  const isTransport = category === 'transport';
  const isHotel = booking.kind === 'hotel';

  // A manual conflict is only worth a callout here while it is both about this booking
  // and still unresolved - once cleared in Plan check, it should stop following the
  // booking around.
  const reviewConflict = bundle.conflicts.find(
    (c) => c.id.startsWith('mc-review-') && c.bookingIds?.includes(booking.id),
  );
  const reviewOpen =
    reviewConflict != null &&
    audit.open.some((f) => f.ruleId === 'manual' && f.key === `manual|${reviewConflict.id}`);

  const sameDayReturn = isTransport ? findSameDayReturn(bundle.bookings, booking) : undefined;

  const setStatus = (status: BookingStatus) => void bookingsRepo.setStatus(booking.id, status);

  // "Show tickets" and "Confirmation" both do the same thing: open the one document that
  // matters, or - when there is more than one - open the Documents disclosure and let the
  // traveller pick. DocumentRow owns the actual open behaviour; this simulates the tap on
  // it rather than duplicating it, so both stay a single implementation.
  const openDocuments = () => {
    const details = documentsSectionRef.current?.querySelector('details');
    if (details) details.open = true;
    if (documents.length === 1) {
      firstDocumentRowRef.current?.querySelector('button')?.click();
    } else {
      documentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const title = isTransport
    ? [booking.from?.city ?? booking.from?.name, booking.to?.city ?? booking.to?.name]
        .filter(Boolean)
        .join(' → ') || booking.title
    : booking.title;
  const subtitle = isTransport
    ? `${booking.operator ?? KIND_WORDS[booking.kind]} · ${formatDayLabel(booking.date)}`
    : `${formatDayLabel(booking.date)}${booking.depart ? ` at ${booking.depart}` : ''}`;

  return (
    <>
      <PageHeader
        kicker={
          <Link to={`/t/${bundle.trip.id}/bookings`} className="inline-flex items-center gap-0.5">
            <ChevronLeft size={16} aria-hidden /> Wallet
          </Link>
        }
        title={title}
        subtitle={subtitle}
        actions={!editing ? <Button onClick={() => setEditing(true)}>Edit</Button> : undefined}
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
          {isTransport ? (
            <TransportTicketCard booking={booking} />
          ) : isHotel ? (
            <HotelStayCard
              booking={booking}
              accommodation={accommodation}
              documentCount={documents.length}
              onOpenDocuments={openDocuments}
            />
          ) : (
            <OtherKeyFactsCard booking={booking} />
          )}

          {isTransport && documents.length > 0 ? (
            <Button
              variant="primary"
              className="mb-4 flex w-full items-center justify-center gap-2"
              onClick={openDocuments}
            >
              Show tickets ({documents.length})
            </Button>
          ) : null}

          {isHotel && booking.cost ? (
            <Section title="Paid">
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {booking.cost.currency}{' '}
                    {booking.cost.amount != null ? booking.cost.amount.toFixed(2) : '—'}
                  </span>
                  <span className="text-sm text-slate-500">
                    {booking.cost.paid ? 'Paid' : 'Not paid yet'}
                    {booking.cost.note ? ` · ${booking.cost.note}` : ''}
                  </span>
                </div>
              </Card>
            </Section>
          ) : null}

          {reviewConflict && reviewOpen ? (
            <div className="bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100 mb-4 rounded-2xl p-3.5 text-sm">
              <p className="flex items-center gap-2 font-bold">
                <AlertTriangle size={16} aria-hidden /> To review
              </p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">{reviewConflict.detail}</p>
              <Link
                to={`/t/${bundle.trip.id}/conflicts`}
                className="mt-1.5 inline-block font-bold underline"
              >
                Decide in Plan check
              </Link>
            </div>
          ) : null}

          {refundLine || booking.notes || sameDayReturn ? (
            <Section title="Good to know">
              <Card>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {refundLine ? (
                    <div className="flex items-start gap-2.5 py-2 first:pt-0">
                      <Check
                        size={16}
                        className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                        aria-hidden
                      />
                      <span>{refundLine}</span>
                    </div>
                  ) : null}
                  {booking.notes ? (
                    <p className="py-2 whitespace-pre-wrap text-slate-600 first:pt-0 dark:text-slate-300">
                      {booking.notes}
                    </p>
                  ) : null}
                  {sameDayReturn ? (
                    <p className="py-2 first:pt-0">
                      Return: {sameDayReturn.depart ? `${sameDayReturn.depart} → ` : ''}
                      {sameDayReturn.to?.city ?? sameDayReturn.to?.name ?? sameDayReturn.title}
                      {' · '}
                      <Link
                        to={`/t/${bundle.trip.id}/bookings/${sameDayReturn.id}`}
                        className="text-brand-700 dark:text-brand-300 font-semibold"
                      >
                        open
                      </Link>
                    </p>
                  ) : null}
                </div>
              </Card>
            </Section>
          ) : null}

          <div className="mb-4 space-y-2">
            <div ref={documentsSectionRef}>
              <Disclosure title="Documents" count={documents.length}>
                <div className="mb-2">
                  <AttachDocumentButton
                    tripId={bundle.trip.id}
                    attachedTo={{ kind: 'booking', id: booking.id }}
                    label="Attach a ticket or confirmation"
                  />
                </div>
                {documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc, index) => (
                      <div key={doc.id} ref={index === 0 ? firstDocumentRowRef : undefined}>
                        <DocumentRow doc={doc} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Nothing filed against this booking yet.</p>
                )}
              </Disclosure>
            </div>

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
