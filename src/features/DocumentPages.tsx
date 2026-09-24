/**
 * The documents vault: tickets and confirmations for things already bought, kept as
 * bytes on this device rather than as a pile of emails to search through at a barrier.
 */
import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { FileText, Trash2, Upload } from 'lucide-react';
import {
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  PageHeader,
  Section,
  SearchInput,
} from '@/components/ui';
import { bookingCategory, itemCategory, type Category } from '@/domain/categories';
import { documentsRepo } from '@/db/repo';
import { formatDayLabel } from '@/domain/time';
import { useTripBundle, useTripDocuments } from '@/hooks/useTrip';
import type {
  DocumentKind,
  DocumentMeta,
  DocumentOwnerKind,
  ID,
  ISODate,
  TripBundle,
} from '@/domain/types';

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
  // Open the tab now, while the tap still counts as the user's: iPhone Safari blocks a
  // window opened after an await. The file is loaded into it once it has been read.
  const tab = window.open('', '_blank');
  const blob = await documentsRepo.blob(id);
  if (!blob) {
    tab?.close();
    window.alert('This file is still downloading. Try again in a moment.');
    return;
  }
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else window.location.href = url;
  window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_TTL_MS);
}

/** The vault's own sections: what a traveller thinks "this ticket belongs with", which is
 * coarser than the app's own booking kinds and includes a bucket for things that are not
 * filed against any one booking at all. */
export type DocumentSection =
  'Transport' | 'Hotels' | 'Sightseeing' | 'Passes' | 'Trip papers' | 'Other';

const DOCUMENT_SECTION_ORDER: DocumentSection[] = [
  'Transport',
  'Hotels',
  'Sightseeing',
  'Passes',
  'Trip papers',
  'Other',
];

const CATEGORY_TO_SECTION: Partial<Record<Category, DocumentSection>> = {
  transport: 'Transport',
  stay: 'Hotels',
  activity: 'Sightseeing',
  pass: 'Passes',
};

export interface DocumentOwnerInfo {
  /** The category badge to show, e.g. a hotel document gets the hotel icon. Falls back to
   * the note icon for a trip-level document or one whose owner no longer exists. */
  category: Category;
  section: DocumentSection;
  /** What to show after "for", e.g. a booking title. Null for a trip-level document. */
  label: string | null;
  /** The owner's date, for sorting and for the "· 12 Sep" after the label. */
  date: ISODate | null;
}

/** What a document is filed against, and when that thing happens - the vault groups by
 * `section` and sorts each group by `date`. */
function ownerInfo(bundle: TripBundle, doc: DocumentMeta): DocumentOwnerInfo {
  const attachedTo = doc.attachedTo;
  if (!attachedTo || attachedTo.kind === 'trip') {
    return { category: 'note', section: 'Trip papers', label: null, date: null };
  }
  if (attachedTo.kind === 'booking') {
    const booking = bundle.bookings.find((b) => b.id === attachedTo.id);
    if (!booking) return { category: 'note', section: 'Other', label: null, date: null };
    const category = bookingCategory(booking.kind);
    return {
      category,
      section: CATEGORY_TO_SECTION[category] ?? 'Other',
      label: booking.title,
      date: booking.date,
    };
  }
  if (attachedTo.kind === 'accommodation') {
    const stay = bundle.accommodations.find((a) => a.id === attachedTo.id);
    if (!stay) return { category: 'note', section: 'Other', label: null, date: null };
    return { category: 'stay', section: 'Hotels', label: stay.name, date: stay.checkIn };
  }
  // The last owner kind is an item, filed against a day rather than a booking.
  const item = bundle.items.find((i) => i.id === attachedTo.id);
  if (!item) return { category: 'note', section: 'Other', label: null, date: null };
  const category = itemCategory(item.type);
  const day = bundle.days.find((d) => d.id === item.dayId);
  return {
    category,
    section: CATEGORY_TO_SECTION[category] ?? 'Other',
    label: item.title,
    date: day?.date ?? null,
  };
}

/** One filed document, shown the same way in the vault and on a booking. `owner` is only
 * passed by the vault, which knows what everything is filed against; a booking page shows
 * its own documents plainly, since the owner is the page itself. */
