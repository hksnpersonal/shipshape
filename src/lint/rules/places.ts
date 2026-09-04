import type { Rule } from '../engine';

/**
 * Place- and venue-based rules: station chaining, round-trip asymmetry, missing transit
 * legs, mode/place-kind mismatch, weekday closures, suspicious opening hours, duplicate
 * venues, seasonal services. Filled by chunk C3b.
 */
export const placeRules: Rule[] = [];
