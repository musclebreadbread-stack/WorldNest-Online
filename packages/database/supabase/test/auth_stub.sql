-- WorldNest Online - auth schema test double
--
-- TEST DOUBLE. Do not run this against a Supabase project: Supabase already has
-- the roles, the `auth` schema and the extensions this file creates, and GoTrue
-- owns `auth.users` for real.
--
-- Purpose: let `scripts/verify-sql.sh` apply the numbered migrations and the
-- test-account seed to a plain `postgres:16-alpine` container. The migrations
-- reference three things a bare Postgres does not have:
--
--   1. the `anon` / `authenticated` / `service_role` roles - `002`'s
--      `create policy ... to authenticated` fails with
--      `role "authenticated" does not exist` without them;
--   2. `auth.users`, which `profiles.id` references and the provisioning
--      trigger fires on, plus `auth.identities`, which the seed writes;
--   3. `auth.uid()` and `auth.role()`, which every RLS policy calls.
--
-- It reproduces only the columns the migrations and the seed actually touch, so
-- column defaults and constraints are approximations of GoTrue's schema rather
-- than a copy of it.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- Supabase keeps extensions in their own schema and puts it on the postgres
-- role's search path, which is why the seed can call `crypt()` and `gen_salt()`
-- unqualified in the SQL Editor. Mirror that here so the seed is verified the
-- way a maintainer will actually run it.
create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
alter role postgres set search_path = "$user", public, extensions;

-- ---------------------------------------------------------------------------
-- auth schema
-- ---------------------------------------------------------------------------
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Only the columns the migrations and the seed touch. GoTrue's real table has
-- roughly thirty more (phone, MFA, SSO and token bookkeeping).
create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255) unique,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  is_super_admin boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Newer GoTrue requires an identity row before it will accept an email
-- sign-in, which is why the seed writes one. The unique key on
-- (provider, provider_id) is what makes the seed's `on conflict do nothing`
-- idempotent.
create table if not exists auth.identities (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  provider_id text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (provider, provider_id)
);

-- ---------------------------------------------------------------------------
-- auth helper functions
-- ---------------------------------------------------------------------------
-- Supabase derives both from the request's JWT claims. The stub reads the same
-- settings, so a policy can be exercised by setting `request.jwt.claim.sub`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;

create or replace function auth.email()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.email', true), '');
$$;
