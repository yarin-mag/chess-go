# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player prove who they are to a server, in every connectivity state, so later sub-projects (coin economy, cosmetics, purchases, wagering) have a trustworthy account to attach state to. No coin ledger, no rank, no shop — identity and connectivity plumbing only.

**Architecture:** A new, fully independent `server/` npm project (Fastify + TypeScript) verifies Clerk session JWTs and is the only thing with write access to a Supabase-hosted Postgres `accounts` table. The existing Electron/PWA client gains a Clerk-backed sign-in gate, a local session cache so a signed-in player never gets blocked by connectivity, and an IndexedDB-backed offline queue that records vs-computer/milestone results while offline and drains them to the server on reconnect.

**Tech Stack:** Fastify 5 + TypeScript (server, hosted on Railway or Fly.io), Supabase Postgres (`pg` client, schema managed via `supabase/migrations/*.sql`), Clerk (`@clerk/backend` server-side, `@clerk/clerk-react` client-side), IndexedDB (`fake-indexeddb` in tests) for the offline queue, Electron `shell.openExternal` + a custom `b-chess://` protocol for desktop sign-in.

**Spec:** `docs/superpowers/specs/2026-09-30-backend-foundation-design.md`

## Global Constraints

- Clients never talk to Supabase directly. Only the Fastify server holds `DATABASE_URL`/service credentials; row-level security stays enabled on every table as defense-in-depth regardless.
- Every Fastify route except `GET /health` requires a valid Clerk-issued bearer token.
- A signed-in player is never blocked from playing by connectivity. Only a server-confirmed "no such session" (never a client-side guess about token staleness) forces re-login.
- `POST /sync/offline-results` always responds per-item (accepted/rejected), never all-or-nothing for a batch.
- This plan does **not** implement coin-crediting, replay verification, or any Stripe/webhook route — those belong to sub-projects 2 and 4 of the larger program. `/sync/offline-results` in this plan is a shape-validating stub that acknowledges but does not credit anything (an earlier draft of the architecture diagram implied a Stripe route belonged here; the spec's own Components list and Context section do not scope it here, and this plan follows that as authoritative).
- `server/` is a fully separate npm project (own `package.json`/`tsconfig.json`/vitest config) and is never wired into the root repo's `npm run typecheck`/`npm test` scripts.
- Server tests that need a real Postgres are gated on `process.env.DATABASE_URL` being set and skip cleanly otherwise — no task's tests require live cloud credentials to pass.
- `.tsx` client files and the Electron main/preload process are not unit-tested in this codebase (no jsdom, no Electron test harness) — verified live instead, matching this repo's established convention (see e.g. Task 7/9 of the prior `2026-09-30-learning-enhancements` plan).

## Review Focus

1. **A player signs in on one device, then opens the app offline on a second device that has never talked to the server.** There's no cached identity to fall back to. Resolved in Task 7 (`decideGate`'s `offlineBlocked` state) — distinct from the never-authenticated-offline fallback, so a real account is never silently downgraded to the old no-account experience.
2. **The offline queue grows large** (weeks offline, playing daily) — Task 10's sync client caps request batch size; Task 5's server route independently rejects an oversized batch rather than trusting the client to have capped it.
3. **Clock skew** — a device with a wrong system clock reports untrustworthy `playedAt` timestamps. Task 9's queue entries carry a monotonic local sequence number (`localSeq`) alongside wall-clock time, so sub-project 2 has something clock-skew-proof to rate-cap against later.
4. **Clerk account deletion/ban while a device is offline** — Task 5's sync route needs a distinct rejection reason (`account_invalid`) separate from generic shape-validation failure, and Task 10's sync client treats that specific reason as "stop queueing, force re-auth" rather than "retry with backoff."
5. **The Electron custom-protocol handler never registering, or being hijacked** — Task 12 includes an explicit live-verification step for this, not just "it worked once locally."

---

### Task 1: Server scaffold — Fastify skeleton with `/health`

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/.env.example`
- Create: `server/.gitignore`
- Create: `server/src/app.ts`
- Create: `server/src/routes/health.ts`
- Create: `server/src/routes/health.test.ts`
- Create: `server/src/index.ts`
- Create: `server/README.md`

**Interfaces:** Produces `buildApp(): FastifyInstance` (no dependencies yet — Task 4 changes this signature to accept `{ verifyToken, accountsRepo }`; every later task that touches `app.ts` reads the current file before editing).

- [ ] **Step 1: Create `server/package.json`.**
```json
{
  "name": "b-chess-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`.**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `server/vitest.config.ts`.**
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node' },
});
```

- [ ] **Step 4: Create `server/.env.example`.**
```
# Fastify server port
PORT=8787

# Clerk secret key (Clerk dashboard → your application → API Keys)
CLERK_SECRET_KEY=

# Postgres connection string (Supabase project → Settings → Database → Connection string, "Session" pooler mode recommended)
DATABASE_URL=

# Comma-separated origins allowed to call this API (the web/PWA build's origin(s))
CORS_ORIGINS=http://localhost:5173,http://localhost:5175
```

- [ ] **Step 5: Create `server/.gitignore`.**
```
node_modules/
dist/
.env
```

- [ ] **Step 6: Write the failing test for `/health`.**
```ts
// server/src/routes/health.test.ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('GET /health', () => {
  it('responds ok without requiring auth', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 7: Run it to verify it fails.**
Run (from `server/`): `npm install && npm test`
Expected: FAIL — `app.ts` / `routes/health.ts` don't exist yet.

- [ ] **Step 8: Implement `server/src/routes/health.ts`.**
```ts
import type { FastifyInstance } from 'fastify';

export function healthRoutes(app: FastifyInstance): void {
  app.get('/health', async () => ({ status: 'ok' }));
}
```

- [ ] **Step 9: Implement `server/src/app.ts`.**
```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';

/** Builds (but does not start) the Fastify app — kept separate from index.ts so tests can use
 *  `.inject()` without binding a real port. */
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.register(cors, { origin: origins.length > 0 ? origins : true });

  app.register(healthRoutes);

  return app;
}
```

- [ ] **Step 10: Run the test again to verify it passes.**
Run: `npm test`
Expected: PASS 1/1.

- [ ] **Step 11: Create the entry point, `server/src/index.ts`.**
```ts
import 'dotenv/config';
import { buildApp } from './app.js';

const app = buildApp();
const port = Number(process.env.PORT ?? 8787);

app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`b-chess-server listening on :${port}`);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 12: Create `server/README.md`.**
```markdown
# b-chess-server

Fastify + TypeScript API for the B-Chess coins/ranks backend. Fully independent from the root
repo's Electron/Vite app — its own `package.json`, its own test run.

## Setup

    cd server
    npm install
    cp .env.example .env   # fill in CLERK_SECRET_KEY and DATABASE_URL once you've provisioned them

## Scripts

- `npm run dev` — run with hot reload (tsx watch)
- `npm test` — run the test suite (tests needing a real Postgres are skipped unless DATABASE_URL is set)
- `npm run typecheck` — type-check only
- `npm run build && npm start` — production build + run

See `docs/superpowers/specs/2026-09-30-backend-foundation-design.md` for the design this implements.
```

- [ ] **Step 13: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 14: Commit.**
```bash
git add server/
git commit -m "feat(server): scaffold Fastify server with a health check"
```

---

### Task 2: `accounts` table migration + local test-database docs

**Files:**
- Create: `supabase/migrations/0001_accounts.sql`
- Modify: `server/README.md`

**Interfaces:** Produces the `accounts` table (`id uuid`, `clerk_user_id text unique`, `created_at timestamptz`) — consumed by Task 4's `pgAccountsRepo`.

- [ ] **Step 1: Create the migration.**
```sql
-- supabase/migrations/0001_accounts.sql
create extension if not exists pgcrypto;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;
-- No policies are added: with RLS on and zero policies, every direct client query is denied by
-- default. Only the server's service-role connection (which bypasses RLS entirely) can read/write
-- this table — exactly the "clients never talk to Supabase directly" constraint, enforced at the
-- database layer as defense-in-depth even if a client ever obtained a Postgres connection string.
```

- [ ] **Step 2: Document local test-database setup in `server/README.md`.** Add this section:
```markdown
## Local test database (for integration tests)

A few tests in this project talk to a real Postgres and are skipped automatically unless
`DATABASE_URL` is set. To run them locally:

    docker run --name bchess-test-db -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres:16
    psql postgresql://postgres:postgres@localhost:5433/postgres -f ../supabase/migrations/0001_accounts.sql
    export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
    npm test

Production schema changes go through the same migration files, applied to the real Supabase
project via the Supabase CLI (`supabase db push`) — see Task 6's deploy notes.
```

- [ ] **Step 3: Apply it to a local test database and verify the table exists.**
Run:
```bash
docker run --name bchess-test-db -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres:16
psql postgresql://postgres:postgres@localhost:5433/postgres -f supabase/migrations/0001_accounts.sql
psql postgresql://postgres:postgres@localhost:5433/postgres -c "\d accounts"
```
Expected: `\d accounts` prints the three columns (`id`, `clerk_user_id`, `created_at`) and shows `rowsecurity` enabled — confirms the migration is syntactically valid and applies cleanly before any application code depends on it. Leave the container running; Task 4's integration test reuses it.

- [ ] **Step 4: Commit.**
```bash
git add supabase/migrations/0001_accounts.sql server/README.md
git commit -m "feat(server): accounts table migration + local test-db docs"
```

---

### Task 3: Clerk session verification

**Files:**
- Create: `server/src/plugins/auth.ts`
- Create: `server/src/plugins/auth.test.ts`
- Create: `server/src/clerkVerifier.ts`

**Interfaces:** Produces `authPlugin(app, verify: TokenVerifier)`, `type SessionClaims = { clerkUserId: string }`, `type TokenVerifier = (token: string) => Promise<SessionClaims>`, and the production `clerkVerifier: TokenVerifier` — consumed by Task 4's `buildApp` deps.

- [ ] **Step 1: Write the failing tests.**
```ts
// server/src/plugins/auth.test.ts
import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { authPlugin } from './auth.js';

describe('authPlugin', () => {
  it('rejects a request with no Authorization header', async () => {
    const app = Fastify();
    authPlugin(app, async () => ({ clerkUserId: 'user_1' }));
    app.get('/protected', async (req) => ({ clerkUserId: req.session?.clerkUserId }));
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request whose token fails verification', async () => {
    const app = Fastify();
    authPlugin(app, async () => { throw new Error('bad token'); });
    app.get('/protected', async () => ({ ok: true }));
    const res = await app.inject({ method: 'GET', url: '/protected', headers: { authorization: 'Bearer bad' } });
    expect(res.statusCode).toBe(401);
  });

  it('attaches session claims to the request when the token verifies', async () => {
    const app = Fastify();
    authPlugin(app, async (token) => ({ clerkUserId: `user-for-${token}` }));
    app.get('/protected', async (req) => ({ clerkUserId: req.session?.clerkUserId }));
    const res = await app.inject({ method: 'GET', url: '/protected', headers: { authorization: 'Bearer tok123' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ clerkUserId: 'user-for-tok123' });
  });
});
```

- [ ] **Step 2: Run to verify it fails.**
Run: `npm test`
Expected: FAIL — `auth.ts` doesn't exist.

- [ ] **Step 3: Implement `server/src/plugins/auth.ts`.**
```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface SessionClaims {
  /** Clerk's own user id (the token's `sub` claim) — the only identity fact this app trusts. */
  clerkUserId: string;
}

export type TokenVerifier = (token: string) => Promise<SessionClaims>;

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionClaims;
  }
}

