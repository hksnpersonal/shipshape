# Session handoff - Shipshape - 2026-09-24

> **Redesign, 2026-09-24.** The traveller chose "Direction A" (design canvas:
> claude.ai/artifact/CURzEuVx4dM1fmkmtaRu99) over a city-binder alternative. Four tabs:
> Today, Trip, Wallet, More. The palette lives in `src/index.css` by redefining Tailwind's
> `slate` (paper to ink) and `brand` (terracotta) scales, so screens keep using those
> names; fonts are bundled via `@fontsource-variable`. Restore point before it:
> `checkpoint-2026-09-24-02`.

> **Correction, 2026-09-24 (later session).** The trip departs **25 September 2026**
> (Sydney 21:05, TK175), not 9 October. The end date of 18 October is correct: the flight
> home lands in Sydney on the 18th, so `trip-range` no longer fires. The seed was
> reconciled against every ticket in `Europe Trips\Trip Details`. References, seats,
> ticket numbers and all 32 documents live in the private overlay
> `Europe Trips\shipshape-private.json`, merged by `scripts/make-private-trip.mjs` into
> `Europe Trips\Europe 2026.shipshape.json` for import on each phone. Never move them
> into the seed: the seed ships inside the public site. See `docs/PENDING.md`.

## Where things stand

**Phase 0 of `docs/ROADMAP.md` is complete.** Everything in the original brief is
addressed, and everything the app holds can now be corrected inside the app rather than by
editing the seed file. It is ready to travel with.

**The product it wants to become changed shape.** No longer "audit my half-booked plan" but
_remove planning as a task_: answer a few questions, get a whole trip, review rather than
build, then rely on it during the trip. `docs/ROADMAP.md` records that, what it costs, and
what is blocked by other people's terms rather than effort. Read it before planning work.

## Verified state

Run on 2026-09-24, not quoted from memory.

| Check                                     | Result                                     |
| ----------------------------------------- | ------------------------------------------ |
| `npm run verify`                          | 169 tests pass, 11 files                   |
| `npm run build`                           | clean, 15 precached entries, 784 KiB       |
| `git status`                              | clean, 25 commits on `main`, no remote     |
| Audit of the sample trip (today = 04 Sep) | 111 findings: 5 error, 49 warning, 57 info |

The seed was not touched, so the five errors are unchanged and still genuine.

```
npm run verify                                    # everything
npx vitest run src/seed/__tests__/report.test.ts --disableConsoleIntercept
```

The second prints the audit, and is how rule noise gets diagnosed.
`checkpoint-2026-09-06-01` tags this state.

## What landed

- **A tightening pass over every screen** (`f59320d`). Shared `Row`, `Disclosure`,
  `FactStrip`, `FilterChips`, `SearchInput` and `StatTile` live in `components/ui.tsx`.
  The playbook moved to `features/PlaybookPages.tsx`, with search, category tiles and a
  booking timeline. "Watch for" says **Non-refundable** only when the rules say so, and
  otherwise "Check refund rules". Never infer a refund from free text.

- **Documents vault** at `t/:tripId/documents`, plus an attach control on the booking
  screen, which is where you are when you want to file a ticket.
- **Items** can be added, edited and deleted.
- **Bookings** can be captured, edited, deleted, and linked to an item. Capture shows the
  playbook match live as the title is typed.
- **Renamed to Shipshape** from TripDeck, which collided with two live products.

Five decisions worth not undoing:

- The **IndexedDB database keeps its old name** `tripdeck`. It is an internal key, and
  renaming it would strand a trip already sitting on a phone.
- Exports write `.shipshape.json`, and **`format: 'tripdeck'` is still accepted on import**.
  An older backup is somebody's only copy of a trip.
- The vault frees its object URL **on a timer**, not right after `window.open`. The new tab
  fetches it asynchronously; revoking at once blanks the page on iOS Safari.
- Typing an exact time clears `timeApprox`, but **only when the edit moved the time**, and a
  checkbox puts it back.
- **Adding an item while a tag filter is on drops the filter.** A new line carries no tags,
  so it would otherwise land out of sight and the app would look like it had swallowed what
  someone just typed.

Nothing validates that an end time follows a start time. An overnight flight runs 23:30 to
06:15, `buildDayTimeline` already handles it, and this app surfaces contradictions rather
than preventing them.

## Next concrete step

**Do not start Phase 1 before the trip.** Capacitor, a backend and accounts cannot be
finished in the time left, and travelling with a half-migrated app is worse than travelling
with a finished small one. Phase 1 starts in November, informed by the trip.

Until 9 October the work is content, not code: file the real PDFs from
`C:\Users\henso\OneDrive\Documents\MyPersonal\Europe Trips\`, walk the itinerary, and
correct what is wrong now that it can be.

`docs/PENDING.md` holds what is left, all of it Phase 1 or later.

## Open questions

- **Time-sensitive, not a code task.** Galleria Borghese's book-by date was **2026-09-06**
  and has passed. Unknown whether it was booked. The trip departs **9 October**.
- **Publishing.** No `gh` and no git remote. Name the repository `shipshape`: `deploy.yml`
  reads the base path from it and `vite.config.ts` defaults to `/shipshape/`. Then Settings,
  Pages, Source set to "GitHub Actions" once. Git identity is set repo-locally to
  `Claude <noreply@anthropic.com>`, matching history; change it before publishing.
  **The seed trip is bundled into the build**, so a public Pages site publishes the
  itinerary. Decide whether that is acceptable before pushing.

## Deliberately not done

Do not "fix" these. Each is load-bearing.

- **The sample trip ends 18 October while the flight home is the 17th.** The source notes
  said 18. The linter raising it is the demonstration working.
- **Stale lines are kept** beside their bookings, tagged `CONFLICT`. Deleting them would
  make tests pass and the product pointless.
- **Live data was ruled out for this version.** Deep links cover it with no API keys.
- **The 57 informational findings stay out of badges.** Showing 111 made the number
  meaningless.

Decisions and their reasoning live in `docs/ARCHITECTURE.md`; converting notes into seed
data is `docs/CONTENT-GUIDE.md`; where the product is going is `docs/ROADMAP.md`.
