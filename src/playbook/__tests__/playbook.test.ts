import { describe, expect, it } from 'vitest';
import { makeBooking, makeBundle, makeItem, makePlace } from '@/test/builders';
import type { Guide } from '../types';
import { bookBy, bookByTimeline, urgentBookings } from '../bookBy';
import { directionsUrl, itemLinks, placeUrl, renderTemplate, toDDMMYYYY } from '../deepLinks';
import { bestGuide, countryOf, matchGuides } from '../match';

const REVIEWED = '2026-09-04';

const guide = (over: Partial<Guide> & { id: string }): Guide => ({
  title: 'A guide',
  countryCode: 'IT',
  category: 'train',
  summary: 'Something useful about buying this particular kind of ticket.',
  match: {},
  official: { name: 'Operator', url: 'https://example.com/' },
  bookAdvice: { note: 'Book it at some sensible point before you travel.' },
  lastReviewed: REVIEWED,
  ...over,
});

const highSpeed = guide({
  id: 'it-highspeed',
  match: { kinds: ['train'], operators: ['Trenitalia'], modes: ['train'] },
  bookAdvice: { latestDaysBefore: 30, note: 'Book a month out for the cheap fares.' },
  ticketsOpen: { daysBefore: 120 },
});

const regional = guide({
  id: 'it-regional',
  category: 'regional-train',
  match: { kinds: ['regional-train'], modes: ['train'] },
  bookAdvice: {
    latestDaysBefore: null,
    onSiteOk: true,
    note: 'Buy it at the station on the day of travel.',
  },
});

const swiss = guide({
  id: 'ch-mountain',
  countryCode: 'CH',
  category: 'mountain-railway',
  match: { kinds: ['mountain-railway'], operators: ['Trenitalia'] },
});

const generic = guide({
  id: 'eu-rail',
  countryCode: 'EU',
  match: { kinds: ['train', 'regional-train'] },
});

const guides = [highSpeed, regional, swiss, generic];

describe('matchGuides', () => {
  it('picks the high-speed guide for a Trenitalia express and the regional one otherwise', () => {
    const express = makeBooking({
      date: '2026-09-29',
      kind: 'train',
      operator: 'Trenitalia',
      countryCode: 'IT',
    });
    expect(bestGuide(express, guides)?.id).toBe('it-highspeed');

    const slow = makeBooking({ date: '2026-09-30', kind: 'regional-train', countryCode: 'IT' });
    expect(bestGuide(slow, guides)?.id).toBe('it-regional');
  });

  it('never returns a guide for another country', () => {
    const italian = makeBooking({
      date: '2026-09-29',
      kind: 'mountain-railway',
      operator: 'Trenitalia',
      countryCode: 'IT',
    });
    const ids = matchGuides(italian, guides).map((r) => r.guide.id);
    expect(ids).not.toContain('ch-mountain');
  });

  it('lets an explicit pin outrank a strong operator match', () => {
    const booking = makeBooking({
      date: '2026-09-29',
      kind: 'train',
      operator: 'Trenitalia',
      countryCode: 'IT',
      guideIds: ['eu-rail'],
    });
    expect(bestGuide(booking, guides)?.id).toBe('eu-rail');
  });

  it('matches on a canonical place key', () => {
    const withPlace = guide({
      id: 'it-varenna',
      match: { placeKeys: ['it-varenna-esino'] },
    });
    const item = makeItem({
      dayId: 'd',
      title: 'Train to the lake',
      location: makePlace({ name: 'Varenna-Esino', key: 'it-varenna-esino', countryCode: 'IT' }),
    });
    const result = matchGuides(item, [withPlace]);
    expect(result[0]?.reasons).toContain('about this exact place');
  });

  it('explains why each guide matched and is stable across calls', () => {
    const booking = makeBooking({
      date: '2026-09-29',
      kind: 'train',
      operator: 'Trenitalia',
      countryCode: 'IT',
    });
    const first = matchGuides(booking, guides);
    const second = matchGuides(booking, guides);
    expect(first.map((r) => r.guide.id)).toEqual(second.map((r) => r.guide.id));
    expect(first[0]?.reasons).toContain('operated by Trenitalia');
  });

  it('reads the country from a place when the booking does not say', () => {
    const item = makeItem({
      dayId: 'd',
      travel: {
        mode: 'train',
        from: makePlace({ name: 'Basel SBB', countryCode: 'CH' }),
        to: makePlace({ name: 'Paris Gare de Lyon', countryCode: 'FR' }),
      },
    });
    expect(countryOf(item)).toBe('CH');
  });
});

