/**
 * Every booking guide the app ships with.
 *
 * Content is plain typed modules rather than markdown so an authoring mistake is a
 * compile error, and so the whole playbook is available offline with no fetch.
 */
import type { Guide } from '@/playbook/types';
import { belgiumGuides, franceGuides, netherlandsGuides } from './fr-be-nl';
import { euGuides } from './eu';
import { italyGuides } from './it';
import { switzerlandGuides } from './ch';

export const allGuides: Guide[] = [
  ...italyGuides,
  ...switzerlandGuides,
  ...franceGuides,
  ...belgiumGuides,
  ...netherlandsGuides,
  ...euGuides,
];

export { belgiumGuides, euGuides, franceGuides, italyGuides, netherlandsGuides, switzerlandGuides };
