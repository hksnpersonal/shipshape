/**
 * The bookings board, the book-by queue, and one booking in detail.
 *
 * This is the screen that replaces the pile of confirmation emails, and the guide card is
 * what replaces searching for "is X worth booking in advance".
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ExternalLink, Plus, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
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
import { bookingLinks } from '@/playbook/deepLinks';
import { matchGuides } from '@/playbook/match';
import { bookBy } from '@/playbook/bookBy';
import { useBookBy, useDocumentsFor, useToday, useTripBundle } from '@/hooks/useTrip';
import type { Booking, BookingKind, BookingStatus, ID } from '@/domain/types';
import type { BookByEntry } from '@/playbook/bookBy';
import type { Reseller } from '@/playbook/types';

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
        subtitle={`${entries.length} things across the trip, ordered by when they need doing`}
        actions={
          !addingBooking ? (
            <Button variant="primary" onClick={() => setAddingBooking(true)}>
              <Plus size={15} aria-hidden /> Add a booking
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

function TrustIcon({ trust }: { trust: Reseller['trust'] }) {
  if (trust === 'fine') return <ShieldCheck size={15} className="text-emerald-600" aria-hidden />;
  if (trust === 'avoid') return <ShieldX size={15} className="text-rose-600" aria-hidden />;
  return <ShieldAlert size={15} className="text-amber-600" aria-hidden />;
}

const TRUST_WORDS: Record<Reseller['trust'], string> = {
  fine: 'Fine to use',
  'ok-with-markup': 'Works, with a markup',
  avoid: 'Avoid',
};

export function BookingDetailPage() {
  const { tripId, bookingId } = useParams();
  const bundle = useTripBundle(tripId);
  const today = useToday(bundle?.trip.defaultTimeZone);
  const navigate = useNavigate();
  const documents = useDocumentsFor('booking', bookingId);

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
        actions={<Button onClick={() => void navigate(-1)}>Back</Button>}
      />

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

/** The playbook entry rendered inline, used from a booking and from an item. */
export function GuideCard({ guideId }: { guideId: string }) {
  const guide = allGuides.find((g) => g.id === guideId);
  if (!guide) return null;

  return (
    <Section title="How to book this reliably">
      <Card>
        <p className="font-medium">{guide.title}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{guide.summary}</p>

        <p className="mt-3 text-sm font-semibold">When to book</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{guide.bookAdvice.note}</p>

        <p className="mt-3 text-sm font-semibold">Where to book</p>
        <div className="mt-1">
          <OutLink href={guide.official.url}>
            {guide.official.name}, the official channel
            <ExternalLink size={13} className="ml-1.5" aria-hidden />
          </OutLink>
        </div>
        {guide.official.note ? (
          <p className="mt-1 text-sm text-slate-500">{guide.official.note}</p>
        ) : null}

        {guide.resellers?.length ? (
          <ul className="mt-2 space-y-1.5">
            {guide.resellers.map((reseller) => (
              <li key={reseller.url} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5">
                  <TrustIcon trust={reseller.trust} />
                </span>
                <span>
                  <span className="font-medium">{reseller.name}</span>
                  <span className="text-slate-500"> · {TRUST_WORDS[reseller.trust]}</span>
                  {reseller.note ? (
                    <span className="block text-slate-500">{reseller.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {guide.validation?.required ? (
          <>
            <p className="mt-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
              Validation
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{guide.validation.note}</p>
          </>
        ) : null}

        {guide.refundRules ? (
          <>
            <p className="mt-3 text-sm font-semibold">Refunds</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{guide.refundRules}</p>
          </>
        ) : null}

        {guide.passCoverage?.length ? (
          <>
            <p className="mt-3 text-sm font-semibold">Rail pass</p>
            <ul className="text-sm text-slate-600 dark:text-slate-300">
              {guide.passCoverage.map((cover) => (
                <li key={cover.passId}>
                  {cover.coverage === 'covered'
                    ? 'Fully covered'
                    : cover.coverage === 'discount'
                      ? 'Discounted, not free'
                      : 'Not covered'}
                  {cover.note ? `. ${cover.note}` : ''}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {guide.gotchas?.length ? (
          <>
            <p className="mt-3 text-sm font-semibold">What catches people out</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {guide.gotchas.map((gotcha) => (
                <li key={gotcha}>{gotcha}</li>
              ))}
            </ul>
          </>
        ) : null}

        <p className="mt-3 text-xs text-slate-400">Checked {guide.lastReviewed}</p>
      </Card>
    </Section>
  );
}

export function PlaybookIndexPage() {
  const byCountry = new Map<string, typeof allGuides>();
  for (const guide of allGuides) {
    const list = byCountry.get(guide.countryCode) ?? [];
    list.push(guide);
    byCountry.set(guide.countryCode, list);
  }
  const NAMES: Record<string, string> = {
    IT: 'Italy',
    CH: 'Switzerland',
    FR: 'France',
    BE: 'Belgium',
    NL: 'Netherlands',
    EU: 'Anywhere in Europe',
  };

  return (
    <>
      <PageHeader
        title="Booking playbook"
        subtitle="Where to buy each kind of ticket, when, and what to watch for. Works offline."
      />
      {[...byCountry.entries()].map(([code, guides]) => (
        <Section key={code} title={NAMES[code] ?? code}>
          <div className="space-y-2">
            {guides.map((guide) => (
              <LinkCard key={guide.id} to={`/playbook/${guide.id}`}>
                <p className="font-medium">{guide.title}</p>
                <p className="text-sm text-slate-500">{guide.summary}</p>
              </LinkCard>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}

export function PlaybookDetailPage() {
  const { guideId } = useParams();
  const navigate = useNavigate();
  const guide = allGuides.find((g) => g.id === guideId);
  if (!guide) return <EmptyState title="No such guide." />;

  return (
    <>
      <PageHeader
        title={guide.title}
        actions={<Button onClick={() => void navigate(-1)}>Back</Button>}
      />
      <GuideCard guideId={guide.id} />
      {guide.sources?.length ? (
        <Section title="Checked against">
          <ul className="space-y-1 text-sm">
            {guide.sources.map((source) => (
              <li key={source}>
                <Link to={source} className="text-brand-700 dark:text-brand-300 break-all">
                  {source}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

export type { Booking };
