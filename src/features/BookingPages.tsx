/**
 * The bookings board, the book-by queue, and one booking in detail.
 *
 * This is the screen that replaces the pile of confirmation emails, and the guide card is
 * what replaces searching for "is X worth booking in advance".
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ExternalLink, Plus } from 'lucide-react';
import { allGuides } from '@/content/guides';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  LinkCard,
  OutLink,
  PageHeader,
  Section,
} from '@/components/ui';
import { bookingsRepo } from '@/db/repo';
import { itemsOfBooking } from '@/domain/bundle';
import { formatDayLabel } from '@/domain/time';
import { AttachDocumentButton, DocumentRow } from '@/features/DocumentPages';
import { GuideCard } from '@/features/PlaybookPages';
import { bookingLinks } from '@/playbook/deepLinks';
import { matchGuides } from '@/playbook/match';
import { bookBy } from '@/playbook/bookBy';
import { useBookBy, useDocumentsFor, useToday, useTripBundle } from '@/hooks/useTrip';
import type { Booking, BookingKind, BookingStatus, ID } from '@/domain/types';
import type { BookByEntry } from '@/playbook/bookBy';

const STATUS_WORDS: Record<BookingStatus, string> = {
  to_book: 'Still to book',
  booked: 'Booked',
  confirmed: 'Confirmed',
  on_site: 'Pay on the day',
  not_needed: 'Nothing to book',
  cancelled: 'Cancelled',
};

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

export function BookingsBoardPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const entries = useBookBy(bundle, today);
  const [addingBooking, setAddingBooking] = useState(false);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;

  const groups: Array<{ title: string; entries: BookByEntry[] }> = [
    {
      title: 'Still to book',
      entries: entries.filter((e) => e.booking.status === 'to_book'),
    },
    {
      title: 'Pay on the day',
      entries: entries.filter((e) => e.booking.status === 'on_site'),
    },
    {
      title: 'Already booked',
      entries: entries.filter(
        (e) => e.booking.status === 'booked' || e.booking.status === 'confirmed',
      ),
    },
    {
      title: 'Nothing to do',
      entries: entries.filter(
        (e) => e.booking.status === 'not_needed' || e.booking.status === 'cancelled',
      ),
    },
  ];

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

      {groups.map((group) =>
        group.entries.length === 0 ? null : (
          <Section key={group.title} title={`${group.title} (${group.entries.length})`}>
            <div className="space-y-2">
              {group.entries.map((entry) => {
                const label = urgencyLabel(entry);
                return (
                  <LinkCard
                    key={entry.booking.id}
                    to={`/t/${bundle.trip.id}/bookings/${entry.booking.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{entry.booking.title}</p>
                        <p className="text-sm text-slate-500">
                          {formatDayLabel(entry.booking.date)}
                          {entry.booking.depart ? ` at ${entry.booking.depart}` : ''}
                        </p>
                      </div>
                      <Chip tone={label.tone}>{label.text}</Chip>
                    </div>
                  </LinkCard>
                );
              })}
            </div>
          </Section>
        ),
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
  const [error, setError] = useState<string | null>(null);

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
    await bookingsRepo.patch(booking.id, {
      title: trimmedTitle,
      date,
      kind,
      status,
      // An empty string, not undefined: Dexie's update does not reliably drop a key when
      // handed undefined, so clearing the field this way could leave the old value behind.
      reference,
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

  const guide = matchGuides(booking, allGuides)[0]?.guide;
  const result = bookBy(booking, allGuides, today);
  const links = bookingLinks(booking, guide);
  const linked = itemsOfBooking(bundle, booking.id);

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
        <Card className="mb-4">
          <div className="mb-3 flex items-center gap-2">
            <Chip tone={statusTone(booking.status)}>{STATUS_WORDS[booking.status]}</Chip>
            {result.date ? <Chip>Book by {result.date}</Chip> : <Chip>Bought on the day</Chip>}
            {result.opensOn ? <Chip>On sale from {result.opensOn}</Chip> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['to_book', 'booked', 'confirmed', 'on_site', 'not_needed'] as BookingStatus[]).map(
              (status) => (
                <Button
                  key={status}
                  variant={booking.status === status ? 'primary' : 'secondary'}
                  onClick={() => setStatus(status)}
                >
                  {STATUS_WORDS[status]}
                </Button>
              ),
            )}
          </div>
          {booking.refundable === false ? (
            <p className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300">
              Not refundable. Treat the departure time as fixed and build in a real margin.
            </p>
          ) : null}
          {booking.notes ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{booking.notes}</p>
          ) : null}
        </Card>
      )}

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

      {guide ? <GuideCard guideId={guide.id} /> : null}

      {linked.length > 0 ? (
        <Section title="On these days">
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
        </Section>
      ) : null}
    </>
  );
}

export type { Booking };
