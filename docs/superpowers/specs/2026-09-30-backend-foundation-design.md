# Backend Foundation — Design Spec

## Context: the larger "Coins & Ranks" program

This is sub-project 1 of a 6-part program the user asked for: a chess-related
virtual economy (coins, ranks, cosmetics, real-money purchase, and peer-vs-peer
wagering) layered onto a chess app that has been, until now, 100% offline and
serverless (Electron + PWA, PeerJS/WebRTC for online play, zero backend, zero
accounts).

The six sub-projects, in build order (each gets its own spec → plan → build
cycle; this document covers only the first):

1. **Backend foundation** (this document) — server, database, accounts/auth,
   and offline/online identity continuity. Nothing below this works without it.
2. **Coin economy core** — authoritative ledger, earning rules (vs-computer
   results scaled by difficulty, rank milestones), the real crediting logic
   behind the offline-sync endpoint this document only stubs the shape of.
3. **Cosmetics shop** — direct-purchase catalog + a randomized-drop ("crate")
   mechanic, chat-reaction unlocks, board/piece skins. Actual visual design of
   the cosmetics is a separate, deferred Design task (tracked in `tasks.txt`
   at the repo root) — this program only builds the data model and shop
   mechanics, not the art.
4. **Real-money purchase** — Stripe integration on top of #2's ledger.
5. **Peer wagering** — server-arbitrated coin stakes on online games. The
   hardest and riskiest sub-project: today the two WebRTC peers are the only
   witnesses to a game's outcome, so the server needs a real way to adjudicate
   who won before it can move real coins.

**Two decisions were made for the whole program, not just this document, and
apply to every later sub-project:**

- **Coins are one-way.** Real money can buy coins; coins can never convert
  back to real money (no cash-out, no player-to-player resale for cash). This
  keeps the program out of real-money-gambling territory (money transmitter
  licensing, KYC/AML) — but it does **not** eliminate legal risk entirely.
- **Some cosmetics will be randomized drops** (crates/gacha), not purely
  direct-purchase. Several jurisdictions regulate randomized paid items
  independently of cash-out policy (Belgium bans loot boxes outright; others
  require disclosed odds). **This program needs a lawyer's sign-off before
  sub-project 3 (crates) or sub-project 5 (wagering) ships** — that review is
  out of scope for this document and for the engineering plan entirely; it is
  a product/legal gate, not a coding task.

## Goal

Let a player prove who they are to a server, in every connectivity state
(fresh install offline, fresh install online, signed-in-and-online,
signed-in-and-offline), so that later sub-projects have a trustworthy account
to attach coins, rank, cosmetics, and wager history to. This document does
**not** build the economy itself — no coin ledger, no rank table, no shop —
only the identity and connectivity plumbing everything else depends on.

## Requirements this spec satisfies

- **Signup is required before any play**, full stop — this is a deliberate
  break from the app's current zero-friction behavior, confirmed explicitly.
  A fresh install that has never authenticated, and has no network to reach
  Clerk, is the one exception: it falls back to exactly today's app (fully
  local, no coins, no rank — there is no account yet to credit anything to).
- **A signed-in player who goes offline keeps playing seamlessly.** vs-computer
  and learning-milestone results are recorded locally and queued; online
  wagering and real-money purchase are hard-blocked offline (both require a
  server actually present, which is a sub-project 2/4/5 concern, not this
  one's — this document just needs the client to *know* it's offline and gate
  those UI paths accordingly).
- **Offline-earned results survive reconnection and sync to the server**,
  without trusting the client's bare claim of what happened (see "Offline
  queue and sync" below) — though the actual coin-crediting and
  replay-verification *business logic* belongs to sub-project 2. This
  document defines the transport contract (what the client sends, what the
  server can say back) that sub-project 2 will implement against.

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐        ┌──────────────┐
│ Client (Electron/PWA)│         │   Fastify API (TS)    │        │   Supabase    │
│                      │         │   hosted on Railway/   │        │   Postgres    │
│ - Clerk session cache│──JWT───▶│   Fly.io               │──SQL──▶│  (accounts,   │
│ - Offline queue      │         │ - verifies Clerk JWT   │        │   later:      │
│   (IndexedDB)        │◀────────│ - business rules       │        │   ledger,     │
│ - Shared engine pkg  │         │ - Stripe webhooks       │        │   rank, etc.) │
│   (for future replay)│         │ - Shared engine pkg     │        │               │
└─────────────────────┘         │   (for transcript replay│        └──────────────┘
         │                       │   in sub-project 2)     │
         │  system browser        └──────────────────────┘
         ▼  (Electron only)
