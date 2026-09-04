# TripDeck

Everything about a trip in one place, plus two things a trip app usually leaves to you.

**It audits the plan.** Twenty-six rules read the itinerary the way a compiler reads code
and report what cannot happen: a check-in that starts before the train lands, thirty-three
minutes to make a non-refundable connection, a stall that only opens on Mondays scheduled
for a Friday, a ferry on a timetable that ended the week before. Findings land in an inbox
you work through and clear, and a cleared finding stays cleared.

**It tells you where to buy things.** For a first-time visitor the hard question is not
what to see, it is whether to book now or on the day, whether the official site or a
reseller, and what will catch you out at the machine. Forty-one guides answer that per
country and per operator, with the official channel named, resellers rated honestly, and
refund rules, validation traps and rail-pass coverage written down. They work offline.

Everything is stored on the device. No account, no server, no sign-in.

## Running it

```
npm install
npm run dev
```

The first launch loads a full sample trip, so there is something to look at immediately.

| Command                       | What it does                                             |
| ----------------------------- | -------------------------------------------------------- |
| `npm run dev`                 | Development server                                       |
| `npm run build`               | Production build, service worker, and the Pages 404 shim |
| `npm run preview`             | Serve the built app                                      |
| `npm run verify`              | Types, lint, formatting and the whole test suite         |
| `npm test`                    | Tests only                                               |
| `node scripts/make-icons.mjs` | Regenerate the app icons                                 |

## Installing it on a phone

Build and deploy, open the site, then use the browser's install option. On iOS that is
Share, then Add to Home Screen. Once installed it opens full screen and works with no
signal, which is the point: Swiss valleys and Italian regional trains have neither.

## Your data

The trip lives in this browser's storage and nowhere else. That is what makes it work
offline, and it means the device holds the only copy.

- **Export** writes a single `.tripdeck.json` file. That is your backup and your way onto
  a new phone.
- **Export the itinerary only** leaves ticket files out, which makes the file small enough
  to send to whoever you are travelling with.
- **Import** takes a file back, either replacing the trip it came from or bringing it in
  alongside with fresh identifiers.

API keys, if a future version uses them, stay on the device and are never written into an
export. A test enforces that.

## How it is put together

```
src/domain     types, schemas, and pure helpers for time, places and opening hours
src/lint       the rule engine and the twenty-six rules
src/playbook   guide matching, book-by dates, and deep links
src/content    the guides themselves, as typed modules
src/db         Dexie storage, the repository layer, export and import
src/seed       the sample trip, one item per bullet of the original notes
src/features   the screens
```

Three decisions worth knowing about.

**A day's identity is its date, and dates never move.** Swapping two days for the weather
moves the items between them and holds back anything booked or pinned to a date, then
tells you what it held back. Nothing gets dragged somewhere it cannot go.

**Contradictions are preserved, not resolved.** When the notes said the train arrives at
13:40 and the ticket says 15:40, both survive in the data and the app raises the
disagreement. Silently picking one is how a plan quietly becomes wrong.

**Times are wall-clock strings in the day's own timezone.** Instant arithmetic happens
only where it must, for countdowns and for deciding what "today" is.

## Adding guides

`docs/CONTENT-GUIDE.md` covers converting itinerary notes into seed data. Guides live in
`src/content/guides` as typed modules, so a mistake is a compile error rather than a bad
recommendation. Every guide carries a `lastReviewed` date, and anything not confirmed
against an official source is prefixed `[unverified]`. A test keeps it that way.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages. Set the repository's Pages source
to GitHub Actions once, and the workflow does the rest. The build reads its base path from
an environment variable, so the same bundle also serves from the root of any static host.
