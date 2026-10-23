/**
 * Runtime validation mirroring `types.ts`.
 *
 * These schemas guard the one place untrusted data enters the app: an imported or shared
 * trip file. A drift test asserts the inferred types still match the hand-written
 * interfaces, so the two cannot quietly diverge.
 */
import { z } from 'zod';

export const ISODateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date');

export const LocalTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected an HH:mm time');

export const TimestampSchema = z.string().min(1);

export const WeekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export const TagSchema = z.enum(['MUST', 'OPTIONAL', 'CHECK', 'CONFLICT']);
export const SeveritySchema = z.enum(['error', 'warning', 'info']);

export const ItemTypeSchema = z.enum([
  'transport',
  'transfer',
  'sight',
  'meal',
  'shop',
  'admin',
  'reminder',
  'freeform',
]);

export const ItemStatusSchema = z.enum(['planned', 'done', 'skipped']);

export const TravelModeSchema = z.enum([
  'walk',
  'metro',
  'tram',
  'bus',
  'train',
  'ferry',
  'boat',
  'gondola',
  'cablecar',
  'cogwheel',
  'funicular',
  'taxi',
  'flight',
  'shuttle',
]);

export const PlaceKindSchema = z.enum([
  'airport',
  'rail-station',
  'metro-station',
  'pier',
  'bus-stop',
  'venue',
  'hotel',
  'area',
  'unknown',
]);

export const PlaceSchema = z.object({
  name: z.string().min(1),
  key: z.string().optional(),
  kind: PlaceKindSchema.optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zone: z.string().optional(),
  countryCode: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  mapsQuery: z.string().optional(),
});

export const OpeningRuleSchema = z.object({
  days: z.array(WeekdaySchema),
  open: LocalTimeSchema,
  close: LocalTimeSchema,
});

export const OpeningHoursSchema = z.object({
  rules: z.array(OpeningRuleSchema),
  closedOn: z.array(WeekdaySchema).optional(),
  seasonal: z.boolean().optional(),
  rawText: z.string().optional(),
  confidence: z.enum(['verified', 'notes', 'guess']),
  note: z.string().optional(),
});

export const MoneySchema = z.object({
  amount: z.number().nullable(),
  currency: z.string(),
  per: z.enum(['person', 'group', 'unit']).optional(),
  note: z.string().optional(),
  paid: z.boolean().optional(),
});

export const PassCoverageSchema = z.enum(['covered', 'discount', 'none', 'unknown']);

export const TravelLegSchema = z.object({
  mode: TravelModeSchema,
  from: PlaceSchema,
  to: PlaceSchema,
  via: z.array(PlaceSchema).optional(),
  durationMins: z.number().nullable().optional(),
  seatSide: z.enum(['left', 'right']).nullable().optional(),
  seatSideNote: z.string().optional(),
  operator: z.string().optional(),
  line: z.string().optional(),
  platformNote: z.string().optional(),
  passCoverage: PassCoverageSchema.optional(),
  passId: z.string().optional(),
  seasonalTimetable: z.boolean().optional(),
  alternatives: z.array(z.string()).optional(),
});

export const ItemSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  dayId: z.string().min(1),
  sortKey: z.number(),
  title: z.string().min(1),
  type: ItemTypeSchema,
  time: LocalTimeSchema.nullable().optional(),
  timeEnd: LocalTimeSchema.nullable().optional(),
  timeApprox: z.boolean().optional(),
  timeLabel: z.enum(['morning', 'afternoon', 'evening']).nullable().optional(),
  durationMins: z.number().nullable().optional(),
  location: PlaceSchema.nullable().optional(),
  openingHours: OpeningHoursSchema.nullable().optional(),
  cost: MoneySchema.nullable().optional(),
  orderNotes: z.array(z.string()).optional(),
  travel: TravelLegSchema.nullable().optional(),
  tags: z.array(TagSchema),
  status: ItemStatusSchema,
  bookingId: z.string().nullable().optional(),
  groupLabel: z.string().optional(),
  pinnedToDate: z.boolean().optional(),
  notes: z.string().optional(),
  sourceRef: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const DaySchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  date: ISODateSchema,
  timeZone: z.string().optional(),
  city: z.string(),
  countryCode: z.string(),
  theme: z.string().optional(),
  originalLabel: z.string().optional(),
  notes: z.string().optional(),
});

