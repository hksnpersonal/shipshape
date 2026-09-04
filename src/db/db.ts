/**
 * On-device storage.
 *
 * Everything lives in the browser: no account, no server, no network. That is a
 * deliberate trade. It makes the app work in a Swiss valley with no signal, and it means
 * the only copy of an edit is on the phone that made it, which is why export exists and
 * why the app nags about it.
 */
import Dexie, { type Table } from 'dexie';
import type {
  Accommodation,
  Booking,
  Day,
  DocumentBytes,
  DocumentMeta,
  FindingState,
  ID,
  Item,
  ManualConflict,
  ProviderSettings,
  Reminder,
  Trip,
} from '@/domain/types';

export class TripDeckDB extends Dexie {
  trips!: Table<Trip, ID>;
  days!: Table<Day, ID>;
  items!: Table<Item, ID>;
  bookings!: Table<Booking, ID>;
  accommodations!: Table<Accommodation, ID>;
  documents!: Table<DocumentMeta, ID>;
  /** Kept apart from `documents` so listing never pulls binary data into memory. */
  documentBytes!: Table<DocumentBytes, ID>;
  reminders!: Table<Reminder, ID>;
  conflicts!: Table<ManualConflict, ID>;
  findingStates!: Table<FindingState, string>;
  settings!: Table<ProviderSettings, string>;

  constructor(name = 'tripdeck') {
    super(name);
    // Never remove or edit a version block once it has shipped: Dexie replays them in
    // order to upgrade a database that has been sitting on someone's phone.
    this.version(1).stores({
      trips: 'id, updatedAt',
      days: 'id, tripId, [tripId+date]',
      items: 'id, tripId, dayId, [dayId+sortKey], bookingId',
      bookings: 'id, tripId, [tripId+date], [tripId+status], kind',
      accommodations: 'id, tripId, [tripId+checkIn]',
      documents: 'id, tripId, [attachedTo.kind+attachedTo.id]',
      documentBytes: 'id',
      reminders: 'id, tripId, [tripId+fireDate]',
      conflicts: 'id, tripId',
      findingStates: 'id, tripId, [tripId+status], key',
      settings: 'id',
    });
  }
}

export const db = new TripDeckDB();

/** Every table that holds rows belonging to one trip, for cascade operations. */
export const TRIP_SCOPED_TABLES = [
  'days',
  'items',
  'bookings',
  'accommodations',
  'documents',
  'reminders',
  'conflicts',
  'findingStates',
] as const;
