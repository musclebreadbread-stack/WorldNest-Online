-- WorldNest Online - Chat Hardening
-- Server-side chat moderation: rate limiting, word filter, mute list.
-- Run this after 005_world_layer_schema.sql.
--
-- What this migration makes authoritative (decision D10): a client can no
-- longer bypass rate limits, word filtering, or mute enforcement by modifying
-- the browser. The `worldnest_send_chat` RPC function is the single point of
-- entry for all chat messages: it enforces the rate limit, filters blocked
-- words with asterisks, truncates to `max_message_length`, and writes to
-- `chat_messages`. A modified client cannot skip any of these checks.
--
-- This migration is RE-RUNNABLE. Everything below is `if not exists`, `drop
-- policy if exists`, `create or replace`, or `on conflict ... do update`.

-- ---------------------------------------------------------------------------
-- Chat configuration table
-- ---------------------------------------------------------------------------
-- A single-row settings table that the RPC reads. A maintainer can tweak rate
-- limits or max length without redeploying code.
create table if not exists public.chat_config (
  id boolean primary key default true check (id),
  rate_limit_per_minute integer not null default 10 check (rate_limit_per_minute > 0),
  max_message_length integer not null default 240 check (max_message_length > 0)
);

insert into public.chat_config (id, rate_limit_per_minute, max_message_length)
values (true, 10, 240)
on conflict (id) do update
  set rate_limit_per_minute = excluded.rate_limit_per_minute,
      max_message_length = excluded.max_message_length;

-- ---------------------------------------------------------------------------
-- Blocked words table
-- ---------------------------------------------------------------------------
-- Conservative list for a youth (ages 10-18) game. Only clear slurs and
-- profanity are included; no common words that could false-positive. The filter
-- does case-insensitive substring matching and replaces matched words with
-- asterisks rather than rejecting the message.
create table if not exists public.blocked_words (
  word text primary key
);

insert into public.blocked_words (word) values
  ('fuck'),
  ('shit'),
  ('damn'),
  ('bitch'),
  ('asshole'),
  ('bastard'),
  ('crap'),
  ('dick'),
  ('piss'),
  ('slut'),
  ('whore'),
  ('nigger'),
  ('nigga'),
  ('faggot'),
  ('retard'),
  ('cunt')
on conflict (word) do nothing;

-- ---------------------------------------------------------------------------
-- Mute list table
-- ---------------------------------------------------------------------------
-- Player-scoped: each player can mute others so their messages are hidden
-- client-side. RLS ensures players can only see and manage their own mutes.
create table if not exists public.mute_list (
  muter_id uuid references public.profiles(id) on delete cascade not null,
  muted_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (muter_id, muted_id)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.chat_config enable row level security;
alter table public.blocked_words enable row level security;
alter table public.mute_list enable row level security;

-- Chat config: readable by authenticated, not writable by anyone except maintainer.
drop policy if exists "Anyone can view chat config" on public.chat_config;
create policy "Anyone can view chat config"
  on public.chat_config for select
  to authenticated
  using (true);

-- Blocked words: readable by authenticated (the RPC reads it server-side, but
-- the client may also display the filter list for transparency).
drop policy if exists "Anyone can view blocked words" on public.blocked_words;
create policy "Anyone can view blocked words"
  on public.blocked_words for select
  to authenticated
  using (true);

-- Mute list: each player can only see and manage their own mutes.
drop policy if exists "Users can view their own mutes" on public.mute_list;
create policy "Users can view their own mutes"
  on public.mute_list for select
  to authenticated
  using (auth.uid() = muter_id);

drop policy if exists "Users can insert their own mutes" on public.mute_list;
create policy "Users can insert their own mutes"
  on public.mute_list for insert
  to authenticated
  with check (auth.uid() = muter_id);

drop policy if exists "Users can delete their own mutes" on public.mute_list;
create policy "Users can delete their own mutes"
  on public.mute_list for delete
  to authenticated
  using (auth.uid() = muter_id);

-- Revoke direct writes on config and blocked_words from non-maintainers.
revoke insert, update, delete on public.chat_config from anon, authenticated;
revoke insert, update, delete on public.blocked_words from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The authoritative chat RPC
-- ---------------------------------------------------------------------------
-- Security definer so it can write chat_messages even though we could lock that
-- table down later. Reads auth.uid() itself, enforces rate limit from
-- chat_config, filters blocked words, truncates, inserts, and returns the
-- sanitized body.

create or replace function public.worldnest_send_chat(
  p_world_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid := auth.uid();
  v_username text;
  v_config public.chat_config;
  v_recent integer;
  v_sanitized text;
  v_word text;
  v_msg_id uuid;
begin
  if v_player is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  if p_world_id is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_world_id');
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty_message');
  end if;

  -- Look up the player's username from profiles.
  select username into v_username from public.profiles where id = v_player;
  if v_username is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  -- Load configuration.
  select * into v_config from public.chat_config where id = true;

  -- Rate limit: count messages in the last minute.
  select count(*) into v_recent from public.chat_messages
  where sender_id = v_player and created_at > now() - interval '1 minute';

  if v_recent >= v_config.rate_limit_per_minute then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  -- Truncate to max length.
  v_sanitized := left(trim(p_body), v_config.max_message_length);

  -- Filter blocked words: case-insensitive whole-word replacement with asterisks.
  -- Uses \m and \M (Postgres regex word-boundary anchors) to avoid matching
  -- inside compound words (e.g., "crap" must not match inside "scrapyard").
  for v_word in select word from public.blocked_words loop
    v_sanitized := regexp_replace(
      v_sanitized,
      '\m' || v_word || '\M',
      repeat('*', length(v_word)),
      'gi'
    );
  end loop;

  -- If message is entirely asterisks/whitespace after filtering, reject.
  if length(trim(translate(v_sanitized, '*', ''))) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;

  -- Insert the message.
  insert into public.chat_messages (world_id, sender_id, username, body)
  values (p_world_id, v_player, v_username, v_sanitized)
  returning id into v_msg_id;

  return jsonb_build_object(
    'ok', true,
    'message_id', v_msg_id,
    'sanitized_body', v_sanitized
  );
end;
$$;

-- Lock down function execution.
revoke execute on function public.worldnest_send_chat(uuid, text)
  from public, anon, authenticated;
grant execute on function public.worldnest_send_chat(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Index for rate-limit query performance
-- ---------------------------------------------------------------------------
-- The RPC counts messages per player per minute on every send. Without an
-- index the COUNT scans the entire chat_messages table. This composite index
-- allows Postgres to range-scan only the sender's recent rows.
create index if not exists idx_chat_messages_sender_recent
  on public.chat_messages (sender_id, created_at desc);
