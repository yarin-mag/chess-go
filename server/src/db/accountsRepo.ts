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
