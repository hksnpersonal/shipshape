# Pending

The living list of what is left. Unlike the handoff, this does not go stale in a week.
Delete items as they land rather than ticking them.

## Blocked on the user

- **Publish it.** No GitHub remote and no `gh` on this machine. Either
  `winget install GitHub.cli` then `gh repo create`, or create the repository on github.com
  and `git remote add origin`. Then set Settings, Pages, Source to "GitHub Actions" once.
  The `deploy.yml` workflow handles everything after that and reads the base path from the
  repository name.
- **Decide on the name.** "TripDeck" is a working title, present in the manifest, the README
  and the icon. Cheap now, annoying after publishing.

## Next, in order

1. **Documents vault.** The last unaddressed part of the original brief: attaching the
   tickets already bought. Storage, size limit, export and tests are done; only the screen
   is missing. See the handoff for the specific steps.
2. **Item editor.** Title, time, notes, tags and type. Today only status and order can
   change, so a correction means editing the seed file. `itemsRepo.patch` already exists.
3. **Quick capture for bookings.** A short form to add a booking from a confirmation email,
   with the guide match shown as you type. `bookingsRepo.add` already exists.
4. **Attach a booking to an item, and unlink it.** The data model supports it; nothing in
   the interface sets `bookingId`.

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