export function DocumentRow({
  doc,
  ownerLabel,
  owner,
}: {
  doc: DocumentMeta;
  /** @deprecated Pass `owner` instead, which also carries the category and date. */
  ownerLabel?: string;
  owner?: DocumentOwnerInfo;
}) {
  const remove = async () => {
    if (!window.confirm(`Remove ${doc.name}? This cannot be undone.`)) return;
    await documentsRepo.remove(doc.id);
  };
  const label = owner?.label ?? ownerLabel ?? null;

  // The whole row opens the file: that is what it is for, and a large target is easier
  // on a moving train. Removing is rare and destructive, so it gets a small icon and a
  // confirmation rather than a button the same size as Open.
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => void openDocument(doc.id)}
          className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-l-xl p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
        >
          {owner ? (
            <CategoryIcon category={owner.category} size="sm" />
          ) : (
            <FileText size={18} className="shrink-0 text-slate-400" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block font-medium">{doc.name}</span>
            <span className="block truncate text-xs text-slate-500">
              {label ? `for ${label}` : KIND_WORDS[doc.kind]}
              {owner?.date ? ` · ${formatDayLabel(owner.date)}` : ''}
              {` · ${formatSize(doc.size)}`}
            </span>
          </span>
          <span className="text-brand-700 dark:text-brand-300 shrink-0 text-sm font-medium">
            Open
          </span>
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          className="flex min-h-[56px] shrink-0 items-center px-3 text-slate-400 hover:text-rose-600"
        >
          <Trash2 size={16} aria-hidden />
          <span className="sr-only">Remove {doc.name}</span>
        </button>
      </div>
    </div>
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
  // Defaulted rather than asked for. Almost everything filed here is a ticket, and a
  // required question before the file picker would be one more thing to get through.
  const [kind, setKind] = useState<DocumentKind>('ticket');

  const attach = async (file: File) => {
    setError(null);
    try {
      await documentsRepo.attach(tripId, file, { name: file.name, kind, attachedTo });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That file could not be attached.');
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => fileInput.current?.click()}>
          <Upload size={15} aria-hidden /> {label}
        </Button>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          as
          <select
            aria-label="Kind of document"
            value={kind}
            onChange={(event) => setKind(event.target.value as DocumentKind)}
            className="min-h-[36px] rounded-lg border border-slate-300 px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {(Object.keys(KIND_WORDS) as DocumentKind[]).map((option) => (
              <option key={option} value={option}>
                {KIND_WORDS[option]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        aria-label={label}
        className="hidden"
        onChange={(event) => {
          const files = event.target.files;
          if (files) for (const file of Array.from(files)) void attach(file);
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
  const [query, setQuery] = useState('');

  if (!bundle) return <p className="text-slate-500">Loading.</p>;

  const owners = new Map(documents.map((doc) => [doc.id, ownerInfo(bundle, doc)]));

  const q = query.trim().toLowerCase();
  const matching = q
    ? documents.filter((doc) => {
        const label = owners.get(doc.id)?.label ?? '';
        return doc.name.toLowerCase().includes(q) || label.toLowerCase().includes(q);
      })
    : documents;

  const sections = DOCUMENT_SECTION_ORDER.map((section) => ({
    section,
    items: matching
      .filter((doc) => owners.get(doc.id)?.section === section)
      .sort((a, b) => {
        const dateA = owners.get(a.id)?.date;
        const dateB = owners.get(b.id)?.date;
        if (dateA && dateB) return dateA.localeCompare(dateB);
        if (dateA) return -1;
        if (dateB) return 1;
        return a.name.localeCompare(b.name);
      }),
  })).filter((group) => group.items.length > 0);

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
        <>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by name or what it's for"
            label="Search documents"
          />
          {sections.length === 0 ? (
            <EmptyState title="Nothing matches that search." />
          ) : (
            sections.map(({ section, items }) => (
              <Section key={section} title={`${section} (${items.length})`}>
                <div className="space-y-2">
                  {items.map((doc) => (
                    <DocumentRow key={doc.id} doc={doc} owner={owners.get(doc.id)} />
                  ))}
                </div>
              </Section>
            ))
          )}
        </>
      )}
    </>
  );
}
