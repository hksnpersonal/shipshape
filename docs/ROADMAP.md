# Roadmap: from linter to trip platform

Written 2026-09-05. This is a decision record, not a wish list. Where a thing is blocked by
someone else's commercial terms rather than by effort, it says so, because that is the
difference between "not built yet" and "not buildable by us".

`docs/PENDING.md` remains the live list for the current app. This document is about the
product the current app would have to become.

## The target

**The goal is not a planning tool. It is the removal of planning as a task.**

Someone who has never travelled overseas should be able to answer a short set of questions,
receive a complete trip, and spend their time _reviewing_ rather than _building_. They
should never feel intimidated, and they should not lose evenings to it. Then the same app
has to be dependable in their hand for the whole trip.

That reduces to two jobs, in this order:

1. **AI plans it; the user reviews and adjusts.** The product is the review experience, not
   the generation. Generation is commodity - every competitor has it. Making a plan
   _checkable by someone with no expertise_ is the hard part and the whole value.
2. **It works when it matters.** At the barrier, in a taxi, at check-in, on a platform with
   no signal and a dying battery.

Everything else - price comparison, group collaboration, expense splitting - supports those
two or waits.

### The corollary about comparison

"Cheapest and best value comparison for everything" and "do not stress me out" are in
tension. A comparison screen is a decision handed back to the user, and forty hotel options
is forty decisions - which is the intimidation we are trying to remove.

So: **one opinionated pick with its reasoning visible, two alternatives, and a swap that
takes one tap.** Full comparison exists behind a "see all options" affordance for people who
want it. Comparison on demand, never comparison by default.

### Why the linter is the review experience

A first-time traveller cannot meaningfully review a European itinerary. They do not know
that 33 minutes to change at Gare de Lyon is tight, or that Galleria Borghese sells out
weeks ahead. Handing them an AI plan and saying "check this" recreates the exact anxiety we
set out to remove.

The 26 rules are what make review possible without expertise. "We checked 26 things against
this plan, all clear" is the trust mechanism. And because the rules re-run on every edit,
the user cannot break the plan without being told: swap a museum, and if the train is now
unmakeable, it says so immediately rather than three weeks later on a platform.

This is not a differentiator bolted onto a planner. It is the load-bearing UX of the
central step.

## What exists today

74 source files, roughly 15,500 lines, 124 tests across 10 files. Concretely:

| Asset                           | State                                                | Survives the pivot?                               |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| Domain model (`src/domain`)     | Days, items, bookings, places, typed                 | Yes, extends                                      |
| Linter (`src/lint`)             | 26 rules, engine, timeline, stable finding keys      | **Yes - becomes the review UX**                   |
| Playbook (`src/content/guides`) | 41 guides, 5 country modules, `lastReviewed`, tested | **Yes - becomes retrieval corpus**                |
| Storage (`src/db`)              | Dexie, repos, documents as bytes                     | Yes, becomes the offline cache                    |
| Transfer (`src/db/transfer.ts`) | Export/import, base64 documents                      | Yes, becomes sync payload                         |
| 13 screens (`src/features`)     | React 19, Tailwind 4, router data mode               | Yes, wrapped by Capacitor                         |
| PWA/Workbox                     | 15 precached entries, 739 KB                         | Partly - native shell supersedes                  |
| Offline-first storage           | Deliberate                                           | **Yes - this is the in-trip reliability promise** |
| No accounts at all              | Deliberate                                           | No - sharing and sync need identity               |

Only the last row is a real loss. Everything else is additive.

Note the row above it. Offline-first was originally a purity choice; it is now half the
product requirement. Accounts get added on top, but the device stays the source of truth,
because "reliable during the trip" means working at a ticket barrier with no signal.

## Three constraints that shape everything

### 1. You cannot sell the ticket inside the app

"Without going out to another tab" holds for planning, comparing and tracking. It does not
hold for purchase. Selling travel yourself means becoming a licensed travel retailer with
bonding and regulatory obligations. Affiliate integrations hand the user to the supplier's
own checkout - that is the contract, not a technical gap.

So the promise to make is **one place to decide, compare and track, with a handoff at the
moment of payment**. Every competitor does the same, including the paid ones.

### 2. The supplier landscape narrowed badly in 2026

Two doors that were open a year ago are now shut:

- **Amadeus Self-Service was decommissioned on 17 July 2026.** The free-tier hobbyist route
  into flight and hotel data no longer exists. Remaining Amadeus access is Quick Connect or
  Enterprise, i.e. commercial agreements.
- **Booking.com's Demand API became partner-gated on 30 July 2026** - Managed Affiliate
  Partner status, a signed contract, and Account Manager-enabled Partner Centre access
  before you get even sandbox credentials. Booking through the Orders endpoints needs a
  further "Search, Look & Book" approval and a business case.

And one clause that aims directly at this product: **Booking.com General Partner Terms v5
prohibit using an AI system, or technology integrated with one, in performing the
agreement without Booking.com's prior written approval.** An AI-planning app is the exact
thing that clause contemplates. Assume Booking.com is unavailable to us and design so that
nothing depends on it.

