# Pending

The living list of what is left. Unlike the handoff, this does not go stale in a week.
Delete items as they land rather than ticking them.

This list covers the app as it stands. `docs/ROADMAP.md` covers the larger product it could
become - a full planner with live pricing, collaboration and push - and phases the work.
Item 1 below is Phase 0 there.

## Blocked on the user

- **Decide the eight "To review" cards** at the top of Plan check (ids `mc-review-*` in
  `src/seed/europe-2026/bookings.ts`). They record where the traveller's notes, the
  1 August itinerary and the tickets disagree. The traveller asked for them to be flagged,
  not fixed. Day plans show ticket times. Delete a card once it is decided.

- **Put it on both phones (before 25 September).** `npm run build:private` writes the
  private site to `Europe Trips\Shipshape private site` (outside the repo, by design:
  it carries the trip file with every reference and document). Drag that folder onto
  app.netlify.com/drop and claim it. Each phone opens the link once and has everything;
  the file loads once per device (`settings.preloadedTripAt`) so later launches never
  overwrite changes made on the phone. Anyone with the URL can read it: share it only
  between the two travellers. The public `dist` (`$env:VITE_BASE='/'; npm run build`,
  from PowerShell, not Git Bash) has no private data.
- **Regenerating the private file** after changing the seed or the overlay:
  `node scripts/make-private-trip.mjs "<Europe Trips>\shipshape-private.json" "<Europe Trips>\Europe 2026.shipshape.json"`.
  Importing it again replaces the trip on the phone, including any edits made there.

- **Publish it.** No GitHub remote and no `gh` on this machine. Either
  `winget install GitHub.cli` then `gh repo create`, or create the repository on github.com
  and `git remote add origin`. **Name the repository `shipshape`**: `deploy.yml` reads the
  base path from it, and `vite.config.ts` now defaults to `/shipshape/`. Then set Settings,
  Pages, Source to "GitHub Actions" once.
- **Rename the working folder.** It is still `Projects\tripdeck`. Nothing reads the folder
  name, so this is tidiness rather than a bug, and it could not be done from inside a
  session running in that folder. `mv ~/Projects/tripdeck ~/Projects/shipshape` from
  anywhere else.

## Next, in order

Phase 0 of `docs/ROADMAP.md` is done. Everything below is Phase 1 or later, and none of it
is reachable before the trip departs on 9 October - see the handoff for that argument.

1. **Edit the trip and its days.** Name, dates, timezone, a day's city or theme. Everything
   else can now be corrected in the app; these still mean editing the seed.
2. **Accommodations have no editor either.** `db.accommodations` is read everywhere and
   written only by the importer.

## Later

- **Background reminders.** Needs push, a server, and an installed app on iOS. In-app
  listing works today.
- **Live routing.** Google Maps directions with real transit times, behind a runtime
  adapter, with the key stored on device and excluded from exports.
- **An assistant.** Paste a confirmation email, get a parsed booking. Same adapter shape.
  Load the `claude-api` skill before writing any of it.
- **More countries.** The guides cover Italy, Switzerland, France, Belgium, the Netherlands
  and generic Europe. Adding a country is additive work in `src/content/guides`.
- **A guide freshness check.** Every guide carries `lastReviewed`; `staleGuides()` exists
  and nothing calls it. Surface a banner once entries pass six months.
- **Import from markdown.** Explicitly out of scope for version one. Import from JSON works.

## Rule ideas not yet implemented

- Walking legs whose stated duration disagrees with the distance, once places carry
  coordinates. No coordinates are recorded today, deliberately, because inventing them
  would poison the locality heuristics.
- Opening hours that conflict with a booked time slot on the same day.
- A day with no meal planned across a long stretch, which the source notes cared about.
- Currency exposure: how much of the trip is unbooked and priced in CHF versus EUR.

## Health

Re-run these before trusting any claim about the project.

```
npm run verify
npx vitest run src/seed
npx vitest run src/seed/__tests__/report.test.ts --disableConsoleIntercept
```

The last one prints the audit and the booking queue, and is how rule noise gets diagnosed.
Its numbers on 2026-09-05: 111 findings, 5 errors, 49 warnings, 57 informational.
