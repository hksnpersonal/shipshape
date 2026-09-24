/**
 * Shipshape domain contract.
 *
 * Every other module (db, lint, playbook, seed, UI) compiles against these types.
 * `schemas.ts` mirrors them with Zod and a test asserts the two never drift.
 *
 * Conventions
 * - `ISODate` is a calendar date `YYYY-MM-DD`; `LocalTime` is wall-clock `HH:mm`
 *   interpreted in the owning Day's timezone (Day.timeZone ?? Trip.defaultTimeZone).
 * - A Day's identity is its date and never moves. Items move between Days.
 * - Bookings carry their own date; an Item links to a Booking one-way via `bookingId`.
 * - Derived facts (accommodation for a date, item order, book-by date) are computed,
 *   never stored.
 */

export type ID = string;
/** `YYYY-MM-DD` */
export type ISODate = string;
/** `HH:mm`, 24-hour, local wall-clock */
export type LocalTime = string;
/** ISO-8601 instant, e.g. `2026-09-04T10:00:00.000Z` */
export type Timestamp = string;

export type CountryCode = 'IT' | 'CH' | 'FR' | 'BE' | 'NL' | 'AU' | (string & {});
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Editorial tags carried over from the traveller's notes. Booking state is NOT a tag. */
export type Tag = 'MUST' | 'OPTIONAL' | 'CHECK' | 'CONFLICT';
export const TAGS: readonly Tag[] = ['MUST', 'OPTIONAL', 'CHECK', 'CONFLICT'];

export type ItemType =
  'transport' | 'transfer' | 'sight' | 'meal' | 'shop' | 'admin' | 'reminder' | 'freeform';
export type ItemStatus = 'planned' | 'done' | 'skipped';

export type TravelMode =
  | 'walk'
  | 'metro'
  | 'tram'
  | 'bus'
  | 'train'
  | 'ferry'
  | 'boat'
  | 'gondola'
  | 'cablecar'
  | 'cogwheel'
  | 'funicular'
  | 'taxi'
  | 'flight'
  | 'shuttle';

export type PlaceKind =
  | 'airport'
  | 'rail-station'
  | 'metro-station'
  | 'pier'
  | 'bus-stop'
  | 'venue'
  | 'hotel'
  | 'area'
  | 'unknown';

export interface Place {
  name: string;
  /** Canonical slug (e.g. `it-roma-termini`). When present it wins over name normalisation. */
  key?: string;
  kind?: PlaceKind;
  address?: string;
  /** Coarse locality, e.g. `Rome`. Used by the missing-transit heuristic. */
  city?: string;
  /** Finer locality when lat/lng unknown, e.g. `paris-14e`. */
  zone?: string;
  countryCode?: CountryCode;
  lat?: number;
  lng?: number;
  /** Overrides name+address in map deep links. */
  mapsQuery?: string;
}

export interface OpeningRule {
  days: Weekday[];
  open: LocalTime;
  close: LocalTime;
}

export interface OpeningHours {
  rules: OpeningRule[];
  closedOn?: Weekday[];
  seasonal?: boolean;
  /** As written in the notes, e.g. `10:15–3:45`. Kept for the suspicious-hours rule. */
  rawText?: string;
  confidence: 'verified' | 'notes' | 'guess';
  note?: string;
}

export interface Money {
  amount: number | null;
  currency: string;
  per?: 'person' | 'group' | 'unit';
  note?: string;
  paid?: boolean;
}

export type PassCoverage = 'covered' | 'discount' | 'none' | 'unknown';

export interface TravelLeg {
  mode: TravelMode;
  from: Place;
  to: Place;
  via?: Place[];
  /** Stated duration. The Item's `time`/`timeEnd` are depart/arrive. */
  durationMins?: number | null;
  seatSide?: 'left' | 'right' | null;
  seatSideNote?: string;
  operator?: string;
  line?: string;
  platformNote?: string;
  passCoverage?: PassCoverage;
  passId?: ID;
  /** True when the service runs a reduced/seasonal timetable (e.g. October lake ferries). */
  seasonalTimetable?: boolean;
  alternatives?: string[];
}

export type TimeLabel = 'morning' | 'afternoon' | 'evening';

