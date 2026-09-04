/**
 * Export, import, and sharing.
 *
 * One JSON file is the trip: it is the backup, the way to move to a new phone, the way to
 * hand the itinerary to the person travelling with you, and the format the built-in
 * sample trip ships in. Using one path for all four means it is exercised constantly
 * rather than only when someone needs it most.
 *
 * API keys are never included. They are the one thing in the database that must not
 * travel with a shared file.
 */
import { nanoid } from 'nanoid';
import { ExportFileSchema, validateBundleIntegrity } from '@/domain/schemas';
import { findingStateId } from '@/lint/keys';
import type { ExportFile, FindingState, ID, TripBundle } from '@/domain/types';
import { db } from './db';
import { loadTripBundle } from './repo';

export const SCHEMA_VERSION = 1 as const;
export const APP_VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Blob encoding
// ---------------------------------------------------------------------------

/**
 * A Blob that has been through structured clone into storage does not always come back
 * with an `arrayBuffer` method, so fall back to the reader that predates it.
 */
async function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the stored file.'));
    reader.readAsArrayBuffer(blob);
  });
}

export function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000; // large enough to be fast, small enough not to blow the stack
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(await bytesOf(blob));
}

export { bytesOf };

export function base64ToBytes(data: string): ArrayBuffer {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportOptions {
  /** Attach ticket PDFs and photos. Off makes a small file safe to send in a message. */
  includeDocuments: boolean;
}

export async function exportTrip(
  tripId: ID,
  options: ExportOptions = { includeDocuments: true },
): Promise<ExportFile> {
  const bundle = await loadTripBundle(tripId);
  if (!bundle) throw new Error(`No trip with id ${tripId}`);

  const findingStates = await db.findingStates.where('tripId').equals(tripId).toArray();

  const documents: ExportFile['documents'] = [];
  for (const meta of bundle.documents) {
    if (!options.includeDocuments) {
      documents.push({ ...meta });
      continue;
    }
    const row = await db.documentBytes.get(meta.id);
    documents.push(row ? { ...meta, data: bytesToBase64(row.bytes) } : { ...meta });
  }

  return {
    format: 'tripdeck',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    bundle,
    findingStates,
    documents,
  };
}

export function exportFileName(bundle: TripBundle): string {
  const slug = bundle.trip.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'trip'}.tripdeck.json`;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportMode =
  /** Overwrite the trip with the same id. Used for restoring a backup. */
  | 'replace'
  /** Bring it in alongside, with fresh ids. Used for a trip someone sent you. */
  | 'copy';

export interface ImportResult {
  tripId: ID;
  counts: Record<string, number>;
  warnings: string[];
}

export class ImportError extends Error {
  /** Readable problems, one per line, safe to show a user. */
  readonly problems: string[];

  constructor(message: string, problems: string[]) {
    super(message);
    this.name = 'ImportError';
    this.problems = problems;
  }
}

/** Rewrites every id in a bundle so an imported trip can sit beside the original. */
function remapIds(file: ExportFile): ExportFile {
  const map = new Map<string, string>();
  const remap = (id: string): string => {
    const existing = map.get(id);
    if (existing) return existing;
    const fresh = `${id.split('-')[0] ?? 'id'}-${nanoid(10)}`;
    map.set(id, fresh);
    return fresh;
  };
  const optional = (id: string | null | undefined): string | null | undefined =>
    id === null || id === undefined ? id : remap(id);

  const { bundle } = file;
  const tripId = remap(bundle.trip.id);

  const days = bundle.days.map((d) => ({ ...d, id: remap(d.id), tripId }));
  const bookings = bundle.bookings.map((b) => ({ ...b, id: remap(b.id), tripId }));
  const items = bundle.items.map((i) => ({
    ...i,
    id: remap(i.id),
    tripId,
    dayId: remap(i.dayId),
    bookingId: optional(i.bookingId) ?? null,
  }));
  const accommodations = bundle.accommodations.map((a) => ({
    ...a,
    id: remap(a.id),
    tripId,
    bookingId: optional(a.bookingId) ?? null,
  }));
  const reminders = bundle.reminders.map((r) => ({
    ...r,
    id: remap(r.id),
    tripId,
    forItemId: optional(r.forItemId) ?? null,
  }));
  const conflicts = bundle.conflicts.map((c) => ({
    ...c,
    id: remap(c.id),
    tripId,
    itemIds: c.itemIds.map(remap),
    ...(c.bookingIds ? { bookingIds: c.bookingIds.map(remap) } : {}),
    ...(c.dayId ? { dayId: remap(c.dayId) } : {}),
  }));
  const documents = bundle.documents.map((d) => ({
    ...d,
    id: remap(d.id),
    tripId,
    attachedTo: d.attachedTo ? { ...d.attachedTo, id: remap(d.attachedTo.id) } : null,
  }));

  const trip = {
    ...bundle.trip,
    id: tripId,
    ...(bundle.trip.swapGroups
      ? {
          swapGroups: bundle.trip.swapGroups.map((g) => ({
            ...g,
            id: remap(g.id),
            dayIds: g.dayIds.map(remap),
          })),
        }
      : {}),
  };

  // Finding keys embed item ids, so they have to be rewritten too or a resolved
  // conflict would silently reattach itself to the wrong thing.
  const findingStates: FindingState[] = file.findingStates.map((s) => {
    const [ruleId = s.ruleId, ids = ''] = s.key.split('|');
    const newKey = `${ruleId}|${ids
      .split(',')
      .filter(Boolean)
      .map((id) => map.get(id) ?? id)
      .join(',')}`;
    return { ...s, id: findingStateId(tripId, newKey), tripId, key: newKey };
  });

  const exportedDocuments = file.documents.map((d) => ({
    ...d,
    id: map.get(d.id) ?? d.id,
    tripId,
    attachedTo: d.attachedTo
      ? { ...d.attachedTo, id: map.get(d.attachedTo.id) ?? d.attachedTo.id }
      : null,
  }));

  return {
    ...file,
    bundle: { trip, days, items, bookings, accommodations, reminders, conflicts, documents },
    findingStates,
    documents: exportedDocuments,
  };
}

/** Parse and check a file without writing anything. */
export function parseExportFile(input: unknown): ExportFile {
  const parsed = ExportFileSchema.safeParse(input);
  if (!parsed.success) {
    throw new ImportError(
      'That file is not a TripDeck export, or it is damaged.',
      parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || 'file'}: ${i.message}`),
    );
  }
  const problems = validateBundleIntegrity(parsed.data.bundle);
  if (problems.length > 0) {
    throw new ImportError('The file parsed but its contents do not hang together.', problems);
  }
  return parsed.data as ExportFile;
}

