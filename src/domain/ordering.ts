/**
 * Gap-based ordering. Items are spaced by 1000 so inserting between two of them is a
 * midpoint calculation rather than a renumber of the whole day. When the gaps close up,
 * `renormalise` respaces once.
 */
import type { ID, Item } from '@/domain/types';

export const SORT_GAP = 1000;

const byKey = (a: Item, b: Item): number => a.sortKey - b.sortKey;

/** A key that places a new item after everything in `items`. */
export function nextSortKey(items: Item[]): number {
  if (items.length === 0) return SORT_GAP;
  return Math.max(...items.map((i) => i.sortKey)) + SORT_GAP;
}

/** A key between two neighbours. `undefined` means the start or end of the list. */
export function sortKeyBetween(before: Item | undefined, after: Item | undefined): number {
  if (!before && !after) return SORT_GAP;
  if (!before && after) return after.sortKey - SORT_GAP;
  if (before && !after) return before.sortKey + SORT_GAP;
  if (before && after) return (before.sortKey + after.sortKey) / 2;
  return SORT_GAP;
}

/** True when two neighbours are so close that another insert would collide. */
export function needsRenormalise(items: Item[]): boolean {
  const sorted = items.slice().sort(byKey);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev === undefined || cur === undefined) continue;
    if (cur.sortKey - prev.sortKey < 1) return true;
  }
  return false;
}

/** Respace every item by `SORT_GAP`, preserving order. Returns only what changed. */
export function renormalise(items: Item[]): Item[] {
  const sorted = items.slice().sort(byKey);
  const out: Item[] = [];
  sorted.forEach((item, index) => {
    const sortKey = (index + 1) * SORT_GAP;
    if (sortKey !== item.sortKey) out.push({ ...item, sortKey });
  });
  return out;
}

/**
 * Move one item one position up or down. Returns only the items whose sortKey changed,
 * so the caller can write a minimal update. A move off either end is a no-op.
 */
export function moveItem(items: Item[], id: ID, dir: 'up' | 'down'): Item[] {
  const sorted = items.slice().sort(byKey);
  const index = sorted.findIndex((i) => i.id === id);
  if (index === -1) return [];
  const target = dir === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= sorted.length) return [];
  const a = sorted[index];
  const b = sorted[target];
  if (!a || !b) return [];
  return [
    { ...a, sortKey: b.sortKey },
    { ...b, sortKey: a.sortKey },
  ];
}

/** Reassign keys so `orderedIds` becomes the display order. Returns only what changed. */
export function reorderTo(items: Item[], orderedIds: ID[]): Item[] {
  const out: Item[] = [];
  orderedIds.forEach((id, index) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const sortKey = (index + 1) * SORT_GAP;
    if (sortKey !== item.sortKey) out.push({ ...item, sortKey });
  });
  return out;
}
