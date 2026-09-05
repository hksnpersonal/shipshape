# Session handoff - TripDeck - 2026-09-05

## Where things stand

**The app.** Tickets already bought can now be filed, and the plan can be corrected without
editing the seed. That closes the last two gaps in the original brief.

**The product.** The stated intention is no longer "audit my half-booked plan". It is
_remove planning as a task_: answer a few questions, get a whole trip, review rather than
build, then rely on it during the trip. `docs/ROADMAP.md` records that, what it costs, and
what is blocked by other people's terms rather than by effort. Read it before planning
work.

## Verified state

Run on 2026-09-05, not quoted from memory.

| Check                                     | Result                                     |
| ----------------------------------------- | ------------------------------------------ |
| `npm run verify`                          | 137 tests pass, 10 files                   |
| `npm run build`                           | clean, 15 precached entries, 748 KiB       |
| `git status`                              | clean, 11 commits on `main`, no remote     |
| Audit of the sample trip (today = 04 Sep) | 111 findings: 5 error, 49 warning, 57 info |

The seed was not touched, so the five errors are unchanged and still genuine.

```
npm run verify                                    # everything
npx vitest run src/seed/__tests__/report.test.ts --disableConsoleIntercept
```

The second prints the audit, and is how rule noise gets diagnosed.
`checkpoint-2026-09-05-01` tags the state before this session's build.

## What landed

- **Documents vault** at `t/:tripId/documents`: list, attach, open, remove. An attach
  control also sits on the booking detail screen, which is where you are when you want to
  file a ticket.
- **Item editor**: an Edit button on the item detail screen opens an inline form for title,
  type, start and end time, the fuzzy time label, tags and notes.

Two things worth not undoing:

- The vault frees its object URL on a **timer**, not synchronously after `window.open`. The
  new tab fetches the URL asynchronously; revoking straight away blanks it, reliably so on
  iOS Safari, which is the phone this gets opened on at a barrier.
- Typing an exact time clears `timeApprox`, but **only when the edit actually moved the
  time**, so correcting a title leaves someone else's "~19:00" alone.

Nothing validates that an end time follows a start time. An overnight flight runs 23:30 to
06:15, `buildDayTimeline` already handles it by adding a day, and this app surfaces
contradictions rather than preventing them.

## Next concrete step

Depends on a decision that has not been made: **trip-first or product-first**.

- **Trip-first.** The app is ready to use. What is left is content, not code: file the real
  PDFs from `C:\Users\henso\OneDrive\Documents\MyPersonal\Europe Trips\`, walk the
  itinerary, correct what is wrong now that it can be corrected.
- **Product-first.** Roadmap Phase 1: Capacitor shell, push plumbing, and a Supabase
  project whose first job is holding the Claude key server-side. Accounts and sync are
  deliberately deferred.

`docs/PENDING.md` holds the smaller items in priority order.

## Open questions

- **The name is a genuine collision, not a preference.** `tripdeck.io` and `tripdeckai.com`
  are both live products in this exact category, the second an AI trip planner. Decide
  before publishing: it is in the manifest, the README, the icon and the `.tripdeck.json`
  file extension. `Preflight` was the suggestion, though it suits an audit tool more than
  the reassuring thing this is now meant to be.
- **Publishing.** No `gh` and no git remote, so `deploy.yml` has nothing to push to. Needs
  a GitHub account, then Settings, Pages, Source set to "GitHub Actions" once.
- **Git identity** is set repo-locally to `Claude <noreply@anthropic.com>`, matching the
  existing history. Change it before publishing.
- **Time-sensitive, not a code task.** The audit says Galleria Borghese should be booked by
  **2026-09-06**. That is tomorrow, and it is the only thing in the "book now" band. The
  trip departs **9 October**.

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
