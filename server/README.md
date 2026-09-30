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
