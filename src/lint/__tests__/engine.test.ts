import { describe, expect, it } from 'vitest';
import { makeBundle, makeDay, makeItem } from '@/test/builders';
import type { Finding, FindingState } from '@/domain/types';
import { applyStates, lintTrip, type Rule as EngineRule } from '../engine';
import { findingKey, findingStateId } from '../keys';
import { buildDayTimeline, fromMinutes, toMinutes } from '../timeline';

describe('findingKey', () => {
  it('is stable regardless of id order and drops blanks', () => {
    expect(findingKey('r', 'b', 'a', undefined, '')).toBe(findingKey('r', 'a', 'b'));
    expect(findingKey('r', 'a', 'a')).toBe('r|a');
  });

  it('namespaces state rows by trip', () => {
    expect(findingStateId('t1', 'r|a')).toBe('t1|r|a');
  });
});

describe('timeline', () => {
  it('parses and formats wall-clock times', () => {
    expect(toMinutes('08:35')).toBe(515);
    expect(toMinutes('24:00')).toBeNull();
    expect(toMinutes(null)).toBeNull();
    expect(fromMinutes(515)).toBe('08:35');
  });

  it('infers an end from duration and orders timed entries chronologically', () => {
    const day = makeDay({ date: '2026-09-26' });
    const items = [
      makeItem({ dayId: day.id, sortKey: 2000, title: 'Second', time: '10:00', durationMins: 30 }),
      makeItem({ dayId: day.id, sortKey: 1000, title: 'First', time: '09:00', timeEnd: '09:45' }),
      makeItem({ dayId: day.id, sortKey: 3000, title: 'Untimed' }),
    ];
    const tl = buildDayTimeline(day, items);
    expect(tl.entries.map((e) => e.item.title)).toEqual(['First', 'Second', 'Untimed']);
    expect(tl.timed.map((e) => e.item.title)).toEqual(['First', 'Second']);
    expect(tl.timed[1]?.endMin).toBe(630);
    expect(tl.timed[1]?.inferredEnd).toBe(true);
    expect(tl.timed[0]?.inferredEnd).toBe(false);
  });
});

describe('lintTrip', () => {
  const finding = (over: Partial<Finding> = {}): Finding => ({
    key: 'x|1',
    ruleId: 'x',
    severity: 'warning',
    title: 't',
    detail: 'd',
    itemIds: [],
    source: 'rule',
    ...over,
  });

  const ruleEmitting = (id: string, findings: Finding[]): EngineRule => ({
    id,
    severity: 'warning',
    title: id,
    describe: id,
    run: () => findings,
  });

  it('sorts by severity then date and drops duplicate keys', () => {
    const rules = [
      ruleEmitting('a', [
        finding({ key: 'a|1', ruleId: 'a', severity: 'info', date: '2026-09-26' }),
      ]),
      ruleEmitting('b', [
        finding({ key: 'b|1', ruleId: 'b', severity: 'error', date: '2026-10-01' }),
        finding({ key: 'b|1', ruleId: 'b', severity: 'error', date: '2026-10-01' }),
      ]),
    ];
    const out = lintTrip(makeBundle(), { rules });
    expect(out.map((f) => f.key)).toEqual(['b|1', 'a|1']);
  });

  it('overlays persisted resolve decisions', () => {
    const findings = [finding({ key: 'a|1' }), finding({ key: 'a|2' })];
    const states: FindingState[] = [
      {
        id: 't|a|1',
        tripId: 't',
        key: 'a|1',
        ruleId: 'a',
        status: 'resolved',
        note: 'checked',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
    ];
    const out = applyStates(findings, states);
    expect(out[0]).toMatchObject({ status: 'resolved', stateNote: 'checked' });
    expect(out[1]?.status).toBe('open');
  });
});
