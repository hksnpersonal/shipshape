/**
 * One case per conflict listed in section 8 of the source itinerary notes.
 *
 * Each builds the smallest fixture that reproduces the situation and asserts the rule
 * fires. These are deliberately not seed tests: they prove the rules are general, not
 * that one particular trip happens to trip them.
 */
import { describe, expect, it } from 'vitest';
import { parseOpeningHours } from '@/domain/hours';
import type { Finding, Item, Place } from '@/domain/types';
import { makeBooking, makeBundle, makeConflict, makeDay, makeItem } from '@/test/builders';
import { lintTrip } from '../engine';

const TODAY = '2026-09-04';

const lint = (bundle: Parameters<typeof lintTrip>[0]): Finding[] =>
  lintTrip(bundle, { today: TODAY });

const fired = (findings: Finding[], ruleId: string): Finding[] =>
  findings.filter((f) => f.ruleId === ruleId);

const expectRule = (findings: Finding[], ruleId: string): Finding => {
  const hits = fired(findings, ruleId);
  expect(
    hits,
    `expected rule "${ruleId}" to fire, got: ${findings.map((f) => f.ruleId).join(', ')}`,
  ).not.toHaveLength(0);
  const first = hits[0];
  if (!first) throw new Error('unreachable');
  return first;
};

// --- places used across the cases -----------------------------------------------------
const p = (name: string, over: Partial<Place> = {}): Place => ({
  name,
  kind: 'venue',
  city: 'Paris',
  countryCode: 'FR',
  ...over,
});

const gareDeLyon = p('Paris Gare de Lyon', { kind: 'rail-station', zone: 'paris-12e' });
const gareDuNord = p('Paris Gare du Nord', { kind: 'rail-station', zone: 'paris-10e' });
const baselSbb = p('Basel SBB', { kind: 'rail-station', city: 'Basel', countryCode: 'CH' });
const interlakenOst = p('Interlaken Ost', {
  kind: 'rail-station',
  city: 'Interlaken',
  countryCode: 'CH',
});
const brusselsMidi = p('Brussels Midi', {
  kind: 'rail-station',
  city: 'Brussels',
  countryCode: 'BE',
});
const grandPlace = p('Grand Place', { city: 'Brussels', zone: 'brussels-centre' });
const amsterdamCentraal = p('Amsterdam Centraal', {
  kind: 'rail-station',
  city: 'Amsterdam',
  zone: 'amsterdam-centrum',
  countryCode: 'NL',
});
const zaandijk = p('Zaandijk Zaanse Schans', {
  kind: 'rail-station',
  city: 'Zaandijk',
  countryCode: 'NL',
});

const transport = (over: Partial<Item> & { dayId: string }): Item =>
  makeItem({ type: 'transport', ...over });

