import type { Rule } from '../engine';
import { placeRules } from './places';
import { timingRules } from './timing';
import { tripRules } from './trip';

/** The default rule set. Order here does not matter; findings are sorted by the engine. */
export const allRules: Rule[] = [...timingRules, ...placeRules, ...tripRules];

export { placeRules, timingRules, tripRules };
