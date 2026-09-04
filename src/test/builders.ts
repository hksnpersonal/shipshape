/**
 * Fixture builders shared by every test suite. Keep them dumb: sensible defaults plus a
 * shallow override, no cleverness, so a failing test reads as data not as setup code.
 */
import type {
  Accommodation,
  Booking,
  Day,
  DocumentMeta,
  Item,
  ManualConflict,
  Place,
  Reminder,
  Trip,
  TripBundle,
} from '@/domain/types';

const TS = '2026-09-04T00:00:00.000Z';

let counter = 0;
const nextId = (prefix: string): string => `${prefix}-${++counter}`;
/** Call in `beforeEach` when a test asserts on generated ids. */
export const resetIds = (): void => {
  counter = 0;
};

export const TEST_TRIP_ID = 'trip-test';

export function makeTrip(over: Partial<Trip> = {}): Trip {
  return {
    id: TEST_TRIP_ID,
    name: 'Test Trip',
    travellers: 2,
    startDate: '2026-09-25',
    endDate: '2026-10-17',
    originName: 'Sydney, Australia',
    originTimeZone: 'Australia/Sydney',
    defaultTimeZone: 'Europe/Rome',
    baseCurrency: 'AUD',
    spendCurrencies: ['EUR', 'CHF'],
    countries: ['IT', 'CH', 'FR', 'BE', 'NL'],
    passes: [],
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

export function makeDay(over: Partial<Day> & { date: string }): Day {
  return {
    id: over.id ?? `day-${over.date}`,
    tripId: TEST_TRIP_ID,
    city: 'Rome',
    countryCode: 'IT',
    ...over,
  };
}

export function makePlace(over: Partial<Place> & { name: string }): Place {
  return { kind: 'venue', city: 'Rome', countryCode: 'IT', ...over };
}

export function makeItem(over: Partial<Item> & { dayId: string }): Item {
  const id = over.id ?? nextId('item');
  return {
    id,
    tripId: TEST_TRIP_ID,
    sortKey: 1000,
    title: 'Something',
    type: 'sight',
    tags: [],
    status: 'planned',
    createdAt: TS,
    updatedAt: TS,
    ...over,
    dayId: over.dayId,
  };
}

export function makeBooking(over: Partial<Booking> & { date: string }): Booking {
  return {
    id: over.id ?? nextId('booking'),
    tripId: TEST_TRIP_ID,
    kind: 'attraction',
    title: 'A booking',
    status: 'to_book',
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

export function makeAccommodation(
  over: Partial<Accommodation> & { checkIn: string; checkOut: string },
): Accommodation {
  return {
    id: over.id ?? nextId('acc'),
    tripId: TEST_TRIP_ID,
    name: 'A hotel',
    place: makePlace({ name: 'A hotel', kind: 'hotel' }),
    ...over,
  };
}

export function makeReminder(over: Partial<Reminder> & { fireDate: string }): Reminder {
  return {
    id: over.id ?? nextId('rem'),
    tripId: TEST_TRIP_ID,
    title: 'Buy snacks',
    tags: ['MUST'],
    kind: 'day-before',
    status: 'pending',
    ...over,
  };
}

export function makeConflict(over: Partial<ManualConflict> = {}): ManualConflict {
  return {
    id: over.id ?? nextId('mc'),
    tripId: TEST_TRIP_ID,
    title: 'A noted conflict',
    detail: 'The notes disagree with the booking.',
    severity: 'warning',
    itemIds: [],
    source: 'notes',
    ...over,
  };
}

export function makeDocument(over: Partial<DocumentMeta> = {}): DocumentMeta {
  return {
    id: over.id ?? nextId('doc'),
    tripId: TEST_TRIP_ID,
    name: 'ticket.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    kind: 'ticket',
    attachedTo: null,
    createdAt: TS,
    ...over,
  };
}

/** Assemble a bundle, defaulting every collection to empty. */
export function makeBundle(over: Partial<TripBundle> = {}): TripBundle {
  return {
    trip: makeTrip(),
    days: [],
    items: [],
    bookings: [],
    accommodations: [],
    reminders: [],
    conflicts: [],
    documents: [],
    ...over,
  };
}

/**
 * Convenience for the common "one day, a few items" fixture.
 * Items are given ascending sortKeys in the order supplied.
 */
export function makeDayWithItems(
  date: string,
  items: Array<Partial<Item>>,
  dayOver: Partial<Day> = {},
): { day: Day; items: Item[] } {
  const day = makeDay({ date, ...dayOver });
  return {
    day,
    items: items.map((i, idx) => makeItem({ sortKey: (idx + 1) * 1000, ...i, dayId: day.id })),
  };
}
