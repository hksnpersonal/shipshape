/**
 * First launch.
 *
 * A trip app that opens empty cannot show anyone what it is for, so the sample itinerary
 * loads on the very first run. It goes in through the ordinary import path, which means
 * the code that restores a backup is proven every time someone installs the app.
 *
 * A private build (`npm run build:private`) ships the traveller's own trip file, with its
 * tickets attached, beside the app. That file loads instead, once per device, so the
 * phone opens with everything filed and nobody has to find a file picker.
 */
import { europe2026 } from '@/seed/europe-2026';
import type { BookingStatus } from '@/domain/types';
import { db } from './db';
import { settingsRepo } from './repo';
import { importTrip, parseExportFile } from './transfer';

/**
 * Where a private build serves its files; absent in the public build. The trip itself is
 * small and loads before the app opens. Each document is a separate file fetched in the
 * background afterwards, because one 13 MB download that has to finish before anything
 * shows is a phone stuck on a loading screen.
 */
export const PRIVATE_BASE =
  import.meta.env.VITE_PRIVATE_TRIP === '1' ? import.meta.env.BASE_URL : null;
export const PRIVATE_TRIP_URL = PRIVATE_BASE ? `${PRIVATE_BASE}trip.shipshape.json` : null;

export interface SeedOptions {
  privateTripUrl?: string | null;
  fetchImpl?: typeof fetch;
}

export async function ensureSeed(options: SeedOptions = {}): Promise<void> {
  const privateTripUrl =
    options.privateTripUrl === undefined ? PRIVATE_TRIP_URL : options.privateTripUrl;
  if (privateTripUrl && (await loadPrivateTrip(privateTripUrl, options.fetchImpl ?? fetch))) {
    return;
  }
  const count = await db.trips.count();
  if (count > 0) return;
  await importTrip(europe2026, { mode: 'replace' });
}

/**
 * Loads the bundled trip file once. Returns true when this device has it, whether it was
 * loaded just now or on an earlier launch. A failed download (offline on first open)
 * returns false, so the app still starts and tries again next time.
 */
async function loadPrivateTrip(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  const settings = await settingsRepo.get();
  if (settings.preloadedTripAt) return true;

  let file: unknown;
  try {
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) return false;
    file = await response.json();
  } catch {
    return false;
  }

  // Replace rather than copy: the sample trip shares this id, and two trips called
  // Europe 2026 is exactly the confusion the private build exists to avoid.
  await importTrip(file, { mode: 'replace' });
  await settingsRepo.patch({
    preloadedTripAt: new Date().toISOString(),
    preloadedTripVersion: versionOf(file),
  });
  return true;
}

const versionOf = (file: unknown): string | null =>
  typeof file === 'object' && file !== null && 'exportedAt' in file
    ? String((file as { exportedAt: unknown }).exportedAt)
    : null;

/**
 * A newer trip file than the one this device loaded, or null. Only asked once the trip has
 * been preloaded: a first launch loads the file anyway. A device that loaded before
 * versions were recorded has none, so any file counts as newer.
 */
export async function checkForTripUpdate(
  url: string | null = PRIVATE_TRIP_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  if (!url) return null;
  const settings = await settingsRepo.get();
  if (!settings.preloadedTripAt) return null;
  try {
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const file: unknown = await response.json();
    const version = versionOf(file);
    return version && version !== settings.preloadedTripVersion ? file : null;
  } catch {
    return null;
  }
}

/**
 * Replaces the trip with a newer file, keeping what the traveller did on this phone: items
 * ticked done or skipped, Plan check decisions, and every document already downloaded, so
 * an update costs a 200 KB download rather than every ticket again.
 */
