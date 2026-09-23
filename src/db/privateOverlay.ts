/**
 * The private half of a trip.
 *
 * The bundled seed is public: it ships inside the site. Booking references, ticket numbers,
 * seats and the documents themselves do not belong there, because a reference plus a
 * surname is enough to cancel a booking. They live in an overlay file kept beside the
 * documents, and `scripts/make-private-trip.mjs` merges the two into one import file.
 */
import { ExportFileSchema, validateBundleIntegrity } from '@/domain/schemas';
import type {
  Booking,
  DocumentKind,
  DocumentMeta,
  DocumentOwnerKind,
  ExportFile,
  ID,
  Trip,
} from '@/domain/types';
import { bytesToBase64 } from './transfer';

export interface OverlayDocument {
  /** Path relative to the overlay file. */
  file: string;
  /** Shown in the vault; defaults to the file name. */
  name?: string;
  kind: DocumentKind;
  attachTo?: { kind: DocumentOwnerKind; id: ID };
  notes?: string;
}

export interface PrivateOverlay {
  trip?: Partial<Omit<Trip, 'id'>>;
  /** Merged field by field over the seed booking with the same id. */
  bookings?: Record<ID, Partial<Omit<Booking, 'id' | 'tripId'>>>;
  documents?: OverlayDocument[];
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export function mimeTypeOf(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

/**
 * Returns a new export file; the seed is not mutated. Throws with every problem listed
 * when a patch names a booking that does not exist or the result fails validation, so a
 * typo in the overlay stops the build instead of quietly dropping a reference.
 */
export function applyOverlay(
  seed: ExportFile,
  overlay: PrivateOverlay,
  readFile: (relativePath: string) => ArrayBuffer,
  now: string = new Date().toISOString(),
): ExportFile {
  const file = structuredClone(seed);
  const { bundle } = file;
  const problems: string[] = [];

  if (overlay.trip) bundle.trip = { ...bundle.trip, ...overlay.trip, updatedAt: now };

  for (const [id, patch] of Object.entries(overlay.bookings ?? {})) {
    const index = bundle.bookings.findIndex((b) => b.id === id);
    if (index === -1) {
      problems.push(`No booking with id ${id}`);
      continue;
    }
    bundle.bookings[index] = { ...bundle.bookings[index]!, ...patch, updatedAt: now };
  }

  const owners: Record<DocumentOwnerKind, Set<ID>> = {
    trip: new Set([bundle.trip.id]),
    booking: new Set(bundle.bookings.map((b) => b.id)),
    item: new Set(bundle.items.map((i) => i.id)),
    accommodation: new Set(bundle.accommodations.map((a) => a.id)),
  };
  const documents: ExportFile['documents'] = [...file.documents];
  (overlay.documents ?? []).forEach((doc, n) => {
    if (doc.attachTo && !owners[doc.attachTo.kind].has(doc.attachTo.id)) {
      problems.push(`${doc.file} is attached to a missing ${doc.attachTo.kind} ${doc.attachTo.id}`);
    }
    const bytes = readFile(doc.file);
    const meta: DocumentMeta = {
      id: `doc-private-${String(n + 1).padStart(3, '0')}`,
      tripId: bundle.trip.id,
      name: doc.name ?? doc.file.split('/').pop() ?? doc.file,
      mimeType: mimeTypeOf(doc.file),
      size: bytes.byteLength,
      kind: doc.kind,
      attachedTo: doc.attachTo ?? null,
      createdAt: now,
      ...(doc.notes ? { notes: doc.notes } : {}),
    };
    bundle.documents.push(meta);
    documents.push({ ...meta, data: bytesToBase64(bytes) });
  });
  file.documents = documents;
  file.exportedAt = now;

  const parsed = ExportFileSchema.safeParse(file);
  if (!parsed.success) {
    problems.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  problems.push(...validateBundleIntegrity(bundle));
  if (problems.length > 0) {
    throw new Error(`The private overlay does not apply cleanly:\n- ${problems.join('\n- ')}`);
  }
  return file;
}
