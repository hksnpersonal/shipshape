/**
 * The hooks every screen builds on.
 *
 * One live query over the trip, one memoised audit, and one notion of "today" that can be
 * simulated so the Today view is testable before you have left home.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { allGuides } from '@/content/guides';
import { db } from '@/db/db';
import { loadTripBundle } from '@/db/repo';
import { todayIn } from '@/domain/time';
import { applyStates, lintTrip, type ResolvedFinding } from '@/lint/engine';
import { bookByTimeline, type BookByEntry } from '@/playbook/bookBy';
import {
  DEFAULT_SETTINGS,
  type ID,
  type ISODate,
  type ProviderSettings,
  type TripBundle,
} from '@/domain/types';

export function useSettings(): ProviderSettings {
  return useLiveQuery(
    async () => (await db.settings.get('settings')) ?? DEFAULT_SETTINGS,
    [],
    DEFAULT_SETTINGS,
  ) as ProviderSettings;
}

export function useTrips() {
  return useLiveQuery(() => db.trips.toArray(), [], undefined);
}

export function useTripBundle(tripId: ID | undefined): TripBundle | null | undefined {
  return useLiveQuery(async () => {
    if (!tripId) return null;
    // Touching every table makes this re-run on any change to the trip.
    await Promise.all([db.items.count(), db.bookings.count(), db.findingStates.count()]);
    return loadTripBundle(tripId);
  }, [tripId]);
}

/** The date the app should treat as today, honouring the simulated date in settings. */
export function useToday(timeZone = 'Europe/Rome'): ISODate {
  const settings = useSettings();
  return settings.simulatedToday ?? todayIn(timeZone);
}

export interface Audit {
  findings: ResolvedFinding[];
  open: ResolvedFinding[];
  /** Errors and warnings only: the things that actually need a decision. */
  actionable: ResolvedFinding[];
  /** Information the app noticed but is not asking you to do anything about. */
  notes: ResolvedFinding[];
  counts: {
    error: number;
    warning: number;
    info: number;
    /** Errors plus warnings. This is the number shown on badges. */
    actionable: number;
    open: number;
    resolved: number;
  };
}

export function useAudit(bundle: TripBundle | null | undefined, today: ISODate): Audit {
  const states = useLiveQuery(
    () => (bundle ? db.findingStates.where('tripId').equals(bundle.trip.id).toArray() : []),
    [bundle?.trip.id, bundle?.items.length],
    [],
  );

  return useMemo(() => {
    if (!bundle) {
      return {
        findings: [],
        open: [],
        actionable: [],
        notes: [],
        counts: { error: 0, warning: 0, info: 0, actionable: 0, open: 0, resolved: 0 },
      };
    }
    const findings = applyStates(lintTrip(bundle, { today, guides: allGuides }), states ?? []);
    const open = findings.filter((f) => f.status === 'open');
    const actionable = open.filter((f) => f.severity !== 'info');
    const notes = open.filter((f) => f.severity === 'info');
    return {
      findings,
      open,
      actionable,
      notes,
      counts: {
        error: open.filter((f) => f.severity === 'error').length,
        warning: open.filter((f) => f.severity === 'warning').length,
        info: notes.length,
        actionable: actionable.length,
        open: open.length,
        resolved: findings.length - open.length,
      },
    };
  }, [bundle, states, today]);
}

export function useBookBy(bundle: TripBundle | null | undefined, today: ISODate): BookByEntry[] {
  return useMemo(() => (bundle ? bookByTimeline(bundle, allGuides, today) : []), [bundle, today]);
}
