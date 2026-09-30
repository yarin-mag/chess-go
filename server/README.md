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

See `docs/superpowers/specs/2026-09-30-backend-foundation-design.md` for the design this implements.
