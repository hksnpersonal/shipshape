# Session handoff

**Date:** 2026-09-04
**State:** working, installable app. 122 tests pass, `npm run verify` and `npm run build`
are both green. Five commits on `main`, no remote yet.

## Where things stand

TripDeck is built and runs. `npm run dev`, or `npm run build && npm run preview` and open
`http://localhost:4173/tripdeck/`. The first launch seeds the Europe 2026 sample trip.

Verified by hand in headless Chrome against the production build: the trip home, the day
timeline for 11 October, and the offline-ready state. Screenshots were taken and deleted;
`.gitignore` excludes `shot-*.png`.

What the audit says about the real itinerary on 4 September 2026:

| Measure                     | Value |
| --------------------------- | ----- |
| Findings needing a decision | 54    |
| Of those, impossible        | 5     |
| Smaller observations        | 57    |
| Bookings still to arrange   | 8     |
| Items in the plan           | 272   |

All five errors are real: two stale arrival times still sitting beside their bookings, a
Swiss leg that departs five minutes before the previous train lands, 33 minutes onto a
non-refundable TGV, and a Monday-only stall scheduled for a Friday.

## What is not done

1. **No GitHub remote.** `gh` is not installed on this machine. Either
   `winget install GitHub.cli` and `gh repo create`, or create the repository on
   github.com and `git remote add origin`. Then set Settings, Pages, Source to
   "GitHub Actions" and the deploy workflow takes over.
2. **No item editor.** Status and reordering work; changing a title, time or note does
   not. This is the most obvious next feature.
3. **Reminders do not fire.** They list correctly in the app, but background notification
   needs push and a server, and on iOS an installed app as well.
4. **Live data is absent.** No Google Maps routing, no assistant. Deep links cover the
   need for now. If these are added, they belong behind runtime-selected adapters.
5. **Documents can be attached but there is no vault screen.** The storage layer, the size
   limit and the tests are all in place; only the interface is missing.
6. **Guides cover five countries.** Extending to other destinations is additive work in
   `src/content/guides`.

## Things to be careful about

- **The sample trip's end date is deliberately wrong.** It says 18 October because the
  original notes said so, while the flight home is the 17th. The linter raises it. Do not
  "fix" the seed; that finding is the demonstration.
- **Stale and contradictory lines in the seed are deliberate too.** `docs/CONTENT-GUIDE.md`
  explains the rule. Removing them would make the tests pass and the product pointless.
- **Read the source notes with a UTF-8 reader.** A test scans the seed for mojibake and for
  any non-ASCII character, and will fail the build if either appears.
- **Never edit or remove a shipped Dexie `version()` block.** Dexie replays them to upgrade
  a database that has been sitting on someone's phone.
- **Rule severity has a defined meaning.** `error` means cannot happen. Badge counts show
  errors and warnings only. Adding a noisy rule at warning level degrades the whole inbox;
  see the tuning notes in `docs/ARCHITECTURE.md`.

## Rebuilding confidence quickly

```
npm run verify                                          # everything
npx vitest run src/seed                                 # the 17 conflicts on the real trip
npx vitest run src/seed/__tests__/report.test.ts        # prints the full audit for reading
```

The last one is the tool for tuning rules. It prints totals by rule, every error, and the
booking queue, which is how the false positives were found and removed.