┌─────────────────────┐
│  Clerk-hosted sign-in │
│  custom-protocol       │
│  callback: b-chess://  │
│  auth-callback          │
└─────────────────────┘
```

Clients never talk to Supabase directly — the service-role key never ships to
a client, so a modified client cannot write to its own account row, ledger,
or anything else, no matter what sub-project 2+ adds to the schema. Row-level
security stays enabled on every table as defense-in-depth in case a key ever
leaks, but the real security boundary is "clients only ever talk to Fastify,
Fastify is the only thing with write access to Postgres."

The chess engine's pure scoring/move logic is factored into a shared TS
package (`packages/engine` or similar — exact location decided at plan time)
importable by both the renderer and the Fastify server. This document does
not use it yet; it exists so sub-project 2's replay-verification (server
independently re-derives a claimed offline result from a move transcript) is
possible without reimplementing chess logic server-side. Today the engine's
scoring functions live inside `src/renderer/engine/` and are only ever
invoked from `worker.ts` by convention (per this app's own established
architecture) — extracting the pure logic into something callable from a
plain Node process, with no Worker/DOM dependency, is real work scoped as its
own task in the implementation plan.

## Components

1. **Clerk integration**
   - Web (Vite/PWA renderer): `@clerk/clerk-react`, standard hosted
     sign-in/sign-up components.
   - Electron: no in-app browser redirect. Opens the OS default browser to
     Clerk's hosted sign-in page; Clerk redirects to a custom protocol
     (`b-chess://auth-callback?...`) that Electron registers as a deep-link
     handler, handing the resulting session back to the app. Same pattern
     Discord/Slack desktop clients use.

2. **Fastify API skeleton**
   - `GET /health` — trivial liveness check for the hosting platform.
   - Auth middleware: verifies the Clerk JWT on every non-health route via
     Clerk's server SDK; rejects with 401 on anything invalid/expired/missing.
   - `GET /me` — looks up the `accounts` row for the authenticated
     `clerk_user_id`; creates it on first call if absent (lazy account
     creation, no separate "register" step). Returns `{ accountId,
     clerkUserId, createdAt }`. Calling it twice must never create two rows.
   - `POST /sync/offline-results` — accepts a batch of queued offline game
     records; this document defines its request/response *shape* only (see
     below). In this sub-project it does no crediting — it validates the
     shape, persists nothing beyond an acknowledgement, and returns a
     per-item accept/reject response so the client can safely drain its
     queue. Sub-project 2 replaces the "does no crediting" part with the
     real replay-verification and ledger-writing logic, without changing the
     contract this document establishes.

3. **Postgres schema (this sub-project only)**
   ```sql
   create table accounts (
     id uuid primary key default gen_random_uuid(),
     clerk_user_id text not null unique,
     created_at timestamptz not null default now()
   );
   ```
   `coin_ledger`, `rank_progress`, `cosmetics_inventory`, `wager_records` are
   explicitly out of scope here — they belong to sub-projects 2, 3, and 5.

4. **Client-side session cache**
   - Clerk's session (or at minimum the `clerkUserId`/`accountId` pair
     returned by `GET /me`) is cached locally so a signed-in player who goes
     offline is never blocked from playing just because the app can't
     re-verify the token against Clerk's servers right now. Re-verification
     happens naturally the next time an authenticated API call succeeds
     (including the eventual sync call).

