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

## Local test database (for integration tests)

A few tests in this project talk to a real Postgres and are skipped automatically unless
`DATABASE_URL` is set. To run them locally:

    docker run --name bchess-test-db -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d postgres:16
    psql postgresql://postgres:postgres@localhost:5433/postgres -f ../supabase/migrations/0001_accounts.sql
    export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
    npm test

Production schema changes go through the same migration files, applied to the real Supabase
project via the Supabase CLI (`supabase db push`) — see the provisioning notes below.

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

See `docs/superpowers/specs/2026-09-30-backend-foundation-design.md` for the design this implements.
