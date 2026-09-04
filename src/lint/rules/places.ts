/**
 * Place and venue rules.
 *
 * These catch the mistakes that only show up when you look at *where* things are: a
 * journey that resumes from a station you never reached, a leg missing between two ends
 * of a city, a venue that is shut on the day you turn up, a ferry that stops running in
 * October.
 */
import { placeKey, sameCity, sameLocality, samePlace } from '@/domain/places';
import { isOpenOn, parseOpeningHours } from '@/domain/hours';
import { weekdayOf } from '@/domain/time';
import type { Finding, Item, Place, TravelMode } from '@/domain/types';
import type { LintContext, Rule } from '../engine';
import { bookingOf, isTransport, makeFinding } from './helpers';

const WEEKDAY_NAMES: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Items that do not move you and do not take time: they never break a journey. */
const PASSIVE_TYPES = new Set<Item['type']>(['reminder', 'admin']);

const chainStationMismatch: Rule = {
  id: 'chain-station-mismatch',
  severity: 'warning',
  title: 'Journey resumes somewhere else',
  describe: 'One leg ends at a different place from where the next leg starts.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      const legs = timeline.entries.filter((e) => isTransport(e.item) && e.item.travel);
      for (let i = 1; i < legs.length; i += 1) {
        const prev = legs[i - 1];
        const next = legs[i];
        if (!prev || !next) continue;
        const from = next.item.travel?.from;
        const to = prev.item.travel?.to;
        if (!from || !to || samePlace(to, from)) continue;
        // A short hop between the two is a legitimate way to bridge them.
        const between = timeline.entries.slice(
          timeline.entries.indexOf(prev) + 1,
          timeline.entries.indexOf(next),
        );
        if (between.some((e) => isTransport(e.item))) continue;
        if (between.some((e) => !PASSIVE_TYPES.has(e.item.type))) continue;

        out.push(
          makeFinding({
            ruleId: 'chain-station-mismatch',
            severity: 'warning',
            title: `Gap between ${to.name} and ${from.name}`,
            detail: `"${prev.item.title}" ends at ${to.name}, but "${next.item.title}" starts from ${from.name}. Nothing covers the distance between them.`,
            suggestedFix:
              'Either it is the same through service and one leg should say so, or a connecting leg is missing.',
            day,
            items: [prev.item, next.item],
          }),
        );
      }
    }
    return out;
  },
};

const roundTripAsymmetry: Rule = {
  id: 'round-trip-asymmetry',
  severity: 'info',
  title: 'Out and back use different stations',
  describe: 'You leave from one station and come back from another in the same town.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      const legs = timeline.entries.map((e) => e.item).filter((i) => isTransport(i) && i.travel);
      for (let i = 0; i < legs.length; i += 1) {
        for (let j = i + 1; j < legs.length; j += 1) {
          const outbound = legs[i]?.travel;
          const back = legs[j]?.travel;
          const outItem = legs[i];
          const backItem = legs[j];
          if (!outbound || !back || !outItem || !backItem) continue;
          // Returns to where the outbound started, but departs from somewhere else.
          if (!samePlace(outbound.from, back.to)) continue;
          if (samePlace(outbound.to, back.from)) continue;
          if (!sameCity(outbound.to, back.from)) continue;

          out.push(
            makeFinding({
              ruleId: 'round-trip-asymmetry',
              severity: 'info',
              title: `Out to ${outbound.to.name}, back from ${back.from.name}`,
              detail: `The outbound leg reaches ${outbound.to.name} but the return leaves from ${back.from.name}. Both are in ${back.from.city ?? 'the same place'}.`,
              suggestedFix:
                'This may well be correct. Just do not assume you buy the return from the station you arrived at.',
              day,
              items: [outItem, backItem],
            }),
          );
        }
      }
    }
    return out;
  },
};

