/**
 * Clock rules.
 *
 * These are the ones that catch a day that cannot physically happen: two things at once,
 * a connection too tight to make, a stated duration that disagrees with the ticket, and
 * a line left over from an earlier draft that still shows the old time.
 */
import { fromMinutes } from '@/domain/time';
import { samePlace } from '@/domain/places';
import type { Finding, Item } from '@/domain/types';
import type { LintContext, Rule } from '../engine';
import { durationOf, type TimelineEntry } from '../timeline';
import { bookingOf, formatMins, isLocked, isTransport, makeFinding } from './helpers';

const at = (mins: number | null): string => (mins === null ? 'an unknown time' : fromMinutes(mins));

/** Modes that run to a timetable and can therefore run late. */
const SCHEDULED_MODES = new Set([
  'train',
  'metro',
  'tram',
  'bus',
  'ferry',
  'boat',
  'flight',
  'cogwheel',
  'cablecar',
  'gondola',
  'funicular',
  'shuttle',
]);

/** True when this item is you stepping off something that runs to a timetable. */
function arrivesOnAService(item: Item): boolean {
  const mode = item.travel?.mode;
  return mode !== undefined && SCHEDULED_MODES.has(mode);
}

/** Consecutive pairs of timed entries within each day. */
function* timedPairs(ctx: LintContext): Generator<{
  day: LintContext['orderedDays'][number];
  prev: TimelineEntry;
  next: TimelineEntry;
}> {
  for (const day of ctx.orderedDays) {
    const timeline = ctx.timelines.get(day.id);
    if (!timeline) continue;
    for (let i = 1; i < timeline.timed.length; i += 1) {
      const prev = timeline.timed[i - 1];
      const next = timeline.timed[i];
      if (prev && next) yield { day, prev, next };
    }
  }
}

const timeOverlap: Rule = {
  id: 'time-overlap',
  severity: 'error',
  title: 'Two things at once',
  describe: 'One item is still running when the next one starts.',
  run(ctx) {
    const out: Finding[] = [];
    for (const { day, prev, next } of timedPairs(ctx)) {
      if (prev.endMin === null || next.startMin === null) continue;
      // An inferred end is a guess from a duration, so only a real clash counts.
      const overlap = prev.endMin - next.startMin;
      if (overlap <= 0) continue;
      out.push(
        makeFinding({
          ruleId: 'time-overlap',
          severity: 'error',
          title: `${prev.item.title} overlaps ${next.item.title}`,
          detail: `"${prev.item.title}" runs until ${at(prev.endMin)} but "${next.item.title}" starts at ${at(next.startMin)}, an overlap of ${formatMins(overlap)}.`,
          suggestedFix: `Move "${next.item.title}" to ${at(prev.endMin)} or later, or shorten the earlier item.`,
          day,
          items: [prev.item, next.item],
        }),
      );
    }
    return out;
  },
};

const insufficientTransfer: Rule = {
  id: 'insufficient-transfer',
  severity: 'warning',
  title: 'Connection too tight',
  describe: 'Not enough time between arriving somewhere and catching the next thing.',
  run(ctx) {
    const out: Finding[] = [];
    for (const { day, prev, next } of timedPairs(ctx)) {
      if (prev.endMin === null || next.startMin === null) continue;
      const gap = next.startMin - prev.endMin;
      if (gap < 0) continue; // a real overlap is the other rule's business
      // A connection, not a buffer. Turning up early for a train is good planning; the
      // risk is arriving on one scheduled service and having to catch another. Walking
      // to a station beforehand cannot make you late in the same way.
      if (!arrivesOnAService(prev.item)) continue;
      if (next.item.type !== 'transport') continue;

      const nextBooking = bookingOf(ctx, next.item.bookingId);
      const locked = isLocked(nextBooking);
      const threshold = locked
        ? ctx.options.minTransferNonRefundableMins
        : ctx.options.minTransferMins;
      if (gap >= threshold) continue;

      out.push(
        makeFinding({
          ruleId: 'insufficient-transfer',
          severity: locked ? 'error' : 'warning',
          title: `${formatMins(gap)} to make ${next.item.title}`,
          detail: locked
            ? `"${prev.item.title}" ends at ${at(prev.endMin)} and "${next.item.title}" leaves at ${at(next.startMin)}. That is ${formatMins(gap)}, under the ${formatMins(threshold)} worth allowing for a ticket that cannot be changed or refunded.`
            : `"${prev.item.title}" ends at ${at(prev.endMin)} and "${next.item.title}" starts at ${at(next.startMin)}, leaving ${formatMins(gap)}.`,
          suggestedFix: locked
            ? 'Check the exact connection on the operator timetable, or take the earlier service. A missed non-refundable train is a new ticket.'
            : 'Confirm the walking or platform time between the two.',
          day,
          items: [prev.item, next.item],
          ...(nextBooking ? { bookings: [nextBooking] } : {}),
        }),
      );
    }
    return out;
  },
};