describe('bookBy', () => {
  const TODAY = '2026-09-04';

  it('uses an explicit window before the guide or the default', () => {
    const booking = makeBooking({
      date: '2026-10-04',
      kind: 'train',
      operator: 'Trenitalia',
      countryCode: 'IT',
      bookWindow: { latestDaysBefore: 2 },
    });
    const result = bookBy(booking, guides, TODAY);
    expect(result.basis).toBe('explicit');
    expect(result.date).toBe('2026-10-02');
  });

  it('falls back to the guide, then to the per-kind default', () => {
    const fromGuide = bookBy(
      makeBooking({ date: '2026-10-04', kind: 'train', operator: 'Trenitalia', countryCode: 'IT' }),
      guides,
      TODAY,
    );
    expect(fromGuide.basis).toBe('guide');
    expect(fromGuide.date).toBe('2026-09-04');

    const fromDefault = bookBy(
      makeBooking({ date: '2026-10-04', kind: 'restaurant', countryCode: 'IT' }),
      [],
      TODAY,
    );
    expect(fromDefault.basis).toBe('default');
    expect(fromDefault.date).toBe('2026-09-20');
  });

  it('treats a null window as bought on the day', () => {
    const result = bookBy(
      makeBooking({ date: '2026-09-30', kind: 'regional-train', countryCode: 'IT' }),
      guides,
      TODAY,
    );
    expect(result).toMatchObject({ date: null, basis: 'on-site', urgency: 'on-site' });
  });

  it('reports when tickets go on sale', () => {
    const result = bookBy(
      makeBooking({ date: '2026-10-04', kind: 'train', operator: 'Trenitalia', countryCode: 'IT' }),
      guides,
      TODAY,
    );
    expect(result.opensOn).toBe('2026-06-06');
  });

  it('bands urgency and marks anything already booked as done', () => {
    const at = (date: string, status: 'to_book' | 'booked' = 'to_book') =>
      bookBy(makeBooking({ date, kind: 'restaurant', countryCode: 'IT', status }), [], TODAY)
        .urgency;

    expect(at('2026-09-10')).toBe('overdue'); // book-by was 2026-08-27
    expect(at('2026-09-20')).toBe('now'); // book-by 2026-09-06
    expect(at('2026-10-04')).toBe('soon'); // book-by 2026-09-20
    expect(at('2026-11-30')).toBe('later');
    expect(at('2026-09-10', 'booked')).toBe('done');
  });

  it('orders the timeline by book-by date with on-the-day items last', () => {
    const bundle = makeBundle({
      bookings: [
        makeBooking({
          id: 'onsite',
          date: '2026-09-30',
          kind: 'regional-train',
          countryCode: 'IT',
        }),
        makeBooking({ id: 'late', date: '2026-11-01', kind: 'restaurant', countryCode: 'IT' }),
        makeBooking({ id: 'soon', date: '2026-09-20', kind: 'restaurant', countryCode: 'IT' }),
      ],
    });
    const timeline = bookByTimeline(bundle, guides, TODAY);
    expect(timeline.map((e) => e.booking.id)).toEqual(['soon', 'late', 'onsite']);
    expect(urgentBookings(timeline).map((e) => e.booking.id)).toEqual(['soon']);
  });
});

describe('deep links', () => {
  it('substitutes and encodes template variables', () => {
    const url = renderTemplate('https://example.com/?d={date}&from={from}', {
      date: '2026-10-16',
      from: "Sant'Antonino Relais",
    });
    expect(url).toBe("https://example.com/?d=2026-10-16&from=Sant'Antonino%20Relais");
  });

  it('returns nothing when a variable has no value, so the link can be dropped', () => {
    expect(renderTemplate('https://example.com/?d={date}', {})).toBe('');
    expect(renderTemplate('https://example.com/?d={date}', { date: '' })).toBe('');
  });

  it('formats a European date', () => {
    expect(toDDMMYYYY('2026-10-16')).toBe('16/10/2026');
  });

  it('maps travel modes onto the ones Google Maps understands', () => {
    const a = makePlace({ name: 'Hotel Baslertor' });
    const b = makePlace({ name: 'Luzern train station' });
    expect(directionsUrl(a, b, 'walk')).toContain('travelmode=walking');
    expect(directionsUrl(a, b, 'taxi')).toContain('travelmode=driving');
    expect(directionsUrl(a, b, 'cogwheel')).toContain('travelmode=transit');
    expect(placeUrl(a)).toContain('query=Hotel%20Baslertor');
  });

  it('offers directions for a journey and a map pin for a place', () => {
    const journey = makeItem({
      dayId: 'd',
      type: 'transport',
      travel: {
        mode: 'train',
        from: makePlace({ name: 'Roma Termini' }),
        to: makePlace({ name: 'Firenze SMN' }),
      },
    });
    expect(itemLinks(journey, '2026-09-29').map((l) => l.kind)).toEqual(['directions']);

    const visit = makeItem({ dayId: 'd', location: makePlace({ name: 'Pantheon' }) });
    expect(itemLinks(visit, '2026-09-26').map((l) => l.kind)).toEqual(['map']);

    const nowhere = makeItem({ dayId: 'd', location: null });
    expect(itemLinks(nowhere, '2026-09-26')).toEqual([]);
  });

  it('adds the official booking link when a guide matched', () => {
    const item = makeItem({ dayId: 'd', location: makePlace({ name: 'Pilatus Kulm' }) });
    const links = itemLinks(item, '2026-10-05', undefined, highSpeed);
    expect(links.some((l) => l.kind === 'book' && l.url === 'https://example.com/')).toBe(true);
  });
});
