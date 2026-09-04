import type { Rule } from '../engine';

/**
 * Clock-based rules: overlaps, transfer gaps, stated-vs-actual durations, idle gaps,
 * stale duplicate lines, item/booking time and date agreement, order-vs-time sanity.
 * Filled by chunk C3a.
 */
export const timingRules: Rule[] = [];
