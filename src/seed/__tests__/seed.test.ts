/**
 * The sample trip has to be correct as data, and it has to reproduce the problems the
 * traveller found by hand. If a rule stops firing on the real itinerary, that is a
 * regression in the linter even when every unit test still passes.
 */
import { describe, expect, it } from 'vitest';
import { ExportFileSchema, validateBundleIntegrity } from '@/domain/schemas';
import { allGuides } from '@/content/guides';
import { lintTrip } from '@/lint/engine';
import { bookByTimeline } from '@/playbook/bookBy';
import type { Finding } from '@/domain/types';
import { europe2026 } from '../europe-2026';
import { DAY_DATES, DAY_KEYS } from '../europe-2026/ids';
import { scanForMojibake } from '../europe-2026/normalize';

const TODAY = '2026-09-04';
const bundle = europe2026.bundle;

const findings: Finding[] = lintTrip(bundle, { today: TODAY, guides: allGuides });
const rulesFired = new Set(findings.map((f) => f.ruleId));
const on = (date: string): Finding[] => findings.filter((f) => f.date === date);

describe('the Europe 2026 sample trip', () => {
  it('is a valid export file', () => {
    expect(ExportFileSchema.safeParse(europe2026).success).toBe(true);
  });

  it('hangs together: every reference points at something real', () => {
    expect(validateBundleIntegrity(bundle)).toEqual([]);
  });

  it('has no mojibake anywhere in it', () => {
    expect(scanForMojibake(europe2026)).toEqual([]);
  });

  it('is entirely ASCII, so no encoding can mangle it', () => {
    const offenders: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        // eslint-disable-next-line no-control-regex
        if (/[^\x00-\x7F]/.test(value)) offenders.push(`${path}: ${value.slice(0, 60)}`);
      } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
      else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
      }
    };
    walk(europe2026, '$');
    expect(offenders).toEqual([]);
  });

  it('covers 23 consecutive days from the Sydney departure to the flight home', () => {
    expect(bundle.days).toHaveLength(DAY_KEYS.length);
    const dates = bundle.days.map((d) => d.date).sort();
    expect(dates[0]).toBe(DAY_DATES.d00);
    expect(dates[dates.length - 1]).toBe(DAY_DATES.d22);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('has a bed for every night, counting the overnight flight as one', () => {
    const uncovered = findings.filter(
      (f) => f.ruleId === 'accommodation-gap' && f.title.includes('No accommodation'),
    );
    // The 25 September night is spent in the air, which the rule recognises.
    expect(uncovered.map((f) => f.title)).toEqual([]);
  });

  it('gives every journey a travel leg', () => {
    const missing = bundle.items.filter(
      (i) => (i.type === 'transport' || i.type === 'transfer') && !i.travel,
    );
    expect(missing.map((i) => i.id)).toEqual([]);
  });

  it('traces every item back to the source notes', () => {
    expect(bundle.items.filter((i) => !i.sourceRef).map((i) => i.id)).toEqual([]);
  });
});

