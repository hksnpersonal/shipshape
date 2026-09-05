/**
 * The built-in sample trip, assembled and shaped as an export file.
 *
 * It loads through exactly the same import path a shared trip does, so the code that
 * matters most on someone's first launch is the code exercised most often.
 */
import type { ExportFile } from '@/domain/types';
import { APP_VERSION, SCHEMA_VERSION } from '@/db/transfer';
import { accommodations, bookings, conflicts, reminders } from './bookings';
import { daysOneToEight, itemsOneToEight } from './days-01-08';
import { daysNineToFifteen, itemsNineToFifteen } from './days-09-15';
import { daysSixteenToTwentyTwo, itemsSixteenToTwentyTwo } from './days-16-22';
import { SEED_TS } from './helpers';
import { trip } from './trip';

export const europe2026: ExportFile = {
  format: 'shipshape',
  schemaVersion: SCHEMA_VERSION,
  exportedAt: SEED_TS,
  appVersion: APP_VERSION,
  bundle: {
    trip,
    days: [...daysOneToEight, ...daysNineToFifteen, ...daysSixteenToTwentyTwo],
    items: [...itemsOneToEight, ...itemsNineToFifteen, ...itemsSixteenToTwentyTwo],
    bookings,
    accommodations,
    reminders,
    conflicts,
    documents: [],
  },
  findingStates: [],
  documents: [],
};

export { trip } from './trip';
export * from './ids';
