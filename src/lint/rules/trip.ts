import type { Rule } from '../engine';

/**
 * Trip-level and booking rules: airport lead time, trip date range, day sequence,
 * unresolved tags, accommodation gaps, unlinked bookings, overdue book-by dates,
 * missing day-before reminders, and manual conflicts. Filled by chunk C3c.
 */
export const tripRules: Rule[] = [];