const transitDurationMismatch: Rule = {
  id: 'transit-duration-mismatch',
  severity: 'warning',
  title: 'Stated journey time disagrees with the times',
  describe: 'A travel leg says one duration but its departure and arrival say another.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      for (const entry of timeline.entries) {
        const stated = entry.item.travel?.durationMins;
        if (typeof stated !== 'number') continue;
        if (entry.startMin === null || entry.inferredEnd || entry.endMin === null) continue;
        const actual = entry.endMin - entry.startMin;
        const drift = actual - stated;
        if (Math.abs(drift) <= ctx.options.durationToleranceMins) continue;
        out.push(
          makeFinding({
            ruleId: 'transit-duration-mismatch',
            severity: 'warning',
            title: `${entry.item.title} is labelled ${formatMins(stated)} but runs ${formatMins(actual)}`,
            detail: `The times say ${at(entry.startMin)} to ${at(entry.endMin)}, which is ${formatMins(actual)}. The note says ${formatMins(stated)}.`,
            suggestedFix:
              'Trust the booked times and correct the note, once you have checked the ticket.',
            day,
            items: [entry.item],
          }),
        );
      }
    }
    return out;
  },
};

const idleGap: Rule = {
  id: 'idle-gap',
  severity: 'info',
  title: 'Unplanned stretch',
  describe: 'A long gap between two timed items with nothing scheduled in between.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      const order = timeline.entries.map((e) => e.item.id);
      for (let i = 1; i < timeline.timed.length; i += 1) {
        const prev = timeline.timed[i - 1];
        const next = timeline.timed[i];
        if (!prev || !next || prev.endMin === null || next.startMin === null) continue;
        const gap = next.startMin - prev.endMin;
        if (gap <= ctx.options.idleGapMins) continue;

        // Untimed items sitting in the gap do not silence the rule. They change what it
        // says: the plan has something here, it just never got a clock time.
        const from = order.indexOf(prev.item.id);
        const to = order.indexOf(next.item.id);
        const between = timeline.entries
          .slice(Math.min(from, to) + 1, Math.max(from, to))
          .filter((e) => e.startMin === null);
        const accounted = between.reduce((total, e) => total + (durationOf(e.item) ?? 0), 0);
        if (gap - accounted <= ctx.options.idleGapMins) continue;
        // Two cases are worth raising: something is planned here but never got a time,
        // or you have just arrived somewhere and the plan goes quiet. A long lull
        // between two sights on a holiday is not a defect.
        if (between.length === 0 && !isTransport(prev.item)) continue;

        const names = between.map((e) => `"${e.item.title}"`).join(', ');
        out.push(
          makeFinding({
            ruleId: 'idle-gap',
            severity: 'info',
            title:
              between.length > 0
                ? `${names} sits in a ${formatMins(gap)} gap with no time on it`
                : `${formatMins(gap)} unplanned after ${prev.item.title}`,
            detail:
              between.length > 0
                ? `Between ${at(prev.endMin)} and ${at(next.startMin)} the only thing planned is ${names}, which has no start time or duration.`
                : `Nothing is scheduled between ${at(prev.endMin)} and ${at(next.startMin)}.`,
            suggestedFix:
              between.length > 0
                ? 'Give it a time, or accept that the morning is loose and stop the app asking.'
                : 'Either this is deliberate slack, or an activity was meant to sit here and never got a time.',
            day,
            items: [prev.item, next.item, ...between.map((e) => e.item)],
          }),
        );
      }
    }
    return out;
  },
};

/** Strip the words that vary between two references to the same thing. */
function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(
      /\b(arrive at|arrive|arrival at|arrival|depart from|depart|leave|to|the|at|in)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const staleDuplicate: Rule = {
  id: 'stale-duplicate',
  severity: 'warning',
  title: 'Same thing twice with different times',
  describe: 'Two items on one day describe the same event but disagree about when.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      const groups = new Map<string, TimelineEntry[]>();
      for (const entry of timeline.entries) {
        const key = normaliseTitle(entry.item.title);
        if (key.length < 4) continue;
        const list = groups.get(key);
        if (list) list.push(entry);
        else groups.set(key, [entry]);
      }
      for (const entries of groups.values()) {
        if (entries.length < 2) continue;
        const times = new Set(entries.map((e) => e.startMin));
        if (times.size < 2) continue;
        const first = entries[0];
        if (!first) continue;
        out.push(
          makeFinding({
            ruleId: 'stale-duplicate',
            severity: 'warning',
            title: `"${first.item.title}" appears twice with different times`,
            detail: `Listed at ${entries.map((e) => at(e.startMin)).join(' and ')}. One of these is almost certainly left over from an earlier draft.`,
            suggestedFix: 'Keep the time the booking supports and delete the other line.',
            day,
            items: entries.map((e) => e.item),
          }),
        );
      }
    }
    return out;
  },
};

