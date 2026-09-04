/**
 * Validation for playbook content.
 *
 * The guides are shipped advice that people will act on. A test runs `validateGuides`
 * over everything in `src/content/guides` so a broken link or a made-up category fails
 * the build rather than reaching a traveller at a ticket machine.
 */
import { z } from 'zod';
import { ISODateSchema } from '@/domain/schemas';
import { renderTemplate } from './deepLinks';
import type { Guide } from './types';

const GuideCategorySchema = z.enum([
  'train',
  'regional-train',
  'international-train',
  'ferry',
  'mountain-railway',
  'gondola',
  'bus',
  'metro',
  'museum',
  'attraction',
  'restaurant',
  'pass',
  'city-card',
  'airport',
  'flight',
  'hotel',
]);

const httpsUrl = z.string().url().startsWith('https://', 'must be an https URL');

export const GuideSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z]{2}-[a-z0-9-]+$/, 'id must be kebab-case and start with a country prefix'),
  title: z.string().min(1),
  countryCode: z.string().min(2),
  category: GuideCategorySchema,
  summary: z.string().min(20, 'a summary should actually say something'),
  match: z.object({
    kinds: z.array(z.string()).optional(),
    modes: z.array(z.string()).optional(),
    operators: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    placeKeys: z.array(z.string()).optional(),
    countries: z.array(z.string()).optional(),
  }),
  official: z.object({ name: z.string().min(1), url: httpsUrl, note: z.string().optional() }),
  resellers: z
    .array(
      z.object({
        name: z.string().min(1),
        url: httpsUrl,
        trust: z.enum(['fine', 'ok-with-markup', 'avoid']),
        note: z.string().optional(),
      }),
    )
    .optional(),
  ticketsOpen: z
    .object({ daysBefore: z.number().optional(), note: z.string().optional() })
    .optional(),
  bookAdvice: z.object({
    latestDaysBefore: z.number().nullable().optional(),
    onSiteOk: z.boolean().optional(),
    note: z.string().min(10),
  }),
  refundRules: z.string().optional(),
  changeRules: z.string().optional(),
  validation: z.object({ required: z.boolean(), note: z.string().min(5) }).optional(),
  passCoverage: z
    .array(
      z.object({
        passId: z.string(),
        coverage: z.enum(['covered', 'discount', 'none']),
        note: z.string().optional(),
      }),
    )
    .optional(),
  seasonal: z
    .object({ offSeasonMonths: z.array(z.number().int().min(1).max(12)), note: z.string() })
    .optional(),
  priceSignals: z.array(z.string()).optional(),
  gotchas: z.array(z.string()).optional(),
  trustNotes: z.array(z.string()).optional(),
  deepLinks: z
    .array(
      z.object({
        label: z.string().min(1),
        kind: z.enum(['book', 'timetable', 'info', 'map']),
        template: z.string().startsWith('https://', 'templates must be absolute https URLs'),
      }),
    )
    .optional(),
  sources: z.array(z.string()).optional(),
  lastReviewed: ISODateSchema,
});

const SAMPLE_VARS = {
  date: '2026-10-16',
  dateDDMMYYYY: '16/10/2026',
  from: 'Roma Termini',
  to: 'Firenze S. M. Novella',
  time: '08:35',
};

/**
 * Everything wrong with a set of guides, as readable sentences. Empty means they are fit
 * to ship.
 */
export function validateGuides(guides: Guide[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const guide of guides) {
    const parsed = GuideSchema.safeParse(guide);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`${guide.id || '(no id)'}: ${issue.path.join('.')} ${issue.message}`);
      }
      continue;
    }
    if (seen.has(guide.id)) problems.push(`${guide.id}: duplicate guide id`);
    seen.add(guide.id);

    for (const link of guide.deepLinks ?? []) {
      const url = renderTemplate(link.template, SAMPLE_VARS);
      if (!url) {
        problems.push(`${guide.id}: deep link "${link.label}" uses a placeholder we cannot fill`);
        continue;
      }
      try {
        new URL(url);
      } catch {
        problems.push(`${guide.id}: deep link "${link.label}" does not render a valid URL`);
      }
    }

    if (guide.bookAdvice.latestDaysBefore === null && guide.bookAdvice.onSiteOk !== true) {
      problems.push(
        `${guide.id}: says there is no booking deadline but does not confirm buying on site is fine`,
      );
    }
  }

  return problems;
}

/** Guides whose advice has not been checked in a while, for the staleness banner. */
export function staleGuides(guides: Guide[], today: string, maxAgeDays = 183): Guide[] {
  const cutoff = new Date(today).getTime() - maxAgeDays * 86_400_000;
  return guides.filter((g) => new Date(g.lastReviewed).getTime() < cutoff);
}
