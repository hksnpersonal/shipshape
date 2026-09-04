import { describe, expect, it } from 'vitest';
import {
  makeAccommodation,
  makeBooking,
  makeBundle,
  makeDay,
  makeItem,
  makePlace,
  makeTrip,
} from '@/test/builders';
import type { Item } from '@/domain/types';
import { accommodationForDate, itemsForDay, nightsCovered } from '../bundle';
import { describeHours, isOpenOn, parseOpeningHours, parseWeekday } from '../hours';
import { moveItem, needsRenormalise, renormalise, sortKeyBetween } from '../ordering';
import { haversineKm, placeKey, sameLocality, samePlace } from '../places';
import { TripBundleSchema, validateBundleIntegrity } from '../schemas';
import { applyDaySwap, describeSwap, planDaySwap } from '../swap';
import { addDays, daysBetween, formatDayLabel, todayIn, weekdayOf } from '../time';

describe('time', () => {
  it('reads the weekday of a date without a timezone', () => {
    expect(weekdayOf('2026-10-16')).toBe('fri');
    expect(weekdayOf('2026-09-26')).toBe('sat');
    expect(weekdayOf('2026-09-28')).toBe('mon');
  });

  it('counts calendar days across a month boundary', () => {
    expect(daysBetween('2026-09-30', '2026-10-02')).toBe(2);
    expect(daysBetween('2026-10-02', '2026-09-30')).toBe(-2);
    expect(addDays('2026-09-30', 2)).toBe('2026-10-02');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('gives a different calendar date either side of the date line', () => {
    // 2026-09-26 21:00 UTC is still the 26th in Rome and already the 27th in Sydney.
    const instant = new Date('2026-09-26T21:00:00Z');
    expect(todayIn('Europe/Rome', instant)).toBe('2026-09-26');
    expect(todayIn('Australia/Sydney', instant)).toBe('2026-09-27');
  });

  it('formats a day label', () => {
    expect(formatDayLabel('2026-09-26')).toBe('Sat 26 Sep');
  });
});

describe('places', () => {
  it('collapses decorated station names to one key', () => {
    expect(placeKey(makePlace({ name: 'Roma Termini' }))).toBe(
      placeKey(makePlace({ name: 'Roma Termini Station' })),
    );
    expect(placeKey(makePlace({ name: 'Basel SBB Bahnhof' }))).toBe('basel-sbb');
  });

  it('prefers an explicit key over the name', () => {
    const a = makePlace({ name: 'Termini', key: 'it-roma-termini' });
    const b = makePlace({ name: 'Roma Termini', key: 'it-roma-termini' });
    expect(samePlace(a, b)).toBe(true);
  });

  it('decides locality from coordinates, then zone, then city', () => {
    const withCoords = (lat: number, lng: number) => makePlace({ name: `p${lat}`, lat, lng });
    expect(sameLocality(withCoords(41.9, 12.5), withCoords(41.9005, 12.5005))).toBe('same');
    expect(sameLocality(withCoords(41.9, 12.5), withCoords(45.46, 9.19))).toBe('different');

    const zoneA = makePlace({ name: 'a', city: 'Paris', zone: 'paris-14e' });
    const zoneB = makePlace({ name: 'b', city: 'Paris', zone: 'paris-16e' });
    expect(sameLocality(zoneA, zoneB)).toBe('different');
    expect(sameLocality(zoneA, makePlace({ name: 'c', city: 'Paris', zone: 'paris-14e' }))).toBe(
      'same',
    );

    // Same city with no zone is not enough to claim you can walk it.
    const cityOnlyA = makePlace({ name: 'a', city: 'Amsterdam', zone: undefined });
    const cityOnlyB = makePlace({ name: 'b', city: 'Amsterdam', zone: undefined });
    expect(sameLocality(cityOnlyA, cityOnlyB)).toBe('unknown');
    expect(sameLocality(cityOnlyA, makePlace({ name: 'z', city: 'Zaandijk' }))).toBe('different');
  });

  it('measures distance between coordinates', () => {
    const rome = makePlace({ name: 'Rome', lat: 41.9028, lng: 12.4964 });
    const milan = makePlace({ name: 'Milan', lat: 45.4642, lng: 9.19 });
    expect(haversineKm(rome, milan)).toBeGreaterThan(450);
    expect(haversineKm(rome, milan)).toBeLessThan(500);
  });
});

describe('hours', () => {
  it('reads weekday words in several forms', () => {
    expect(parseWeekday('Tuesday')).toBe('tue');
    expect(parseWeekday('tues')).toBe('tue');
    expect(parseWeekday('TU')).toBe('tue');
    expect(parseWeekday('nonsense')).toBeUndefined();
  });

  it('parses a weekday range with a closure', () => {
    const { hours, issues } = parseOpeningHours('Tue-Sun 09:00-19:00, closed Mondays');
    expect(issues).toEqual([]);
    expect(hours?.closedOn).toEqual(['mon']);
    expect(hours?.rules[0]?.days).not.toContain('mon');
    expect(hours?.rules[0]?.open).toBe('09:00');
    expect(isOpenOn(hours, 'mon')).toBe(false);
    expect(isOpenOn(hours, 'wed', '10:00')).toBe(true);
    expect(isOpenOn(hours, 'wed', '20:00')).toBe(false);
  });

  it('defaults to every day when no weekday is named', () => {
    const { hours } = parseOpeningHours('07:00-20:00');
    expect(hours?.rules[0]?.days).toHaveLength(7);
    expect(isOpenOn(hours, 'sun', '08:00')).toBe(true);
  });

  it('marks an approximate seasonal range as a guess', () => {
    const { hours } = parseOpeningHours('~09:30-18:00 seasonal');
    expect(hours?.seasonal).toBe(true);
    expect(hours?.confidence).toBe('guess');
  });

  it('handles round-the-clock opening', () => {
    const { hours } = parseOpeningHours('open 24 h');
    expect(isOpenOn(hours, 'tue', '03:00')).toBe(true);
  });

  it('reports a close time before the open time rather than repairing it', () => {
    const { hours, issues } = parseOpeningHours('10:15-3:45');
    expect(issues).toContain('close-before-open');
    expect(hours?.confidence).toBe('guess');
    expect(hours?.rawText).toBe('10:15-3:45');
    expect(isOpenOn(hours, 'wed', '11:00')).toBe(false);
  });

  it('reports a string with no times at all', () => {
    expect(parseOpeningHours('opening hours vary').issues).toContain('no-time-range');
  });

  it('describes hours for the interface', () => {
    const { hours } = parseOpeningHours('Mon-Sat 09:00-19:00');
    expect(hours && describeHours(hours)).toBe('Mon-Sat 09:00-19:00');
  });
});

describe('ordering', () => {
  const day = makeDay({ date: '2026-09-26' });
  const items = (keys: number[]): Item[] =>
    keys.map((sortKey, i) => makeItem({ dayId: day.id, sortKey, title: `t${i}` }));

  it('inserts between neighbours and renormalises when the gap closes', () => {
    const [a, b] = items([1000, 2000]);
    expect(a && b && sortKeyBetween(a, b)).toBe(1500);
    expect(sortKeyBetween(undefined, a)).toBe(0);
    expect(sortKeyBetween(b, undefined)).toBe(3000);

    const tight = items([1000, 1000.5, 2000]);
    expect(needsRenormalise(tight)).toBe(true);
    expect(renormalise(tight).map((i) => i.sortKey)).toEqual([2000, 3000]);
  });

  it('swaps neighbours and refuses to move past the ends', () => {
    const list = items([1000, 2000, 3000]);
    const moved = moveItem(list, list[1]?.id ?? '', 'up');
    expect(moved.map((i) => [i.title, i.sortKey])).toEqual([
      ['t1', 1000],
      ['t0', 2000],
    ]);
    expect(moveItem(list, list[0]?.id ?? '', 'up')).toEqual([]);
    expect(moveItem(list, list[2]?.id ?? '', 'down')).toEqual([]);
  });
});

describe('bundle', () => {
  it('finds the stay covering a night and reports gaps', () => {
    const bundle = makeBundle({
      days: [
        makeDay({ date: '2026-09-26' }),
        makeDay({ date: '2026-09-27' }),
        makeDay({ date: '2026-09-28' }),
      ],
      accommodations: [makeAccommodation({ checkIn: '2026-09-26', checkOut: '2026-09-27' })],
    });
    expect(accommodationForDate(bundle, '2026-09-26')).toBeDefined();
    // Checkout day is not a night at that hotel.
    expect(accommodationForDate(bundle, '2026-09-27')).toBeUndefined();
    const { covered, uncovered } = nightsCovered(bundle);
    expect(covered).toEqual(['2026-09-26']);
    expect(uncovered).toEqual(['2026-09-27']);
  });

  it('returns a day’s items in sortKey order', () => {
    const day = makeDay({ date: '2026-09-26' });
    const bundle = makeBundle({
      days: [day],
      items: [
        makeItem({ dayId: day.id, sortKey: 2000, title: 'second' }),
        makeItem({ dayId: day.id, sortKey: 1000, title: 'first' }),
      ],
    });
    expect(itemsForDay(bundle, day.id).map((i) => i.title)).toEqual(['first', 'second']);
  });
});

describe('swap', () => {
  it('moves free items and holds back booked and pinned ones', () => {
    const dayA = makeDay({ date: '2026-10-08', id: 'day-a' });
    const dayB = makeDay({ date: '2026-10-09', id: 'day-b' });
    const booking = makeBooking({ date: '2026-10-08', status: 'booked' });
    const bundle = makeBundle({
      days: [dayA, dayB],
      bookings: [booking],
      items: [
        makeItem({ id: 'free-a', dayId: dayA.id, sortKey: 1000, title: 'Gondola' }),
        makeItem({
          id: 'booked-a',
          dayId: dayA.id,
          sortKey: 2000,
          title: 'Cogwheel to Rigi Kulm',
          bookingId: booking.id,
        }),
        makeItem({
          id: 'pinned-a',
          dayId: dayA.id,
          sortKey: 3000,
          title: 'Blausee reservation',
          pinnedToDate: true,
        }),
        makeItem({ id: 'free-b', dayId: dayB.id, sortKey: 1000, title: 'Lake walk' }),
      ],
    });

    const plan = planDaySwap(bundle, dayA.id, dayB.id);
    expect(plan.heldBack).toEqual([
      { itemId: 'booked-a', title: 'Cogwheel to Rigi Kulm', reason: 'booked' },
      { itemId: 'pinned-a', title: 'Blausee reservation', reason: 'pinned' },
    ]);
    expect(plan.moves.map((m) => [m.itemId, m.toDayId])).toEqual([
      ['free-a', 'day-b'],
      ['free-b', 'day-a'],
    ]);

    const after = applyDaySwap(bundle.items, plan, '2026-09-04T00:00:00.000Z');
    expect(after.find((i) => i.id === 'free-a')?.dayId).toBe('day-b');
    expect(after.find((i) => i.id === 'booked-a')?.dayId).toBe('day-a');
    // The days themselves never move.
    expect(dayA.date).toBe('2026-10-08');
    expect(dayB.date).toBe('2026-10-09');
    expect(describeSwap(plan)).toContain('2 items move');
  });

  it('is a no-op when a day is swapped with itself', () => {
    const day = makeDay({ date: '2026-10-08' });
    const bundle = makeBundle({ days: [day], items: [makeItem({ dayId: day.id })] });
    expect(planDaySwap(bundle, day.id, day.id)).toEqual({ moves: [], heldBack: [] });
  });
});

describe('schemas', () => {
  const day = makeDay({ date: '2026-09-26' });
  const validBundle = makeBundle({
    trip: makeTrip(),
    days: [day],
    items: [makeItem({ dayId: day.id })],
  });

  it('accepts a well-formed bundle', () => {
    expect(TripBundleSchema.safeParse(validBundle).success).toBe(true);
    expect(validateBundleIntegrity(validBundle)).toEqual([]);
  });

  it('rejects an impossible time and a malformed date', () => {
    const badTime = makeBundle({
      ...validBundle,
      items: [makeItem({ dayId: day.id, time: '25:00' })],
    });
    expect(TripBundleSchema.safeParse(badTime).success).toBe(false);

    const badDate = makeBundle({ ...validBundle, days: [makeDay({ date: '26-09-2026' })] });
    expect(TripBundleSchema.safeParse(badDate).success).toBe(false);
  });

  it('catches references that point nowhere', () => {
    const orphan = makeBundle({
      ...validBundle,
      items: [makeItem({ dayId: 'no-such-day' })],
    });
    expect(validateBundleIntegrity(orphan)[0]).toContain('unknown day');
  });

  it('catches a transport item with no travel leg', () => {
    const bad = makeBundle({
      ...validBundle,
      items: [makeItem({ dayId: day.id, type: 'transport' })],
    });
    expect(validateBundleIntegrity(bad).join(' ')).toContain('no travel leg');
  });
});