const itemBookingTimeMismatch: Rule = {
  id: 'item-booking-time-mismatch',
  severity: 'warning',
  title: 'Itinerary time disagrees with the booking',
  describe: 'An item linked to a booking shows a different departure or arrival.',
  run(ctx) {
    const out: Finding[] = [];
    for (const item of ctx.bundle.items) {
      const booking = bookingOf(ctx, item.bookingId);
      if (!booking) continue;
      const day = ctx.bundle.days.find((d) => d.id === item.dayId);
      const problems: string[] = [];
      if (booking.depart && item.time && booking.depart !== item.time) {
        problems.push(`departure is ${item.time} here but ${booking.depart} on the booking`);
      }
      if (booking.arrive && item.timeEnd && booking.arrive !== item.timeEnd) {
        problems.push(`arrival is ${item.timeEnd} here but ${booking.arrive} on the booking`);
      }
      if (problems.length === 0) continue;
      out.push(
        makeFinding({
          ruleId: 'item-booking-time-mismatch',
          severity: 'warning',
          title: `${item.title} does not match its booking`,
          detail: `The ${problems.join(', and the ')}.`,
          suggestedFix: 'The booking wins. Update the itinerary line to match the ticket.',
          day,
          items: [item],
          bookings: [booking],
        }),
      );
    }
    return out;
  },
};

const staleArrivalTime: Rule = {
  id: 'stale-arrival-time',
  severity: 'warning',
  title: 'Old arrival time still in the plan',
  describe: 'An unlinked item names the same destination as a booking but a different time.',
  run(ctx) {
    const out: Finding[] = [];
    for (const booking of ctx.bundle.bookings) {
      if (!booking.to || !booking.arrive) continue;
      const day = ctx.bundle.days.find((d) => d.date === booking.date);
      if (!day) continue;
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      for (const entry of timeline.entries) {
        const item = entry.item;
        if (item.bookingId === booking.id) continue; // the linked rule handles those
        const destination = item.travel?.to ?? item.location;
        if (!samePlace(destination, booking.to)) continue;
        const stamp = item.timeEnd ?? item.time;
        if (!stamp || stamp === booking.arrive) continue;
        // Only flag lines that read like an arrival, not a later visit to the same place.
        if (!/arriv/i.test(item.title)) continue;
        out.push(
          makeFinding({
            ruleId: 'stale-arrival-time',
            severity: 'warning',
            title: `"${item.title}" says ${stamp}, the booking says ${booking.arrive}`,
            detail: `${booking.title} is booked to reach ${booking.to.name} at ${booking.arrive}. This line still shows ${stamp}.`,
            suggestedFix: `Use ${booking.arrive} and re-check everything scheduled after it.`,
            day,
            items: [item],
            bookings: [booking],
          }),
        );
      }
    }
    return out;
  },
};

const itemBookingDateMismatch: Rule = {
  id: 'item-booking-date-mismatch',
  severity: 'error',
  title: 'Item sits on a different date to its booking',
  describe: 'Usually the aftermath of a day swap that moved something it should not have.',
  run(ctx) {
    const out: Finding[] = [];
    for (const item of ctx.bundle.items) {
      const booking = bookingOf(ctx, item.bookingId);
      if (!booking) continue;
      const day = ctx.bundle.days.find((d) => d.id === item.dayId);
      if (!day) continue;
      // An overnight flight legitimately touches two days: the day it leaves and the day
      // it lands. Both are the right date for an item about it.
      const validDates = [booking.date, booking.arriveDate, booking.endDate].filter(Boolean);
      if (validDates.includes(day.date)) continue;
      out.push(
        makeFinding({
          ruleId: 'item-booking-date-mismatch',
          severity: 'error',
          title: `${item.title} is on the wrong day`,
          detail: `It sits on ${day.date} but ${booking.title} is booked for ${validDates.join(' or ')}.`,
          suggestedFix: `Move it back to ${booking.date}, or change the booking.`,
          day,
          items: [item],
          bookings: [booking],
        }),
      );
    }
    return out;
  },
};

const orderTimeMismatch: Rule = {
  id: 'order-time-mismatch',
  severity: 'info',
  title: 'Running order disagrees with the clock',
  describe: 'An item is listed before another that happens earlier.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      const timedInOrder = timeline.entries.filter(
        (e): e is TimelineEntry & { startMin: number } => e.startMin !== null,
      );
      for (let i = 1; i < timedInOrder.length; i += 1) {
        const prev = timedInOrder[i - 1];
        const cur = timedInOrder[i];
        if (!prev || !cur || cur.startMin >= prev.startMin) continue;
        out.push(
          makeFinding({
            ruleId: 'order-time-mismatch',
            severity: 'info',
            title: `${cur.item.title} is listed after something later in the day`,
            detail: `"${cur.item.title}" at ${at(cur.startMin)} comes after "${prev.item.title}" at ${at(prev.startMin)} in the running order.`,
            suggestedFix: 'Reorder the day so the list matches the clock.',
            day,
            items: [prev.item, cur.item],
          }),
        );
      }
    }
    return out;
  },
};

export const timingRules: Rule[] = [
  timeOverlap,
  insufficientTransfer,
  transitDurationMismatch,
  idleGap,
  staleDuplicate,
  itemBookingTimeMismatch,
  staleArrivalTime,
  itemBookingDateMismatch,
  orderTimeMismatch,
];

export type { Item };