describe('the conflicts the traveller found by hand', () => {
  it('#1 the trip end date disagrees with the flight home', () => {
    // The header said 18 October; the flight is the 17th.
    expect(rulesFired.has('trip-range')).toBe(true);
  });

  it('#2 the original day numbering is recorded rather than lost', () => {
    const relabelled = bundle.days.filter((d) => d.originalLabel);
    expect(relabelled.length).toBeGreaterThanOrEqual(3);
    expect(bundle.conflicts.map((c) => c.id)).toContain('mc-day-numbering');
  });

  it('#3 the Paris check-in cannot happen before the train arrives', () => {
    const paris = on(DAY_DATES.d16);
    expect(paris.some((f) => f.ruleId === 'time-overlap')).toBe(true);
    expect(paris.some((f) => f.ruleId === 'stale-arrival-time')).toBe(true);
  });

  it('#4 the Basel connection onto a non-refundable TGV is flagged', () => {
    expect(bundle.conflicts.map((c) => c.id)).toContain('mc-basel-connection');
    expect(on(DAY_DATES.d16).some((f) => f.ruleId === 'unresolved-tag')).toBe(true);
  });

  it('#5 the old Amsterdam arrival time is caught against the booking', () => {
    const amsterdam = on(DAY_DATES.d20);
    const stale = amsterdam.find((f) => f.ruleId === 'stale-arrival-time');
    expect(stale?.detail).toContain('12:50');
  });

  it('#6 the Eurostar labelled two hours actually runs 1 h 25', () => {
    const brussels = on(DAY_DATES.d19);
    expect(brussels.some((f) => f.ruleId === 'transit-duration-mismatch')).toBe(true);
    expect(brussels.some((f) => f.ruleId === 'idle-gap')).toBe(true);
  });

  it('#7 the Chiasso to Lucerne routing is unresolved', () => {
    expect(bundle.conflicts.map((c) => c.id)).toContain('mc-chiasso-routing');
    expect(on(DAY_DATES.d09).some((f) => f.ruleId === 'unresolved-tag')).toBe(true);
  });

  it('#8 the Zaandijk leg is called a metro and the return is unaccounted for', () => {
    const zaanse = on(DAY_DATES.d21);
    expect(zaanse.some((f) => f.ruleId === 'mode-place-kind')).toBe(true);
    expect(zaanse.some((f) => f.ruleId === 'missing-transit-leg')).toBe(true);
  });

  it('#9 the Monday-only stroopwafel stall falls on a Friday', () => {
    const closed = on(DAY_DATES.d21).find((f) => f.ruleId === 'venue-closed-weekday');
    expect(closed?.title).toContain('Friday');
  });

  it('#10 the Louvre morning has an unexplained gap', () => {
    expect(on(DAY_DATES.d17).some((f) => f.ruleId === 'idle-gap')).toBe(true);
  });

  it('#11 no metro leg is planned from the 14th to Trocadero', () => {
    expect(on(DAY_DATES.d18).some((f) => f.ruleId === 'missing-transit-leg')).toBe(true);
  });

  it('#12 the Florence Duomo hours close before they open', () => {
    const suspicious = on(DAY_DATES.d05).find((f) => f.ruleId === 'opening-hours-suspicious');
    expect(suspicious?.title).toContain('10:15-3:45');
  });

  it('#13 and #14 repeated venues are surfaced, the tiramisu hardest', () => {
    const repeats = findings.filter((f) => f.ruleId === 'duplicate-venue');
    const tiramisu = repeats.find((f) => f.title.includes('Two Sizes'));
    const gallery = repeats.find((f) => f.title.includes('Doria'));
    expect(tiramisu?.severity).toBe('warning');
    expect(tiramisu?.title).toContain('3 days');
    expect(gallery).toBeDefined();
  });

  it('#15 the departure day has no journey planned to Schiphol', () => {
    const airport = on(DAY_DATES.d22).find((f) => f.ruleId === 'airport-lead-time');
    expect(airport?.detail).toContain('10:15');
  });

  it('#16 the Pisa round trip uses two different stations', () => {
    expect(on(DAY_DATES.d05).some((f) => f.ruleId === 'round-trip-asymmetry')).toBe(true);
  });

  it('#17 the evening Lake Como ferry is flagged as a seasonal risk', () => {
    expect(on(DAY_DATES.d08).some((f) => f.ruleId === 'seasonal-service')).toBe(true);
  });

  it('surfaces every hand-written conflict as its own card', () => {
    const manual = findings.filter((f) => f.ruleId === 'manual');
    expect(manual).toHaveLength(bundle.conflicts.length);
  });
});

describe('what the traveller sees on 4 September 2026', () => {
  it('puts the mountain and museum bookings near the front of the queue', () => {
    const timeline = bookByTimeline(bundle, allGuides, TODAY);
    const outstanding = timeline.filter(
      (e) => e.result.urgency === 'overdue' || e.result.urgency === 'now',
    );
    expect(outstanding.length).toBeGreaterThan(0);
    // Everything already ticketed is out of the queue.
    expect(outstanding.every((e) => e.booking.status === 'to_book')).toBe(true);
  });

  it('finds real problems rather than a wall of noise', () => {
    const errors = findings.filter((f) => f.severity === 'error');
    expect(findings.length).toBeGreaterThan(20);
    // An inbox nobody can clear is an inbox nobody opens.
    expect(errors.length).toBeLessThan(25);
  });

  it('reports which rules found nothing, as a record of coverage', () => {
    // Not an assertion about any single rule. It documents what the sample exercises.
    expect(rulesFired.size).toBeGreaterThanOrEqual(10);
  });
});
