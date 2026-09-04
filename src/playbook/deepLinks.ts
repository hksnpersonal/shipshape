/**
 * One-tap links out.
 *
 * The whole point of the app is that you stop copying place names between Google Maps,
 * an operator site and a booking confirmation. Every link is built from data already in
 * the itinerary, so nothing has to be retyped on a phone at a station.
 */
import { placeQuery } from '@/domain/places';
import type { Booking, ISODate, Item, Place, TravelMode } from '@/domain/types';
import type { DeepLinkKind, Guide } from './types';

/** Guide links plus the map links the app builds itself. */
export type ResolvedLinkKind = DeepLinkKind | 'directions';

export interface DeepLink {
  label: string;
  kind: ResolvedLinkKind;
  url: string;
}

const MAPS_MODE: Record<TravelMode, 'transit' | 'walking' | 'driving'> = {
  walk: 'walking',
  taxi: 'driving',
  metro: 'transit',
  tram: 'transit',
  bus: 'transit',
  train: 'transit',
  ferry: 'transit',
  boat: 'transit',
  gondola: 'transit',
  cablecar: 'transit',
  cogwheel: 'transit',
  funicular: 'transit',
  flight: 'transit',
  shuttle: 'transit',
};

/** `2026-10-16` -> `16/10/2026`, for operators that want a European date. */
export function toDDMMYYYY(date: ISODate): string {
  const [y, m, d] = date.split('-');
  return y && m && d ? `${d}/${m}/${y}` : date;
}

/**
 * Fill a guide's URL template. Returns `''` when a placeholder has no value, so the
 * caller drops the link rather than sending someone to a broken page.
 */
export function renderTemplate(template: string, vars: Record<string, string | undefined>): string {
  let missing = false;
  const url = template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined || value === '') {
      missing = true;
      return '';
    }
    return encodeURIComponent(value);
  });
  return missing ? '' : url;
}

export function placeUrl(place: Place): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(place))}`;
}

export function directionsUrl(from: Place, to: Place, mode: TravelMode): string {
  const params = new URLSearchParams({
    api: '1',
    origin: placeQuery(from),
    destination: placeQuery(to),
    travelmode: MAPS_MODE[mode] ?? 'transit',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Variables available to a guide template for a given item and booking. */
export function templateVars(
  date: ISODate | undefined,
  item?: Item,
  booking?: Booking,
): Record<string, string | undefined> {
  const from = item?.travel?.from ?? booking?.from;
  const to = item?.travel?.to ?? booking?.to;
  return {
    date,
    dateDDMMYYYY: date ? toDDMMYYYY(date) : undefined,
    from: from?.name,
    to: to?.name,
    time: item?.time ?? booking?.depart ?? undefined,
  };
}

/**
 * Every link worth offering on an item: how to get there, where it is, and where to buy
 * whatever it needs.
 */
export function itemLinks(
  item: Item,
  date: ISODate | undefined,
  booking?: Booking,
  guide?: Guide,
): DeepLink[] {
  const links: DeepLink[] = [];

  const travel = item.travel;
  if (travel) {
    links.push({
      label: `Directions to ${travel.to.name}`,
      kind: 'directions',
      url: directionsUrl(travel.from, travel.to, travel.mode),
    });
  } else if (item.location) {
    links.push({
      label: `${item.location.name} on the map`,
      kind: 'map',
      url: placeUrl(item.location),
    });
  }

  if (booking?.url) {
    links.push({ label: 'Your booking', kind: 'info', url: booking.url });
  }

  if (guide) {
    links.push({ label: `Book at ${guide.official.name}`, kind: 'book', url: guide.official.url });
    const vars = templateVars(date, item, booking);
    for (const link of guide.deepLinks ?? []) {
      const url = renderTemplate(link.template, vars);
      if (url) links.push({ label: link.label, kind: link.kind, url });
    }
  }

  return links;
}

/** Links for a booking on its own, used by the bookings board. */
export function bookingLinks(booking: Booking, guide?: Guide): DeepLink[] {
  const links: DeepLink[] = [];
  if (booking.url) links.push({ label: 'Your booking', kind: 'info', url: booking.url });
  if (guide) {
    links.push({ label: `Book at ${guide.official.name}`, kind: 'book', url: guide.official.url });
    const vars = templateVars(booking.date, undefined, booking);
    for (const link of guide.deepLinks ?? []) {
      const url = renderTemplate(link.template, vars);
      if (url) links.push({ label: link.label, kind: link.kind, url });
    }
  }
  if (booking.from && booking.to) {
    links.push({
      label: 'Route on the map',
      kind: 'directions',
      url: directionsUrl(booking.from, booking.to, 'train'),
    });
  }
  return links;
}
