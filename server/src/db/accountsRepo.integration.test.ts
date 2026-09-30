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
