# Converting itinerary notes into TripDeck seed data

This is the rulebook for turning the Europe 2026 source notes into typed seed modules.
Follow it literally so four people writing four different day ranges produce data that
looks like it came from one hand.

Source of truth:
`C:\Users\henso\OneDrive\Documents\MyPersonal\Europe Trips\europe-trip-2026.md`

**Read that file with the Read tool.** It is UTF-8. Reading it through a shell that
assumes the Windows ANSI codepage turns every arrow and accent into mojibake that looks
almost correct in a diff. A test (`scanForMojibake` in `src/seed/europe-2026/normalize.ts`)
fails the build if any of those sequences reaches a seed string.

Write source in **ASCII only**. `Caffe`, not `Caffè`; `Fraekmuentegg`, not `Fräkmüntegg`.
Accents come back in a later localisation pass.

## The contract you build against

| File | What it gives you |
|---|---|
| `src/domain/types.ts` | every type. Do not widen or invent fields. |
| `src/seed/europe-2026/ids.ts` | `DAY_DATES`, `dayId()`, `itemId()`, `sortKeyFor()`, `ACC`, `BK`, `PLACES` |
| `src/seed/europe-2026/trip.ts` | the `Trip` row and its swap groups |

Never invent an id. If you need a booking or a place that is not in `ids.ts`, say so in
your report rather than adding one, unless the rule below allows an inline place.

## One bullet, one Item

Every bullet in a day section becomes exactly one `Item`. Do not merge two bullets because
they feel related, and do not split one bullet into two. The linter's job is to find the
gaps; merging hides them.

- `id`: `itemId('d07', n)` where `n` is the 1-based bullet position in that day.
- `sortKey`: `sortKeyFor(n)` with the same `n`, so order matches the notes.
- `dayId`: `dayId('d07')`.
- `tripId`: `TRIP_ID`.
- `createdAt` / `updatedAt`: the constant `'2026-09-04T00:00:00.000Z'`.
- `sourceRef`: `'Day 7 - bullet 3'`, using the **renumbered** day from the spec heading.
- `status`: always `'planned'` in the seed.

### Titles

Use the note's own wording, trimmed of times, tags and travel-time parentheticals. Keep the
proper noun. `"**14:30** - Check in, freshen up, rest 30 mins"` becomes `Check in and rest`.

## Times

| In the notes | In the data |
|---|---|
| `08:35` | `time: '08:35'` |
| `19:00-20:00` | `time: '19:00'`, `timeEnd: '20:00'` |
| `~15:45` | `time: '15:45'`, `timeApprox: true` |
| `Morning` / `Afternoon` / `Evening` | `time: null`, `timeLabel: 'morning'` |
| `15:00 or 15:30` | `time: '15:00'`, and put the alternative in `notes` |
| `(3 hours)` after a start time | `durationMins: 180` |
| no time at all | omit `time`; the item still holds its `sortKey` position |

Times are wall-clock in the day's timezone. Never convert to UTC.

## Tags

Tags are editorial only: `MUST`, `OPTIONAL`, `CHECK`, `CONFLICT`.

- `[MUST]` in the notes, or SHOUTED TEXT like `BUY SNACKS TONIGHT` -> `['MUST']`
- `[OPTIONAL]`, or "or skip", or "if you want" -> `['OPTIONAL']`
- `[CHECK]`, or "verify", or "confirm whether" -> `['CHECK']`
- `[CONFLICT]`, or a line that contradicts a booking -> `['CONFLICT']`

`[BOOKED]`, `[TO BOOK]` and `[ON-SITE]` are **not tags**. They are `Booking.status` values
of `booked`, `to_book` and `on_site`. The item links to the booking with `bookingId`.

## Types