export async function importTrip(
  input: unknown,
  options: { mode: ImportMode } = { mode: 'copy' },
): Promise<ImportResult> {
  const parsed = parseExportFile(input);
  const file = options.mode === 'copy' ? remapIds(parsed) : parsed;
  const { bundle } = file;
  const tripId = bundle.trip.id;
  const warnings: string[] = [];

  if (options.mode === 'replace' && (await db.trips.get(tripId))) {
    warnings.push('An existing trip with the same id was replaced.');
  }

  await db.transaction('rw', db.tables, async () => {
    if (options.mode === 'replace') {
      for (const name of [
        'days',
        'items',
        'bookings',
        'accommodations',
        'documents',
        'reminders',
        'conflicts',
        'findingStates',
      ]) {
        await db.table(name).where('tripId').equals(tripId).delete();
      }
      await db.trips.delete(tripId);
    }

    await db.trips.add(bundle.trip);
    await db.days.bulkAdd(bundle.days);
    await db.items.bulkAdd(bundle.items);
    await db.bookings.bulkAdd(bundle.bookings);
    await db.accommodations.bulkAdd(bundle.accommodations);
    await db.reminders.bulkAdd(bundle.reminders);
    await db.conflicts.bulkAdd(bundle.conflicts);
    await db.findingStates.bulkAdd(file.findingStates);

    for (const doc of file.documents) {
      const { data, ...meta } = doc;
      await db.documents.put(meta);
      if (data) await db.documentBytes.put({ id: meta.id, bytes: base64ToBytes(data) });
      else warnings.push(`"${meta.name}" came without its file and is listed but empty.`);
    }
  });

  return {
    tripId,
    counts: {
      days: bundle.days.length,
      items: bundle.items.length,
      bookings: bundle.bookings.length,
      accommodations: bundle.accommodations.length,
      reminders: bundle.reminders.length,
      conflicts: bundle.conflicts.length,
      documents: file.documents.length,
    },
    warnings,
  };
}
