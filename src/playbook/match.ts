/**
 * Matching an itinerary entry to the right piece of booking advice.
 *
 * Scoring is additive and every contribution records a reason, so the interface can show
 * *why* a guide came up rather than presenting it as an oracle.
 */
import { placeKey } from '@/domain/places';
import type { Booking, CountryCode, Item, Place, TravelPass } from '@/domain/types';
import type { Guide, GuideCategory, GuideMatchResult } from './types';

export interface MatchContext {
  countryCode?: CountryCode;
  passes?: TravelPass[];
}

const isBooking = (subject: Item | Booking): subject is Booking =>
  'kind' in subject && 'status' in subject;

function placesOf(subject: Item | Booking): Place[] {
  const out: Place[] = [];
  if (isBooking(subject)) {
    if (subject.from) out.push(subject.from);
    if (subject.to) out.push(subject.to);
  } else {
    if (subject.location) out.push(subject.location);
    if (subject.travel) out.push(subject.travel.from, subject.travel.to);
  }
  return out;
}

/** Where this thing happens, from the most reliable signal available. */
export function countryOf(subject: Item | Booking, ctx?: MatchContext): CountryCode | undefined {
  if (isBooking(subject) && subject.countryCode) return subject.countryCode;
  for (const place of placesOf(subject)) {
    if (place.countryCode) return place.countryCode;
  }
  return ctx?.countryCode;
}

/** The guide category you would reach for by default, given only the kind or mode. */
function defaultCategory(subject: Item | Booking): GuideCategory | undefined {
  if (isBooking(subject)) {
    const map: Partial<Record<Booking['kind'], GuideCategory>> = {
      flight: 'flight',
      train: 'train',
      'regional-train': 'regional-train',
      'international-train': 'international-train',
      ferry: 'ferry',
      'mountain-railway': 'mountain-railway',
      gondola: 'gondola',
      bus: 'bus',
      hotel: 'hotel',
      restaurant: 'restaurant',
      attraction: 'attraction',
      pass: 'pass',
      'city-card': 'city-card',
    };
    return map[subject.kind];
  }
  const mode = subject.travel?.mode;
  if (!mode) return undefined;
  const map: Partial<Record<NonNullable<typeof mode>, GuideCategory>> = {
    train: 'train',
    ferry: 'ferry',
    boat: 'ferry',
    cogwheel: 'mountain-railway',
    funicular: 'mountain-railway',
    cablecar: 'gondola',
    gondola: 'gondola',
    metro: 'metro',
    bus: 'bus',
    flight: 'flight',
  };
  return map[mode];
}

function haystack(subject: Item | Booking): string {
  const parts = [subject.title, subject.notes ?? ''];
  if (isBooking(subject)) parts.push(subject.operator ?? '', subject.provider ?? '');
  else parts.push(subject.travel?.operator ?? '', subject.travel?.line ?? '');
  return parts.join(' ').toLowerCase();
}

function operatorText(subject: Item | Booking): string {
  if (isBooking(subject))
    return `${subject.operator ?? ''} ${subject.provider ?? ''}`.toLowerCase();
  return (subject.travel?.operator ?? '').toLowerCase();
}

/**
 * Guides that apply to a subject, best first. Only positive scores are returned, and the
 * order is stable so the same input always renders the same list.
 */
export function matchGuides(
  subject: Item | Booking,
  guides: Guide[],
  ctx: MatchContext = {},
): GuideMatchResult[] {
  const country = countryOf(subject, ctx);
  const keys = new Set(placesOf(subject).map(placeKey));
  const text = haystack(subject);
  const operators = operatorText(subject);
  const category = defaultCategory(subject);
  const pinned = isBooking(subject) ? new Set(subject.guideIds ?? []) : new Set<string>();
  const mode = isBooking(subject) ? undefined : subject.travel?.mode;
  const kind = isBooking(subject) ? subject.kind : undefined;

  const results: GuideMatchResult[] = [];
  for (const guide of guides) {
    // A guide for another country is never relevant, however well it scores otherwise.
    if (guide.countryCode !== 'EU' && country && guide.countryCode !== country) continue;
    if (guide.match.countries?.length && country && !guide.match.countries.includes(country)) {
      continue;
    }

    let score = 0;
    const reasons: string[] = [];

    if (pinned.has(guide.id)) {
      score += 100;
      reasons.push('pinned to this booking');
    }
    for (const op of guide.match.operators ?? []) {
      if (op && operators.includes(op.toLowerCase())) {
        score += 40;
        reasons.push(`operated by ${op}`);
        break;
      }
    }
    if (kind && guide.match.kinds?.includes(kind)) {
      score += 30;
      reasons.push(`covers ${kind} bookings`);
    }
    if (mode && guide.match.modes?.includes(mode)) {
      score += 30;
      reasons.push(`covers travel by ${mode}`);
    }
    for (const key of guide.match.placeKeys ?? []) {
      if (keys.has(key)) {
        score += 30;
        reasons.push('about this exact place');
        break;
      }
    }
    for (const word of guide.match.keywords ?? []) {
      if (word && text.includes(word.toLowerCase())) {
        score += 10;
        reasons.push(`mentions "${word}"`);
      }
    }
    if (category && guide.category === category) {
      score += 5;
      reasons.push(`general advice for ${category}`);
    }

    if (score > 0) results.push({ guide, score, reasons });
  }

  return results.sort((a, b) => b.score - a.score || a.guide.id.localeCompare(b.guide.id));
}

export function bestGuide(
  subject: Item | Booking,
  guides: Guide[],
  ctx: MatchContext = {},
): Guide | undefined {
  return matchGuides(subject, guides, ctx)[0]?.guide;
}
