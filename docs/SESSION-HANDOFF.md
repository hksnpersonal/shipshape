# Session handoff - TripDeck - 2026-09-05

## Where things stand

TripDeck is a working, installable, offline-first trip app built from scratch in the
previous session. It holds the traveller's real Europe 2026 itinerary, audits it against
26 rules, and carries 41 offline guides on where and when to buy each kind of ticket.

Since the last handoff: three screens that were routed and rendering but had nothing
linking to them are now reachable, with tests asserting the links. Nothing else changed.

## Verified state

Run on 2026-09-05, not quoted from memory.

| Check                                     | Result                                     |
| ----------------------------------------- | ------------------------------------------ |
| `npm run verify`                          | 124 tests pass, 10 files                   |
| `npm run build`                           | clean, 15 precached entries, 739 KB        |
| `git status`                              | clean, 7 commits on `main`                 |
| Audit of the sample trip (today = 04 Sep) | 111 findings: 5 error, 49 warning, 57 info |

The five errors are all genuine and are the product demonstrating itself:

```
2026-10-09 time-overlap            Train to Spiez overlaps Train to Kandersteg
2026-10-11 insufficient-transfer   33 min to make TGV Lyria to Paris
2026-10-11 time-overlap            TGV Lyria to Paris overlaps Arrive Paris Gare de Lyon
2026-10-15 time-overlap            Eurostar to Amsterdam overlaps Arrive Amsterdam Centraal
2026-10-16 venue-closed-weekday    Stroopwafel at the market is closed on Friday
```

Commands that reproduce these:

```
npm run verify                                    # everything
npx vitest run src/seed                           # the 17 source conflicts, on the real trip
npx vitest run src/seed/__tests__/report.test.ts --disableConsoleIntercept
```

The last one prints the full audit and the booking queue. It is the tool for tuning rules,
and it is how the false positives were found and removed.

## Next concrete step

**Build the documents vault.** It is the last piece of the traveller's original problem
that is unaddressed: they said they need to check the tickets they have already bought,
and there is currently no way to attach one.

Everything underneath it exists and is tested. `documentsRepo` in `src/db/repo.ts` has
`attach`, `bytes`, `blob` and `remove`, enforces a 15 MB limit, and stores contents as
`ArrayBuffer` in the `documentBytes` table. Export already carries files as base64 and the
round trip is covered in `src/db/__tests__/transfer.test.ts`.

What is missing is only the screen:

1. Add `DocumentsVaultPage` to `src/features/BookingPages.tsx` (or a new file), route it at
   `t/:tripId/documents` in `src/app/routes.tsx`.
2. A file input calling `documentsRepo.attach(tripId, file, { name, kind, attachedTo })`.
3. Open a stored file with `URL.createObjectURL(await documentsRepo.blob(id))` in a new tab,
   and revoke the URL afterwards.
4. An attach control on `BookingDetailPage`, since that is where someone actually is when
   they want to file a ticket.
5. Link it from the trip home's "Also here" section, and add a case to the reachability
   test in `src/features/__tests__/screens.test.tsx`.

Real PDFs to test with are in
`C:\Users\henso\OneDrive\Documents\MyPersonal\Europe Trips\Hotels\` and `\Trains\`.

## Open questions

- **Publishing.** The GitHub CLI is not installed and there is no git remote, so the deploy
  workflow has nothing to push to. Needs the user's GitHub account: either
  `winget install GitHub.cli` then `gh repo create`, or create the repo on the website and
  `git remote add origin`. Then set Settings, Pages, Source to "GitHub Actions" once.
- **Item editing.** Status, skip and reorder work; changing a title, time or note does not,
  so corrections currently mean editing the seed file. Worth asking whether a full editor
  matters before departure, or whether the audit plus reordering is enough.
- **Naming.** "TripDeck" is a working title. It is in the manifest, the README and the icon,
  and is cheap to change now and annoying to change after publishing.
- **Time-sensitive, not a code task.** The audit says Galleria Borghese should be booked by
  **2026-09-06**, which is tomorrow. It is the only item in the "book now" band.

## Key files

| Path                                     | Why it matters                                           |
| ---------------------------------------- | -------------------------------------------------------- |
| `src/domain/types.ts`                    | The contract every other module compiles against         |
| `src/lint/engine.ts`                     | `Rule`, `LintContext`, `lintTrip`, stable finding keys   |
| `src/lint/rules/{timing,places,trip}.ts` | The 26 rules, grouped by what they look at               |
| `src/db/transfer.ts`                     | Export and import; also the seed and share path          |
| `src/db/repo.ts`                         | Every write, including the cascade and the day swap      |
| `src/seed/europe-2026/`                  | The real trip, one item per bullet of the original notes |
| `src/content/guides/`                    | The 41 booking guides                                    |
| `docs/ARCHITECTURE.md`                   | The decisions and their reasoning                        |
| `docs/CONTENT-GUIDE.md`                  | How to convert itinerary notes into seed data            |
| `docs/PENDING.md`                        | The living list of what is left                          |

## Deliberately not done

- **The sample trip's end date says 18 October and the flight home is the 17th.** The
  original notes said 18. The linter raising it is the demonstration working. Do not
  "correct" the seed.
- **Stale lines are kept, not deleted.** "Arrive Paris Gare de Lyon 13:40" and
  "Arrive Amsterdam Centraal 12:45" survive beside their bookings, tagged `CONFLICT`.
  Removing them would make tests pass and the product pointless.
- **Live data was ruled out for this version** by the user. Deep links to Google Maps and
  operator sites cover the need with no API keys. If Google Maps routing or an assistant is
  added later, they belong behind runtime-selected adapters, not inline calls.
- **Background notifications were not attempted.** Reminders list in the app but do not fire
  on the phone. That needs push, a server, and an installed app on iOS.
- **No drag-and-drop reordering.** Up and down buttons are reliable on a touch screen and
  cost no dependency.
- **The 57 informational findings are not shown in badges.** Showing 111 made the number
  meaningless. Badge counts are errors plus warnings only; the rest fold away in the inbox.