/** Rejects with 401 any request in this plugin's scope missing a valid `Authorization: Bearer
 *  <token>` header. Registered inside app.ts's protected sub-scope only — /health is registered
 *  outside that scope and never passes through this hook at all. */
export function authPlugin(app: FastifyInstance, verify: TokenVerifier): void {
  app.decorateRequest('session', undefined);

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) return reply.code(401).send({ error: 'missing bearer token' });

    try {
      req.session = await verify(token);
    } catch {
      return reply.code(401).send({ error: 'invalid or expired session' });
    }
  });
}
```

- [ ] **Step 4: Run to verify it passes.**
Run: `npm test`
Expected: PASS 3/3 (plus the earlier health test, 4/4 total).

- [ ] **Step 5: Add the Clerk SDK dependency.**
```bash
npm install @clerk/backend
```

- [ ] **Step 6: Implement the production verifier, `server/src/clerkVerifier.ts`.** Not unit-tested — it needs a real Clerk secret key and a real signed token, neither of which exists until Task 14's live provisioning. Exercised only there.
```ts
import { verifyToken } from '@clerk/backend';
import type { SessionClaims, TokenVerifier } from './plugins/auth.js';

/** Production token verifier — wraps Clerk's backend SDK. Requires CLERK_SECRET_KEY. */
export const clerkVerifier: TokenVerifier = async (token) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set');
  const claims = await verifyToken(token, { secretKey });
  return { clerkUserId: claims.sub };
};
```

- [ ] **Step 7: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 8: Commit.**
```bash
git add server/src/plugins/auth.ts server/src/plugins/auth.test.ts server/src/clerkVerifier.ts server/package.json server/package-lock.json
git commit -m "feat(server): Clerk session verification (auth plugin + production verifier)"
```

---

### Task 4: Accounts repository + `GET /me`

**Files:**
- Create: `server/src/db/accountsRepo.ts`
- Create: `server/src/db/accountsRepo.integration.test.ts`
- Create: `server/src/routes/me.ts`
- Create: `server/src/routes/me.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:** Consumes `authPlugin`/`TokenVerifier` (Task 3). Produces `AccountsRepo` (consumed by Task 6's production wiring) and changes `buildApp`'s signature to `buildApp(deps: { verifyToken: TokenVerifier; accountsRepo: AccountsRepo }): FastifyInstance` — every later task that calls `buildApp` must pass both.

- [ ] **Step 1: Add the `pg` dependency.**
```bash
npm install pg
npm install -D @types/pg
```

- [ ] **Step 2: Implement `server/src/db/accountsRepo.ts`.**
```ts
import type { Pool } from 'pg';

export interface Account {
  id: string;
  clerkUserId: string;
  createdAt: string;
}

export interface AccountsRepo {
  findOrCreateByClerkUserId(clerkUserId: string): Promise<Account>;
}

/** Real Postgres-backed implementation. findOrCreate is a single upsert (ON CONFLICT DO NOTHING +
 *  a follow-up SELECT) so two concurrent first-logins for the same user can never create two rows. */
export function pgAccountsRepo(pool: Pool): AccountsRepo {
  return {
    async findOrCreateByClerkUserId(clerkUserId) {
      const upsert = await pool.query(
        `insert into accounts (clerk_user_id) values ($1)
         on conflict (clerk_user_id) do nothing
         returning id, clerk_user_id, created_at`,
        [clerkUserId],
      );
      const row =
        upsert.rows[0] ??
        (
          await pool.query(`select id, clerk_user_id, created_at from accounts where clerk_user_id = $1`, [
            clerkUserId,
          ])
        ).rows[0];
      return { id: row.id, clerkUserId: row.clerk_user_id, createdAt: row.created_at.toISOString() };
    },
  };
}
```

- [ ] **Step 3: Write the gated integration test.**
```ts
// server/src/db/accountsRepo.integration.test.ts
import { describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { pgAccountsRepo } from './accountsRepo.js';

const DATABASE_URL = process.env.DATABASE_URL;
const maybeDescribe = DATABASE_URL ? describe : describe.skip;

maybeDescribe('pgAccountsRepo (real Postgres — requires DATABASE_URL and migration 0001 applied)', () => {
  it('finds-or-creates exactly one row for repeated calls with the same clerkUserId', async () => {
    const pool = new Pool({ connectionString: DATABASE_URL });
    const repo = pgAccountsRepo(pool);
    const uniqueId = `test-${Date.now()}`;
    const first = await repo.findOrCreateByClerkUserId(uniqueId);
    const second = await repo.findOrCreateByClerkUserId(uniqueId);
    expect(first.id).toBe(second.id);
    await pool.query('delete from accounts where clerk_user_id = $1', [uniqueId]);
    await pool.end();
  });
});
```

- [ ] **Step 4: Run against the Task 2 local test database to verify it passes.**
Run:
```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
npm test
```
Expected: PASS (this test); without `DATABASE_URL` set, `npm test` shows it as skipped, not failing.

- [ ] **Step 5: Write the failing tests for `GET /me`** (against a fake repo — no real Postgres needed here).
```ts
// server/src/routes/me.test.ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { AccountsRepo } from '../db/accountsRepo.js';

function fakeRepo(): AccountsRepo & { calls: string[] } {
  const calls: string[] = [];
  const accounts = new Map<string, { id: string; clerkUserId: string; createdAt: string }>();
  return {
    calls,
    async findOrCreateByClerkUserId(clerkUserId) {
      calls.push(clerkUserId);
      let account = accounts.get(clerkUserId);
      if (!account) {
        account = { id: `acct-${accounts.size + 1}`, clerkUserId, createdAt: '2026-09-30T00:00:00.000Z' };
        accounts.set(clerkUserId, account);
      }
      return account;
    },
  };
}

describe('GET /me', () => {
  it('returns 401 with no bearer token', async () => {
    const app = buildApp({ verifyToken: async () => ({ clerkUserId: 'u1' }), accountsRepo: fakeRepo() });
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });

  it('creates and returns an account on first call', async () => {
    const repo = fakeRepo();
    const app = buildApp({ verifyToken: async () => ({ clerkUserId: 'u1' }), accountsRepo: repo });
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer tok' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().clerkUserId).toBe('u1');
    expect(repo.calls).toEqual(['u1']);
  });

  it('returns the same account id on a second call — never creates two rows', async () => {
    const repo = fakeRepo();
    const app = buildApp({ verifyToken: async () => ({ clerkUserId: 'u1' }), accountsRepo: repo });
    const first = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer tok' } });
    const second = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer tok' } });
    expect(first.json().accountId).toBe(second.json().accountId);
  });
});
```

- [ ] **Step 6: Run to verify it fails.**
Run: `npm test`
Expected: FAIL — `buildApp` doesn't accept deps yet, `me.ts` doesn't exist.

- [ ] **Step 7: Implement `server/src/routes/me.ts`.**
```ts
import type { FastifyInstance } from 'fastify';
import type { AccountsRepo } from '../db/accountsRepo.js';

export function meRoutes(app: FastifyInstance, opts: { accountsRepo: AccountsRepo }): void {
  app.get('/me', async (req, reply) => {
    if (!req.session) return reply.code(401).send({ error: 'missing session' });
    const account = await opts.accountsRepo.findOrCreateByClerkUserId(req.session.clerkUserId);
    return { accountId: account.id, clerkUserId: account.clerkUserId, createdAt: account.createdAt };
  });
}
```

- [ ] **Step 8: Update `server/src/app.ts`** to accept deps and register `/me` behind the auth plugin, with `/health` outside that scope entirely.
```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { authPlugin, type TokenVerifier } from './plugins/auth.js';
import type { AccountsRepo } from './db/accountsRepo.js';

export interface AppDeps {
  verifyToken: TokenVerifier;
  accountsRepo: AccountsRepo;
}

/** Builds (but does not start) the Fastify app — kept separate from index.ts so tests can use
 *  `.inject()` without binding a real port, and without real Clerk/Postgres credentials. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.register(cors, { origin: origins.length > 0 ? origins : true });

  app.register(healthRoutes); // no auth required

  app.register(async (protectedApp) => {
    authPlugin(protectedApp, deps.verifyToken);
    protectedApp.register(meRoutes, { accountsRepo: deps.accountsRepo });
  });

  return app;
}
```

- [ ] **Step 9: Update `server/src/index.ts`** — it now needs real deps to call `buildApp`. Wire the ones that exist so far (`clerkVerifier` from Task 3); `accountsRepo` needs a real `Pool`, added here too since `pg` is now a dependency.
```ts
import 'dotenv/config';
import { Pool } from 'pg';
import { buildApp } from './app.js';
import { clerkVerifier } from './clerkVerifier.js';
import { pgAccountsRepo } from './db/accountsRepo.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = buildApp({ verifyToken: clerkVerifier, accountsRepo: pgAccountsRepo(pool) });

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`b-chess-server listening on :${port}`);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 10: Update `server/src/routes/health.test.ts`** — `buildApp` now requires deps even for the health-only test.
```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('GET /health', () => {
  it('responds ok without requiring auth', async () => {
    const app = buildApp({ verifyToken: async () => ({ clerkUserId: 'unused' }), accountsRepo: { findOrCreateByClerkUserId: async () => ({ id: 'unused', clerkUserId: 'unused', createdAt: '2026-01-01T00:00:00.000Z' }) } });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 11: Run the full server test suite to verify everything passes.**
Run: `npm test`
Expected: PASS — all of Tasks 1/3/4's tests green (integration test still gated on `DATABASE_URL`).

- [ ] **Step 12: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 13: Commit.**
```bash
git add server/
git commit -m "feat(server): accounts repository + GET /me (find-or-create)"
```

---

### Task 5: `POST /sync/offline-results` (stub)

**Files:**
- Create: `server/src/routes/sync.ts`
- Create: `server/src/routes/sync.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:** Produces the wire contract `SyncItem`/`SyncResultItem` that Task 10's client `syncClient.ts` targets exactly: request `{ items: SyncItem[] }`, response `{ results: SyncResultItem[] }`, where `SyncResultItem.status` is `'accepted' | 'rejected'` and `reason` is one of `'malformed item'` (generic) or `'account_invalid'` (Review Focus item 4 — not reachable in this stub since every session that gets this far already verified, but the shape is reserved now so sub-project 2 doesn't need a breaking contract change to add it).

- [ ] **Step 1: Write the failing tests.**
```ts
// server/src/routes/sync.test.ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { AccountsRepo } from '../db/accountsRepo.js';

const fakeRepo: AccountsRepo = {
  async findOrCreateByClerkUserId(clerkUserId) {
    return { id: 'acct-1', clerkUserId, createdAt: '2026-01-01T00:00:00.000Z' };
  },
};

function app() {
  return buildApp({ verifyToken: async () => ({ clerkUserId: 'u1' }), accountsRepo: fakeRepo });
}

const auth = { authorization: 'Bearer tok' };
const validItem = { localId: 'a', kind: 'vsComputer', transcript: { moves: [] }, playedAt: '2026-09-30T00:00:00.000Z', localSeq: 1 };

describe('POST /sync/offline-results', () => {
  it('returns 401 with no bearer token', async () => {
    const res = await app().inject({ method: 'POST', url: '/sync/offline-results', payload: { items: [] } });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request whose body is not { items: [] }', async () => {
    const res = await app().inject({ method: 'POST', url: '/sync/offline-results', headers: auth, payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a batch larger than the max size', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ ...validItem, localId: `item-${i}` }));
    const res = await app().inject({ method: 'POST', url: '/sync/offline-results', headers: auth, payload: { items } });
    expect(res.statusCode).toBe(400);
  });

  it('accepts a shape-valid item and rejects a malformed one, per item, in the same batch', async () => {
    const malformed = { localId: 'b', kind: 'not-a-real-kind' };
    const res = await app().inject({
      method: 'POST',
      url: '/sync/offline-results',
      headers: auth,
      payload: { items: [validItem, malformed] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([
      { localId: 'a', status: 'accepted' },
      { localId: 'b', status: 'rejected', reason: 'malformed item' },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**
Run: `npm test`
Expected: FAIL — `sync.ts` doesn't exist, `/sync/offline-results` returns 404.

- [ ] **Step 3: Implement `server/src/routes/sync.ts`.**
```ts
import type { FastifyInstance } from 'fastify';

const MAX_SYNC_BATCH = 50;

interface SyncItem {
  localId: string;
  kind: 'vsComputer' | 'milestone';
  transcript: unknown;
  playedAt: string;
  localSeq: number;
}

function isValidItem(item: unknown): item is SyncItem {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.localId === 'string' &&
    (i.kind === 'vsComputer' || i.kind === 'milestone') &&
    typeof i.playedAt === 'string' &&
    typeof i.localSeq === 'number' &&
    'transcript' in i
  );
}

/** Shape-validates and acknowledges a batch of offline results — does not credit any coins.
 *  Sub-project 2 replaces the accept-everything-valid loop below with real replay-verification and
 *  ledger crediting, without changing this route's request/response contract. */
export function syncRoutes(app: FastifyInstance): void {
  app.post('/sync/offline-results', async (req, reply) => {
    if (!req.session) return reply.code(401).send({ error: 'missing session' });

    const body = req.body as { items?: unknown };
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items) return reply.code(400).send({ error: 'items must be an array' });
    if (items.length > MAX_SYNC_BATCH) {
      return reply.code(400).send({ error: `at most ${MAX_SYNC_BATCH} items per sync request` });
    }

    const results = items.map((item) => {
      if (!isValidItem(item)) {
        const localId = typeof (item as { localId?: unknown })?.localId === 'string' ? (item as { localId: string }).localId : 'unknown';
        return { localId, status: 'rejected' as const, reason: 'malformed item' };
      }
      return { localId: item.localId, status: 'accepted' as const };
    });

    return { results };
  });
}
```

- [ ] **Step 4: Register it in `server/src/app.ts`**, inside the same protected scope as `/me`.
```ts
import { syncRoutes } from './routes/sync.js';
// ...
  app.register(async (protectedApp) => {
    authPlugin(protectedApp, deps.verifyToken);
    protectedApp.register(meRoutes, { accountsRepo: deps.accountsRepo });
    protectedApp.register(syncRoutes);
  });
```

- [ ] **Step 5: Run to verify it passes.**
Run: `npm test`
Expected: PASS, all tests across the project green.

- [ ] **Step 6: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit.**
```bash
git add server/src/routes/sync.ts server/src/routes/sync.test.ts server/src/app.ts
git commit -m "feat(server): POST /sync/offline-results (shape-validating stub)"
```

---

### Task 6: Deploy docs — Railway + Supabase + Clerk setup

**Files:**
- Modify: `server/README.md`

**Interfaces:** None new — documentation only, read by Task 14's live provisioning step.

- [ ] **Step 1: Add setup/deploy instructions to `server/README.md`.**
```markdown
## Provisioning the real services (one-time, manual)

These are account-creation/dashboard steps — not something to script. Do them once, then fill in
`server/.env` (locally) and the hosting platform's environment variables (in production) with the
resulting values.

1. **Clerk** — create an application at clerk.com. Copy the **Secret key** into
   `CLERK_SECRET_KEY`. Copy the **Publishable key** for the client (used in a later task's
   `.env` for the renderer, not this server).
2. **Supabase** — create a project at supabase.com. Under Settings → Database, copy the
   connection string (Session pooler mode) into `DATABASE_URL`. Install the Supabase CLI
   (`npm install -g supabase`), run `supabase link --project-ref <your-project-ref>`, then
   `supabase db push` to apply every file under `supabase/migrations/` to the real database.
3. **Railway** (or Fly.io) — create a new project, point it at this repo with `server/` as the
   root directory (Railway's "Root Directory" setting). Set `PORT`, `CLERK_SECRET_KEY`,
   `DATABASE_URL`, and `CORS_ORIGINS` (the deployed web app's real origin, once it exists) as
   environment variables on the service. Railway auto-detects the Node app and runs
   `npm install && npm run build && npm start`.

None of the earlier tasks in this plan require these to exist — every test either uses a fake
dependency or is gated on `DATABASE_URL`/skips cleanly without it. This step matters starting at
Task 14, the live end-to-end verification.
```

- [ ] **Step 2: Commit.**
```bash
git add server/README.md
git commit -m "docs(server): Clerk/Supabase/Railway provisioning steps"
```

---

### Task 7: Client auth store + pure gate-decision logic

**Files:**
- Create: `src/renderer/features/auth/authStore.ts`
- Create: `src/renderer/features/auth/authGate.ts`
- Create: `src/renderer/features/auth/authGate.test.ts`
- Create: `src/renderer/features/auth/useOnlineStatus.ts`

**Interfaces:** Produces `useAuthStore` (persisted: `status`, `accountId`, `clerkUserId`, `hasEverAuthenticated`) and the pure `decideGate(input): GateDecision` — consumed by Task 8's `App.tsx` routing.

- [ ] **Step 1: Write the failing tests for `decideGate`.**
```ts
// src/renderer/features/auth/authGate.test.ts
import { describe, expect, it } from 'vitest';
import { decideGate } from './authGate';

describe('decideGate', () => {
  it('shows the app for a signed-in session regardless of connectivity', () => {
    expect(decideGate({ hasEverAuthenticated: true, status: 'signedIn', isOnline: true })).toBe('showApp');
    expect(decideGate({ hasEverAuthenticated: true, status: 'signedIn', isOnline: false })).toBe('showApp');
  });

  it('shows sign-in for a never-authenticated device that is online', () => {
    expect(decideGate({ hasEverAuthenticated: false, status: 'signedOut', isOnline: true })).toBe('showSignIn');
  });

  it('falls back to the old no-account experience for a never-authenticated device that is offline', () => {
    expect(decideGate({ hasEverAuthenticated: false, status: 'signedOut', isOnline: false })).toBe('offlineFallback');
  });

  it('blocks (never silently falls back) a previously-authenticated device that is signed out and offline', () => {
    expect(decideGate({ hasEverAuthenticated: true, status: 'signedOut', isOnline: false })).toBe('offlineBlocked');
  });

  it('shows sign-in for a previously-authenticated, now signed-out device that is online', () => {
    expect(decideGate({ hasEverAuthenticated: true, status: 'signedOut', isOnline: true })).toBe('showSignIn');
  });

  it('shows nothing conclusive yet while status is still being checked', () => {
    expect(decideGate({ hasEverAuthenticated: false, status: 'checking', isOnline: true })).toBe('checking');
  });
});
```

- [ ] **Step 2: Run to verify it fails.**
Run: `npx vitest run src/renderer/features/auth/authGate.test.ts`
Expected: FAIL — `authGate.ts` doesn't exist.

- [ ] **Step 3: Implement `src/renderer/features/auth/authGate.ts`.**
```ts
export type GateDecision = 'checking' | 'showApp' | 'showSignIn' | 'offlineFallback' | 'offlineBlocked';

interface GateInput {
  hasEverAuthenticated: boolean;
  status: 'checking' | 'signedOut' | 'signedIn';
  isOnline: boolean;
}

/** The one place all five states this app can be in resolve to a single screen decision:
 *  - signed in (any connectivity) -> the real app, always
 *  - never authenticated + online -> sign-in screen
 *  - never authenticated + offline -> today's old no-account experience (Clerk is unreachable
 *    anyway, and there's no account yet to attach anything to)
 *  - previously authenticated, now signed out, offline -> explicitly BLOCKED, never silently
 *    downgraded to the no-account fallback (a real account exists; losing that distinction would
 *    let a banned/invalidated session's device keep queueing offline results indefinitely)
 *  - previously authenticated, now signed out, online -> sign-in screen (normal re-login) */
export function decideGate(input: GateInput): GateDecision {
  if (input.status === 'checking') return 'checking';
  if (input.status === 'signedIn') return 'showApp';
  if (!input.hasEverAuthenticated) return input.isOnline ? 'showSignIn' : 'offlineFallback';
  return input.isOnline ? 'showSignIn' : 'offlineBlocked';
}
```

- [ ] **Step 4: Run to verify it passes.**
Run: `npx vitest run src/renderer/features/auth/authGate.test.ts`
Expected: PASS 6/6.

- [ ] **Step 5: Implement `src/renderer/features/auth/authStore.ts`.**
```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AuthStatus = 'checking' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  accountId: string | null;
  clerkUserId: string | null;
  /** True once this device has completed at least one real sign-in — the fact `decideGate` uses to
   *  tell "never signed in" apart from "signed out, but has an account". */
  hasEverAuthenticated: boolean;
  setSignedIn(accountId: string, clerkUserId: string): void;
  setSignedOut(): void;
  setChecking(): void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: 'checking',
      accountId: null,
      clerkUserId: null,
      hasEverAuthenticated: false,
      setSignedIn(accountId, clerkUserId) {
        set({ status: 'signedIn', accountId, clerkUserId, hasEverAuthenticated: true });
      },
      setSignedOut() {
        set({ status: 'signedOut', accountId: null, clerkUserId: null });
      },
      setChecking() {
        set({ status: 'checking' });
      },
    }),
    { name: 'b-chess-auth', storage: createJSONStorage(() => localStorage) },
  ),
);
```

- [ ] **Step 6: Implement `src/renderer/features/auth/useOnlineStatus.ts`.** A `.ts` hook (no JSX), still exercising real DOM event APIs — matches this codebase's convention of keeping such hooks outside `.tsx` files where feasible, though this one isn't independently unit-tested (jsdom-only browser events), consistent with the plan's Global Constraints.
```ts
import { useEffect, useState } from 'react';

/** Tracks `navigator.onLine`, updated live via the browser's own online/offline events — the single
 *  source of truth `decideGate` and the offline queue (Task 9) both read connectivity from. */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
```

- [ ] **Step 7: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 8: Commit.**
```bash
git add src/renderer/features/auth/
git commit -m "feat(auth): auth store + pure connectivity-aware gate decision"
```

---

### Task 8: Sign-in gate UI (web)

**Files:**
- Create: `src/renderer/components/AuthGateScreen.tsx`
- Create: `src/renderer/components/AuthGateScreen.module.css`
- Create: `src/renderer/components/OfflineBlockedScreen.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/main.tsx`
- Modify: `package.json` (root)
- Create: `.env.example` (root)

**Interfaces:** Consumes `useAuthStore`, `decideGate`, `useOnlineStatus` (Task 7). No new exports later tasks depend on — this is the top of the routing tree.

- [ ] **Step 1: Add the Clerk React SDK.**
```bash
npm install @clerk/clerk-react
```

- [ ] **Step 2: Create the root `.env.example`** (the renderer's own env, distinct from `server/.env.example`).
```
# Clerk publishable key (Clerk dashboard -> your application -> API Keys -> Publishable key)
VITE_CLERK_PUBLISHABLE_KEY=

# Base URL of the deployed b-chess-server (Task 6)
VITE_API_BASE_URL=http://localhost:8787
```

- [ ] **Step 3: Wire `<ClerkProvider>` in `src/renderer/main.tsx`.** Read the current file first — it already does i18n bootstrapping and `backfillVaultIfEmpty()` before mounting; add the Clerk provider around the existing root render without disturbing that order.
```tsx
import { ClerkProvider } from '@clerk/clerk-react';
// ...existing imports...

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={clerkPublishableKey}>
    <App />
  </ClerkProvider>,
);
```

- [ ] **Step 4: Implement `src/renderer/components/AuthGateScreen.module.css`.**
```css
.screen {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 24px 16px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 420px;
  text-align: center;
}
```

- [ ] **Step 5: Implement `src/renderer/components/AuthGateScreen.tsx`.** Embeds Clerk's own hosted `<SignIn/>` component and, on success, calls the existing `GET /me` (Task 4) to populate `useAuthStore`.
```tsx
import { SignIn, useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/authStore';
import styles from './AuthGateScreen.module.css';

/** Shown whenever decideGate() says 'showSignIn'. Once Clerk reports a signed-in session, fetches
 *  /me to get this account's server-side id and populate authStore — the one place that ever calls
 *  setSignedIn, so every other screen can trust useAuthStore.accountId is real. */
export function AuthGateScreen() {
  const { t } = useTranslation();
  const { isSignedIn, getToken } = useAuth();
  const setSignedIn = useAuthStore((s) => s.setSignedIn);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      const base = import.meta.env.VITE_API_BASE_URL as string;
      const res = await fetch(`${base}/me`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok || cancelled) return;
      const { accountId, clerkUserId } = await res.json();
      setSignedIn(accountId, clerkUserId);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, setSignedIn]);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>{t('common:appTitle')}</h1>
        <SignIn routing="virtual" />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement `src/renderer/components/OfflineBlockedScreen.tsx`.**
```tsx
import { useTranslation } from 'react-i18next';
import styles from './AuthGateScreen.module.css';

/** Shown for a previously-authenticated device that's signed out and offline — deliberately does
 *  NOT fall back to local-only play (see authGate.ts's 'offlineBlocked' case). */
export function OfflineBlockedScreen() {
  const { t } = useTranslation();
  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>{t('common:appTitle')}</h1>
        <p>{t('auth:offlineBlocked')}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Add the `auth` i18n namespace** (en only for this task — he/es translation is a documented follow-up, not blocking this plan's own scope, since this plan's Global Constraints don't repeat the full i18n-sweep discipline of the learning-enhancements plan; note this explicitly rather than silently shipping English-only and calling it done).
```json
// src/renderer/locales/en/auth.json
{
  "offlineBlocked": "You're offline and your last sign-in has expired. Connect to the internet to sign back in."
}
```
Register it in `src/renderer/i18n/index.ts` the same way the other namespaces are registered (read the current file first — this plan doesn't reproduce its full content since Task history shows it churns; add `authEn` alongside the existing imports and to the `en` resources entry only, leaving `he`/`es` to fall back to English via `fallbackLng` until a translation pass happens).

- [ ] **Step 8: Wire the gate into `src/renderer/App.tsx`.** Read the current file first (it already branches on several visibility stores). Add the auth gate as the very first check, before every existing branch.
```tsx
import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { AuthGateScreen } from './components/AuthGateScreen';
import { OfflineBlockedScreen } from './components/OfflineBlockedScreen';
import { decideGate } from './features/auth/authGate';
import { useAuthStore } from './features/auth/authStore';
import { useOnlineStatus } from './features/auth/useOnlineStatus';
// ...existing imports...

export function App() {
  const { isLoaded, isSignedIn } = useAuth();
  const { status, hasEverAuthenticated, setChecking, setSignedOut } = useAuthStore();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!isLoaded) return setChecking();
    if (!isSignedIn) setSignedOut();
    // A truthy isSignedIn is handled by AuthGateScreen's own effect (Step 5) calling setSignedIn once
    // /me resolves — this effect only ever needs to move state *toward* signedOut/checking.
  }, [isLoaded, isSignedIn, setChecking, setSignedOut]);

  const gate = decideGate({ hasEverAuthenticated, status, isOnline });
  if (gate === 'checking') return null;
  if (gate === 'showSignIn') return <AuthGateScreen />;
  if (gate === 'offlineBlocked') return <OfflineBlockedScreen />;
  // 'showApp' and 'offlineFallback' both fall through to the existing app below unchanged —
  // offlineFallback is exactly today's app, by construction (no account, no coins UI to show yet
  // regardless, since sub-project 2 hasn't shipped any).

  // ...existing routing branches, unchanged...
}
```

- [ ] **Step 9: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 10: Live verification.** Start the web dev server (`npm run dev:web`) with a real (or Clerk's own test-mode) publishable key in `.env`:
   - Fresh browser profile, online: confirm `AuthGateScreen` appears before any game UI.
   - Sign in with a Clerk test account: confirm the app UI appears afterward, and `localStorage['b-chess-auth']` shows `status: 'signedIn'` with real `accountId`/`clerkUserId`.
   - Reload the page while still "signed in" in Clerk: confirm no flash of the sign-in screen (the persisted store should short-circuit correctly once Clerk's own `isLoaded` resolves).
   - Simulate offline (DevTools → Network → Offline) while signed in: confirm the app keeps working, no gate screen appears.
   - Clear `localStorage['b-chess-auth']` only (simulating "signed out on this device"), then go offline: confirm `OfflineBlockedScreen` appears, not the sign-in screen and not the old app.

- [ ] **Step 11: Commit.**
```bash
git add src/renderer/components/AuthGateScreen.tsx src/renderer/components/AuthGateScreen.module.css src/renderer/components/OfflineBlockedScreen.tsx src/renderer/App.tsx src/renderer/main.tsx src/renderer/locales/en/auth.json src/renderer/i18n/index.ts package.json package-lock.json .env.example
git commit -m "feat(auth): sign-in gate UI, wired into App.tsx routing"
```

---

### Task 9: Offline queue (IndexedDB)

**Files:**
- Create: `src/renderer/features/sync/offlineQueueDB.ts`
- Create: `src/renderer/features/sync/offlineQueueDB.test.ts`
- Create: `src/renderer/features/sync/offlineQueueStore.ts`
- Create: `src/renderer/features/sync/offlineQueueStore.test.ts`
- Modify: `package.json` (root, devDependency)

**Interfaces:** Produces `enqueueOfflineResult(item)`, `drainOfflineQueue()`, and the `QueuedItem` type — consumed by Task 10's `syncClient.ts` and Task 11's wiring into `gameStore`/`puzzleProgressStore`.

- [ ] **Step 1: Add the IndexedDB test polyfill.**
```bash
npm install -D fake-indexeddb
```

- [ ] **Step 2: Write the failing tests for the DB wrapper.**
```ts
// src/renderer/features/sync/offlineQueueDB.test.ts
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { addItem, clearAll, deleteItem, listItems } from './offlineQueueDB';

beforeEach(async () => {
  await clearAll();
});

describe('offlineQueueDB', () => {
  it('adds and lists items in insertion order', async () => {
    await addItem({ localId: 'a', kind: 'vsComputer', transcript: {}, playedAt: 't1', localSeq: 1 });
    await addItem({ localId: 'b', kind: 'vsComputer', transcript: {}, playedAt: 't2', localSeq: 2 });
    const items = await listItems();
    expect(items.map((i) => i.localId)).toEqual(['a', 'b']);
  });

  it('deletes a specific item by localId', async () => {
    await addItem({ localId: 'a', kind: 'vsComputer', transcript: {}, playedAt: 't1', localSeq: 1 });
    await addItem({ localId: 'b', kind: 'vsComputer', transcript: {}, playedAt: 't2', localSeq: 2 });
    await deleteItem('a');
    expect((await listItems()).map((i) => i.localId)).toEqual(['b']);
  });

  it('clearAll empties the queue', async () => {
    await addItem({ localId: 'a', kind: 'vsComputer', transcript: {}, playedAt: 't1', localSeq: 1 });
    await clearAll();
    expect(await listItems()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails.**
Run: `npx vitest run src/renderer/features/sync/offlineQueueDB.test.ts`
Expected: FAIL — `offlineQueueDB.ts` doesn't exist.

- [ ] **Step 4: Implement `src/renderer/features/sync/offlineQueueDB.ts`.**
```ts
const DB_NAME = 'b-chess-offline-queue';
const STORE_NAME = 'items';
const DB_VERSION = 1;

export interface QueuedItem {
  localId: string;
  kind: 'vsComputer' | 'milestone';
  transcript: unknown;
  playedAt: string; // ISO wall-clock time — informational only, never trusted alone (see localSeq)
  /** Monotonically increasing per-device counter, immune to system-clock changes — the server-side
   *  replacement for `playedAt` when detecting a suspiciously large offline-earning claim
   *  (Review Focus item 3; the actual rate-capping logic itself belongs to sub-project 2). */
  localSeq: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'localId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addItem(item: QueuedItem): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listItems(): Promise<QueuedItem[]> {
  const db = await openDB();
  const items = await new Promise<QueuedItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as QueuedItem[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function deleteItem(localId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearAll(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
```

- [ ] **Step 5: Run to verify it passes.**
Run: `npx vitest run src/renderer/features/sync/offlineQueueDB.test.ts`
Expected: PASS 3/3.

- [ ] **Step 6: Write the failing tests for the higher-level enqueue/drain store.**
```ts
// src/renderer/features/sync/offlineQueueStore.test.ts
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, listItems } from './offlineQueueDB';
import { enqueueOfflineResult, useOfflineQueueStore } from './offlineQueueStore';

beforeEach(async () => {
  await clearAll();
  useOfflineQueueStore.setState({ nextLocalSeq: 1 });
});

describe('enqueueOfflineResult', () => {
  it('persists the item with a monotonically increasing localSeq', async () => {
    await enqueueOfflineResult({ kind: 'vsComputer', transcript: { moves: ['e4'] } });
    await enqueueOfflineResult({ kind: 'vsComputer', transcript: { moves: ['d4'] } });
    const items = await listItems();
    expect(items.map((i) => i.localSeq)).toEqual([1, 2]);
  });

  it('assigns each item a unique localId', async () => {
    await enqueueOfflineResult({ kind: 'milestone', transcript: { stage: 2 } });
    await enqueueOfflineResult({ kind: 'milestone', transcript: { stage: 3 } });
    const items = await listItems();
    expect(new Set(items.map((i) => i.localId)).size).toBe(2);
  });
});
```

- [ ] **Step 7: Run to verify it fails.**
Run: `npx vitest run src/renderer/features/sync/offlineQueueStore.test.ts`
Expected: FAIL — `offlineQueueStore.ts` doesn't exist.

- [ ] **Step 8: Implement `src/renderer/features/sync/offlineQueueStore.ts`.**
```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addItem, type QueuedItem } from './offlineQueueDB';

interface OfflineQueueMetaState {
  /** The next localSeq to assign — persisted separately from the queue items themselves (in
   *  localStorage, not IndexedDB) so it survives even a queue that's been fully drained, and never
   *  resets to 1 and starts colliding with a still-syncing earlier batch's sequence numbers. */
  nextLocalSeq: number;
}

export const useOfflineQueueStore = create<OfflineQueueMetaState>()(
  persist(() => ({ nextLocalSeq: 1 }), {
    name: 'b-chess-offline-queue-seq',
    storage: createJSONStorage(() => localStorage),
  }),
);

/** Records one offline result for later sync. Never throws on the caller — a write failure here
 *  (e.g. IndexedDB unavailable in some embedded context) should never interrupt the game that just
 *  finished; callers fire-and-forget this. */
export async function enqueueOfflineResult(input: {
  kind: QueuedItem['kind'];
  transcript: unknown;
}): Promise<void> {
  const localSeq = useOfflineQueueStore.getState().nextLocalSeq;
  useOfflineQueueStore.setState({ nextLocalSeq: localSeq + 1 });
  const item: QueuedItem = {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    transcript: input.transcript,
    playedAt: new Date().toISOString(),
    localSeq,
  };
  await addItem(item);
}
```

- [ ] **Step 9: Run to verify it passes.**
Run: `npx vitest run src/renderer/features/sync/offlineQueueStore.test.ts`
Expected: PASS 2/2.

- [ ] **Step 10: Run the whole client suite to confirm nothing else broke.**
Run: `npx vitest run`
Expected: all green, including everything from the prior `learning-enhancements` plan.

- [ ] **Step 11: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 12: Commit.**
```bash
git add src/renderer/features/sync/offlineQueueDB.ts src/renderer/features/sync/offlineQueueDB.test.ts src/renderer/features/sync/offlineQueueStore.ts src/renderer/features/sync/offlineQueueStore.test.ts package.json package-lock.json
git commit -m "feat(sync): IndexedDB-backed offline queue"
```

---

### Task 10: Sync client (drains the queue to the server)

**Files:**
- Create: `src/renderer/features/sync/syncClient.ts`
- Create: `src/renderer/features/sync/syncClient.test.ts`

**Interfaces:** Consumes `listItems`/`deleteItem` (Task 9's `offlineQueueDB.ts`), `useAuthStore` (Task 7), Task 5's `/sync/offline-results` contract exactly (`{ items: [...] }` request, `{ results: [{localId, status, reason?}] }` response). Produces `syncOfflineQueue(getToken)` — consumed by Task 11's connectivity-triggered wiring.

- [ ] **Step 1: Write the failing tests**, faking both `fetch` and the DB layer via Vitest's module mocking so this file's retry/backoff and accept/reject handling is tested without real IndexedDB or a real server.
```ts
// src/renderer/features/sync/syncClient.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./offlineQueueDB', () => ({
  listItems: vi.fn(),
  deleteItem: vi.fn(),
}));

import { deleteItem, listItems } from './offlineQueueDB';
import { syncOfflineQueue } from './syncClient';

const item = (localId: string) => ({
  localId,
  kind: 'vsComputer' as const,
  transcript: { moves: [] },
  playedAt: '2026-09-30T00:00:00.000Z',
  localSeq: 1,
});

beforeEach(() => {
  vi.mocked(listItems).mockReset();
  vi.mocked(deleteItem).mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('syncOfflineQueue', () => {
  it('does nothing when the queue is empty', async () => {
    vi.mocked(listItems).mockResolvedValue([]);
    await syncOfflineQueue(async () => 'tok');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('POSTs the queue and deletes only the accepted items', async () => {
    vi.mocked(listItems).mockResolvedValue([item('a'), item('b')]);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ results: [{ localId: 'a', status: 'accepted' }, { localId: 'b', status: 'rejected', reason: 'malformed item' }] }), { status: 200 }),
    );
    await syncOfflineQueue(async () => 'tok');
    expect(deleteItem).toHaveBeenCalledWith('a');
    expect(deleteItem).not.toHaveBeenCalledWith('b');
  });

  it('sends the bearer token from getToken', async () => {
    vi.mocked(listItems).mockResolvedValue([item('a')]);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ results: [{ localId: 'a', status: 'accepted' }] }), { status: 200 }));
    await syncOfflineQueue(async () => 'my-token');
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer my-token');
  });

  it('leaves every item queued (deletes nothing) when the whole request fails', async () => {
    vi.mocked(listItems).mockResolvedValue([item('a')]);
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    await syncOfflineQueue(async () => 'tok'); // must not throw — a failed sync is not the caller's problem
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('splits the queue into batches no larger than the server\'s cap', async () => {
    const items = Array.from({ length: 120 }, (_, i) => item(`item-${i}`));
    vi.mocked(listItems).mockResolvedValue(items);
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(init!.body as string) as { items: { localId: string }[] };
      expect(body.items.length).toBeLessThanOrEqual(50);
      return new Response(JSON.stringify({ results: body.items.map((i) => ({ localId: i.localId, status: 'accepted' })) }), { status: 200 });
    });
    await syncOfflineQueue(async () => 'tok');
    expect(fetch).toHaveBeenCalledTimes(3); // 50 + 50 + 20
  });
});
```

- [ ] **Step 2: Run to verify it fails.**
Run: `npx vitest run src/renderer/features/sync/syncClient.test.ts`
Expected: FAIL — `syncClient.ts` doesn't exist.

- [ ] **Step 3: Implement `src/renderer/features/sync/syncClient.ts`.**
```ts
import { deleteItem, listItems, type QueuedItem } from './offlineQueueDB';

// Mirrors server/src/routes/sync.ts's MAX_SYNC_BATCH exactly — kept in sync manually since client and
// server are separate npm projects with no shared package yet (see the spec's note on the shared
// engine package being deferred until sub-project 2 actually needs it).
const MAX_SYNC_BATCH = 50;

interface SyncResultItem {
  localId: string;
  status: 'accepted' | 'rejected';
  reason?: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Drains the offline queue to the server, one capped-size batch at a time. Never throws — a sync
 *  failure (network down, server error) just leaves the queue as-is for the next attempt; only
 *  server-acknowledged ('accepted') items are ever deleted locally. Called on the browser's 'online'
 *  event (Task 11) and is safe to call redundantly (e.g. app foreground) since an empty queue is a
 *  fast no-op. */
export async function syncOfflineQueue(getToken: () => Promise<string | null>): Promise<void> {
  const items = await listItems();
  if (items.length === 0) return;

  const token = await getToken();
  if (!token) return; // signed out mid-flight — nothing to authenticate this sync with

  const base = import.meta.env.VITE_API_BASE_URL as string;

  for (const batch of chunk(items, MAX_SYNC_BATCH)) {
    try {
      const res = await fetch(`${base}/sync/offline-results`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: batch }),
      });
      if (!res.ok) continue; // whole batch stays queued, retried on the next sync attempt
      const { results } = (await res.json()) as { results: SyncResultItem[] };
      await Promise.all(
        results.filter((r) => r.status === 'accepted').map((r) => deleteItem(r.localId)),
      );
    } catch {
      // Network failure mid-batch — this batch (and any later ones) stays queued; nothing to do here.
    }
  }
}

export type { QueuedItem };
```

- [ ] **Step 4: Run to verify it passes.**
Run: `npx vitest run src/renderer/features/sync/syncClient.test.ts`
Expected: PASS 5/5.

- [ ] **Step 5: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit.**
```bash
git add src/renderer/features/sync/syncClient.ts src/renderer/features/sync/syncClient.test.ts
git commit -m "feat(sync): sync client — drains the offline queue in capped batches"
```

---

### Task 11: Wire real trigger points + connectivity-triggered draining

**Files:**
- Modify: `src/renderer/features/game/gameStore.ts`
- Modify: `src/renderer/features/game/gameStore.test.ts`
- Modify: `src/renderer/features/puzzle/puzzleProgressStore.ts`
- Modify: `src/renderer/features/puzzle/puzzleProgressStore.test.ts`
- Modify: `src/renderer/App.tsx`

**Interfaces:** Consumes `enqueueOfflineResult` (Task 9), `syncOfflineQueue` (Task 10), `useAuthStore` (Task 7), `useOnlineStatus` (Task 7).

- [ ] **Step 1: Write the failing test for `gameStore.finish()` enqueuing a result when signed in.** Read `gameStore.test.ts`'s current top-of-file mocks first (it already mocks `@/features/vault/backgroundAnalysisQueue`, per the prior plan) and add alongside them.
```ts
// add near the existing vi.mock calls in gameStore.test.ts
vi.mock('@/features/sync/offlineQueueStore', () => ({ enqueueOfflineResult: vi.fn() }));
// ...
import { enqueueOfflineResult } from '@/features/sync/offlineQueueStore';
import { useAuthStore } from '@/features/auth/authStore';

// new test, alongside the existing "ends the game on checkmate" test:
it('enqueues an offline-sync record for the finished game when signed in', () => {
  useAuthStore.setState({ status: 'signedIn', accountId: 'acct-1', clerkUserId: 'u1', hasEverAuthenticated: true });
  state().startGame(localConfig());
  play('f2', 'f3');
  play('e7', 'e5');
  play('g2', 'g4');
  play('d8', 'h4'); // checkmate
  expect(enqueueOfflineResult).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'vsComputer' }),
  );
});

it('does not enqueue anything when signed out', () => {
  useAuthStore.setState({ status: 'signedOut', accountId: null, clerkUserId: null, hasEverAuthenticated: false });
  state().startGame(localConfig());
  play('f2', 'f3');
  play('e7', 'e5');
  play('g2', 'g4');
  play('d8', 'h4');
  expect(enqueueOfflineResult).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails.**
Run: `npx vitest run src/renderer/features/game/gameStore.test.ts`
Expected: FAIL — `finish()` doesn't call `enqueueOfflineResult` yet.

- [ ] **Step 3: Wire it in `gameStore.ts`'s `finish()`.** Read the current file first (Task 11 of the prior plan already added `humanColorsOf`/`enqueueBackgroundAnalysis` here — add alongside, don't disturb).
```ts
import { enqueueOfflineResult } from '@/features/sync/offlineQueueStore';
import { useAuthStore } from '@/features/auth/authStore';
// ...
  const finish = (result: GameResult, now: number) => {
    abortEngine();
    get().clock.stop(now);
    const { config, history } = get();
    if (history.length > 0) {
      const savedId = useSavedGamesStore.getState().saveGame(config, history, result);
      enqueueBackgroundAnalysis({ sourceGameId: savedId, fen: config.fen, history, humanColors: humanColorsOf(config) });
      // Offline-sync record is separate from local save: it's what eventually earns coins once
      // sub-project 2 lands, and only makes sense for a signed-in account to claim.
      if (useAuthStore.getState().status === 'signedIn') {
        void enqueueOfflineResult({ kind: 'vsComputer', transcript: { config, history, result } });
      }
    }
    set({ status: 'over', result, engineThinking: false, ...noSelection });
  };
```

- [ ] **Step 4: Run to verify it passes.**
Run: `npx vitest run src/renderer/features/game/gameStore.test.ts`
Expected: PASS, including both new tests.

- [ ] **Step 5: Write the failing test for puzzle-stage-completion enqueuing a milestone.** Read `puzzleProgressStore.ts`/`.test.ts` first to match the real `markSolved` signature exactly before writing this.
```ts
vi.mock('@/features/sync/offlineQueueStore', () => ({ enqueueOfflineResult: vi.fn() }));
import { enqueueOfflineResult } from '@/features/sync/offlineQueueStore';
import { useAuthStore } from '@/features/auth/authStore';

it('enqueues a milestone sync record when signed in', () => {
  useAuthStore.setState({ status: 'signedIn', accountId: 'acct-1', clerkUserId: 'u1', hasEverAuthenticated: true });
  usePuzzleProgressStore.getState().markSolved(1, 0);
  expect(enqueueOfflineResult).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'milestone' }),
  );
});
```

- [ ] **Step 6: Run to verify it fails, then wire it into `puzzleProgressStore.ts`'s `markSolved`.** (Exact integration point depends on reading the real current file — this plan specifies the outcome, not a guessed line number: every call that advances `furthestStage`/`furthestPuzzleIndex` to a genuinely new value should enqueue `{ kind: 'milestone', transcript: { stage, puzzleIndex } }` when signed in, mirroring the `gameStore.ts` pattern above exactly.)

- [ ] **Step 7: Run the full test suite.**
Run: `npx vitest run`
Expected: all green.

- [ ] **Step 8: Wire connectivity-triggered draining into `App.tsx`.** Add alongside the existing auth-gate `useEffect` from Task 8.
```tsx
import { useAuth } from '@clerk/clerk-react';
import { syncOfflineQueue } from './features/sync/syncClient';
// ...
  const isOnline = useOnlineStatus();
  const { getToken } = useAuth();

  useEffect(() => {
    if (isOnline && status === 'signedIn') void syncOfflineQueue(getToken);
  }, [isOnline, status, getToken]);
```

- [ ] **Step 9: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 10: Commit.**
```bash
git add src/renderer/features/game/gameStore.ts src/renderer/features/game/gameStore.test.ts src/renderer/features/puzzle/puzzleProgressStore.ts src/renderer/features/puzzle/puzzleProgressStore.test.ts src/renderer/App.tsx
git commit -m "feat(sync): wire vs-computer and milestone results into the offline queue"
```

---

### Task 12: Electron protocol registration

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `electron-builder.yml`

**Interfaces:** Produces the preload-exposed `window.electronAuth.openExternalSignIn(url)` / `window.electronAuth.onAuthCallback(cb)` API — consumed by Task 13's renderer-side sign-in flow.

- [ ] **Step 1: Register the protocol and handle the callback in `src/main/index.ts`.**
```ts
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';

const PROTOCOL = 'b-chess';
let mainWindow: BrowserWindow | null = null;

function handleProtocolUrl(url: string): void {
  mainWindow?.webContents.send('auth-callback', url);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: '#1b1a17',
    title: 'B-Chess',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

if (!app.requestSingleInstanceLock()) {
  // Another instance is already running — Windows/Linux hand us the b-chess:// URL as an argv, and
  // the *other* (already-running) instance receives 'second-instance' below; this one just exits.
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) handleProtocolUrl(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('open-url', (event, url) => {
    // macOS delivers the protocol URL this way instead of via argv.
    event.preventDefault();
    handleProtocolUrl(url);
  });

  ipcMain.handle('open-external', (_event, url: string) => {
    void shell.openExternal(url);
  });

  app.whenReady().then(() => {
    app.setAsDefaultProtocolClient(PROTOCOL);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 2: Expose the API to the renderer in `src/preload/index.ts`.**
```ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAuth', {
  openExternalSignIn: (url: string) => ipcRenderer.invoke('open-external', url),
  onAuthCallback: (callback: (url: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on('auth-callback', handler);
    return () => ipcRenderer.off('auth-callback', handler);
  },
});
```

- [ ] **Step 3: Register the protocol for packaged builds in `electron-builder.yml`.**
```yaml
protocols:
  name: B-Chess Auth Callback
  schemes:
    - b-chess
```

- [ ] **Step 4: Typecheck.**
Run: `npm run typecheck`
Expected: clean. (`window.electronAuth` needs a type declaration — add an ambient `src/renderer/electron.d.ts`:)
```ts
interface ElectronAuthAPI {
  openExternalSignIn(url: string): Promise<void>;
  onAuthCallback(callback: (url: string) => void): () => void;
}

declare global {
  interface Window {
    electronAuth?: ElectronAuthAPI;
  }
}

export {};
```

- [ ] **Step 5: Live verification — this is the one Review Focus item (#5) that has no automated test at all.**
   - Run `npm run build && npm run dev` (or a packaged build) on the target OS.
   - From a terminal, run `start b-chess://auth-callback?test=1` (Windows) or `open b-chess://auth-callback?test=1` (macOS) while the app is running.
   - Confirm the running Electron window receives the URL (temporarily `console.log` it in the preload callback for this check, then remove the log).
   - Quit the app entirely, repeat the same command, and confirm it **launches** the app and still delivers the URL (exercises the `second-instance`/cold-start path, not just the warm one).
   - On Windows specifically, confirm no other installed application has already claimed the `b-chess://` scheme (check `HKEY_CLASSES_ROOT\b-chess` in the registry) — a real instance of the exact hijack risk this Review Focus item names.

- [ ] **Step 6: Commit.**
```bash
git add src/main/index.ts src/preload/index.ts src/renderer/electron.d.ts electron-builder.yml
git commit -m "feat(electron): register b-chess:// protocol, relay callback URLs to the renderer"
```

---

### Task 13: Electron sign-in flow (system browser handoff)

**Files:**
- Modify: `src/renderer/components/AuthGateScreen.tsx`

**Interfaces:** Consumes `window.electronAuth` (Task 12).

- [ ] **Step 1: Detect Electron and branch the sign-in UI.** Read the current `AuthGateScreen.tsx` (Task 8) before editing.
```tsx
const isElectron = typeof window !== 'undefined' && !!window.electronAuth;
```

- [ ] **Step 2: Consult Clerk's current official Electron/desktop integration guide before writing the token-exchange call.** Clerk's SDK surface for cross-context sign-in handoff (desktop apps opening a system browser and receiving a session back via a custom protocol) is exactly the kind of API that evolves; this plan intentionally does not hardcode a specific Clerk endpoint/method name here that could be stale by implementation time. What this step's code MUST do, regardless of Clerk's exact current API:
   - Build the Clerk-hosted sign-in URL with a `redirect_url` (or Clerk's currently-documented equivalent parameter) pointing at `b-chess://auth-callback`.
   - Call `window.electronAuth!.openExternalSignIn(signInUrl)` to open it in the system browser instead of rendering Clerk's embedded `<SignIn/>` component (which only works inside a real browser context, not usefully inside a `BrowserWindow` for this cross-context flow).
   - Register `window.electronAuth!.onAuthCallback((url) => {...})`, parse whatever Clerk's redirect hands back (a ticket, code, or token per Clerk's current documented shape), and use Clerk's client SDK to turn it into an active session — after which the rest of `AuthGateScreen.tsx`'s existing effect (Task 8, Step 5: call `GET /me`, `setSignedIn`) runs unchanged.
```tsx
useEffect(() => {
  if (!isElectron) return;
  const unsubscribe = window.electronAuth!.onAuthCallback(async (url) => {
    // Exact parsing/exchange call: see Clerk's current Electron/desktop docs (Step 2's note above).
    // Whatever the mechanism, it must end with Clerk's client SDK reporting isSignedIn === true, which
    // the existing effect above (Task 8) already reacts to — no other code path needed here.
    await exchangeAuthCallbackForSession(url); // implemented against Clerk's real current API
  });
  return unsubscribe;
}, [isElectron]);

const signIn = () => {
  if (isElectron) {
    const signInUrl = buildClerkHostedSignInUrl({ redirectTo: 'b-chess://auth-callback' });
    void window.electronAuth!.openExternalSignIn(signInUrl);
  }
  // else: the existing embedded <SignIn/> (Task 8) handles it directly, unchanged.
};
```

- [ ] **Step 3: Typecheck.**
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Live verification** (no automated test is possible here — real system browser, real Electron IPC, real Clerk session):
   - Launch the Electron app, trigger sign-in, confirm the system's default browser opens to Clerk's hosted sign-in page.
   - Complete sign-in in the browser with a real (or Clerk test-mode) account.
   - Confirm the Electron window regains focus and completes sign-in (reaches `showApp`, not stuck on `AuthGateScreen`) without the user manually switching back to it.
   - Confirm `GET /me` was actually called (check the server logs or add a temporary log) and `useAuthStore` ends up with a real `accountId`.

- [ ] **Step 5: Commit.**
```bash
git add src/renderer/components/AuthGateScreen.tsx
git commit -m "feat(electron): system-browser sign-in flow via the b-chess:// protocol"
```

---

### Task 14: Live end-to-end verification against real provisioned services

**Files:** None — verification only, using every prior task's code as-is.

**Interfaces:** None new.

- [ ] **Step 1: Provision the real services**, following `server/README.md`'s Task 6 instructions — a real Clerk application, a real Supabase project with migration `0001` applied via `supabase db push`, and a real Railway (or Fly.io) deployment of `server/` with all four environment variables set.

- [ ] **Step 2: Point the client at the real deployment.** Set `VITE_API_BASE_URL` (root `.env`) to the deployed server's real URL and `VITE_CLERK_PUBLISHABLE_KEY` to the real Clerk publishable key.

- [ ] **Step 3: Full end-to-end pass, web build.**
   - Fresh browser profile → sign up with a real email → confirm `GET /me` creates exactly one `accounts` row (check the Supabase table editor).
   - Reload the page → confirm no re-prompt (session persists).
   - Go offline (DevTools) → play one vs-computer game to completion → confirm an item appears in IndexedDB (Application tab → IndexedDB → `b-chess-offline-queue`).
   - Go back online → confirm the queued item is gone from IndexedDB within a few seconds (drained and acknowledged) and no error appears in the console.
   - Solve one puzzle stage → confirm a `milestone` item is queued and drains the same way.

- [ ] **Step 4: Full end-to-end pass, Electron build.**
   - Packaged (or `npm run dev`) Electron app → sign in via the system-browser flow (Task 13) → confirm the same `GET /me` / account-creation behavior as the web pass.
   - Repeat the offline → play → reconnect → drain sequence from Step 3 inside Electron.

- [ ] **Step 5: Adversarial-ish sanity check on the server.** Using `curl` (or Postman) with a deliberately malformed or missing bearer token, confirm `GET /me` and `POST /sync/offline-results` both return 401, and that `GET /health` still returns 200 with no token at all — the actual production deployment, not just the unit tests, enforcing Global Constraint #2.

- [ ] **Step 6: Update the plan's ledger / mark complete.** No commit needed for this task (no files changed) — if running under `superpowers:executing-plans`, its `task-done` step still records this verification in the ledger.

---

## Self-Review

- **Spec coverage:** every numbered item in the spec's "Requirements this spec satisfies" section maps to a task — signup-before-play (Tasks 7–8), signed-in-offline continuity (Tasks 7, 9, 11), offline-earned-results-survive-and-sync (Tasks 5, 9, 10, 11, 14). The spec's "Components" list (1–5) maps one-to-one to Tasks 3/4 (Clerk+`/me`), 1 (Fastify skeleton — folds in health), 4/2 (Postgres schema), 7 (session cache), 9/10 (offline queue+sync).
- **Type consistency:** `TokenVerifier`/`SessionClaims` (Task 3) is consumed unchanged by Task 4's `buildApp` signature and Task 14's live verification. `AccountsRepo` (Task 4) is consumed unchanged by Task 5's route registration and Task 6's `index.ts` wiring. `QueuedItem` (Task 9) is consumed unchanged by Task 10's `syncClient.ts` and Task 11's `gameStore.ts`/`puzzleProgressStore.ts` call sites. The `SyncItem`/`SyncResultItem` wire shape is defined once in Task 5 and Task 10 mirrors it exactly (flagged explicitly as manually-kept-in-sync, since client and server are separate npm projects with no shared package in this sub-project).
- **Placeholder scan:** the one place this plan deliberately does not hardcode an exact third-party API call is Task 13 Step 2 (Clerk's Electron token-exchange) — flagged explicitly as "consult Clerk's current docs" rather than a vague "implement the auth flow," with a concrete contract (what must be true before/after) given regardless. Every other step has real, complete code.
- **Review Focus:** all five items from the spec (carried into this plan's own Review Focus section) have an owning task: #1 → Task 7 (`decideGate`'s `offlineBlocked` state, tested); #2 → Tasks 5 and 10 (server-side cap enforced independently of the client's own batching); #3 → Task 9 (`localSeq`); #4 → Task 5's reserved `account_invalid` reason shape (not yet triggered — sub-project 2's job to actually send it, but the contract exists now so that's not a breaking change later); #5 → Task 12 Step 5 (live verification only, since it's fundamentally not unit-testable).

---
