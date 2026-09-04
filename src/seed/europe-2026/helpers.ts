/**
 * Boilerplate remover for the seed day files.
 *
 * Every item needs an id, a trip id, a day id, a sort key, timestamps, a status and a
 * traceability reference back to the source notes. Writing those out 300 times would bury
 * the actual itinerary, so they are derived here from the day key and the bullet position.
 */
import { parseOpeningHours } from '@/domain/hours';
import type { Day, Item, ItemType, OpeningHours, Tag } from '@/domain/types';
import { DAY_DATES, TRIP_ID, type DayKey, dayId, itemId, sortKeyFor } from './ids';

export const SEED_TS = '2026-09-04T00:00:00.000Z';

/** One bullet from the notes, with everything derivable left off. */
export type ItemDraft = Omit<
  Partial<Item>,
  'id' | 'tripId' | 'dayId' | 'sortKey' | 'createdAt' | 'updatedAt'
> & { title: string; type: ItemType };

/** The day number as printed in the renumbered source notes, for `sourceRef`. */
function sourceDayNumber(key: DayKey): string {
  return key === 'd00' ? 'Departure day' : `Day ${Number(key.slice(1))}`;
}

/**
 * Turn a list of bullets into items. Position in the array is the bullet order, which
 * becomes both the id suffix and the sort key, so the app shows the day as it was written.
 */
export function buildItems(key: DayKey, drafts: ItemDraft[]): Item[] {
  return drafts.map((draft, index) => {
    const n = index + 1;
    const tags: Tag[] = draft.tags ?? [];
    return {
      id: itemId(key, n),
      tripId: TRIP_ID,
      dayId: dayId(key),
      sortKey: sortKeyFor(n),
      status: 'planned',
      createdAt: SEED_TS,
      updatedAt: SEED_TS,
      sourceRef: `${sourceDayNumber(key)} - bullet ${n}`,
      ...draft,
      tags,
    };
  });
}

export interface DayDraft {
  city: string;
  countryCode: string;
  theme?: string;
  timeZone?: string;
  originalLabel?: string;
  notes?: string;
}

export function buildDay(key: DayKey, draft: DayDraft): Day {
  return {
    id: dayId(key),
    tripId: TRIP_ID,
    date: DAY_DATES[key],
    ...draft,
  };
}

/**
 * Opening hours exactly as the notes wrote them. The raw text is always kept so the
 * linter can complain about it rather than the data quietly pretending it is fine.
 */
export function hours(raw: string, confidence: OpeningHours['confidence'] = 'notes'): OpeningHours {
  const parsed = parseOpeningHours(raw);
  if (!parsed.hours) {
    return { rules: [], rawText: raw, confidence: 'guess', note: parsed.issues.join(', ') };
  }
  return {
    ...parsed.hours,
    rawText: raw,
    confidence: parsed.issues.length > 0 ? 'guess' : confidence,
  };
}