describe('spec section 8 conflicts', () => {
  // --- timing -------------------------------------------------------------------------

  it('#3 flags a check-in that starts before the train has arrived', () => {
    const day = makeDay({ date: '2026-10-11', city: 'Paris', countryCode: 'FR' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          transport({
            dayId: day.id,
            sortKey: 1000,
            title: 'TGV Lyria to Paris Gare de Lyon',
            time: '12:37',
            timeEnd: '15:40',
            travel: { mode: 'train', from: baselSbb, to: gareDeLyon, durationMins: 183 },
          }),
          makeItem({
            dayId: day.id,
            sortKey: 2000,
            type: 'admin',
            title: 'Check in and rest',
            time: '14:30',
            durationMins: 30,
          }),
        ],
      }),
    );
    const finding = expectRule(findings, 'time-overlap');
    expect(finding.severity).toBe('error');
    expect(finding.detail).toContain('15:40');
  });

  it('#3b flags too little time between arriving and the next timed stop', () => {
    const day = makeDay({ date: '2026-10-11', city: 'Paris', countryCode: 'FR' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          transport({
            dayId: day.id,
            sortKey: 1000,
            type: 'transfer',
            title: 'Metro to the hotel',
            time: '15:40',
            timeEnd: '16:04',
            travel: { mode: 'metro', from: gareDeLyon, to: gareDuNord, durationMins: 24 },
          }),
          makeItem({
            dayId: day.id,
            sortKey: 2000,
            type: 'admin',
            title: 'Check in and freshen up',
            time: '16:09',
          }),
        ],
      }),
    );
    expect(expectRule(findings, 'insufficient-transfer').severity).toBe('warning');
  });

  it('#4 raises the bar for a connection onto a non-refundable ticket', () => {
    const day = makeDay({ date: '2026-10-11', city: 'Basel', countryCode: 'CH' });
    const tgv = makeBooking({
      id: 'bk-tgv',
      date: '2026-10-11',
      kind: 'international-train',
      title: 'TGV Lyria Basel to Paris',
      status: 'booked',
      depart: '12:37',
      refundable: false,
      changeable: false,
    });
    const findings = lint(
      makeBundle({
        days: [day],
        bookings: [tgv],
        items: [
          transport({
            dayId: day.id,
            sortKey: 1000,
            title: 'Train Interlaken Ost to Basel SBB',
            time: '10:04',
            timeEnd: '12:04',
            travel: { mode: 'train', from: interlakenOst, to: baselSbb, durationMins: 120 },
          }),
          transport({
            dayId: day.id,
            sortKey: 2000,
            title: 'TGV Lyria to Paris',
            time: '12:37',
            timeEnd: '15:40',
            bookingId: tgv.id,
            travel: { mode: 'train', from: baselSbb, to: gareDeLyon, durationMins: 183 },
          }),
        ],
      }),
    );
    const finding = expectRule(findings, 'insufficient-transfer');
    // 33 minutes is fine for a flexible ticket and not fine for this one.
    expect(finding.severity).toBe('error');
    expect(finding.detail).toContain('cannot be changed');
  });

  it('#6 flags a leg labelled two hours that runs an hour and twenty five', () => {
    const day = makeDay({ date: '2026-10-14', city: 'Paris', countryCode: 'FR' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          transport({
            dayId: day.id,
            title: 'Eurostar to Brussels Midi',
            time: '06:49',
            timeEnd: '08:14',
            travel: { mode: 'train', from: gareDuNord, to: brusselsMidi, durationMins: 120 },
          }),
        ],
      }),
    );
    expect(expectRule(findings, 'transit-duration-mismatch').title).toContain('2 h');
  });

  it('#6b flags the empty stretch between arriving in Brussels and the first stop', () => {
    const day = makeDay({ date: '2026-10-14', city: 'Brussels', countryCode: 'BE' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          transport({
            dayId: day.id,
            sortKey: 1000,
            title: 'Eurostar to Brussels Midi',
            time: '06:49',
            timeEnd: '08:14',
            travel: { mode: 'train', from: gareDuNord, to: brusselsMidi, durationMins: 85 },
          }),
          makeItem({ dayId: day.id, sortKey: 2000, title: 'Grand Place', time: '09:30' }),
        ],
      }),
    );
    expect(expectRule(findings, 'idle-gap').title).toContain('1 h 16');
  });

  it('#10 flags the Louvre gap with no activity scheduled in it', () => {
    const day = makeDay({ date: '2026-10-12', city: 'Paris', countryCode: 'FR' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          transport({
            dayId: day.id,
            sortKey: 1000,
            type: 'transfer',
            title: 'Metro to Palais Royal',
            time: '08:30',
            timeEnd: '08:50',
            travel: {
              mode: 'metro',
              from: gareDuNord,
              to: p('Palais Royal', { kind: 'metro-station' }),
              durationMins: 20,
            },
          }),
          makeItem({ dayId: day.id, sortKey: 2000, title: 'Jardin des Tuileries', time: '10:20' }),
        ],
      }),
    );
    expect(fired(findings, 'idle-gap')).toHaveLength(1);
  });

  it('#5 flags an old arrival time left beside the booked one', () => {
    const day = makeDay({ date: '2026-10-15', city: 'Amsterdam', countryCode: 'NL' });
    const eurostar = makeBooking({
      id: 'bk-ams',
      date: '2026-10-15',
      kind: 'international-train',
      title: 'Eurostar Paris to Amsterdam',
      status: 'booked',
      depart: '09:24',
      arrive: '12:50',
      from: gareDuNord,
      to: amsterdamCentraal,
    });
    const findings = lint(
      makeBundle({
        days: [day],
        bookings: [eurostar],
        items: [
          makeItem({
            dayId: day.id,
            title: 'Arrive Amsterdam Centraal',
            time: '12:45',
            location: amsterdamCentraal,
          }),
        ],
      }),
    );
    const finding = expectRule(findings, 'stale-arrival-time');
    expect(finding.detail).toContain('12:50');
    expect(finding.suggestedFix).toContain('12:50');
  });

  it('#3c flags an itinerary line that disagrees with the ticket it is linked to', () => {
    const day = makeDay({ date: '2026-10-11', city: 'Paris', countryCode: 'FR' });
    const tgv = makeBooking({
      id: 'bk-tgv',
      date: '2026-10-11',
      kind: 'international-train',
      title: 'TGV Lyria',
      status: 'booked',
      depart: '12:37',
      arrive: '15:40',
    });
    const findings = lint(
      makeBundle({
        days: [day],
        bookings: [tgv],
        items: [
          transport({
            dayId: day.id,
            title: 'TGV Lyria to Paris',
            time: '12:37',
            timeEnd: '13:40',
            bookingId: tgv.id,
            travel: { mode: 'train', from: baselSbb, to: gareDeLyon },
          }),
        ],
      }),
    );
    expect(expectRule(findings, 'item-booking-time-mismatch').detail).toContain('15:40');
  });

  // --- places and venues --------------------------------------------------------------

  it('#7 flags a journey that resumes from a station the previous leg never reached', () => {
    const day = makeDay({ date: '2026-10-04', city: 'Lucerne', countryCode: 'CH' });
    const chiasso = p('Chiasso', { kind: 'rail-station', city: 'Chiasso', countryCode: 'CH' });
    const arthGoldau = p('Arth-Goldau', { kind: 'rail-station', city: 'Arth', countryCode: 'CH' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          transport({
            dayId: day.id,
            sortKey: 1000,
            title: 'Trenitalia to Chiasso',
            time: '08:10',
            timeEnd: '08:58',
            travel: {
              mode: 'train',
              from: p('Milano Centrale', {
                kind: 'rail-station',
                city: 'Milan',
                countryCode: 'IT',
              }),
              to: chiasso,
            },
          }),
          transport({
            dayId: day.id,
            sortKey: 2000,
            title: 'Train onward to Lucerne',
            time: '11:00',
            travel: {
              mode: 'train',
              from: arthGoldau,
              to: p('Luzern', { kind: 'rail-station', city: 'Lucerne', countryCode: 'CH' }),
            },
          }),
        ],
      }),
    );
    expect(expectRule(findings, 'chain-station-mismatch').detail).toContain('Arth-Goldau');
  });

  it('#16 notices the Pisa round trip uses two different stations', () => {
    const day = makeDay({ date: '2026-09-30', city: 'Florence', countryCode: 'IT' });
    const smn = p('Firenze Santa Maria Novella', {
      kind: 'rail-station',
      city: 'Florence',
      countryCode: 'IT',
    });
    const sanRossore = p('Pisa San Rossore', {
      kind: 'rail-station',
      city: 'Pisa',
      countryCode: 'IT',
    });
    const centrale = p('Pisa Centrale', { kind: 'rail-station', city: 'Pisa', countryCode: 'IT' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          transport({
            dayId: day.id,
            sortKey: 1000,
            title: 'Regional train to Pisa',
            time: '07:30',
            timeEnd: '08:54',
            travel: { mode: 'train', from: smn, to: sanRossore },
          }),
          transport({
            dayId: day.id,
            sortKey: 2000,
            title: 'Regional train back to Florence',
            time: '11:30',
            timeEnd: '12:30',
            travel: { mode: 'train', from: centrale, to: smn },
          }),
        ],
      }),
    );
    const finding = expectRule(findings, 'round-trip-asymmetry');
    expect(finding.detail).toContain('Pisa Centrale');
  });

  it('#8 flags no return journey between Zaanse Schans and the market', () => {
    const day = makeDay({ date: '2026-10-16', city: 'Amsterdam', countryCode: 'NL' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          makeItem({
            dayId: day.id,
            sortKey: 1000,
            title: 'Explore Zaanse Schans',
            time: '09:20',
            location: p('Zaanse Schans', { city: 'Zaandijk', countryCode: 'NL' }),
          }),
          makeItem({
            dayId: day.id,
            sortKey: 2000,
            title: 'Albert Cuyp Market',
            time: '13:30',
            location: p('Albert Cuyp Market', {
              city: 'Amsterdam',
              zone: 'amsterdam-de-pijp',
              countryCode: 'NL',
            }),
          }),
        ],
      }),
    );
    expect(expectRule(findings, 'missing-transit-leg').title).toContain('Albert Cuyp');
  });

  it('#11 flags the missing metro leg from the 14th to Trocadero', () => {
    const day = makeDay({ date: '2026-10-13', city: 'Paris', countryCode: 'FR' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          makeItem({
            dayId: day.id,
            sortKey: 1000,
            type: 'meal',
            title: 'Lunch at Les Fondus de la Raclette',
            time: '12:30',
            location: p('Les Fondus de la Raclette', { zone: 'paris-14e' }),
          }),
          makeItem({
            dayId: day.id,
            sortKey: 2000,
            title: 'Trocadero',
            time: '14:30',
            location: p('Trocadero', { zone: 'paris-16e' }),
          }),
        ],
      }),
    );
    expect(fired(findings, 'missing-transit-leg')).toHaveLength(1);
  });

  it('#8b flags a leg called a metro that runs between railway stations', () => {
    const day = makeDay({ date: '2026-10-16', city: 'Amsterdam', countryCode: 'NL' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          transport({
            dayId: day.id,
            title: 'Metro to Zaandijk Zaanse Schans',
            time: '08:40',
            travel: {
              mode: 'metro',
              from: amsterdamCentraal,
              to: zaandijk,
              durationMins: 21,
            },
          }),
        ],
      }),
    );
    expect(expectRule(findings, 'mode-place-kind').detail).toContain('railway station');
  });

  it('#9 flags a Monday-only stall visited on a Friday', () => {
    const day = makeDay({ date: '2026-10-16', city: 'Amsterdam', countryCode: 'NL' });
    const parsed = parseOpeningHours('Mon 09:00-17:00');
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          makeItem({
            dayId: day.id,
            title: "RUDI's Original Stroopwafels",
            time: '13:45',
            location: p('Albert Cuyp Market', { city: 'Amsterdam', countryCode: 'NL' }),
            openingHours: parsed.hours ?? null,
          }),
        ],
      }),
    );
    const finding = expectRule(findings, 'venue-closed-weekday');
    expect(finding.severity).toBe('error');
    expect(finding.title).toContain('Friday');
  });

  it('#13 flags a Monday-to-Saturday gallery visited on a Sunday', () => {
    const day = makeDay({ date: '2026-09-27', city: 'Rome', countryCode: 'IT' });
    const parsed = parseOpeningHours('Mon-Sat 09:00-19:00');
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          makeItem({
            dayId: day.id,
            title: 'Galleria Doria Pamphilj',
            time: '17:00',
            location: p('Galleria Doria Pamphilj', { city: 'Rome', countryCode: 'IT' }),
            openingHours: parsed.hours ?? null,
          }),
        ],
      }),
    );
    expect(expectRule(findings, 'venue-closed-weekday').title).toContain('Sunday');
  });

  it('#12 flags hours that close before they open', () => {
    const day = makeDay({ date: '2026-09-30', city: 'Florence', countryCode: 'IT' });
    const parsed = parseOpeningHours('10:15-3:45');
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          makeItem({
            dayId: day.id,
            title: 'Cathedral of Santa Maria del Fiore',
            time: '14:00',
            location: p('Duomo', { city: 'Florence', countryCode: 'IT' }),
            openingHours: parsed.hours ?? null,
          }),
        ],
      }),
    );
    const finding = expectRule(findings, 'opening-hours-suspicious');
    expect(finding.detail).toContain('12-hour');
    // A garbled range must not masquerade as a closure.
    expect(fired(findings, 'venue-closed-weekday')).toHaveLength(0);
  });

  it('#13b and #14 flag a venue repeated across days, harder at three', () => {
    const twoSizes = p('Two Sizes Tiramisu', { city: 'Rome', countryCode: 'IT' });
    const doria = p('Galleria Doria Pamphilj', { city: 'Rome', countryCode: 'IT' });
    const days = ['2026-09-26', '2026-09-27', '2026-09-28'].map((date) =>
      makeDay({ date, city: 'Rome', countryCode: 'IT' }),
    );
    const findings = lint(
      makeBundle({
        days,
        items: [
          ...days.map((d, i) =>
            makeItem({
              dayId: d.id,
              sortKey: 1000,
              id: `ts-${i}`,
              title: 'Two Sizes Tiramisu',
              location: twoSizes,
            }),
          ),
          makeItem({
            dayId: days[0]?.id ?? '',
            sortKey: 2000,
            id: 'dp-0',
            title: 'Galleria Doria Pamphilj',
            location: doria,
          }),
          makeItem({
            dayId: days[2]?.id ?? '',
            sortKey: 2000,
            id: 'dp-1',
            title: 'Galleria Doria Pamphilj',
            location: doria,
          }),
        ],
      }),
    );
    const hits = fired(findings, 'duplicate-venue');
    const tiramisu = hits.find((f) => f.title.includes('Two Sizes'));
    const gallery = hits.find((f) => f.title.includes('Doria'));
    expect(tiramisu?.severity).toBe('warning');
    expect(tiramisu?.title).toContain('3 days');
    expect(gallery?.severity).toBe('info');
  });

  it('#17 flags an October lake ferry as a seasonal risk', () => {
    const day = makeDay({ date: '2026-10-03', city: 'Menaggio', countryCode: 'IT' });
    const findings = lint(
      makeBundle({
        days: [day],
        items: [
          transport({
            dayId: day.id,
            title: 'Ferry Menaggio to Varenna',
            time: '17:00',
            travel: {
              mode: 'ferry',
              from: p('Menaggio pier', { kind: 'pier', city: 'Menaggio', countryCode: 'IT' }),
              to: p('Varenna pier', { kind: 'pier', city: 'Varenna', countryCode: 'IT' }),
              seasonalTimetable: true,
            },
          }),
        ],
      }),
    );
    expect(expectRule(findings, 'seasonal-service').suggestedFix).toContain('land route');
  });

  // --- trip level ---------------------------------------------------------------------

  it('#15 flags a departure day with no journey to the airport', () => {
    const day = makeDay({ date: '2026-10-17', city: 'Amsterdam', countryCode: 'NL' });
    const flight = makeBooking({
      id: 'bk-home',
      date: '2026-10-17',
      kind: 'flight',
      title: 'Thai Airways to Sydney',
      status: 'booked',
      depart: '14:15',
      to: p('Amsterdam Schiphol', { kind: 'airport', city: 'Amsterdam', countryCode: 'NL' }),
    });
    const findings = lint(
      makeBundle({
        trip: { ...makeBundle().trip, endDate: '2026-10-17' },
        days: [day],
        bookings: [flight],
        items: [
          makeItem({
            dayId: day.id,
            type: 'admin',
            title: 'Check out of the hotel',
            time: '09:45',
          }),
        ],
      }),
    );
    const finding = expectRule(findings, 'airport-lead-time');
    expect(finding.detail).toContain('10:15');
  });

  it('#1 flags a trip end date that disagrees with the flight home', () => {
    const findings = lint(
      makeBundle({
        trip: { ...makeBundle().trip, startDate: '2026-09-25', endDate: '2026-10-18' },
        days: [makeDay({ date: '2026-10-17', city: 'Amsterdam', countryCode: 'NL' })],
        bookings: [
          makeBooking({
            date: '2026-10-17',
            kind: 'flight',
            title: 'Thai Airways to Sydney',
            status: 'booked',
            depart: '14:15',
          }),
        ],
      }),
    );
    expect(expectRule(findings, 'trip-range').title).toContain('2026-10-18');
  });

  it('#2 flags a missing day in the middle of the trip', () => {
    const findings = lint(
      makeBundle({
        trip: { ...makeBundle().trip, startDate: '2026-09-26', endDate: '2026-09-29' },
        days: [
          makeDay({ date: '2026-09-26' }),
          makeDay({ date: '2026-09-27' }),
          makeDay({ date: '2026-09-29' }),
        ],
      }),
    );
    expect(expectRule(findings, 'day-sequence').title).toContain('2026-09-28');
  });

  it('surfaces a hand-written conflict as a finding of its own', () => {
    const day = makeDay({ date: '2026-10-04', city: 'Lucerne', countryCode: 'CH' });
    const findings = lint(
      makeBundle({
        days: [day],
        conflicts: [
          makeConflict({
            id: 'mc-chiasso',
            title: 'Is it the same train onward from Chiasso?',
            detail: 'Only the Milan to Chiasso leg is booked.',
            severity: 'warning',
            dayId: day.id,
          }),
        ],
      }),
    );
    const finding = expectRule(findings, 'manual');
    expect(finding.source).toBe('manual');
    expect(finding.date).toBe('2026-10-04');
    expect(finding.key).toBe('manual|mc-chiasso');
  });
});
