import type {
  Finding,
  FindingState,
  FindingStatus,
  ID,
  Severity,
  TripBundle,
} from '@/domain/types';
import type { Guide } from '@/playbook/types';
import { allRules } from './rules';
import { buildTimelines, type DayTimeline } from './timeline';

/** Tunables. Every rule reads thresholds from here rather than hard-coding them. */
export interface LintOptions {
  /** The date the audit is run for, `YYYY-MM-DD`. Injected so tests are deterministic. */
  today: string;
  /** Minimum comfortable gap between a leg arriving and the next thing starting. */
  minTransferMins: number;
  /** Raised threshold when the next leg's booking is non-refundable/non-changeable. */
  minTransferNonRefundableMins: number;
  /** A gap longer than this with nothing planned is reported as an idle gap. */
  idleGapMins: number;
  /** Allowed drift between a stated duration and depart/arrive times. */
  durationToleranceMins: number;
  /** How early to be at an airport before departure. */
  airportLeadMins: number;
  /** Walking speed used to sanity-check walk legs. */
  walkingKmh: number;
  /** A guide reviewed longer ago than this is flagged as possibly stale. */
  guideStaleDays: number;
}

export const DEFAULT_LINT_OPTIONS: LintOptions = {
  today: '1970-01-01',
  minTransferMins: 10,
  minTransferNonRefundableMins: 45,
  idleGapMins: 60,
  durationToleranceMins: 10,
  airportLeadMins: 240,
  walkingKmh: 4.5,
  guideStaleDays: 183,
};

export interface LintContext {
  bundle: TripBundle;
  guides: Guide[];
  options: LintOptions;
  /** Per-day resolved timelines, keyed by day id. */
  timelines: Map<ID, DayTimeline>;
  /** Days in date order. */
  orderedDays: TripBundle['days'];
}

export interface Rule {
  id: string;
  /** Default severity. A rule may still emit findings at another severity. */
  severity: Severity;
  /** Short human title for the rule itself, shown in settings/docs. */
  title: string;
  /** One sentence describing what the rule checks. */
  describe: string;
  run(ctx: LintContext): Finding[];
}

export interface LintInput extends Partial<LintOptions> {
  guides?: Guide[];
  /** Override the registered rule set (tests use this to run one rule in isolation). */
  rules?: Rule[];
}

export function buildContext(bundle: TripBundle, input: LintInput = {}): LintContext {
  const { guides = [], rules: _rules, ...optionOverrides } = input;
  const options: LintOptions = { ...DEFAULT_LINT_OPTIONS, ...optionOverrides };
  return {
    bundle,
    guides,
    options,
    timelines: buildTimelines(bundle),
    orderedDays: bundle.days.slice().sort((a, b) => a.date.localeCompare(b.date)),
  };
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/**
 * Run every rule over a trip. Pure: same bundle plus same options gives the same
 * findings in the same order (severity, then date, then rule id, then key).
 */
export function lintTrip(bundle: TripBundle, input: LintInput = {}): Finding[] {
  const ctx = buildContext(bundle, input);
  const rules = input.rules ?? allRules;
  const findings: Finding[] = [];
  for (const rule of rules) {
    for (const finding of rule.run(ctx)) findings.push(finding);
  }
  const seen = new Set<string>();
  return findings
    .filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (a.date ?? '').localeCompare(b.date ?? '') ||
        a.ruleId.localeCompare(b.ruleId) ||
        a.key.localeCompare(b.key),
    );
}

export interface ResolvedFinding extends Finding {
  status: FindingStatus;
  stateNote?: string;
}

/** Overlay persisted resolve/dismiss decisions onto freshly computed findings. */
export function applyStates(findings: Finding[], states: FindingState[]): ResolvedFinding[] {
  const byKey = new Map(states.map((s) => [s.key, s]));
  return findings.map((f) => {
    const state = byKey.get(f.key);
    return state
      ? { ...f, status: state.status, ...(state.note ? { stateNote: state.note } : {}) }
      : { ...f, status: 'open' as const };
  });
}