const missingTransitLeg: Rule = {
  id: 'missing-transit-leg',
  severity: 'warning',
  title: 'No way to get there',
  describe: 'Two consecutive items are in different places with no travel between them.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      const located = timeline.entries.filter((e) => {
        if (PASSIVE_TYPES.has(e.item.type)) return false;
        return Boolean(e.item.location ?? e.item.travel);
      });
      for (let i = 1; i < located.length; i += 1) {
        const prev = located[i - 1];
        const next = located[i];
        if (!prev || !next) continue;
        if (isTransport(prev.item) || isTransport(next.item)) continue;
        const from: Place | null | undefined = prev.item.location;
        const to: Place | null | undefined = next.item.location;
        if (sameLocality(from, to) !== 'different') continue;

        out.push(
          makeFinding({
            ruleId: 'missing-transit-leg',
            severity: 'warning',
            title: `Nothing gets you from ${from?.name} to ${to?.name}`,
            detail: `"${prev.item.title}" is in ${from?.zone ?? from?.city ?? 'one place'} and "${next.item.title}" is in ${to?.zone ?? to?.city ?? 'another'}, with no travel item between them.`,
            suggestedFix: 'Add the leg and its travel time, then re-check the times after it.',
            day,
            items: [prev.item, next.item],
          }),
        );
      }
    }
    return out;
  },
};

/** Modes that only ever serve a place of a given kind. */
const MODE_EXPECTS: Partial<Record<TravelMode, { kinds: string[]; label: string }>> = {
  metro: { kinds: ['metro-station', 'venue', 'area', 'hotel', 'bus-stop'], label: 'a metro stop' },
  train: { kinds: ['rail-station', 'metro-station', 'airport'], label: 'a railway station' },
  ferry: { kinds: ['pier'], label: 'a ferry pier' },
  boat: { kinds: ['pier'], label: 'a pier' },
  flight: { kinds: ['airport'], label: 'an airport' },
};

const modePlaceKind: Rule = {
  id: 'mode-place-kind',
  severity: 'warning',
  title: 'Mode of transport does not match the stop',
  describe: 'A leg calls itself one thing but its endpoints belong to another network.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      for (const { item } of timeline.entries) {
        const travel = item.travel;
        if (!travel) continue;
        const expectation = MODE_EXPECTS[travel.mode];
        if (!expectation) continue;
        const wrong = [travel.from, travel.to].filter(
          (p) => p.kind !== undefined && !expectation.kinds.includes(p.kind),
        );
        if (wrong.length === 0) continue;
        const place = wrong[0];
        if (!place) continue;
        out.push(
          makeFinding({
            ruleId: 'mode-place-kind',
            severity: 'warning',
            title: `"${item.title}" is called a ${travel.mode} but ${place.name} is not ${expectation.label}`,
            detail: `${place.name} is ${place.kind === 'rail-station' ? 'a railway station' : `a ${place.kind}`}. Booking the wrong network is an easy mistake to make at the machine.`,
            suggestedFix: `Check which service actually runs to ${place.name} and correct the mode.`,
            day,
            items: [item],
          }),
        );
      }
    }
    return out;
  },
};

const venueClosedWeekday: Rule = {
  id: 'venue-closed-weekday',
  severity: 'error',
  title: 'Closed that day',
  describe: 'A venue is scheduled on a weekday its opening hours exclude.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      const weekday = weekdayOf(day.date);
      for (const entry of timeline.entries) {
        const hours = entry.item.openingHours;
        if (!hours) continue;
        // A malformed range is the other rule's problem, not evidence of a closure.
        if (hours.confidence === 'guess' && hours.rules.every((r) => r.close <= r.open)) continue;
        if (isOpenOn(hours, weekday, entry.item.time)) continue;
        const closedAllDay = !isOpenOn(hours, weekday);
        out.push(
          makeFinding({
            ruleId: 'venue-closed-weekday',
            severity: closedAllDay ? 'error' : 'warning',
            title: `${entry.item.title} is closed on ${WEEKDAY_NAMES[weekday] ?? weekday}`,
            detail: closedAllDay
              ? `${day.date} is a ${WEEKDAY_NAMES[weekday] ?? weekday}, and the hours on file are "${hours.rawText ?? 'as recorded'}".`
              : `Scheduled at ${entry.item.time ?? 'no set time'}, which falls outside "${hours.rawText ?? 'the recorded hours'}".`,
            suggestedFix: 'Move it to a day it opens, or drop it. Confirm on the venue site first.',
            day,
            items: [entry.item],
          }),
        );
      }
    }
    return out;
  },
};

