import type { Booking, Day, Finding, ID, Item, Severity } from '@/domain/types';
import type { LintContext } from '../engine';
import { findingKey } from '../keys';

export interface FindingInput {
  ruleId: string;
  severity: Severity;
  title: string;
  detail: string;
  suggestedFix?: string;
  day?: Day | null;
  items?: Array<Item | undefined | null>;
  bookings?: Array<Booking | undefined | null>;
  /** Extra ids folded into the key when items/bookings alone are not unique. */
  keyExtra?: string[];
}

/** Build a Finding with a stable key. Always use this rather than a literal. */
export function makeFinding(input: FindingInput): Finding {
  const itemIds = (input.items ?? []).filter((i): i is Item => !!i).map((i) => i.id);
  const bookingIds = (input.bookings ?? []).filter((b): b is Booking => !!b).map((b) => b.id);
  return {
    key: findingKey(input.ruleId, ...itemIds, ...bookingIds, ...(input.keyExtra ?? [])),
    ruleId: input.ruleId,
    severity: input.severity,
    title: input.title,
    detail: input.detail,
    ...(input.suggestedFix ? { suggestedFix: input.suggestedFix } : {}),
    ...(input.day ? { dayId: input.day.id, date: input.day.date } : {}),
    itemIds,
    ...(bookingIds.length ? { bookingIds } : {}),
    source: 'rule',
  };
}

export function bookingOf(ctx: LintContext, id: ID | null | undefined): Booking | undefined {
  if (!id) return undefined;
  return ctx.bundle.bookings.find((b) => b.id === id);
}

export function dayOf(ctx: LintContext, id: ID | null | undefined): Day | undefined {
  if (!id) return undefined;
  return ctx.bundle.days.find((d) => d.id === id);
}

/** A booking that cannot be moved or refunded raises transfer-gap expectations. */
export function isLocked(booking: Booking | undefined): boolean {
  if (!booking) return false;
  return booking.refundable === false || booking.changeable === false;
}

export function isTransport(item: Item): boolean {
  return item.type === 'transport' || item.type === 'transfer';
}

/** `1 h 25` for 85, `45 min` for 45. */
export function formatMins(mins: number): string {
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = mins < 0 ? '-' : '';
  if (h === 0) return `${sign}${m} min`;
  return m === 0 ? `${sign}${h} h` : `${sign}${h} h ${m}`;
}