export const BookingKindSchema = z.enum([
  'flight',
  'train',
  'regional-train',
  'international-train',
  'ferry',
  'mountain-railway',
  'gondola',
  'bus',
  'hotel',
  'restaurant',
  'attraction',
  'pass',
  'city-card',
  'other',
]);

export const BookingStatusSchema = z.enum([
  'to_book',
  'booked',
  'confirmed',
  'on_site',
  'not_needed',
  'cancelled',
]);

export const BookWindowSchema = z.object({
  opensDaysBefore: z.number().optional(),
  latestDaysBefore: z.number().nullable().optional(),
  note: z.string().optional(),
});

export const PassengerSchema = z.object({
  name: z.string().min(1),
  seat: z.string().optional(),
  coach: z.string().optional(),
  ticketNumber: z.string().optional(),
  note: z.string().optional(),
});

export const BookingSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  kind: BookingKindSchema,
  title: z.string().min(1),
  status: BookingStatusSchema,
  date: ISODateSchema,
  endDate: ISODateSchema.optional(),
  depart: LocalTimeSchema.nullable().optional(),
  arrive: LocalTimeSchema.nullable().optional(),
  arriveDate: ISODateSchema.optional(),
  from: PlaceSchema.optional(),
  to: PlaceSchema.optional(),
  operator: z.string().optional(),
  provider: z.string().optional(),
  reference: z.string().optional(),
  cost: MoneySchema.nullable().optional(),
  refundable: z.boolean().nullable().optional(),
  changeable: z.boolean().nullable().optional(),
  bookWindow: BookWindowSchema.optional(),
  guideIds: z.array(z.string()).optional(),
  countryCode: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
  passengers: z.array(PassengerSchema).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const AccommodationSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  name: z.string().min(1),
  place: PlaceSchema,
  checkIn: ISODateSchema,
  checkOut: ISODateSchema,
  checkInTime: LocalTimeSchema.optional(),
  checkOutTime: LocalTimeSchema.optional(),
  luggageNote: z.string().optional(),
  bookingId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

export const DocumentMetaSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string(),
  size: z.number(),
  kind: z.enum(['ticket', 'confirmation', 'id', 'insurance', 'other']),
  attachedTo: z
    .object({
      kind: z.enum(['booking', 'item', 'accommodation', 'trip']),
      id: z.string(),
    })
    .nullable(),
  createdAt: TimestampSchema,
  notes: z.string().optional(),
});

export const ReminderSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  title: z.string().min(1),
  tags: z.array(TagSchema),
  fireDate: ISODateSchema,
  fireTime: LocalTimeSchema.optional(),
  forDate: ISODateSchema.optional(),
  forItemId: z.string().nullable().optional(),
  kind: z.enum(['day-before', 'same-day', 'custom']),
  status: z.enum(['pending', 'done', 'dismissed']),
  notes: z.string().optional(),
});

export const ManualConflictSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  title: z.string().min(1),
  detail: z.string(),
  severity: SeveritySchema,
  itemIds: z.array(z.string()),
  bookingIds: z.array(z.string()).optional(),
  dayId: z.string().optional(),
  source: z.enum(['notes', 'user']),
});

export const TravelPassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  validFrom: ISODateSchema,
  validTo: ISODateSchema,
  notes: z.string().optional(),
  guideId: z.string().optional(),
});

export const SwapGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  dayIds: z.array(z.string()),
  rule: z.string().optional(),
});

export const EssentialSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  kind: z.enum(['phone', 'text', 'url']),
  note: z.string().optional(),
});

export const TripSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  travellers: z.number().int().positive(),
  startDate: ISODateSchema,
  endDate: ISODateSchema,
  originName: z.string(),
  originTimeZone: z.string(),
  defaultTimeZone: z.string(),
  baseCurrency: z.string(),
  spendCurrencies: z.array(z.string()),
  countries: z.array(z.string()),
  passes: z.array(TravelPassSchema),
  swapGroups: z.array(SwapGroupSchema).optional(),
  travellerNames: z.array(z.string()).optional(),
  essentials: z.array(EssentialSchema).optional(),
  sourceNote: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const FindingSchema = z.object({
  key: z.string(),
  ruleId: z.string(),
  severity: SeveritySchema,
  title: z.string(),
  detail: z.string(),
  suggestedFix: z.string().optional(),
  dayId: z.string().optional(),
  date: ISODateSchema.optional(),
  itemIds: z.array(z.string()),
  bookingIds: z.array(z.string()).optional(),
  source: z.enum(['rule', 'manual']),
});

