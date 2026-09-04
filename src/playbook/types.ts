import type { BookingKind, CountryCode, ID, ISODate, TravelMode } from '@/domain/types';

/**
 * The booking playbook: curated, offline knowledge about *where and when* to buy each
 * kind of ticket in each country. Content lives in `src/content/guides/*.ts` as typed
 * modules so authoring errors are compile errors.
 */

export type GuideCategory =
  | 'train'
  | 'regional-train'
  | 'international-train'
  | 'ferry'
  | 'mountain-railway'
  | 'gondola'
  | 'bus'
  | 'metro'
  | 'museum'
  | 'attraction'
  | 'restaurant'
  | 'pass'
  | 'city-card'
  | 'airport'
  | 'flight'
  | 'hotel';

/** How much a traveller should trust a non-official sales channel. */
export type ResellerTrust = 'fine' | 'ok-with-markup' | 'avoid';

export interface Reseller {
  name: string;
  url: string;
  trust: ResellerTrust;
  note?: string;
}

export interface GuideMatch {
  kinds?: BookingKind[];
  modes?: TravelMode[];
  /** Case-insensitive substring match against operator/provider. */
  operators?: string[];
  /** Case-insensitive substring match against title and notes. */
  keywords?: string[];
  /** Canonical `Place.key` values this guide is about. */
  placeKeys?: string[];
  countries?: CountryCode[];
}

export interface BookAdvice {
  /** Book no later than this many days before travel. `null` = on the day / on-site. */
  latestDaysBefore?: number | null;
  /** True when turning up and paying at the counter is genuinely fine. */
  onSiteOk?: boolean;
  note: string;
}

export interface GuidePassCoverage {
  passId: ID;
  coverage: 'covered' | 'discount' | 'none';
  note?: string;
}

export type DeepLinkKind = 'book' | 'timetable' | 'info' | 'map';

export interface GuideDeepLink {
  label: string;
  kind: DeepLinkKind;
  /** URL template with `{date}`, `{dateDDMMYYYY}`, `{from}`, `{to}`, `{time}` slots. */
  template: string;
}

export interface Guide {
  id: ID;
  title: string;
  /** `'EU'` for advice that is not country-specific. */
  countryCode: CountryCode | 'EU';
  category: GuideCategory;
  summary: string;
  match: GuideMatch;
  official: { name: string; url: string; note?: string };
  resellers?: Reseller[];
  ticketsOpen?: { daysBefore?: number; note?: string };
  bookAdvice: BookAdvice;
  refundRules?: string;
  changeRules?: string;
  /** Italian regional trains and similar: the ticket must be validated before boarding. */
  validation?: { required: boolean; note: string };
  passCoverage?: GuidePassCoverage[];
  /** Months (1-12) when the service runs a reduced timetable or closes. */
  seasonal?: { offSeasonMonths: number[]; note: string };
  priceSignals?: string[];
  gotchas?: string[];
  trustNotes?: string[];
  deepLinks?: GuideDeepLink[];
  sources?: string[];
  lastReviewed: ISODate;
}

export interface GuideMatchResult {
  guide: Guide;
  score: number;
  reasons: string[];
}

export type BookByBasis = 'explicit' | 'guide' | 'default' | 'on-site';
export type BookByUrgency = 'overdue' | 'now' | 'soon' | 'later' | 'on-site' | 'done';

export interface BookByResult {
  /** Latest sensible booking date, or null when the item is bought on the day. */
  date: ISODate | null;
  /** First date tickets can be bought, when the guide says so. */
  opensOn: ISODate | null;
  basis: BookByBasis;
  daysLeft: number | null;
  urgency: BookByUrgency;
}

/** Fallback windows in days when neither the booking nor a guide says otherwise. */
export const DEFAULT_BOOK_WINDOWS: Record<BookingKind, number | null> = {
  flight: 90,
  train: 60,
  'international-train': 60,
  'regional-train': null,
  ferry: null,
  'mountain-railway': 3,
  gondola: 3,
  bus: null,
  hotel: 30,
  restaurant: 14,
  attraction: 21,
  pass: 14,
  'city-card': 7,
  other: 14,
};
