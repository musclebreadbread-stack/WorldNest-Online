-- WorldNest Online - ready-to-use test accounts
--
-- ############################################################################
-- #  DEVELOPMENT ONLY. NEVER RUN THIS AGAINST A PRODUCTION PROJECT.          #
-- #  It writes fake `auth.users` rows with a published, shared password.     #
-- #  Anyone who knows this file can sign in to any project it has been run   #
-- #  on. It exists so a maintainer can test the game without hand-creating   #
-- #  accounts, and for nothing else.                                         #
-- ############################################################################
--
-- Run AFTER `migrations/002_gameplay_schema.sql`: the accounts below rely on the
-- `handle_new_user` trigger that `002` installs to create their `profiles` and
-- `player_state` rows. This script deliberately does not insert those itself, so
-- the seed is also a live test of the trigger.
--
-- Paste the whole file into the Supabase SQL Editor and run it. It creates:
--
--   | email                  | password     | username |
--   |------------------------|--------------|----------|
--   | tester1@worldnest.test | worldnest123 | Tester1  |
--   | tester2@worldnest.test | worldnest123 | Tester2  |
--   | tester3@worldnest.test | worldnest123 | Tester3  |
--
-- `email_confirmed_at` is set, so there is no confirmation mail step and the
-- accounts can sign in immediately. Every statement is `on conflict do nothing`,
-- so re-running the file is safe and changes nothing.

-- `crypt()` and `gen_salt()` come from pgcrypto, which Supabase preinstalls in
-- the `extensions` schema. The guard is for a plain Postgres, where it is not
-- installed by default; it is a no-op when the extension already exists.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- The ids are fixed rather than generated so re-running conflicts on the
-- primary key instead of creating a second set of testers.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  account.id,
  'authenticated',
  'authenticated',
  account.email,
  crypt('worldnest123', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('username', account.username),
  now(),
  now()
from (
  values
    ('11111111-2222-4333-8444-555555550001'::uuid, 'tester1@worldnest.test', 'Tester1'),
    ('11111111-2222-4333-8444-555555550002'::uuid, 'tester2@worldnest.test', 'Tester2'),
    ('11111111-2222-4333-8444-555555550003'::uuid, 'tester3@worldnest.test', 'Tester3')
) as account (id, email, username)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Identities
-- ---------------------------------------------------------------------------
-- Newer GoTrue refuses an email sign-in for a user with no matching identity
-- row, so an account without this is created but cannot log in. Derived from
-- auth.users rather than repeated, so the two can never disagree.
insert into auth.identities (
  user_id,
  provider,
  provider_id,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  users.id,
  'email',
  users.email,
  jsonb_build_object(
    'sub', users.id::text,
    'email', users.email,
    'email_verified', true,
    'phone_verified', false
  ),
  null,
  now(),
  now()
from auth.users as users
where users.email in (
  'tester1@worldnest.test',
  'tester2@worldnest.test',
  'tester3@worldnest.test'
)
on conflict (provider, provider_id) do nothing;

-- ---------------------------------------------------------------------------
-- Cleanup (uncomment to remove the test accounts)
-- ---------------------------------------------------------------------------
-- Deleting the auth.users rows is enough: auth.identities, profiles,
-- player_state, player_quests, structures, crops and chat_messages all cascade
-- from it. Everything these accounts built in the shared world goes with them.
--
-- delete from auth.users
-- where email in (
--   'tester1@worldnest.test',
--   'tester2@worldnest.test',
--   'tester3@worldnest.test'
-- );
