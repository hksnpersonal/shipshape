/**
 * Trip-wide and booking rules.
 *
 * Where the timing rules look at one day, these look at the shape of the whole trip: do
 * the dates agree with the flights, is every night covered, will you actually reach the
 * airport in time, and is anything still unbooked past the point where booking it is
 * easy.
 */
import { addDays, daysBetween } from '@/domain/time';
import { nightsCovered } from '@/domain/bundle';
import { bookBy } from '@/playbook/bookBy';
import type { Finding } from '@/domain/types';
import type { Rule } from '../engine';
import { findingKey } from '../keys';
import { formatMins, isTransport, makeFinding } from './helpers';
import { fromMinutes, toMinutes } from '../timeline';

const airportLeadTime: Rule = {
  id: 'airport-lead-time',
  severity: 'error',
  title: 'Not enough time before the flight',
  describe: 'Working backwards from the flight, the day does not leave the required margin.',
  run(ctx) {
    const out: Finding[] = [];
    for (const booking of ctx.bundle.bookings) {
      if (booking.kind !== 'flight' || !booking.depart) continue;
      const departMin = toMinutes(booking.depart);
      if (departMin === null) continue;
      const day = ctx.bundle.days.find((d) => d.date === booking.date);
      if (!day) continue;
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;

      const mustBeThereBy = departMin - ctx.options.airportLeadMins;

      // Anchor on the last thing that is not itself a journey, then add up the journeys
      // after it. Anchoring on a transfer would double-count the ride to the airport.
      const before = timeline.timed.filter(
        (e) =>
          e.startMin !== null &&
          e.startMin < departMin &&
          e.item.bookingId !== booking.id &&
          !isTransport(e.item),
      );
      const anchor = before[before.length - 1];
      if (!anchor) continue;

      const transferAfterAnchor = timeline.entries
        .slice(timeline.entries.indexOf(anchor) + 1)
        .filter((e) => isTransport(e.item))
        .reduce((total, e) => total + (e.item.travel?.durationMins ?? e.item.durationMins ?? 0), 0);

      const noTransfer = transferAfterAnchor === 0;
      const projectedArrival = (anchor.endMin ?? anchor.startMin ?? 0) + transferAfterAnchor;
      if (!noTransfer && projectedArrival <= mustBeThereBy) continue;

      const short = projectedArrival - mustBeThereBy;
      out.push(
        makeFinding({
          ruleId: 'airport-lead-time',
          severity: noTransfer ? 'warning' : 'error',
          title: noTransfer
            ? `No journey planned to the airport for ${booking.title}`
            : `${formatMins(short)} short of the airport margin`,
          detail: noTransfer
            ? `"${anchor.item.title}" is the last thing before a ${booking.depart} flight, and nothing in the day covers getting to ${booking.to?.name ?? 'the airport'}. You need to be there by ${fromMinutes(mustBeThereBy)}.`
            : `Working forward from "${anchor.item.title}" plus ${formatMins(transferAfterAnchor)} of travel puts you at the airport around ${fromMinutes(projectedArrival)}. The ${formatMins(ctx.options.airportLeadMins)} rule wants you there by ${fromMinutes(mustBeThereBy)}.`,
          suggestedFix: noTransfer
            ? 'Add the transfer with a realistic duration, then this check can do its job.'
            : `Leave earlier, or accept a shorter margin deliberately rather than by accident.`,
          day,
          items: [anchor.item],
          bookings: [booking],
        }),
      );
    }
    return out;
  },
};

