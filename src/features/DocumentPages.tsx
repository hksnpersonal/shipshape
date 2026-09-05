/**
 * The documents vault: tickets and confirmations for things already bought, kept as
 * bytes on this device rather than as a pile of emails to search through at a barrier.
 */
import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { FileText, Trash2, Upload } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Section } from '@/components/ui';
import { documentsRepo } from '@/db/repo';
import { useTripBundle, useTripDocuments } from '@/hooks/useTrip';
import type { DocumentKind, DocumentMeta, DocumentOwnerKind, ID, TripBundle } from '@/domain/types';

const KIND_WORDS: Record<DocumentKind, string> = {
  ticket: 'Ticket',
  confirmation: 'Confirmation',
  id: 'ID',
  insurance: 'Insurance',
  other: 'Other',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * How long an object URL stays alive after the tab opens. The new tab fetches the URL
 * asynchronously, so revoking it synchronously hands the reader a blank page - reliably
 * so on iOS Safari, which is the phone this gets opened on at a ticket barrier. Wait,
 * then free the memory.
 */
export const OBJECT_URL_TTL_MS = 60_000;

/** Rebuilds the file from stored bytes, opens it in a new tab, and cleans up after. */
async function openDocument(id: ID): Promise<void> {
  const blob = await documentsRepo.blob(id);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_TTL_MS);
}

/** Who a document is filed against, in words, for the vault's own list. */
function describeOwner(bundle: TripBundle, doc: DocumentMeta): string | null {
  if (!doc.attachedTo) return null;
  const { kind, id } = doc.attachedTo;
  if (kind === 'booking') return bundle.bookings.find((b) => b.id === id)?.title ?? null;
  if (kind === 'item') return bundle.items.find((i) => i.id === id)?.title ?? null;
  if (kind === 'accommodation') {
    return bundle.accommodations.find((a) => a.id === id)?.name ?? null;
  }
  return null;
}

/** One filed document, shown the same way in the vault and on a booking. */
export function DocumentRow({ doc, ownerLabel }: { doc: DocumentMeta; ownerLabel?: string }) {
  const remove = async () => {
    if (!window.confirm(`Remove ${doc.name}? This cannot be undone.`)) return;
    await documentsRepo.remove(doc.id);
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{doc.name}</p>
          <p className="text-sm text-slate-500">
            {KIND_WORDS[doc.kind]} · {formatSize(doc.size)} · attached{' '}
            {new Date(doc.createdAt).toLocaleDateString()}
          </p>
          {ownerLabel ? (
            <p className="mt-0.5 text-xs text-slate-400">Filed against {ownerLabel}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => void openDocument(doc.id)}>
            <FileText size={15} aria-hidden /> Open
          </Button>
          <Button variant="danger" onClick={() => void remove()}>
            <Trash2 size={15} aria-hidden /> Remove
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** The file input plus the error message, shared by the vault and the booking page. */
export function AttachDocumentButton({
  tripId,
  attachedTo,
  label = 'Add a document',
}: {
  tripId: ID;
  attachedTo?: { kind: DocumentOwnerKind; id: ID };
  label?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const attach = async (file: File) => {
    setError(null);
    try {
      await documentsRepo.attach(tripId, file, { name: file.name, attachedTo });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That file could not be attached.');
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => fileInput.current?.click()}>
        <Upload size={15} aria-hidden /> {label}
      </Button>
      <input
        ref={fileInput}
        type="file"
        aria-label={label}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void attach(file);
          event.target.value = '';
        }}
      />
      {error ? (
        <Card className="mt-3 border-rose-300 bg-rose-50">
          <p className="text-sm font-medium text-rose-800">{error}</p>
        </Card>
      ) : null}
    </>
  );
}

export function DocumentsVaultPage() {
  const { tripId } = useParams();
  const bundle = useTripBundle(tripId);
  const documents = useTripDocuments(tripId);

  if (!bundle) return <p className="text-slate-500">Loading.</p>;

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Tickets and confirmations you have already bought, kept on this device."
      />

      {/*
        In the body rather than the header's action row. The size-limit message renders under
        the button, and the header lays its actions out in a shrink-0 row, which would squeeze
        the message in beside it.
      */}
      <div className="mb-4">
        <AttachDocumentButton tripId={bundle.trip.id} />
      </div>

      {documents.length === 0 ? (
        <EmptyState title="Nothing filed yet">
          Attach a ticket or confirmation once you have bought it. It stays on this device and
          travels with an export.
        </EmptyState>
      ) : (
        <Section title={`${documents.length} filed`}>
          <div className="space-y-2">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                ownerLabel={describeOwner(bundle, doc) ?? undefined}
              />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