| Use | When |
|---|---|
| `transport` | a named service between two places: a train, flight, ferry, gondola, cogwheel, boat |
| `transfer` | getting yourself between two places: walking, a metro hop, a taxi, a bus to the station |
| `sight` | a place you look at or go into |
| `meal` | a restaurant, cafe, gelato, bakery |
| `shop` | buying things, including supermarket runs |
| `admin` | check-in, checkout, luggage drop, immigration, waking up |
| `reminder` | a standalone instruction with no place, e.g. "wear appropriate outfits" |

## Travel legs

Any `transport` or `transfer` item **must** carry `travel`:

```ts
travel: {
  mode: 'train',
  from: PLACES.romaTermini,
  to: PLACES.firenzeSmn,
  durationMins: 85,
  seatSide: 'left',          // only when the notes say so
  operator: 'Trenitalia',
  passCoverage: 'covered',   // Swiss Travel Pass legs
  passId: PASS_SWISS,
}
```

Prose travel is a leg too. `"Two Sizes Tiramisu - 8 mins walk from the restaurant"` is two
items: the tiramisu stop, and a `transfer` before it with `mode: 'walk'` and
`durationMins: 8`. **This matters.** The rule that finds missing transit legs only works
when the legs that do exist are modelled.

`mode` must match the real vehicle, not the word in the notes. Day 21's "Metro" to Zaandijk
is a train. Model it as the notes describe it (`mode: 'metro'`) and let the linter flag the
mismatch. Do not silently correct it.

If a place genuinely is not in `PLACES` (a bus stop named in passing), inline it, and give
it a `key`:

```ts
from: { key: 'it-rome-bus-senato', name: 'Senato', kind: 'bus-stop', city: 'Rome', countryCode: 'IT' }
```

## Opening hours

Put the note's exact wording in `rawText` and let the parser do the rest:

```ts
openingHours: {
  ...parseOpeningHours('Tue-Sun 09:00-19:00, closed Mondays').hours!,
  rawText: 'Tue-Sun 09:00-19:00, closed Mondays',
  confidence: 'notes',
}
```

`confidence` is `'notes'` for anything taken from the source, `'guess'` when you inferred it,
`'verified'` only if you checked the venue's own site today. Never repair a malformed range.
Florence's `10:15-3:45` stays as written so the suspicious-hours rule can catch it.

## Order notes

What to eat goes in `orderNotes`, one string per dish, not in the title:

```ts
title: 'Dinner at Osteria Pastella',
orderNotes: ['Flambeed tagliatelle with truffle'],
```

## Conflicts stay conflicts

The spec is explicit: the app surfaces disagreements, it does not resolve them.

When a stale line contradicts a booking, keep **both** items. Tag the stale one `CONFLICT`,
give it the time the notes state, and explain in `notes` which one the booking supports.
Day 16's `13:40 Arrive Paris Gare de Lyon` survives beside the booked 15:40 arrival. Do not
delete it, and do not adjust its time.

Something the notes flag that no rule could ever derive becomes a `ManualConflict` in the
conflicts chunk instead, with `source: 'notes'`.

Section 10 of the spec lists notes dropped from an earlier draft. Attach each to the item it
concerns via `notes`, or record it as an `info`-severity `ManualConflict`. Nothing there is
discarded.

## Reminders

Section 7 reminders fire on the day **before** the leg they serve.

```ts
{
  fireDate: DAY_DATES.d15,   // the evening you act
  forDate: DAY_DATES.d16,    // the leg it serves
  kind: 'day-before',
  tags: ['MUST'],
  status: 'pending',
}
```

A reminder that already exists as a bullet inside a day gets **both**: the item on its day,
and the reminder row. They are different surfaces, and the reminder carries the schedule.

## Checklist before you report

- [ ] Every item has `sourceRef`, and its `sortKey` matches bullet order.
- [ ] Every `transport` and `transfer` item has a `travel` leg with `from` and `to`.
- [ ] No item invents an id that is not in `ids.ts`.
- [ ] No accented or non-ASCII character anywhere in the file.
- [ ] Stale and contradictory lines are preserved and tagged `CONFLICT`.
- [ ] `npx tsc -b --noEmit` and `npx prettier --check` both pass on your files.