export const FindingStateSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  key: z.string(),
  ruleId: z.string(),
  status: z.enum(['open', 'resolved', 'dismissed']),
  note: z.string().optional(),
  updatedAt: TimestampSchema,
});

export const ProviderSettingsSchema = z.object({
  id: z.literal('settings'),
  directions: z.object({
    provider: z.enum(['deeplink', 'google-maps']),
    apiKey: z.string().optional(),
  }),
  assistant: z.object({
    provider: z.enum(['none', 'claude']),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  }),
  notifications: z.object({ enabled: z.boolean(), defaultTime: LocalTimeSchema }),
  simulatedToday: ISODateSchema.nullable().optional(),
  showHomeTime: z.boolean().optional(),
  lastExportAt: z.string().nullable().optional(),
  preloadedTripAt: z.string().nullable().optional(),
  preloadedTripVersion: z.string().nullable().optional(),
  shareUsage: z.boolean().optional(),
});

export const TripBundleSchema = z.object({
  trip: TripSchema,
  days: z.array(DaySchema),
  items: z.array(ItemSchema),
  bookings: z.array(BookingSchema),
  accommodations: z.array(AccommodationSchema),
  reminders: z.array(ReminderSchema),
  conflicts: z.array(ManualConflictSchema),
  documents: z.array(DocumentMetaSchema),
});

export const ExportFileSchema = z.object({
  // Both spellings: `tripdeck` is the pre-rename marker, still present in older backups.
  format: z.union([z.literal('shipshape'), z.literal('tripdeck')]),
  schemaVersion: z.literal(1),
  exportedAt: TimestampSchema,
  appVersion: z.string(),
  bundle: TripBundleSchema,
  findingStates: z.array(FindingStateSchema),
  documents: z.array(DocumentMetaSchema.extend({ data: z.string().optional() })),
});

/**
 * Referential checks a schema cannot express. Returns human-readable problems, empty
 * when the bundle hangs together.
 */
export function validateBundleIntegrity(bundle: unknown): string[] {
  const parsed = TripBundleSchema.safeParse(bundle);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  const b = parsed.data;
  const problems: string[] = [];

  const dayIds = new Set(b.days.map((d) => d.id));
  const bookingIds = new Set(b.bookings.map((x) => x.id));
  const itemIds = new Set(b.items.map((i) => i.id));

  const seen = new Set<string>();
  for (const item of b.items) {
    if (seen.has(item.id)) problems.push(`duplicate item id ${item.id}`);
    seen.add(item.id);
    if (!dayIds.has(item.dayId))
      problems.push(`item ${item.id} points at unknown day ${item.dayId}`);
    if (item.bookingId && !bookingIds.has(item.bookingId)) {
      problems.push(`item ${item.id} points at unknown booking ${item.bookingId}`);
    }
    if ((item.type === 'transport' || item.type === 'transfer') && !item.travel) {
      problems.push(`item ${item.id} is a ${item.type} with no travel leg`);
    }
    if (item.tripId !== b.trip.id) problems.push(`item ${item.id} belongs to another trip`);
  }

  const dayDates = new Set<string>();
  for (const day of b.days) {
    if (dayDates.has(day.date)) problems.push(`two days share the date ${day.date}`);
    dayDates.add(day.date);
  }

  for (const reminder of b.reminders) {
    if (reminder.forItemId && !itemIds.has(reminder.forItemId)) {
      problems.push(`reminder ${reminder.id} points at unknown item ${reminder.forItemId}`);
    }
  }

  for (const group of b.trip.swapGroups ?? []) {
    for (const id of group.dayIds) {
      if (!dayIds.has(id)) problems.push(`swap group ${group.id} names unknown day ${id}`);
    }
  }

  return problems;
}