### 3. Collaboration and push both require a server

They are the same decision, not two. The moment a second traveller edits the same trip you
need accounts, sync and conflict resolution; the moment you want a notification to fire
while the app is closed you need push infrastructure and an installed native app. Making
that one decision once, early, is cheaper than twice.

## Integration shortlist

Researched 2026-09-05. Verify before committing - these terms move.

| Provider               | Covers                            | Access                                                                                         | Cost                                                                                  | Verdict                 |
| ---------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------- |
| **Duffel**             | Flights, some hotels              | Self-serve, sandbox in ~1 min                                                                  | Free to 50 orders/mo; $3/order, 1% managed content, $0.005/search past a 1500:1 ratio | **Start here**          |
| **LiteAPI** (Nuitee)   | Hotels                            | Self-serve, no paperwork, test env included                                                    | Transparent per-booking                                                               | **Start here**          |
| Hotelbeds              | Hotels (300k+ properties)         | Sandbox on registration; contract for production                                               | B2B bedbank rates                                                                     | Phase 3                 |
| Booking.com Demand     | Hotels                            | Managed Affiliate Partner + contract + written AI approval                                     | Revenue share                                                                         | Avoid; see constraint 2 |
| Expedia Rapid          | Hotels                            | Partner-only, application + certification, no self-serve; individual developers do not qualify | Est. 6-12 months, $100k-200k integration                                              | No                      |
| Amadeus Self-Service   | Flights/hotels                    | **Dead - decommissioned 17 Jul 2026**                                                          | -                                                                                     | No                      |
| Omio                   | Ground transport, 1000+ operators | Affiliate program - referral commission                                                        | Commission                                                                            | Phase 2, referral only  |
| Trainline for Business | European rail, 80+ carriers       | B2B international API, gated                                                                   | Commercial                                                                            | Phase 4 or never        |
| Rail Europe            | European rail                     | Agency/OTA distribution                                                                        | Commercial                                                                            | Phase 4                 |

**The rail conclusion:** there is no unified European rail API available to an independent
developer, and there will not be one soon. SNCF, DB, Trenitalia and SBB are separate
integrations under separate agreements. Rail stays deep-link plus playbook.

That is not a retreat - it is the position the current app already reached deliberately,
and it is the part competitors handle worst. tripdeck.io will cheerfully schedule a train
without telling you the ticket goes on sale three months out at half the price. The
playbook does. Keep it, expand it, and treat it as content, not as a fallback.

## Architecture decisions

### Capacitor, not React Native

Capacitor wraps the existing React app into real iOS and Android binaries with minimal
code changes, preserving all 15,500 lines and all 124 tests. React Native means rewriting
every screen. Push via `@capacitor-firebase/messaging`, which is the 2026 consensus plugin
because it handles the iOS token problem - the stock plugin returns a native APNs token
where Firebase expects an FCM token, and the mismatch fails silently.

### Supabase for the backend

Postgres, auth, realtime and storage in one, with row-level security doing the
per-trip authorisation. Free tier is 500 MB database, 50k monthly active users, 200
realtime connections; Pro is $25/month per project with 8 GB and 500 connections. Free
projects pause after a week idle, so move to Pro once anyone else is testing.

### Keep Dexie. Sync on top, not instead

The strongest thing about the current app is that it works with no signal, which is the
condition a traveller is actually in. Do not trade offline-first for collaboration -
keep IndexedDB as the source of truth on device and sync to Postgres. The existing
`transfer.ts` export format is most of the sync payload already.

### The linter runs on generated plans

This is the product bet. Generation is commodity; every competitor has it. **Nobody
audits.** LLM planners routinely emit itineraries containing 33-minute transfers and stops
at venues closed that day - your own audit found five such errors in a plan a careful human
wrote by hand.

So the flow is: generate, immediately run all 26 rules, then show the traveller it is
sound - or fix it before they ever see it. "The only planner that proves its own plan
works" is unoccupied ground, and you hold both halves already.

### Generation is grounded in the playbook

Retrieval over `src/content/guides` so recommendations cite a real reviewed source with a
`lastReviewed` date instead of hallucinating booking advice. This is advice people spend
money on. Calls go through a server function so keys never ship in the bundle. Load the
`claude-api` skill before writing any of it.

## Build order

Durations assume one person, part-time. They are estimates, not commitments.

**Phase 0 - Trip-ready (2 weeks, hard deadline 9 October)**
Documents vault and item editor, per `docs/PENDING.md`. Ship it, take it to Europe, take
notes. Nothing below is reachable before departure, and field notes from a real trip are
better product input than anything reasoned out at a desk.

