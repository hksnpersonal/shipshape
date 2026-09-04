/**
 * Read-only accessors over a TripBundle. Nothing here mutates, and nothing derived is
 * ever stored: which hotel covers a date, which items belong to a booking, and so on are
 * all computed from the rows.
 */
import { addDays } from '@/domain/time';
import type {
  Accommodation,
  Booking,
  Day,
  DocumentMeta,
  DocumentOwnerKind,
  ID,
  ISODate,
  Item,
  TripBundle,
} from '@/domain/types';

/** A day's items in display order. */
export function itemsForDay(bundle: TripBundle, dayId: ID): Item[] {
  return bundle.items.filter((i) => i.dayId === dayId).sort((a, b) => a.sortKey - b.sortKey);
}

export function dayById(bundle: TripBundle, dayId: ID): Day | undefined {
  return bundle.days.find((d) => d.id === dayId);
}

export function dayForDate(bundle: TripBundle, date: ISODate): Day | undefined {
  return bundle.days.find((d) => d.date === date);
}

/** Days in date order. */
export function orderedDays(bundle: TripBundle): Day[] {
  return bundle.days.slice().sort((a, b) => a.date.localeCompare(b.date));
}

/** The stay covering the night of `date`: check-in day inclusive, check-out day exclusive. */
export function accommodationForDate(bundle: TripBundle, date: ISODate): Accommodation | undefined {
  return bundle.accommodations.find((a) => a.checkIn <= date && date < a.checkOut);
}

export function bookingById(bundle: TripBundle, id: ID | null | undefined): Booking | undefined {
  if (!id) return undefined;
  return bundle.bookings.find((b) => b.id === id);
}

export function bookingOf(bundle: TripBundle, item: Item): Booking | undefined {
  return bookingById(bundle, item.bookingId);
}

export function itemsOfBooking(bundle: TripBundle, bookingId: ID): Item[] {
  return bundle.items.filter((i) => i.bookingId === bookingId);
}

export function documentsFor(
  bundle: TripBundle,
  ownerKind: DocumentOwnerKind,
  ownerId: ID,
): DocumentMeta[] {
  return bundle.documents.filter(
    (d) => d.attachedTo?.kind === ownerKind && d.attachedTo.id === ownerId,
  );
}

/** Every night of the trip that needs a bed: the first day through the last day minus one. */
export function nightsNeeded(bundle: TripBundle): ISODate[] {
  const days = orderedDays(bundle);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return [];
  const out: ISODate[] = [];
  for (let d = first.date; d < last.date; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Nights with exactly one stay booked, and the ones without. */
export function nightsCovered(bundle: TripBundle): {
  covered: ISODate[];
  uncovered: ISODate[];
  doubleBooked: ISODate[];
} {
  const covered: ISODate[] = [];
  const uncovered: ISODate[] = [];
  const doubleBooked: ISODate[] = [];
  for (const night of nightsNeeded(bundle)) {
    const stays = bundle.accommodations.filter((a) => a.checkIn <= night && night < a.checkOut);
    if (stays.length === 0) uncovered.push(night);
    else if (stays.length > 1) doubleBooked.push(night);
    else covered.push(night);
  }
  return { covered, uncovered, doubleBooked };
}

/** The day a booking belongs to, matched by date. */
export function dayOfBooking(bundle: TripBundle, booking: Booking): Day | undefined {
  return dayForDate(bundle, booking.date);
}