const tripRange: Rule = {
  id: 'trip-range',
  severity: 'warning',
  title: 'Trip dates disagree with what is booked',
  describe: 'A day or booking falls outside the stated start and end of the trip.',
  run(ctx) {
    const { trip } = ctx.bundle;
    const out: Finding[] = [];

    for (const day of ctx.orderedDays) {
      if (day.date >= trip.startDate && day.date <= trip.endDate) continue;
      out.push(
        makeFinding({
          ruleId: 'trip-range',
          severity: 'warning',
          title: `${day.date} is outside the trip dates`,
          detail: `The trip is set as ${trip.startDate} to ${trip.endDate}.`,
          suggestedFix: 'Widen the trip dates or move the day.',
          day,
        }),
      );
    }

    for (const booking of ctx.bundle.bookings) {
      const last = booking.endDate ?? booking.arriveDate ?? booking.date;
      if (booking.date >= trip.startDate && last <= trip.endDate) continue;
      out.push(
        makeFinding({
          ruleId: 'trip-range',
          severity: 'warning',
          title: `${booking.title} falls outside the trip dates`,
          detail: `It runs ${booking.date}${booking.endDate ? ` to ${booking.endDate}` : ''}, but the trip is set as ${trip.startDate} to ${trip.endDate}.`,
          suggestedFix: 'The tickets are the facts. Correct the trip dates to match them.',
          bookings: [booking],
        }),
      );
    }

    // The flight home is the real end of the trip.
    const homeward = ctx.bundle.bookings
      .filter((b) => b.kind === 'flight')
      .sort((a, b) => a.date.localeCompare(b.date))
      .pop();
    if (homeward) {
      const endsOn = homeward.arriveDate ?? homeward.date;
      const drift = daysBetween(endsOn, trip.endDate);
      if (drift !== 0) {
        out.push(
          makeFinding({
            ruleId: 'trip-range',
            severity: 'warning',
            title: `Trip ends ${trip.endDate}, but the flight home is ${homeward.date}`,
            detail: `${homeward.title} departs on ${homeward.date}. The trip end date is ${trip.endDate}, ${Math.abs(drift)} day${Math.abs(drift) === 1 ? '' : 's'} ${drift > 0 ? 'later' : 'earlier'}.`,
            suggestedFix: `Set the trip end to ${endsOn} unless there is a reason for the difference.`,
            bookings: [homeward],
            keyExtra: ['end-date'],
          }),
        );
      }
    }

    return out;
  },
};

const daySequence: Rule = {
  id: 'day-sequence',
  severity: 'warning',
  title: 'A day is missing or repeated',
  describe: 'The days are not one unbroken run of dates.',
  run(ctx) {
    const days = ctx.orderedDays;
    const first = days[0];
    const last = days[days.length - 1];
    if (!first || !last) return [];

    const out: Finding[] = [];
    const byDate = new Map<string, number>();
    for (const day of days) byDate.set(day.date, (byDate.get(day.date) ?? 0) + 1);

    for (const [date, count] of byDate) {
      if (count > 1) {
        out.push(
          makeFinding({
            ruleId: 'day-sequence',
            severity: 'warning',
            title: `Two days share the date ${date}`,
            detail: 'Every date should appear exactly once.',
            suggestedFix: 'Merge them, or give one of them its real date.',
            keyExtra: [`dup-${date}`],
          }),
        );
      }
    }

    for (let date = first.date; date < last.date; date = addDays(date, 1)) {
      if (byDate.has(date)) continue;
      out.push(
        makeFinding({
          ruleId: 'day-sequence',
          severity: 'warning',
          title: `No day for ${date}`,
          detail: `The trip runs ${first.date} to ${last.date}, and ${date} has nothing in it.`,
          suggestedFix: 'Add the day, even if it is only a travel day.',
          keyExtra: [`gap-${date}`],
        }),
      );
    }

    return out;
  },
};

const unresolvedTag: Rule = {
  id: 'unresolved-tag',
  severity: 'warning',
  title: 'Still marked as unchecked',
  describe: 'An item carries a CHECK or CONFLICT tag from the planning notes.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      for (const { item } of timeline.entries) {
        const conflict = item.tags.includes('CONFLICT');
        const check = item.tags.includes('CHECK');
        if (!conflict && !check) continue;
        out.push(
          makeFinding({
            ruleId: 'unresolved-tag',
            severity: conflict ? 'error' : 'warning',
            title: conflict
              ? `${item.title} contradicts something else`
              : `${item.title} still needs checking`,
            detail:
              item.notes ??
              (conflict
                ? 'The notes carry two versions of this and neither has been retired.'
                : 'Marked as needing verification when the itinerary was written.'),
            suggestedFix: conflict
              ? 'Decide which version is right, then delete the other.'
              : 'Confirm it, then clear the tag.',
            day,
            items: [item],
          }),
        );
      }
    }
    return out;
  },
};

const accommodationGap: Rule = {
  id: 'accommodation-gap',
  severity: 'error',
  title: 'Nowhere to sleep',
  describe: 'A night of the trip has no accommodation, or has two.',
  run(ctx) {
    const { uncovered, doubleBooked } = nightsCovered(ctx.bundle);
    const out: Finding[] = [];
    for (const night of uncovered) {
      out.push(
        makeFinding({
          ruleId: 'accommodation-gap',
          severity: 'error',
          title: `No accommodation on the night of ${night}`,
          detail: 'Every night between the first and last day needs a bed.',
          suggestedFix: 'Add the stay, or record it as an overnight train or flight.',
          keyExtra: [`uncovered-${night}`],
        }),
      );
    }
    for (const night of doubleBooked) {
      out.push(
        makeFinding({
          ruleId: 'accommodation-gap',
          severity: 'warning',
          title: `Two places booked for the night of ${night}`,
          detail: 'Overlapping stays usually mean a checkout date is a day out.',
          suggestedFix: 'Check the checkout date on the earlier booking.',
          keyExtra: [`double-${night}`],
        }),
      );
    }
    return out;
  },
};