**Phase 1 - Native shell and a server (4-6 weeks)**
Capacitor for iOS and Android. Apple Developer and Play Console enrolment. Push plumbing
via `@capacitor-firebase/messaging`. A minimal Supabase project whose first job is edge
functions holding the Claude key, so it never ships in the bundle. **Accounts and sync are
deliberately deferred** - they belong to sharing, which is no longer near-term. Nothing
user-visible changes; this is the platform the next two phases need.

**Phase 2 - Generate and review (6-8 weeks)**
The product. Everything before this is scaffolding and everything after is improvement.

- Intake: six questions at most, sensible defaults, follow-ups only where the answer
  actually changes the plan. A newbie does not know what to specify, so do not ask them to.
- Generation: Claude, grounded by retrieval over the 41 guides, so advice cites a reviewed
  source with a date instead of being invented.
- **Audit before display.** The generated plan goes through all 26 rules before the user
  ever sees it. Errors get fixed or flagged; the user is shown what was checked.
- The review surface: every item carries why it was chosen. One pick, two alternatives, a
  one-tap swap, and the rules re-run on every change so a broken connection surfaces
  instantly.
- Prices here are deep links, not live data. Good enough to sanity-check, and it keeps this
  phase free of commercial paperwork.

**Phase 3 - Trip-day reliability (4-6 weeks)**
Moved ahead of pricing, because it is the second of the two stated jobs and it is cheap.
Full offline: documents, confirmation numbers, addresses, the day view. Itinerary-driven
push - leave now, buy this today, your train boards from a different platform. Solo expense
tracking. A today screen that is useful with zero taps and a bad battery.

**Phase 4 - Live prices (8-12 weeks)**
Duffel for flights, LiteAPI for hotels. Upgrades Phase 2's deep links to real numbers, real
best-value ranking, and swap-with-price. Affiliate accounts and revenue share. This phase
carries the real money and the real commercial paperwork, which is why it is not earlier.

**Phase 5 - Group (4-6 weeks)**
Accounts, shared trips, roles, realtime edits, expense splitting and settlement. Last,
because it did not survive the restatement of intent - it was on the original list and
absent from the clarification. Build it when someone asks. The linter gains a new rule
class here: two travellers booked onto different trains.

Roughly **9-12 months part-time** to Phase 5, but Phase 3 is the point at which the app
does what was actually asked for. Treat everything after it as optional.

## Running costs

| Item            | Cost                                                           |
| --------------- | -------------------------------------------------------------- |
| Supabase        | $0, then $25/month per project                                 |
| Apple Developer | $99/year                                                       |
| Google Play     | $25 one-time                                                   |
| Domain          | ~$15/year                                                      |
| Claude API      | Per generated plan; measure in Phase 2 before pricing anything |
| Duffel          | Free to 50 orders/month, then $3/order                         |
| LiteAPI         | Per booking                                                    |

Under $100/month until there is real traffic. The costs that hurt are commercial minimums
and integration time, not infrastructure.

## Revenue reality

Comparison and recommendation is an affiliate business, and affiliate businesses need
traffic - a marketing job, not a building job. tripdeck.io's $2.99-per-plan model sidesteps
that entirely: charge for the artefact, skip the supplier relationships. tripdeckai.com's
$39.99/year needs retention, which a once-a-year purchase struggles to earn.

If the plan is to make money rather than to have built it, the per-plan charge is the
easier business and reaches it several phases sooner.

## What could kill this

- **Rail never opens up.** The "one place" promise stays partial for the exact leg European
  travellers care most about. Mitigation: the playbook, and being honest in the marketing.
- **Supplier terms move again.** Two doors shut in 2026 alone. Build behind adapters so
  swapping a provider is a module, not a rewrite.
- **The AI clause spreads.** If more suppliers follow Booking.com, an AI planner's data
  options narrow further.
- **Solo capacity.** Nine to twelve months part-time is a long time to hold a thesis
  without users. Phase 2 is the earliest point at which anyone else can judge whether the
  bet is right - put it in front of real first-time travellers there, not at the end.
- **The plan is good but not trusted.** The whole product rests on a newbie believing a
  generated itinerary. If the audit banner reads as decoration rather than evidence, the
  anxiety comes straight back and they go and re-check everything by hand - which is the
  failure we set out to prevent. Test this with real people in Phase 2, early.

## Decisions still open

1. ~~**The name.**~~ **Settled: Shipshape.** "TripDeck" collided with two live products in
   this exact category. Shipshape means everything stowed and ready for the voyage, which is
   the promise, and it survives the failure case: "Shipshape says your transfer is too tight"
   still reads as a friend telling you something.
2. **Trip-first or product-first.** Phase 0 assumes the Europe 2026 trip matters. If it does
   not, Phase 1 starts now.
3. **Business model.** Affiliate revenue share, or charge per plan. This changes Phase 3
   entirely and should be decided before it, not during.
4. ~~**Audience.**~~ **Settled.** The audience is the first-time overseas traveller who does
   not want planning to be a project. The current app serves the opposite person - someone
   with a half-booked plan and a suspicion something is wrong - which is why Phase 2 is a
   new front door rather than a new feature.
