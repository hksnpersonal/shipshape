/**
 * Place identity and locality.
 *
 * Two items mean the same physical place when their canonical keys match. Names in the
 * source notes are inconsistent ("Roma Termini" / "Roma Termini Station"), so the key is
 * either an explicit slug or a normalised form of the name.
 */
import type { Place } from '@/domain/types';

/** Words that decorate a station name without changing which station it is. */
const STATION_WORDS = new Set([
  'station',
  'stazione',
  'bahnhof',
  'gare',
  'hbf',
  'hauptbahnhof',
  'statie',
  'estacion',
]);

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Canonical identity for a place. An explicit `key` always wins; otherwise the name is
 * lowercased, stripped of accents and punctuation, and trailing station words removed.
 */
export function placeKey(place: Place): string {
  if (place.key) return place.key;
  const words = stripDiacritics(place.name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1) {
    const last = words[words.length - 1];
    if (last !== undefined && STATION_WORDS.has(last)) words.pop();
    else break;
  }
  return words.join('-');
}

export function samePlace(a: Place | null | undefined, b: Place | null | undefined): boolean {
  if (!a || !b) return false;
  return placeKey(a) === placeKey(b);
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. Both places must have coordinates. */
export function haversineKm(a: Place, b: Place): number {
  if (a.lat === undefined || a.lng === undefined || b.lat === undefined || b.lng === undefined) {
    throw new Error('haversineKm: both places need lat and lng');
  }
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Two places closer than this count as walkable-same for the missing-transit heuristic. */
export const SAME_LOCALITY_KM = 1.2;

export type Locality = 'same' | 'different' | 'unknown';

/**
 * Whether you could stroll between two places. Coordinates win; then the finer `zone`;
 * then `city`. `unknown` means the data cannot say, and callers must not guess.
 */
export function sameLocality(a: Place | null | undefined, b: Place | null | undefined): Locality {
  if (!a || !b) return 'unknown';
  if (samePlace(a, b)) return 'same';
  if (a.lat !== undefined && a.lng !== undefined && b.lat !== undefined && b.lng !== undefined) {
    return haversineKm(a, b) <= SAME_LOCALITY_KM ? 'same' : 'different';
  }
  if (a.zone && b.zone) return a.zone === b.zone ? 'same' : 'different';
  if (a.city && b.city) {
    // Different cities are definitely apart. The same city with no zone information is
    // not enough to claim they are walkable.
    return a.city.toLowerCase() === b.city.toLowerCase() ? 'unknown' : 'different';
  }
  if (a.countryCode && b.countryCode && a.countryCode !== b.countryCode) return 'different';
  return 'unknown';
}

/** The text a map link should search for. */
export function placeQuery(place: Place): string {
  if (place.mapsQuery) return place.mapsQuery;
  return place.address ? `${place.name}, ${place.address}` : place.name;
}
