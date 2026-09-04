# Architecture

Written for whoever picks this up next, including a future me. It records the decisions
that are expensive to reverse and the reasoning behind them, not the code, which the code
already states.

## What the app is

A local-first progressive web app that holds one or more trips, audits them against a rule
set, and carries offline advice about where and when to buy each kind of ticket.

The two things that distinguish it from a notes app are the **linter** and the
**playbook**. Everything else exists to serve them.

## Stack

| Area       | Choice                                  | Version |
| ---------- | --------------------------------------- | ------- |
| Build      | Vite                                    | 8.2.2   |
| UI         | React                                   | 19.2.8  |
| Language   | TypeScript, strict                      | 6.0.3   |
| Styling    | Tailwind CSS                            | 4.3.3   |
| Routing    | react-router, data mode                 | 8.3.1   |
| Storage    | Dexie over IndexedDB                    | 4.4.5   |
| Validation | Zod                                     | 4.5.4   |
| Dates      | date-fns with the first-party TZ layer  | 4.4.0   |
| Offline    | vite-plugin-pwa with Workbox            | 1.3.0   |
| Tests      | Vitest, Testing Library, fake-indexeddb | 5.0.0   |

Versions are pinned exactly. A trip app that breaks on a transitive minor bump the week
before departure is worse than one that is slightly behind.

## The decisions

### A day's identity is its date

Days never move. The weather swap moves _items_ between two days and leaves the days where
they are. Anything with a booking in a confirmed state, or explicitly pinned, is held back
and reported to the user rather than dragged along.

The alternative, swapping the dates on two day rows, looks simpler and is a trap: every
booking, reminder and finding that referenced a date silently comes to mean something
else.

### Contradictions are data

The source notes for the sample trip disagree with themselves in seventeen places. The app
keeps both sides, tags the stale one, and raises the disagreement. It never picks a winner.

This is why `Item` has a `CONFLICT` tag and why `ManualConflict` exists for the
disagreements no rule could derive. It is the whole product thesis: a plan you can trust is
one whose contradictions have been surfaced and decided, not one where a tool quietly chose.

### Times are wall-clock strings

`LocalTime` is `HH:mm` in the owning day's timezone. Nothing is stored as an instant.

A traveller reading "08:35" wants the number on the ticket, not a UTC value rendered
through whatever zone their phone thinks it is in. Instant arithmetic happens in exactly
two places: working out what "today" is, and the countdown. Both go through `TZDate`.

### Findings have stable keys

A finding's key is its rule id plus its sorted subject ids. Resolving one writes a row
keyed by trip and finding key, so the decision survives edits elsewhere, a re-run of the
linter, and an export and re-import. Importing a trip as a copy rewrites those keys along
with everything else, or a resolved conflict would silently reattach to the wrong thing.

### Severity means something specific

- **error**: this cannot happen as planned.
- **warning**: this is probably wrong, or carries real risk.
- **info**: the app noticed something; no action implied.

Badges and headline counts show errors and warnings only. An inbox showing 111 items is an
inbox nobody opens, and most of those 111 were observations rather than problems.

### Documents are stored as bytes, not Blobs

`DocumentBytes` holds an `ArrayBuffer`. A Blob is rebuilt on demand from the bytes plus the
mime type on the metadata row.

Blob-in-IndexedDB has a history of being unreliable on mobile browsers, and it does not
survive structured clone in every environment. Bytes always do.

### One file format, four jobs

`.tripdeck.json` is the backup, the migration path to a new phone, the way to share a trip,
and the format the built-in sample ships in. The first launch loads the sample through the
ordinary import path.

Using one path for all four means the code that restores someone's only copy is exercised
on every install, rather than for the first time in an emergency.

### The playbook is typed modules, not markdown

Guides are TypeScript in `src/content/guides`. An authoring mistake is a compile error, the
whole playbook is available offline with no fetch, and a test validates every entry: unique
ids, https URLs, renderable deep-link templates, and a real booking note.

Every guide carries `lastReviewed`. Anything not confirmed against an official source is
prefixed `[unverified]`, and a test keeps it that way. This is advice people act on with
money.

## Rule design

Rules are pure functions over a `LintContext` and never touch storage. Each reads a
per-day timeline that has already resolved every item's start and end minute, so time
inference lives in one place instead of twenty-six.

Four rules were tightened after seeing what they did to the real itinerary:

- **insufficient-transfer** fires only between two scheduled services. Turning up twenty
  minutes early for a train is good planning; the risk is arriving on one service and
  having to catch another.
- **chain-station-mismatch** requires the two ends to be in different localities. Two
  stations in the same district are a walk, not a hole in the plan.
- **mode-place-kind** looks for a city metro that leaves the city, which is the signal that
  a leg is really a mainline train. Comparing station types produced only noise.
- **accommodation-gap** treats a night on an overnight flight as covered.

Before: 166 findings, 19 errors, most of them wrong. After: 111 findings, 5 errors, all of
them real.

## Known limits

- Live transit times and an in-app assistant are not implemented. The interfaces for them
  are not built either; when they are, they should be adapters chosen at runtime.
- Reminders show in the app but do not fire as background notifications. That needs push,
  a server, and an installed app on iOS.
- There is no editing of items beyond status and order. Adding a full editor is the obvious
  next feature.
- The guide set covers the five countries of the sample trip.
