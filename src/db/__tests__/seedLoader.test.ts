import { beforeEach, describe, expect, it, vi } from 'vitest';
import { europe2026 } from '@/seed/europe-2026';
import { db } from '../db';
import { documentsRepo, settingsRepo } from '../repo';
import {
  applyTripUpdate,
  checkForTripUpdate,
  ensureSeed,
  fetchMissingDocuments,
} from '../seedLoader';
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

describe('fetchMissingDocuments', () => {
  it('downloads each document that arrived without its file, and skips the rest', async () => {
    const file = await privateFile();
    const withoutData = {
      ...file,
      documents: file.documents.map((d) => ({ ...d, data: undefined })),
    };
    await ensureSeed({ privateTripUrl: URL, fetchImpl: serving(withoutData) });
    const [doc] = await db.documents.toArray();
    expect(await db.documentBytes.get(doc!.id)).toBeUndefined();

    const fetchImpl = vi.fn(
      async () => new Response(new Uint8Array([1, 2, 3])),
    ) as unknown as typeof fetch;
    expect(await fetchMissingDocuments('/', fetchImpl)).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(`/docs/${doc!.id}`);
    expect(new Uint8Array((await db.documentBytes.get(doc!.id))!.bytes)).toEqual(
      new Uint8Array([1, 2, 3]),
    );

    // Second launch: nothing left to fetch.
    expect(await fetchMissingDocuments('/', fetchImpl)).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('leaves a failed download for next time', async () => {
    const file = await privateFile();
    const withoutData = {
      ...file,
      documents: file.documents.map((d) => ({ ...d, data: undefined })),
    };
    await ensureSeed({ privateTripUrl: URL, fetchImpl: serving(withoutData) });

    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await fetchMissingDocuments('/', offline)).toBe(0);
    expect(await db.documentBytes.count()).toBe(0);
  });

  it('does nothing in the public build', async () => {
    expect(await fetchMissingDocuments(null)).toBe(0);
  });
});

describe('updating a preloaded trip', () => {
  it('offers nothing in the public build or before the first load', async () => {
    expect(await checkForTripUpdate(null)).toBeNull();
    const file = await privateFile();
    expect(await checkForTripUpdate(URL, serving(file))).toBeNull();
  });

  it('spots a newer file, and not the same one again', async () => {
    const file = await privateFile();
    await ensureSeed({ privateTripUrl: URL, fetchImpl: serving(file) });
    expect(await checkForTripUpdate(URL, serving(file))).toBeNull();
    const newer = { ...file, exportedAt: '2026-09-25T09:00:00.000Z' };
    expect(await checkForTripUpdate(URL, serving(newer))).not.toBeNull();
  });

  it('keeps ticks, decisions, downloaded files and what was added on the phone', async () => {
    const file = await privateFile();
    await ensureSeed({ privateTripUrl: URL, fetchImpl: serving(file) });

    // On the phone: tick an item, mark a booking sorted, decide a finding, add a booking.
    const item = (await db.items.where('tripId').equals(TRIP).first())!;
    await db.items.update(item.id, { status: 'done' });
    await db.bookings.update('bk-mtn-pilatus', { status: 'booked' });
    await db.findingStates.put({
      id: `${TRIP}|some-key`,
      tripId: TRIP,
      key: 'some-key',
      ruleId: 'manual',
      status: 'resolved',
      updatedAt: new Date().toISOString(),
    });
    const later = new Date(Date.now() + 60_000).toISOString();
    await db.bookings.put({
      ...(await db.bookings.get('bk-mtn-pilatus'))!,
      id: 'bk-made-on-phone',
      title: 'Made on the phone',
      createdAt: later,
      updatedAt: later,
    });
    const [doc] = await db.documents.toArray();

    await applyTripUpdate({ ...file, exportedAt: '2026-09-25T09:00:00.000Z' });

    expect((await db.items.get(item.id))?.status).toBe('done');
    expect((await db.bookings.get('bk-mtn-pilatus'))?.status).toBe('booked');
    expect((await db.findingStates.get(`${TRIP}|some-key`))?.status).toBe('resolved');
    expect(await db.bookings.get('bk-made-on-phone')).toBeDefined();
    expect(await db.documentBytes.get(doc!.id)).toBeDefined();
    expect(
      await checkForTripUpdate(URL, serving({ ...file, exportedAt: '2026-09-25T09:00:00.000Z' })),
    ).toBeNull();
  });

  it('carries a tick by day and title when the day loses an item', async () => {
    const file = await privateFile();
    await ensureSeed({ privateTripUrl: URL, fetchImpl: serving(file) });
    const [first, second] = await db.items.where('dayId').equals(`${TRIP}-d16`).sortBy('sortKey');
    await db.items.update(second!.id, { status: 'done' });

    // The newer file drops the first item of the day. The tick is found again by day and
    // title, which is what survives when the seed renumbers the rest.
    const items = file.bundle.items.filter((i) => i.id !== first!.id);
    await applyTripUpdate({
      ...file,
      exportedAt: '2026-09-25T09:00:00.000Z',
      bundle: { ...file.bundle, items },
    });

    const now = await db.items.where('dayId').equals(`${TRIP}-d16`).toArray();
    expect(now.find((i) => i.title === second!.title)?.status).toBe('done');
    expect(now.filter((i) => i.status === 'done')).toHaveLength(1);
  });
});
