/**
 * Weather swap.
 *
 * The Swiss mountain days are interchangeable: you decide the morning you see the
 * forecast. The safe way to model that is to move the *items* between two days and leave
 * the days where they are. Dates never move, so nothing that is pinned to a date - a
 * booked train, a timed reservation - can be silently dragged along with the scenery.
 */
import { SORT_GAP } from '@/domain/ordering';
import type { Booking, ID, Item, TripBundle } from '@/domain/types';

export type HoldBackReason = 'pinned' | 'booked';

export interface DaySwapMove {
  itemId: ID;
  fromDayId: ID;
  toDayId: ID;
  sortKey: number;
}

export interface DaySwapPlan {
  moves: DaySwapMove[];
  /** Items that stayed put, and why. The UI must show these before the user confirms. */
  heldBack: Array<{ itemId: ID; title: string; reason: HoldBackReason }>;
}

const LOCKED_STATUSES = new Set<Booking['status']>(['booked', 'confirmed']);

/** Why an item cannot move off its date, or undefined when it is free to move. */
export function holdBackReason(item: Item, bookings: Booking[]): HoldBackReason | undefined {
  if (item.pinnedToDate) return 'pinned';
  if (item.bookingId) {
    const booking = bookings.find((b) => b.id === item.bookingId);
    if (booking && LOCKED_STATUSES.has(booking.status)) return 'booked';
  }
  return undefined;
}

/**
 * Plan a swap of two days' contents. Pure: it computes moves, and the caller applies
 * them in one transaction. Items keep their relative order in the destination day.
 */
export function planDaySwap(bundle: TripBundle, dayIdA: ID, dayIdB: ID): DaySwapPlan {
  const plan: DaySwapPlan = { moves: [], heldBack: [] };
  if (dayIdA === dayIdB) return plan;

  const partition = (dayId: ID): { movable: Item[] } => {
    const movable: Item[] = [];
    const dayItems = bundle.items
      .filter((i) => i.dayId === dayId)
      .sort((a, b) => a.sortKey - b.sortKey);
    for (const item of dayItems) {
      const reason = holdBackReason(item, bundle.bookings);
      if (reason) plan.heldBack.push({ itemId: item.id, title: item.title, reason });
      else movable.push(item);
    }
    return { movable };
  };

  const a = partition(dayIdA);
  const b = partition(dayIdB);

  a.movable.forEach((item, index) => {
    plan.moves.push({
      itemId: item.id,
      fromDayId: dayIdA,
      toDayId: dayIdB,
      sortKey: (index + 1) * SORT_GAP,
    });
  });
  b.movable.forEach((item, index) => {
    plan.moves.push({
      itemId: item.id,
      fromDayId: dayIdB,
      toDayId: dayIdA,
      sortKey: (index + 1) * SORT_GAP,
    });
  });

  return plan;
}

/** Apply a plan in memory. The database repository does the same thing transactionally. */
export function applyDaySwap(items: Item[], plan: DaySwapPlan, now: string): Item[] {
  const byId = new Map(plan.moves.map((m) => [m.itemId, m]));
  return items.map((item) => {
    const move = byId.get(item.id);
    if (!move) return item;
    return { ...item, dayId: move.toDayId, sortKey: move.sortKey, updatedAt: now };
  });
}

/** A one-line summary for the confirmation sheet. */
export function describeSwap(plan: DaySwapPlan): string {
  if (plan.moves.length === 0 && plan.heldBack.length === 0) return 'Nothing to swap.';
  const moved = `${plan.moves.length} item${plan.moves.length === 1 ? '' : 's'} move`;
  if (plan.heldBack.length === 0) return `${moved}.`;
  return `${moved}, ${plan.heldBack.length} stay on their date because they are booked or pinned.`;
}
