-- WorldNest Online - Progression Schema
-- Persists the two things a session used to lose on every reload: the coin
-- wallet and the quest log.
-- Run this after 002_gameplay_schema.sql.

-- ---------------------------------------------------------------------------
-- Coins
-- ---------------------------------------------------------------------------
-- Coins are a column on player_state, not a table of their own: that row is
-- already written on every autosave, so a wallet table would double the write
-- traffic for a single integer. The default of 0 is what "never saved" looks
-- like, and the client grants the starting coins in that case.
alter table public.player_state
  add column if not exists coins integer default 0 not null;

-- ---------------------------------------------------------------------------
-- Quest log
-- ---------------------------------------------------------------------------
-- One row per quest a player has been offered. quest_id is plain text and is
-- deliberately not a foreign key: the quest catalogue lives in the client, so a
-- quest that is removed from it must leave a harmless orphan row rather than
-- break the schema. The client validates ids on the way back in.
create table public.player_quests (
  player_id uuid references public.profiles(id) on delete cascade not null,
  quest_id text not null,
  state text not null check (state in ('available', 'active', 'completed')),
  progress integer default 0 not null,
  updated_at timestamptz default now() not null,
  primary key (player_id, quest_id)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- A quest log is private progression, so it follows player_state: owner-only for
-- reads as well as writes. Nothing in the game shows another player's quests.
alter table public.player_quests enable row level security;

create policy "Users can view their own quests"
  on public.player_quests for select
  to authenticated
  using (auth.uid() = player_id);

create policy "Users can insert their own quests"
  on public.player_quests for insert
  to authenticated
  with check (auth.uid() = player_id);

create policy "Users can update their own quests"
  on public.player_quests for update
  to authenticated
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

create policy "Users can delete their own quests"
  on public.player_quests for delete
  to authenticated
  using (auth.uid() = player_id);
