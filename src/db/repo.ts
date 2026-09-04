/**
 * Every write the app makes, in one place.
 *
 * Components call these rather than touching Dexie, so a rule like "deleting a trip
 * leaves nothing behind" is enforced once instead of being remembered everywhere.
 */
import { nanoid } from 'nanoid';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { planDaySwap, type DaySwapPlan } from '@/domain/swap';
import { moveItem, nextSortKey, renormalise, sortKeyBetween } from '@/domain/ordering';
import { findingStateId } from '@/lint/keys';
import type {
  Booking,
  DocumentKind,
  DocumentMeta,
  DocumentOwnerKind,
  FindingStatus,
  ID,
  Item,
  ItemStatus,
  ProviderSettings,
  Reminder,
  Trip,
  TripBundle,
} from '@/domain/types';
import { TRIP_SCOPED_TABLES, db } from './db';
import { bytesOf } from './transfer';

const now = (): string => new Date().toISOString();

export const newId = (prefix: string): string => `${prefix}-${nanoid(10)}`;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Everything about one trip, in the shape the pure functions expect. */
export async function loadTripBundle(tripId: ID): Promise<TripBundle | null> {
  const trip = await db.trips.get(tripId);
  if (!trip) return null;
  const [days, items, bookings, accommodations, reminders, conflicts, documents] =
    await Promise.all([
      db.days.where('tripId').equals(tripId).toArray(),
      db.items.where('tripId').equals(tripId).toArray(),
      db.bookings.where('tripId').equals(tripId).toArray(),
      db.accommodations.where('tripId').equals(tripId).toArray(),
      db.reminders.where('tripId').equals(tripId).toArray(),
      db.conflicts.where('tripId').equals(tripId).toArray(),
      db.documents.where('tripId').equals(tripId).toArray(),
    ]);
  return { trip, days, items, bookings, accommodations, reminders, conflicts, documents };
}

