import 'dotenv/config';
import { Pool } from 'pg';
import { buildApp } from './app.js';
import { clerkVerifier } from './clerkVerifier.js';
import { pgAccountsRepo } from './db/accountsRepo.js';
import { validateRequiredEnv } from './validateEnv.js';

// Fails fast and loudly here rather than letting a missing CLERK_SECRET_KEY surface only as a generic
// 401 on the first real request (Important finding, final whole-branch review).
validateRequiredEnv(process.env);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = buildApp({ verifyToken: clerkVerifier, accountsRepo: pgAccountsRepo(pool) });

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`b-chess-server listening on :${port}`);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