5. **Offline queue**
   - IndexedDB-backed (not the existing localStorage/zustand-persist
     pattern — a growing queue of full game transcripts is exactly the kind
     of unbounded-size, append-heavy data localStorage handles poorly).
   - Each queued item: `{ localId, accountId, kind: 'vsComputer' |
     'milestone', transcript, playedAt }` — `transcript` here means whatever
     sub-project 2 needs to replay-verify the result (full move history +
     the engine difficulty/config used); this document defines the queue
     entry's *presence* and *transport*, not its exact payload shape, since
     that's driven by what sub-project 2's replay logic actually needs.
   - Drains automatically on a browser/Electron "online" event, POSTing to
     `/sync/offline-results` in batches, removing accepted items and
     surfacing rejected ones (with the server's stated reason) without
     discarding the rest of the batch.

## Data flow

1. Fresh install, online, never authenticated → Clerk sign-up/sign-in screen
   blocks the rest of the app (per "signup required before any play") →
   on success, client calls `GET /me` → server creates the `accounts` row →
   client caches `{ clerkUserId, accountId }` → normal play begins.
2. Fresh install, offline, never authenticated → Clerk is unreachable, so no
   signup is possible → app falls back to today's fully-local experience,
   with no coins/rank UI shown at all (there's no account to attach them to).
3. Signed in, offline → client trusts its cached `{ clerkUserId, accountId }`
   without re-verifying → vs-computer/learning-milestone results get appended
   to the local IndexedDB queue → wagering and purchase UI is hidden/disabled
   (both need a live server).
4. Reconnect → client detects the `online` event → drains the queue via
   `POST /sync/offline-results` with backoff on failure → this sub-project's
   server accepts the shape and acknowledges; sub-project 2 later adds real
   crediting behind the same endpoint.

## Error handling

- **Expired/stale Clerk token while offline**: never blocks play. The client
  keeps using its last cached identity. The only thing that can force a
  re-login is the server explicitly saying "no such session" (e.g. a banned
  or deleted account) on the next successful network call — until then, a
  stale-looking token offline is treated as "probably fine, we'll find out
  when we're back online," not as an error.
- **Server unreachable during sync**: exponential backoff retry; the queue is
  never cleared until the server actually acknowledges receipt of an item.
  The player can keep playing and queueing more results in the meantime — the
  queue is unbounded in count (bounded only by device storage), not a single
  pending slot.
- **Server rejects a queued item** (shape invalid, or — once sub-project 2
  lands — a failed replay/cap check): rejection is per-item, not per-batch.
  One bad item never blocks the rest of the queue from syncing.

## Testing

- **Fastify API**: real request/response tests (not mocked at the HTTP
  layer) using a real or test-mode Clerk JWT — covering JWT verification
  (valid, expired, missing, malformed), `GET /me` idempotency (two calls,
  one account row), and `/sync/offline-results`'s shape-validation and
  per-item accept/reject response contract.
- **Offline queue (client)**: pure-logic unit tests, consistent with this
  codebase's existing no-jsdom convention — add/drain/retry-backoff behavior,
  connectivity-event handling, and that a rejected item doesn't stall the
  rest of the queue.
- **Electron auth handoff** (system browser → custom protocol callback): not
  meaningfully unit-testable. Live-verification only, the same convention
  this codebase already uses for pure UI/integration behavior that has no
  jsdom environment to test against.

## Review Focus

The five things most likely to bite a real player or reviewer that no test
above directly exercises:

1. **A player signs in on one device, then opens the app offline on a second
   device that has never talked to the server.** There's no cached identity
   to fall back to — this needs an explicit decision (block with "no
   internet, sign in required" vs. some other fallback) in the implementation
   plan; this document flags it but doesn't resolve it.
2. **The offline queue grows large** (a player offline for weeks, playing
   daily) — IndexedDB has no realistic size ceiling for this use case, but
   the *sync batch size* needs an explicit cap so `/sync/offline-results`
   never receives an unbounded single request.
3. **Clock skew**: a device with a wildly wrong system clock reports
   `playedAt` timestamps the server can't trust for later rate-capping
   (sub-project 2's concern, but the queue's data shape needs to carry enough
   information — e.g. a monotonic local counter alongside wall-clock time —
   for sub-project 2 to detect this at all).
4. **Clerk account deletion/ban while a device is offline** — the device
   keeps queueing results against an account that no longer exists server-side.
   The sync endpoint's per-item rejection needs a specific "account no longer
   valid, stop queueing and force re-auth" response distinct from a generic
   per-item validation failure.
5. **The Electron custom-protocol handler being hijacked or never
   registering** (a known class of desktop-OAuth bug — another app or a
   stale registration claiming the `b-chess://` scheme) — the implementation
   plan needs a concrete verification step for this, not just "it worked once
   locally."

---