export async function listTrips(): Promise<Trip[]> {
  const trips = await db.trips.toArray();
  return trips.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export const tripsRepo = {
  async patch(tripId: ID, patch: Partial<Trip>): Promise<void> {
    await db.trips.update(tripId, { ...patch, updatedAt: now() });
  },

  /** Removes the trip and every row that belongs to it, all or nothing. */
  async remove(tripId: ID): Promise<void> {
    await db.transaction('rw', db.tables, async () => {
      // Collect the document ids first. Deleting the metadata rows before reading them
      // would leave the files behind with nothing pointing at them.
      const docIds = (await db.documents.where('tripId').equals(tripId).primaryKeys()) as ID[];
      for (const name of TRIP_SCOPED_TABLES) {
        await db.table(name).where('tripId').equals(tripId).delete();
      }
      await db.documentBytes.bulkDelete(docIds);
      await db.trips.delete(tripId);
    });
  },
};

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const itemsRepo = {
  async setStatus(itemId: ID, status: ItemStatus): Promise<void> {
    await db.items.update(itemId, { status, updatedAt: now() });
  },

  async patch(itemId: ID, patch: Partial<Item>): Promise<void> {
    await db.items.update(itemId, { ...patch, updatedAt: now() });
  },

  async remove(itemId: ID): Promise<void> {
    await db.items.delete(itemId);
  },

  /** Move one item one place up or down within its day. */
  async move(dayId: ID, itemId: ID, dir: 'up' | 'down'): Promise<void> {
    await db.transaction('rw', db.items, async () => {
      const items = await db.items.where('dayId').equals(dayId).toArray();
      const changed = moveItem(items, itemId, dir);
      const stamp = now();
      for (const item of changed) {
        await db.items.update(item.id, { sortKey: item.sortKey, updatedAt: stamp });
      }
    });
  },

  /** Append a new item to the end of a day. */
  async add(tripId: ID, dayId: ID, draft: Partial<Item> & { title: string }): Promise<ID> {
    const stamp = now();
    const existing = await db.items.where('dayId').equals(dayId).toArray();
    const item: Item = {
      id: newId('item'),
      tripId,
      dayId,
      sortKey: nextSortKey(existing),
      type: 'freeform',
      tags: [],
      status: 'planned',
      createdAt: stamp,
      updatedAt: stamp,
      ...draft,
    };
    await db.items.add(item);
    return item.id;
  },

  /** Insert an item between two others, respacing the day if the gap has closed. */
  async insertAfter(tripId: ID, dayId: ID, afterId: ID | null, title: string): Promise<ID> {
    return db.transaction('rw', db.items, async () => {
      const items = (await db.items.where('dayId').equals(dayId).toArray()).sort(
        (a, b) => a.sortKey - b.sortKey,
      );
      const index = afterId ? items.findIndex((i) => i.id === afterId) : -1;
      const before = index >= 0 ? items[index] : undefined;
      const after = items[index + 1];
      const stamp = now();
      const item: Item = {
        id: newId('item'),
        tripId,
        dayId,
        sortKey: sortKeyBetween(before, after),
        title,
        type: 'freeform',
        tags: [],
        status: 'planned',
        createdAt: stamp,
        updatedAt: stamp,
      };
      await db.items.add(item);
      for (const changed of renormalise([...items, item])) {
        await db.items.update(changed.id, { sortKey: changed.sortKey, updatedAt: stamp });
      }
      return item.id;
    });
  },
};

// ---------------------------------------------------------------------------
// Days and the weather swap
// ---------------------------------------------------------------------------

export const daysRepo = {
  /**
   * Swap two days' contents. The plan is computed from a snapshot and applied in one
   * transaction, and the held-back list is returned so the caller can say what stayed.
   */
  async swapContents(tripId: ID, dayA: ID, dayB: ID): Promise<DaySwapPlan> {
    return db.transaction('rw', db.items, db.bookings, db.days, async () => {
      const bundle = await loadTripBundle(tripId);
      if (!bundle) return { moves: [], heldBack: [] };
      const plan = planDaySwap(bundle, dayA, dayB);
      const stamp = now();
      for (const move of plan.moves) {
        await db.items.update(move.itemId, {
          dayId: move.toDayId,
          sortKey: move.sortKey,
          updatedAt: stamp,
        });
      }
      return plan;
    });
  },
};

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export const bookingsRepo = {
  async add(tripId: ID, draft: Partial<Booking> & { title: string; date: string }): Promise<ID> {
    const stamp = now();
    const booking: Booking = {
      id: newId('bk'),
      tripId,
      kind: 'other',
      status: 'to_book',
      createdAt: stamp,
      updatedAt: stamp,
      ...draft,
    };
    await db.bookings.add(booking);
    return booking.id;
  },

  async patch(bookingId: ID, patch: Partial<Booking>): Promise<void> {
    await db.bookings.update(bookingId, { ...patch, updatedAt: now() });
  },

  async setStatus(bookingId: ID, status: Booking['status']): Promise<void> {
    await db.bookings.update(bookingId, { status, updatedAt: now() });
  },

  /** Deleting a booking must not leave items pointing at a row that is gone. */
  async remove(bookingId: ID): Promise<void> {
    await db.transaction('rw', db.bookings, db.items, db.documents, async () => {
      const linked = await db.items.where('bookingId').equals(bookingId).primaryKeys();
      const stamp = now();
      for (const id of linked as ID[]) {
        await db.items.update(id, { bookingId: null, updatedAt: stamp });
      }
      await db.bookings.delete(bookingId);
    });
  },
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** Refuse anything large enough to threaten the browser's storage quota. */
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export const documentsRepo = {
  async attach(
    tripId: ID,
    file: File | Blob,
    options: {
      name: string;
      kind?: DocumentKind;
      attachedTo?: { kind: DocumentOwnerKind; id: ID } | null;
      notes?: string;
    },
  ): Promise<ID> {
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new Error(
        `That file is ${Math.round(file.size / 1024 / 1024)} MB. The limit is 15 MB, so the app keeps working offline.`,
      );
    }
    const bytes = await bytesOf(file);
    const meta: DocumentMeta = {
      id: newId('doc'),
      tripId,
      name: options.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      kind: options.kind ?? 'other',
      attachedTo: options.attachedTo ?? null,
      createdAt: now(),
      ...(options.notes ? { notes: options.notes } : {}),
    };
    await db.transaction('rw', db.documents, db.documentBytes, async () => {
      await db.documents.add(meta);
      await db.documentBytes.add({ id: meta.id, bytes });
    });
    return meta.id;
  },

  async bytes(documentId: ID): Promise<ArrayBuffer | undefined> {
    return (await db.documentBytes.get(documentId))?.bytes;
  },

  /** The file as something a browser can open, rebuilt from the stored bytes. */
  async blob(documentId: ID): Promise<Blob | undefined> {
    const [meta, row] = await Promise.all([
      db.documents.get(documentId),
      db.documentBytes.get(documentId),
    ]);
    if (!row) return undefined;
    return new Blob([row.bytes], { type: meta?.mimeType ?? 'application/octet-stream' });
  },

  async remove(documentId: ID): Promise<void> {
    await db.transaction('rw', db.documents, db.documentBytes, async () => {
      await db.documents.delete(documentId);
      await db.documentBytes.delete(documentId);
    });
  },
};

// ---------------------------------------------------------------------------
// Findings, reminders, settings
// ---------------------------------------------------------------------------

export const findingsRepo = {
  async setState(
    tripId: ID,
    key: string,
    ruleId: string,
    status: FindingStatus,
    note?: string,
  ): Promise<void> {
    await db.findingStates.put({
      id: findingStateId(tripId, key),
      tripId,
      key,
      ruleId,
      status,
      ...(note ? { note } : {}),
      updatedAt: now(),
    });
  },

  async statesFor(tripId: ID) {
    return db.findingStates.where('tripId').equals(tripId).toArray();
  },

  async reopen(tripId: ID, key: string): Promise<void> {
    await db.findingStates.delete(findingStateId(tripId, key));
  },
};

export const remindersRepo = {
  async setStatus(reminderId: ID, status: Reminder['status']): Promise<void> {
    await db.reminders.update(reminderId, { status });
  },
  async add(tripId: ID, draft: Partial<Reminder> & { title: string; fireDate: string }) {
    const reminder: Reminder = {
      id: newId('rem'),
      tripId,
      tags: [],
      kind: 'custom',
      status: 'pending',
      ...draft,
    };
    await db.reminders.add(reminder);
    return reminder.id;
  },
};

export const settingsRepo = {
  async get(): Promise<ProviderSettings> {
    return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
  },
  async patch(patch: Partial<ProviderSettings>): Promise<void> {
    const current = await settingsRepo.get();
    await db.settings.put({ ...current, ...patch, id: 'settings' });
  },
};