const openingHoursSuspicious: Rule = {
  id: 'opening-hours-suspicious',
  severity: 'warning',
  title: 'Opening hours look wrong as written',
  describe: 'The recorded hours do not parse cleanly, usually a missing am or pm.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      for (const { item } of timeline.entries) {
        const hours = item.openingHours;
        if (!hours?.rawText) continue;
        const { issues } = parseOpeningHours(hours.rawText);
        if (issues.length === 0) continue;
        const backwards = issues.includes('close-before-open');
        out.push(
          makeFinding({
            ruleId: 'opening-hours-suspicious',
            severity: 'warning',
            title: `Hours for ${item.title} read "${hours.rawText}"`,
            detail: backwards
              ? `The closing time is earlier than the opening time. This is nearly always a 24-hour clock written as a 12-hour one.`
              : `The hours could not be read (${issues.join(', ')}).`,
            suggestedFix: backwards
              ? 'Check the venue site and write the closing time on the 24-hour clock.'
              : 'Rewrite the hours in the form "Tue-Sun 09:00-19:00, closed Mondays".',
            day,
            items: [item],
          }),
        );
      }
    }
    return out;
  },
};

/** Places you pass through rather than visit. Repeats there mean nothing. */
const TRANSIT_KINDS = new Set(['rail-station', 'metro-station', 'airport', 'pier', 'bus-stop']);

const duplicateVenue: Rule = {
  id: 'duplicate-venue',
  severity: 'info',
  title: 'Same place on more than one day',
  describe: 'A venue appears on several days, which may be intentional or a leftover.',
  run(ctx) {
    const seen = new Map<string, { place: Place; items: Item[]; dates: string[] }>();
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      for (const { item } of timeline.entries) {
        const place = item.location;
        if (!place || isTransport(item)) continue;
        if (place.kind && TRANSIT_KINDS.has(place.kind)) continue;
        if (place.kind === 'hotel') continue;
        const key = placeKey(place);
        const entry = seen.get(key);
        if (entry) {
          entry.items.push(item);
          if (!entry.dates.includes(day.date)) entry.dates.push(day.date);
        } else {
          seen.set(key, { place, items: [item], dates: [day.date] });
        }
      }
    }

    const out: Finding[] = [];
    for (const { place, items, dates } of seen.values()) {
      if (dates.length < 2) continue;
      out.push(
        makeFinding({
          ruleId: 'duplicate-venue',
          severity: dates.length >= 3 ? 'warning' : 'info',
          title: `${place.name} appears on ${dates.length} days`,
          detail: `Listed on ${dates.join(', ')}. Deliberate, or the same idea copied forward?`,
          suggestedFix: 'Keep the day you actually want it on and mark the others optional.',
          items,
        }),
      );
    }
    return out;
  },
};

const seasonalService: Rule = {
  id: 'seasonal-service',
  severity: 'warning',
  title: 'Service may not run at that time of year',
  describe: 'A boat, ferry or mountain lift on a reduced out-of-season timetable.',
  run(ctx) {
    const out: Finding[] = [];
    for (const day of ctx.orderedDays) {
      const timeline = ctx.timelines.get(day.id);
      if (!timeline) continue;
      const monthNumber = Number(day.date.slice(5, 7));
      for (const { item } of timeline.entries) {
        const travel = item.travel;
        if (!travel) continue;

        const guide = ctx.guides.find(
          (g) =>
            g.seasonal?.offSeasonMonths.includes(monthNumber) &&
            (g.match.modes?.includes(travel.mode) ?? false),
        );
        const flagged = travel.seasonalTimetable === true;
        if (!flagged && !guide) continue;
        if (bookingOf(ctx, item.bookingId)?.status === 'booked') continue;

        out.push(
          makeFinding({
            ruleId: 'seasonal-service',
            severity: 'warning',
            title: `${item.title} may not run in ${MONTH_NAMES[monthNumber - 1] ?? day.date}`,
            detail:
              guide?.seasonal?.note ??
              `This ${travel.mode} runs a reduced timetable outside the summer season, and the last service of the day can be much earlier than you expect.`,
            suggestedFix: `Check the operator timetable for ${day.date} and have a land route in reserve.`,
            day,
            items: [item],
          }),
        );
      }
    }
    return out;
  },
};

export const placeRules: Rule[] = [
  chainStationMismatch,
  roundTripAsymmetry,
  missingTransitLeg,
  modePlaceKind,
  venueClosedWeekday,
  openingHoursSuspicious,
  duplicateVenue,
  seasonalService,
];

export type { LintContext };
