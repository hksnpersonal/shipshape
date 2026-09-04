import { describe, expect, it } from 'vitest';
import { validateGuides } from '@/playbook/schema';
import { allGuides } from '../guides';

describe('shipped booking guides', () => {
  it('are all valid and free of duplicate ids', () => {
    expect(validateGuides(allGuides)).toEqual([]);
  });

  it('cover every country the sample trip visits, plus generic advice', () => {
    const countries = new Set(allGuides.map((g) => g.countryCode));
    for (const code of ['IT', 'CH', 'FR', 'BE', 'NL', 'EU']) {
      expect(countries, `no guides for ${code}`).toContain(code);
    }
  });

  it('label unconfirmed claims rather than stating them as fact', () => {
    // Anything speculative must be marked, so a reader can tell advice from recollection.
    const unmarked = allGuides.filter((g) =>
      [...(g.gotchas ?? []), ...(g.trustNotes ?? []), ...(g.priceSignals ?? [])].some(
        (line) =>
          /\bprobably\b|\bi think\b|\bmaybe\b/i.test(line) && !line.startsWith('[unverified]'),
      ),
    );
    expect(unmarked.map((g) => g.id)).toEqual([]);
  });

  it('give every guide a way to act on it', () => {
    for (const guide of allGuides) {
      expect(guide.official.url, `${guide.id} has no official URL`).toMatch(/^https:\/\//);
      expect(guide.bookAdvice.note.length, `${guide.id} advice is too thin`).toBeGreaterThan(20);
    }
  });
});
