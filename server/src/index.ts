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