export interface Item {
  id: ID;
  tripId: ID;
  dayId: ID;
  /** Gap-based ordering within a day: seed uses 1000, 2000, …; insert = midpoint. */
  sortKey: number;
  title: string;
  type: ItemType;
  time?: LocalTime | null;
  timeEnd?: LocalTime | null;
  /** True when the notes said "~14:00". */
  timeApprox?: boolean;
  /** Fuzzy slot when `time` is null. */
  timeLabel?: TimeLabel | null;
  durationMins?: number | null;
  location?: Place | null;
  openingHours?: OpeningHours | null;
  cost?: Money | null;
  /** What to order at a restaurant / café. */
  orderNotes?: string[];
  /** Required when `type` is `transport` or `transfer`. */
  travel?: TravelLeg | null;
  tags: Tag[];
  status: ItemStatus;
  bookingId?: ID | null;
  /** Visual grouping only, e.g. `Evening walking route`. */
  groupLabel?: string;
  /** Excluded from weather-swap moves. */
  pinnedToDate?: boolean;
  notes?: string;
  /** Traceability to the source notes, e.g. `Day 1 · bullet 6`. */
  sourceRef?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Day {
  id: ID;
  tripId: ID;
  date: ISODate;
  /** IANA zone override for this day (e.g. departure day in `Australia/Sydney`). */
  timeZone?: string;
  city: string;
  countryCode: CountryCode;
  theme?: string;
  /** Label used in the original notes when it differs, e.g. `DAY 15 (duplicate)`. */
  originalLabel?: string;
  notes?: string;
}

export type BookingKind =
  | 'flight'
  | 'train'
  | 'regional-train'
  | 'international-train'
  | 'ferry'
  | 'mountain-railway'
  | 'gondola'
  | 'bus'
  | 'hotel'
  | 'restaurant'
  | 'attraction'
  | 'pass'
  | 'city-card'
  | 'other';

export type BookingStatus =
  'to_book' | 'booked' | 'confirmed' | 'on_site' | 'not_needed' | 'cancelled';

export interface BookWindow {
  /** Tickets go on sale this many days before `date`. */
  opensDaysBefore?: number;
  /** Book no later than this many days before `date`. `null` = on the day / on-site. */
  latestDaysBefore?: number | null;
  note?: string;
}

/** Per-person seat, coach and ticket number. One entry per traveller named on the ticket. */
export interface Passenger {
  name: string;
  seat?: string;
  coach?: string;
  ticketNumber?: string;
  note?: string;
}

export interface Booking {
  id: ID;
  tripId: ID;
  kind: BookingKind;
  title: string;
  status: BookingStatus;
  date: ISODate;
  /** Hotels / passes. */
  endDate?: ISODate;
  depart?: LocalTime | null;
  arrive?: LocalTime | null;
  /** Overnight flights. */
  arriveDate?: ISODate;
  from?: Place;
  to?: Place;
  /** Who runs it (e.g. Trenitalia). */
  operator?: string;
  /** Where it was / will be bought (e.g. trenitalia.com, Trainline). */
  provider?: string;
  reference?: string;
  cost?: Money | null;
  refundable?: boolean | null;
  changeable?: boolean | null;
  /** Explicit override of playbook/default booking windows. */
  bookWindow?: BookWindow;
  /** Manual pin of playbook guide ids. */
  guideIds?: ID[];
  countryCode?: CountryCode;
  url?: string;
  notes?: string;
  /** Per-person seat, coach and ticket number. One entry per traveller named on the ticket. */
  passengers?: Passenger[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Accommodation {
  id: ID;
  tripId: ID;
  name: string;
  place: Place;
  checkIn: ISODate;
  checkOut: ISODate;
  checkInTime?: LocalTime;
  checkOutTime?: LocalTime;
  luggageNote?: string;
  bookingId?: ID | null;
  notes?: string;
}

export type DocumentKind = 'ticket' | 'confirmation' | 'id' | 'insurance' | 'other';
export type DocumentOwnerKind = 'booking' | 'item' | 'accommodation' | 'trip';

export interface DocumentMeta {
  id: ID;
  tripId: ID;
  name: string;
  mimeType: string;
  size: number;
  kind: DocumentKind;
  attachedTo: { kind: DocumentOwnerKind; id: ID } | null;
  createdAt: Timestamp;
  notes?: string;
}

/**
 * File contents, kept in their own table so list views never load binary data.
 *
 * Stored as raw bytes rather than a Blob: an ArrayBuffer survives structured clone
 * everywhere, while Blob-in-IndexedDB has a history of being unreliable on older mobile
 * browsers. The mime type lives on the metadata row, so a Blob is rebuilt on demand.
 */
export interface DocumentBytes {
  id: ID;
  bytes: ArrayBuffer;
}

export type ReminderKind = 'day-before' | 'same-day' | 'custom';
export type ReminderStatus = 'pending' | 'done' | 'dismissed';

export interface Reminder {
  id: ID;
  tripId: ID;
  title: string;
  tags: Tag[];
  fireDate: ISODate;
  /** Defaults to 18:00 local when absent. */
  fireTime?: LocalTime;
  /** The date of the leg this reminder serves. */
  forDate?: ISODate;
  forItemId?: ID | null;
  kind: ReminderKind;
  status: ReminderStatus;
  notes?: string;
}

export type Severity = 'error' | 'warning' | 'info';

/** A conflict written down by a person (or imported from notes) that no rule can derive. */
export interface ManualConflict {
  id: ID;
  tripId: ID;
  title: string;
  detail: string;
  severity: Severity;
  itemIds: ID[];
  bookingIds?: ID[];
  dayId?: ID;
  source: 'notes' | 'user';
}

export interface TravelPass {
  id: ID;
  name: string;
  validFrom: ISODate;
  validTo: ISODate;
  notes?: string;
  guideId?: ID;
}

/** A set of days whose contents may be swapped (e.g. weather-dependent mountain days). */
export interface SwapGroup {
  id: ID;
  label: string;
  dayIds: ID[];
  rule?: string;
}

/** A phone number, link or fact worth reaching from the trip home without hunting for it. */
export interface Essential {
  id: ID;
  label: string;
  value: string;
  kind: 'phone' | 'text' | 'url';
  note?: string;
}

export interface Trip {
  id: ID;
  name: string;
  travellers: number;
  /** Inclusive, home-to-home. */
  startDate: ISODate;
  endDate: ISODate;
  originName: string;
  /** IANA zone, e.g. `Australia/Sydney`. */
  originTimeZone: string;
  /** IANA zone used for days without an override, e.g. `Europe/Rome`. */
  defaultTimeZone: string;
  baseCurrency: string;
  spendCurrencies: string[];
  countries: CountryCode[];
  passes: TravelPass[];
  swapGroups?: SwapGroup[];
  /** Who is travelling, shown under the trip name. */
  travellerNames?: string[];
  /** Numbers, links and facts worth reaching from the trip home, e.g. embassy or insurer. */
  essentials?: Essential[];
  sourceNote?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Finding {
  /** Stable across runs: `${ruleId}|${sortedIds.join(',')}`. */
  key: string;
  ruleId: string;
  severity: Severity;
  title: string;
  detail: string;
  suggestedFix?: string;
  dayId?: ID;
  date?: ISODate;
  itemIds: ID[];
  bookingIds?: ID[];
  source: 'rule' | 'manual';
}

export type FindingStatus = 'open' | 'resolved' | 'dismissed';

export interface FindingState {
  /** `${tripId}|${key}` */
  id: string;
  tripId: ID;
  key: string;
  ruleId: string;
  status: FindingStatus;
  note?: string;
  updatedAt: Timestamp;
}

export interface ProviderSettings {
  id: 'settings';
  directions: { provider: 'deeplink' | 'google-maps'; apiKey?: string };
  assistant: { provider: 'none' | 'claude'; apiKey?: string; model?: string };
  notifications: { enabled: boolean; defaultTime: LocalTime };
  /** Dev/QA: drive the Today view before departure. */
  simulatedToday?: ISODate | null;
  /** Render the origin-timezone equivalent next to local times. */
  showHomeTime?: boolean;
  /** Last successful export, for the backup nudge. */
  lastExportAt?: Timestamp | null;
  /**
   * When a private build's bundled trip file was loaded on this device. Set once, so a
   * later launch never replaces the trip and throws away changes made on the phone.
   */
  preloadedTripAt?: Timestamp | null;
}

export const DEFAULT_SETTINGS: ProviderSettings = {
  id: 'settings',
  directions: { provider: 'deeplink' },
  assistant: { provider: 'none' },
  notifications: { enabled: false, defaultTime: '18:00' },
  simulatedToday: null,
  showHomeTime: false,
  lastExportAt: null,
};

/** The in-memory aggregate every pure function takes. */
export interface TripBundle {
  trip: Trip;
  days: Day[];
  items: Item[];
  bookings: Booking[];
  accommodations: Accommodation[];
  reminders: Reminder[];
  conflicts: ManualConflict[];
  documents: DocumentMeta[];
}

/** Export / share / seed file format. Documents are base64 when `includeDocuments` was set. */
export interface ExportFile {
  /**
   * `tripdeck` is what the app was called before it was Shipshape. Exports written then are
   * still somebody's only copy of a trip, so they go on being readable. Only writing moved.
   */
  format: 'shipshape' | 'tripdeck';
  schemaVersion: 1;
  exportedAt: Timestamp;
  appVersion: string;
  bundle: TripBundle;
  findingStates: FindingState[];
  documents: Array<DocumentMeta & { data?: string }>;
}