export async function applyTripUpdate(file: unknown): Promise<void> {
  const parsed = parseExportFile(file);
  const tripId = parsed.bundle.trip.id;
  const { preloadedTripAt } = await settingsRepo.get();
  // Made on this phone: created after the trip file was first loaded here. Ids cannot tell
  // us - an item's id is its position in the day, so it shifts when the notes gain or
  // lose a line.
  const madeHere = (createdAt: string) => !!preloadedTripAt && createdAt > preloadedTripAt;
  const dayItemKey = (dayId: string, title: string) => `${dayId}|${title}`;

  const items = await db.items.where('tripId').equals(tripId).toArray();
  const bookings = await db.bookings.where('tripId').equals(tripId).toArray();
  const documents = await db.documents.where('tripId').equals(tripId).toArray();
  const findingStates = await db.findingStates.where('tripId').equals(tripId).toArray();
  const bytes = (await db.documentBytes.bulkGet(documents.map((d) => d.id))).filter(
    (row) => row !== undefined,
  );
  const incomingBookings = new Map(parsed.bundle.bookings.map((b) => [b.id, b]));
  const incomingDocs = new Set(parsed.bundle.documents.map((d) => d.id));
  const ticks = new Map(
    items
      .filter((i) => i.status !== 'planned' && !madeHere(i.createdAt))
      .map((i) => [dayItemKey(i.dayId, i.title), i.status]),
  );

  await importTrip(parsed, { mode: 'replace' });

  await db.transaction(
    'rw',
    [db.items, db.bookings, db.findingStates, db.documents, db.documentBytes],
    async () => {
      // Things made on this phone: the file has never heard of them, so put them back.
      await db.bookings.bulkPut(bookings.filter((b) => madeHere(b.createdAt)));
      await db.items.bulkPut(items.filter((i) => madeHere(i.createdAt)));
      const docsKept = documents.filter((d) => madeHere(d.createdAt) || incomingDocs.has(d.id));
      await db.documents.bulkPut(docsKept.filter((d) => madeHere(d.createdAt)));
      const keptIds = new Set(docsKept.map((d) => d.id));
      await db.documentBytes.bulkPut(bytes.filter((row) => keptIds.has(row.id)));

      // Progress made on this phone: ticks, matched by day and title, and bookings marked
      // as sorted. The file only wins a booking's status when it is further along.
      for (const item of await db.items.where('tripId').equals(tripId).toArray()) {
        const status = ticks.get(dayItemKey(item.dayId, item.title));
        if (status && item.status === 'planned') await db.items.update(item.id, { status });
      }
      for (const booking of bookings) {
        const next = incomingBookings.get(booking.id);
        if (next && STATUS_RANK[booking.status] > STATUS_RANK[next.status]) {
          await db.bookings.update(booking.id, { status: booking.status });
        }
      }
      await db.findingStates.bulkPut(findingStates);
    },
  );
  await settingsRepo.patch({ preloadedTripVersion: versionOf(parsed) });
}

/** How far along a booking is; not needed and cancelled are decisions, so they rank top. */
const STATUS_RANK: Record<BookingStatus, number> = {
  to_book: 0,
  on_site: 1,
  booked: 2,
  confirmed: 3,
  not_needed: 4,
  cancelled: 4,
};

/**
 * Downloads the file behind every document that arrived without one, one at a time.
 * Safe to run on every launch: a document that already has its bytes is skipped, and one
 * that fails (no signal on a train) is simply tried again next time. Returns how many
 * files arrived.
 */
export async function fetchMissingDocuments(
  baseUrl: string | null = PRIVATE_BASE,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  if (!baseUrl) return 0;
  const metas = await db.documents.toArray();
  let arrived = 0;
  for (const meta of metas) {
    if (await db.documentBytes.get(meta.id)) continue;
    try {
      const response = await fetchImpl(`${baseUrl}docs/${encodeURIComponent(meta.id)}`);
      if (!response.ok) continue;
      const bytes = await response.arrayBuffer();
      // The document may have been removed while it downloaded.
      if (await db.documents.get(meta.id)) {
        await db.documentBytes.put({ id: meta.id, bytes });
        arrived += 1;
      }
    } catch {
      // Offline or interrupted: leave it for the next launch.
    }
  }
  return arrived;
}