const bookingUnlinked: Rule = {
  id: 'booking-unlinked',
  severity: 'info',
  title: 'Booking not on the itinerary',
  describe: 'Something is booked but no item in the plan refers to it.',
  run(ctx) {
    const linked = new Set(ctx.bundle.items.map((i) => i.bookingId).filter(Boolean));
    const out: Finding[] = [];
    for (const booking of ctx.bundle.bookings) {
      if (booking.kind === 'hotel' || booking.kind === 'pass') continue;
      if (booking.status === 'cancelled' || booking.status === 'not_needed') continue;
      if (linked.has(booking.id)) continue;
      out.push(
        makeFinding({
          ruleId: 'booking-unlinked',
          severity: 'info',
          title: `${booking.title} is not on any day`,
          detail: `Booked for ${booking.date}, but nothing in the itinerary points at it.`,
          suggestedFix: 'Add it to that day so it shows up in the timeline and the reminders.',
          bookings: [booking],
        }),
      );
    }
    return out;
  },
};

const bookByOverdue: Rule = {
  id: 'book-by-overdue',
  severity: 'warning',
  title: 'Past the sensible booking date',
  describe: 'Something still unbooked has passed the date the playbook recommends.',
  run(ctx) {
    const out: Finding[] = [];
    for (const booking of ctx.bundle.bookings) {
      if (booking.status !== 'to_book') continue;
      const result = bookBy(booking, ctx.guides, ctx.options.today);
      if (result.urgency !== 'overdue' || result.date === null) continue;
      const late = -(result.daysLeft ?? 0);
      out.push(
        makeFinding({
          ruleId: 'book-by-overdue',
          severity: late > 7 ? 'error' : 'warning',
          title: `${booking.title} should have been booked by ${result.date}`,
          detail: `That was ${late} day${late === 1 ? '' : 's'} ago. It is for ${booking.date}.`,
          suggestedFix:
            'Book it now and expect less choice of time or price than you would have had.',
          bookings: [booking],
        }),
      );
    }
    return out;
  },
};

const earlyDepartureNoReminder: Rule = {
  id: 'early-departure-no-reminder',
  severity: 'info',
  title: 'Early start with no reminder the night before',
  describe: 'A journey before 08:00 with nothing prompting you the evening before.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      const early = timeline.timed.find(
        (e) => isTransport(e.item) && e.startMin !== null && e.startMin < 8 * 60,
      );
      if (!early) continue;
      const eve = addDays(day.date, -1);
      const hasReminder = ctx.bundle.reminders.some(
        (r) => r.fireDate === eve && (r.forDate === day.date || r.forItemId === early.item.id),
      );
      if (hasReminder) continue;
      out.push(
        makeFinding({
          ruleId: 'early-departure-no-reminder',
          severity: 'info',
          title: `${early.item.title} leaves at ${early.item.time} with no reminder the night before`,
          detail: `Nothing on ${eve} prompts you to pack, buy food, or set an alarm.`,
          suggestedFix: `Add a reminder on ${eve}.`,
          day,
          items: [early.item],
        }),
      );
    }
    return out;
  },
};

const manualConflicts: Rule = {
  id: 'manual',
  severity: 'warning',
  title: 'Noted by hand',
  describe: 'A disagreement recorded in the planning notes that no rule can derive.',
  run(ctx) {
    return ctx.bundle.conflicts.map((conflict): Finding => {
      const day = conflict.dayId ? ctx.bundle.days.find((d) => d.id === conflict.dayId) : undefined;
      return {
        key: findingKey('manual', conflict.id),
        ruleId: 'manual',
        severity: conflict.severity,
        title: conflict.title,
        detail: conflict.detail,
        ...(day ? { dayId: day.id, date: day.date } : {}),
        itemIds: conflict.itemIds,
        ...(conflict.bookingIds?.length ? { bookingIds: conflict.bookingIds } : {}),
        source: 'manual',
      };
    });
  },
};

export const tripRules: Rule[] = [
  airportLeadTime,
  tripRange,
  daySequence,
  unresolvedTag,
  accommodationGap,
  bookingUnlinked,
  bookByOverdue,
  earlyDepartureNoReminder,
  manualConflicts,
];
