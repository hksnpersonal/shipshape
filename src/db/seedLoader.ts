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
import { db } from './db';
import { settingsRepo } from './repo';
import { importTrip } from './transfer';

/** Where a private build serves the bundled trip file; absent in the public build. */
export const PRIVATE_TRIP_URL =
  import.meta.env.VITE_PRIVATE_TRIP === '1'
    ? `${import.meta.env.BASE_URL}trip.shipshape.json`
    : null;

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
  await settingsRepo.patch({ preloadedTripAt: new Date().toISOString() });
  return true;
}
