/**
 * First launch.
 *
 * A trip app that opens empty cannot show anyone what it is for, so the sample itinerary
 * loads on the very first run. It goes in through the ordinary import path, which means
 * the code that restores a backup is proven every time someone installs the app.
 */
import { europe2026 } from '@/seed/europe-2026';
import { db } from './db';
import { importTrip } from './transfer';

export async function ensureSeed(): Promise<void> {
  const count = await db.trips.count();
  if (count > 0) return;
  await importTrip(europe2026, { mode: 'replace' });
}
