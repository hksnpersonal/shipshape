/**
 * Export and import carry the only copy of someone's trip. These tests treat that
 * seriously: a round trip must return the same data, a shared copy must not collide with
 * the original, and deleting a trip must not leave orphans behind.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { europe2026 } from '@/seed/europe-2026';
import { db } from '../db';
import { bookingsRepo, documentsRepo, loadTripBundle, tripsRepo } from '../repo';
import {
  ImportError,
  base64ToBytes,
  blobToBase64,
  bytesToBase64,
  exportFileName,
  exportTrip,
  importTrip,
} from '../transfer';

const TRIP_ID = europe2026.bundle.trip.id;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('blob encoding', () => {
  it('survives a round trip through base64', async () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 37, 80, 68, 70]);
    const original = new Blob([bytes], { type: 'application/pdf' });
    expect(new Uint8Array(base64ToBytes(await blobToBase64(original)))).toEqual(bytes);
    expect(base64ToBytes(bytesToBase64(bytes.buffer)).byteLength).toBe(bytes.length);
  });
});

describe('import and export', () => {
  it('rejects something that is not a trip file, with readable reasons', async () => {
    await expect(importTrip({ hello: 'world' })).rejects.toBeInstanceOf(ImportError);
    try {
      await importTrip({ hello: 'world' });
    } catch (error) {
      expect((error as ImportError).problems.length).toBeGreaterThan(0);
    }
  });

  // The app was called TripDeck until 2026-09-05. A backup written then is still somebody's
  // only copy of a trip, and it has to open in the app that replaced it.
  it('still imports a backup written before the rename', async () => {
    const old = { ...europe2026, format: 'tripdeck' as const };
    await importTrip(old, { mode: 'replace' });

    const restored = await loadTripBundle(TRIP_ID);
    expect(restored?.items).toHaveLength(europe2026.bundle.items.length);
  });

  it('restores a trip byte for byte, documents included', async () => {
    await importTrip(europe2026, { mode: 'replace' });

    const pdf = new Blob([new Uint8Array([37, 80, 68, 70, 1, 2, 3])], { type: 'application/pdf' });
    const docId = await documentsRepo.attach(TRIP_ID, pdf, {
      name: 'tgv-ticket.pdf',
      kind: 'ticket',
      attachedTo: { kind: 'booking', id: 'bk-rail-bsl-par' },
    });

    const exported = await exportTrip(TRIP_ID, { includeDocuments: true });
    expect(exportFileName(exported.bundle)).toBe('europe-2026.shipshape.json');
    expect(exported.documents.find((d) => d.id === docId)?.data).toBeTruthy();

    // Wipe the device and put it back.
    await tripsRepo.remove(TRIP_ID);
    expect(await db.trips.count()).toBe(0);
    await importTrip(exported, { mode: 'replace' });

    const restored = await loadTripBundle(TRIP_ID);
    expect(restored?.items).toHaveLength(europe2026.bundle.items.length);
    expect(restored?.bookings).toHaveLength(europe2026.bundle.bookings.length);
    const stored = await documentsRepo.bytes(docId);
    expect(new Uint8Array(stored ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array([37, 80, 68, 70, 1, 2, 3]),
    );
    // And it comes back as something the browser can open, with its type intact.
    expect((await documentsRepo.blob(docId))?.type).toBe('application/pdf');
  });

  it('leaves ticket files out of an itinerary-only export', async () => {
    await importTrip(europe2026, { mode: 'replace' });
    await documentsRepo.attach(TRIP_ID, new Blob(['x']), { name: 'x.txt' });
    const exported = await exportTrip(TRIP_ID, { includeDocuments: false });
    expect(exported.documents.every((d) => d.data === undefined)).toBe(true);
  });

  it('brings a shared trip in alongside the original without colliding', async () => {
    await importTrip(europe2026, { mode: 'replace' });
    const shared = await exportTrip(TRIP_ID, { includeDocuments: false });

    const first = await importTrip(shared, { mode: 'copy' });
    const second = await importTrip(shared, { mode: 'copy' });

    expect(first.tripId).not.toBe(TRIP_ID);
    expect(second.tripId).not.toBe(first.tripId);
    expect(await db.trips.count()).toBe(3);

    // The copy must be internally consistent, not just present.
    const copy = await loadTripBundle(first.tripId);
    const dayIds = new Set(copy?.days.map((d) => d.id));
    expect(copy?.items.every((i) => dayIds.has(i.dayId))).toBe(true);
    expect(copy?.items.every((i) => i.tripId === first.tripId)).toBe(true);
  });

  it('keeps a booking’s passengers and a trip’s essentials through a round trip', async () => {
    await importTrip(europe2026, { mode: 'replace' });
    await bookingsRepo.patch('bk-rail-bsl-par', {
      passengers: [{ name: 'Alex Henson', coach: '5', seat: '74', ticketNumber: 'TGV-9921' }],
    });
    await tripsRepo.patch(TRIP_ID, {
      travellerNames: ['Alex Henson', 'Sam Henson'],
      essentials: [
        { id: 'ess-1', label: 'Travel insurer', value: '+61 2 5550 1234', kind: 'phone' },
      ],
    });

    const exported = await exportTrip(TRIP_ID, { includeDocuments: false });
    await tripsRepo.remove(TRIP_ID);
    await importTrip(exported, { mode: 'replace' });

    const restored = await loadTripBundle(TRIP_ID);
    expect(restored?.bookings.find((b) => b.id === 'bk-rail-bsl-par')?.passengers).toEqual([
      { name: 'Alex Henson', coach: '5', seat: '74', ticketNumber: 'TGV-9921' },
    ]);
    expect(restored?.trip.travellerNames).toEqual(['Alex Henson', 'Sam Henson']);
    expect(restored?.trip.essentials).toEqual([
      { id: 'ess-1', label: 'Travel insurer', value: '+61 2 5550 1234', kind: 'phone' },
    ]);
  });

  it('never puts an API key in an export', async () => {
    await importTrip(europe2026, { mode: 'replace' });
    await db.settings.put({
      id: 'settings',
      directions: { provider: 'google-maps', apiKey: 'secret-key-value' },
      assistant: { provider: 'none' },
      notifications: { enabled: false, defaultTime: '18:00' },
    });
    const exported = await exportTrip(TRIP_ID, { includeDocuments: true });
    expect(JSON.stringify(exported)).not.toContain('secret-key-value');
  });
});

describe('deleting things', () => {
  it('removes every row belonging to a trip', async () => {
    await importTrip(europe2026, { mode: 'replace' });
    await documentsRepo.attach(TRIP_ID, new Blob(['x']), { name: 'x.txt' });
    await tripsRepo.remove(TRIP_ID);

    for (const table of ['trips', 'days', 'items', 'bookings', 'accommodations', 'reminders']) {
      expect(await db.table(table).count(), `${table} still has rows`).toBe(0);
    }
    expect(await db.documentBytes.count()).toBe(0);
  });

  it('unlinks items when their booking is deleted rather than leaving a dangling id', async () => {
    await importTrip(europe2026, { mode: 'replace' });
    const bookingId = 'bk-rail-bsl-par';
    const before = await db.items.where('bookingId').equals(bookingId).count();
    expect(before).toBeGreaterThan(0);

    await bookingsRepo.remove(bookingId);
    expect(await db.items.where('bookingId').equals(bookingId).count()).toBe(0);
    expect(await db.bookings.get(bookingId)).toBeUndefined();
  });

  it('refuses a document too large to keep on a phone', async () => {
    await importTrip(europe2026, { mode: 'replace' });
    const huge = new Blob([new Uint8Array(16 * 1024 * 1024)]);
    await expect(documentsRepo.attach(TRIP_ID, huge, { name: 'huge.bin' })).rejects.toThrow(
      /15 MB/,
    );
  });
});
