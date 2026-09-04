import type { ID } from '@/domain/types';

/**
 * Stable identity for a finding, so a resolve/dismiss survives edits elsewhere in the
 * trip and re-runs of the linter. Ids are sorted so argument order never matters.
 */
export function findingKey(ruleId: string, ...ids: Array<ID | undefined | null>): string {
  const clean = ids.filter((id): id is ID => typeof id === 'string' && id.length > 0);
  return `${ruleId}|${[...new Set(clean)].sort().join(',')}`;
}

/** Primary key of the persisted state row for a finding. */
export function findingStateId(tripId: ID, key: string): string {
  return `${tripId}|${key}`;
}
