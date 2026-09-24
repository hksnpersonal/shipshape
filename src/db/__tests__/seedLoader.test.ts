import { beforeEach, describe, expect, it, vi } from 'vitest';
import { europe2026 } from '@/seed/europe-2026';
import { db } from '../db';
import { documentsRepo, settingsRepo } from '../repo';
import { ensureSeed } from '../seedLoader';
import { exportTrip, importTrip } from '../transfer';

const TRIP = europe2026.bundle.trip.id;
const URL = '/trip.shipshape.json';

/** A private trip file: the sample trip plus one attached ticket. */
async function privateFile() {
  await importTrip(europe2026, { mode: 'replace' });
  await documentsRepo.attach(TRIP, new Blob(['ticket']), {
    name: 'ticket.pdf',
    kind: 'ticket',
    attachedTo: { kind: 'booking', id: 'bk-rail-par-bru' },
  });
  const file = await exportTrip(TRIP, { includeDocuments: true });
  await db.delete();
  await db.open();
  return file;
}

const serving = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('ensureSeed', () => {
  it('loads the sample trip in the public build', async () => {
    await ensureSeed({ privateTripUrl: null });
    expect(await db.trips.count()).toBe(1);
    expect(await db.documents.count()).toBe(0);
  });

  it('opens a private build with the trip and its tickets already filed', async () => {
    const file = await privateFile();
    await ensureSeed({ privateTripUrl: URL, fetchImpl: serving(file) });

    expect(await db.trips.count()).toBe(1);
    const docs = await db.documents.where('tripId').equals(TRIP).toArray();
    expect(docs.map((d) => d.attachedTo?.id)).toEqual(['bk-rail-par-bru']);
    expect(await db.documentBytes.get(docs[0]!.id)).toBeDefined();
    expect((await settingsRepo.get()).preloadedTripAt).toBeTruthy();
  });

  it('replaces the sample trip rather than sitting beside it', async () => {
    await ensureSeed({ privateTripUrl: null });
    const file = await privateFile();
    await importTrip(europe2026, { mode: 'replace' });

    await ensureSeed({ privateTripUrl: URL, fetchImpl: serving(file) });
    expect(await db.trips.count()).toBe(1);
    expect(await db.documents.count()).toBe(1);
  });

  it('loads once, so changes made on the phone survive the next launch', async () => {
    const file = await privateFile();
    const fetchImpl = serving(file);
    await ensureSeed({ privateTripUrl: URL, fetchImpl });
    await db.bookings.update('bk-rail-par-bru', { notes: 'Changed on the phone' });

    await ensureSeed({ privateTripUrl: URL, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((await db.bookings.get('bk-rail-par-bru'))?.notes).toBe('Changed on the phone');
  });

  it('still starts when the file cannot be fetched, and tries again next launch', async () => {
    const file = await privateFile();
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    await ensureSeed({ privateTripUrl: URL, fetchImpl: offline });
    // The sample trip carries the phone through; nothing is marked as loaded.
    expect(await db.trips.count()).toBe(1);
    expect(await db.documents.count()).toBe(0);
    expect((await settingsRepo.get()).preloadedTripAt).toBeFalsy();

    await ensureSeed({ privateTripUrl: URL, fetchImpl: serving(file) });
    expect(await db.trips.count()).toBe(1);
    expect(await db.documents.count()).toBe(1);
  });
});
