import { toMinutes } from '@/domain/time';
import type { Day, ID, Item, TripBundle } from '@/domain/types';

/**
 * A day's items resolved to minute offsets. Every rule reads this rather than raw
 * items, so time inference lives in exactly one place.
 */
export interface TimelineEntry {
  item: Item;
  /** Minutes from midnight, or null when the item has no clock time. */
  startMin: number | null;
  /** startMin + explicit timeEnd, else durationMins, else travel.durationMins, else start. */
  endMin: number | null;
  /** True when endMin was derived from a duration rather than an explicit timeEnd. */
  inferredEnd: boolean;
}

export interface DayTimeline {
  day: Day;
  entries: TimelineEntry[];
  /** Entries with a clock time, in chronological order. */
  timed: TimelineEntry[];
}

export function durationOf(item: Item): number | null {
  if (typeof item.durationMins === 'number') return item.durationMins;
  const travelDuration = item.travel?.durationMins;
  if (typeof travelDuration === 'number') return travelDuration;
  return null;
}

function entryFor(item: Item): TimelineEntry {
  const startMin = toMinutes(item.time);
  const explicitEnd = toMinutes(item.timeEnd);
  if (explicitEnd !== null) {
    // An end before the start means the item runs past midnight.
    const endMin = startMin !== null && explicitEnd < startMin ? explicitEnd + 1440 : explicitEnd;
    return { item, startMin, endMin, inferredEnd: false };
  }
  if (startMin === null) return { item, startMin: null, endMin: null, inferredEnd: false };
  const duration = durationOf(item);
  if (duration === null) return { item, startMin, endMin: startMin, inferredEnd: true };
  return { item, startMin, endMin: startMin + duration, inferredEnd: true };
}

/** Items of one day in sortKey order, resolved to a timeline. */
export function buildDayTimeline(day: Day, items: Item[]): DayTimeline {
  const entries = items
    .filter((i) => i.dayId === day.id)
    .slice()
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(entryFor);
  const timed = entries
    .filter((e): e is TimelineEntry & { startMin: number } => e.startMin !== null)
    .slice()
    .sort((a, b) => a.startMin - b.startMin);
  return { day, entries, timed };
}

/** Every day of the trip, keyed by day id, in date order. */
export function buildTimelines(bundle: TripBundle): Map<ID, DayTimeline> {
  const byDay = new Map<ID, Item[]>();
  for (const item of bundle.items) {
    const list = byDay.get(item.dayId);
    if (list) list.push(item);
    else byDay.set(item.dayId, [item]);
  }
  const days = bundle.days.slice().sort((a, b) => a.date.localeCompare(b.date));
  const out = new Map<ID, DayTimeline>();
  for (const day of days) out.set(day.id, buildDayTimeline(day, byDay.get(day.id) ?? []));
  return out;
}

export { fromMinutes, toMinutes } from '@/domain/time';
