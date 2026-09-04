/**
 * When each thing has to be booked.
 *
 * The traveller's real question is not "what is unbooked" but "what do I have to deal
 * with this week". A book-by date turns a flat to-do list into a queue with a front.
 */
import { addDays, daysBetween } from '@/domain/time';
import type { Booking, ISODate, TripBundle } from '@/domain/types';
import { bestGuide, type MatchContext } from './match';
import { DEFAULT_BOOK_WINDOWS, type BookByBasis, type BookByResult, type Guide } from './types';

const SETTLED = new Set<Booking['status']>(['booked', 'confirmed', 'not_needed', 'cancelled']);

/** How many days before travel this thing should be bought, and where that number came from. */
function windowFor(
  booking: Booking,
  guide: Guide | undefined,
): { days: number | null; basis: BookByBasis } {
  const explicit = booking.bookWindow?.latestDaysBefore;
  if (explicit !== undefined) {
    return { days: explicit, basis: explicit === null ? 'on-site' : 'explicit' };
  }
  const fromGuide = guide?.bookAdvice.latestDaysBefore;
  if (fromGuide !== undefined) {
    return { days: fromGuide, basis: fromGuide === null ? 'on-site' : 'guide' };
  }
  const fallback = DEFAULT_BOOK_WINDOWS[booking.kind];
  return { days: fallback, basis: fallback === null ? 'on-site' : 'default' };
}

export function bookBy(
  booking: Booking,
  guides: Guide[],
  today: ISODate,
  ctx: MatchContext = {},
): BookByResult {
  const guide = bestGuide(booking, guides, ctx);
  const { days, basis } = windowFor(booking, guide);

  const opensDaysBefore = booking.bookWindow?.opensDaysBefore ?? guide?.ticketsOpen?.daysBefore;
  const opensOn =
    opensDaysBefore === undefined ? null : addDays(booking.date, -Math.abs(opensDaysBefore));

  if (days === null) {
    return {
      date: null,
      opensOn,
      basis: 'on-site',
      daysLeft: null,
      urgency: SETTLED.has(booking.status) ? 'done' : 'on-site',
    };
  }

  const date = addDays(booking.date, -Math.abs(days));
  const daysLeft = daysBetween(today, date);

  if (SETTLED.has(booking.status)) {
    return { date, opensOn, basis, daysLeft, urgency: 'done' };
  }

  const urgency =
    daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'now' : daysLeft <= 21 ? 'soon' : 'later';

  return { date, opensOn, basis, daysLeft, urgency };
}

export interface BookByEntry {
  booking: Booking;
  result: BookByResult;
  guide?: Guide;
}

/** Everything still to arrange, in the order it has to be dealt with. */
export function bookByTimeline(bundle: TripBundle, guides: Guide[], today: ISODate): BookByEntry[] {
  return bundle.bookings
    .map((booking): BookByEntry => {
      const guide = bestGuide(booking, guides);
      return {
        booking,
        result: bookBy(booking, guides, today),
        ...(guide ? { guide } : {}),
      };
    })
    .sort((a, b) => {
      const ad = a.result.date;
      const bd = b.result.date;
      if (ad && bd && ad !== bd) return ad.localeCompare(bd);
      if (ad && !bd) return -1;
      if (!ad && bd) return 1;
      return a.booking.date.localeCompare(b.booking.date);
    });
}

/** The things that need attention now, for the trip home screen. */
export function urgentBookings(entries: BookByEntry[], limit = 3): BookByEntry[] {
  const rank: Record<BookByResult['urgency'], number> = {
    overdue: 0,
    now: 1,
    soon: 2,
    'on-site': 3,
    later: 4,
    done: 5,
  };
  return entries
    .filter((e) => e.result.urgency === 'overdue' || e.result.urgency === 'now')
    .sort((a, b) => rank[a.result.urgency] - rank[b.result.urgency])
    .slice(0, limit);
}
