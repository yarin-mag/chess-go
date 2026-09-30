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
