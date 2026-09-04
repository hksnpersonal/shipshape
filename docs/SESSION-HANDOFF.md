# Session handoff - TripDeck - 2026-09-05

## Where things stand

TripDeck is a working, installable, offline-first trip app. It holds the traveller's real
Europe 2026 itinerary, audits it against 26 rules, and carries 41 offline guides on where
and when to buy each kind of ticket.

This session: three screens that were routed and rendering but linked from nowhere are now
reachable, with tests asserting it. Nothing else changed.

## Verified state

Run on 2026-09-05, not quoted from memory.

| Check                                     | Result                                     |
| ----------------------------------------- | ------------------------------------------ |
| `npm run verify`                          | 124 tests pass, 10 files                   |
| `npm run build`                           | clean, 15 precached entries, 739 KB        |
| `git status`                              | clean, 8 commits on `main`, no remote      |
| Audit of the sample trip (today = 04 Sep) | 111 findings: 5 error, 49 warning, 57 info |

The five errors are all genuine, and are the product demonstrating itself:

```
2026-10-09 time-overlap            Train to Spiez overlaps Train to Kandersteg
2026-10-11 insufficient-transfer   33 min to make TGV Lyria to Paris
2026-10-11 time-overlap            TGV Lyria to Paris overlaps Arrive Paris Gare de Lyon
2026-10-15 time-overlap            Eurostar to Amsterdam overlaps Arrive Amsterdam Centraal
2026-10-16 venue-closed-weekday    Stroopwafel at the market is closed on Friday
```

```
npm run verify                                    # everything
npx vitest run src/seed                           # the 17 source conflicts, on the real trip
npx vitest run src/seed/__tests__/report.test.ts --disableConsoleIntercept
```

The last prints the audit and the booking queue. It is how rule noise gets diagnosed, and
how the false positives were found and removed.

## Next concrete step

**Build the documents vault.** It is the last part of the traveller's original problem left
unaddressed: they said they need to check the tickets they have already bought, and there
is still no way to attach one.

Everything underneath exists and is tested. `documentsRepo` in `src/db/repo.ts` has
`attach`, `bytes`, `blob`, `remove`, enforces 15 MB, and stores contents as `ArrayBuffer`
in `documentBytes`. Export carries files as base64; the round trip is covered in
`src/db/__tests__/transfer.test.ts`. Only the screen is missing:

1. `DocumentsVaultPage`, routed at `t/:tripId/documents` in `src/app/routes.tsx`. A file
   input calling `documentsRepo.attach`; open with `URL.createObjectURL(await blob(id))`
   in a new tab and revoke afterwards.
2. An attach control on `BookingDetailPage`, which is where someone is when they want to
   file a ticket.
3. Link it from the trip home's "Also here" section and add a case to the reachability test
   in `src/features/__tests__/screens.test.tsx`.

Real PDFs to test with:
`C:\Users\henso\OneDrive\Documents\MyPersonal\Europe Trips\Hotels\` and `\Trains\`.

`docs/PENDING.md` holds everything after that, in priority order.

## Open questions

- **Publishing.** No `gh` on this machine and no git remote, so `deploy.yml` has nothing to
  push to. Needs the user's GitHub account, then Settings, Pages, Source set to "GitHub
  Actions" once.
- **Item editing.** Status, skip and reorder work; title, time and notes do not, so a
  correction means editing the seed. Worth asking whether that matters before departure.
- **Naming.** "TripDeck" is a working title, present in the manifest, README and icon.
  Cheap to change now, annoying after publishing.
- **Time-sensitive, not a code task.** The audit says Galleria Borghese should be booked by
  **2026-09-06**. It is the only thing in the "book now" band.

## Deliberately not done

Do not "fix" these. Each is load-bearing.

- **The sample trip ends 18 October while the flight home is the 17th.** The original notes
  said 18. The linter raising it is the demonstration working.
- **Stale lines are kept.** "Arrive Paris Gare de Lyon 13:40" and "Arrive Amsterdam
  Centraal 12:45" survive beside their bookings, tagged `CONFLICT`. Deleting them would make
  tests pass and the product pointless.
- **Live data was ruled out by the user for this version.** Deep links cover it with no API
  keys. If routing or an assistant is added, they go behind runtime adapters.
- **Background notifications untried.** Needs push, a server, and an installed app on iOS.
- **No drag-and-drop.** Up and down buttons are reliable on touch and cost no dependency.
- **The 57 informational findings stay out of badges.** Showing 111 made the number
  meaningless.

Decisions and their reasoning live in `docs/ARCHITECTURE.md`; converting notes into seed
data is `docs/CONTENT-GUIDE.md`.
