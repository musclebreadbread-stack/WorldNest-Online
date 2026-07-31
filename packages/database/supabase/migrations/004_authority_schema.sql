-- WorldNest Online - Authority Schema
-- Takes the coin economy and quest completion away from the client.
-- Run this after 003_progression_schema.sql.
--
-- What this migration makes authoritative, and nothing more (decision D2):
-- a client can no longer set its coin balance to an arbitrary number, and a
-- quest reward is paid at most once, at exactly the catalogued amount, with
-- every movement recorded in an auditable ledger. There is no server tick and
-- no server-side simulation, so inventory contents, harvests, positions, crops
-- and terrain edits are still client-authored and still forgeable. Progress on
-- a `collect` objective is client-written too: a cheat can set it to the target
-- without gathering anything. What it cannot do is be paid twice, be paid a
-- different amount, or write `coins` at all.
--
-- Enforcement is by column privileges, not triggers (decision D3): a missing
-- grant fails closed and is visible in `information_schema`, and a client that
-- only speaks PostgREST cannot route around it.
--
-- This migration is RE-RUNNABLE, unlike 001-003. That asymmetry is deliberate:
-- 001-003 create tables outright and are applied once to a fresh project,
-- whereas this file also carries the seeded reference data, so re-running it is
-- how a maintainer refreshes `shop_prices` after a catalogue change. Everything
-- below is therefore `if not exists`, `drop policy if exists`, `create or
-- replace` or `on conflict ... do update`.

-- ---------------------------------------------------------------------------
-- The server's own price list
-- ---------------------------------------------------------------------------
-- The reason a client cannot name its own price. Mirrors `ITEM_PRICES` in
-- `@worldnest/shared`; the parity test in `packages/shared/src/__tests__`
-- reads this file and fails if the two ever drift.
create table if not exists public.shop_prices (
  item_id text primary key,
  buy integer not null check (buy > 0),
  sell integer not null check (sell > 0),
  check (sell < buy)
);

insert into public.shop_prices (item_id, buy, sell) values
  ('wood', 8, 3),
  ('stone', 10, 4),
  ('fiber', 6, 2),
  ('flower', 12, 5),
  ('ore', 30, 14),
  ('wheat_seed', 10, 3),
  ('wheat', 20, 9),
  ('carrot_seed', 12, 4),
  ('carrot', 24, 11),
  ('melon_seed', 14, 5),
  ('melon', 28, 13),
  ('fence', 20, 6),
  ('chest', 60, 20),
  ('path_stone', 5, 2),
  ('fishing_rod', 40, 12),
  ('fish_common', 15, 7),
  ('fish_rare', 35, 16),
  ('fish_tropical', 45, 21),
  ('bread', 25, 12),
  ('fish_pie', 50, 24),
  ('carrot_soup', 40, 18),
  ('fruit_salad', 35, 16)
on conflict (item_id) do update
  set buy = excluded.buy,
      sell = excluded.sell;

-- ---------------------------------------------------------------------------
-- The server's own reward list
-- ---------------------------------------------------------------------------
-- `target` is the progress an objective is finished at, so the server can judge
-- a claim without knowing what the objective is. Mirrors `QUEST_DEFINITIONS` in
-- `@worldnest/game-engine`; the parity test there reads this file too.
create table if not exists public.quest_rewards (
  quest_id text primary key,
  target integer not null check (target > 0),
  reward_coins integer not null check (reward_coins >= 0),
  reward_items jsonb not null default '[]'::jsonb
);

insert into public.quest_rewards (quest_id, target, reward_coins, reward_items) values
  ('collect_wood', 5, 30, '[{"itemId":"wheat_seed","quantity":3}]'::jsonb),
  ('build_fence', 2, 50, '[{"itemId":"wood","quantity":3}]'::jsonb),
  ('greet_pip', 1, 15, '[{"itemId":"flower","quantity":2}]'::jsonb),
  ('donate_first', 1, 25, '[{"itemId":"flower","quantity":1}]'::jsonb)
on conflict (quest_id) do update
  set target = excluded.target,
      reward_coins = excluded.reward_coins,
      reward_items = excluded.reward_items;

-- ---------------------------------------------------------------------------
-- The coin ledger
-- ---------------------------------------------------------------------------
-- Append-only, and what makes the guarantee checkable (decision D7): every coin
-- movement in the game is one of exactly three things, so a maintainer can
-- audit an account with one query. It carries the balance after each movement,
-- and it is also the rate limiter's data source.
create table if not exists public.coin_ledger (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references public.profiles(id) on delete cascade not null,
  operation_id uuid,
  delta integer not null,
  reason text not null check (reason in ('shop_buy', 'shop_sell', 'quest_reward')),
  ref text,
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz default now() not null
);

-- Projects that ran the first version of 004 already have ledger rows. Reuse
-- each row's primary key as its operation id before enforcing the new contract.
alter table public.coin_ledger add column if not exists operation_id uuid;
update public.coin_ledger set operation_id = id where operation_id is null;
alter table public.coin_ledger alter column operation_id set not null;

create index if not exists coin_ledger_player_created_idx
  on public.coin_ledger (player_id, created_at desc);
create unique index if not exists coin_ledger_player_operation_idx
  on public.coin_ledger (player_id, operation_id);

-- ---------------------------------------------------------------------------
-- Row level security on the three new tables
-- ---------------------------------------------------------------------------
alter table public.shop_prices enable row level security;
alter table public.quest_rewards enable row level security;
alter table public.coin_ledger enable row level security;

-- Reference data: readable by anyone, written by nobody but a maintainer.
drop policy if exists "Anyone can view shop prices" on public.shop_prices;
create policy "Anyone can view shop prices"
  on public.shop_prices for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can view quest rewards" on public.quest_rewards;
create policy "Anyone can view quest rewards"
  on public.quest_rewards for select
  to anon, authenticated
  using (true);

-- The ledger is readable by its owner and writable by nobody: there is
-- deliberately no insert, update or delete policy. Only the security definer
-- functions below write it.
drop policy if exists "Users can view their own ledger" on public.coin_ledger;
create policy "Users can view their own ledger"
  on public.coin_ledger for select
  to authenticated
  using (auth.uid() = player_id);

-- A missing policy already refuses a write, but a Supabase project's default
-- privileges hand `authenticated` every privilege on every new table, so revoke
-- the writes explicitly too: the ledger and the two reference tables must fail
-- closed at the privilege level, not only at the policy level.
revoke insert, update, delete on public.coin_ledger from anon, authenticated;
revoke insert, update, delete on public.shop_prices from anon, authenticated;
revoke insert, update, delete on public.quest_rewards from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The lockdown
-- ---------------------------------------------------------------------------
-- A real Supabase project grants `authenticated` every privilege on everything
-- in `public` through default privileges, which is why RLS has been the only
-- thing protecting these tables. These revokes are the actual security change.
-- `packages/database/supabase/test/auth_stub.sql` reproduces those default
-- grants so the harness exercises the same privilege set a real project has.

-- The starting purse becomes a column default (decision D5). The client can no
-- longer write `coins`, so it cannot grant itself the purse either. Pinned to
-- `STARTING_COINS` in `@worldnest/shared` by the parity test.
alter table public.player_state alter column coins set default 50;

-- One-time backfill for rows created before this migration, when the default
-- was 0 and the client granted the purse. A row that is genuinely at zero
-- because the player spent everything is indistinguishable from an unprovisioned
-- one, so this is generous on purpose and harmless: it runs before anybody can
-- have spent authoritative coins.
update public.player_state set coins = 50 where coins = 0;

revoke insert, update on public.player_state from anon, authenticated;

grant insert (player_id, x, y, chunk, last_online, inventory)
  on public.player_state to authenticated;
grant update (x, y, chunk, last_online, inventory)
  on public.player_state to authenticated;

-- Quests need no procedural code at all: `state` gets a default, and it is the
-- one column the client is not granted. So a client may take a quest on (the
-- default makes it `'active'`) and may move `progress`, and only
-- `worldnest_claim_quest_reward` can ever write `'completed'`.
alter table public.player_quests alter column state set default 'active';

revoke insert, update on public.player_quests from anon, authenticated;

grant insert (player_id, quest_id, progress, updated_at)
  on public.player_quests to authenticated;
grant update (progress, updated_at)
  on public.player_quests to authenticated;

-- Migration 005 adds the client-owned build-objective baseline. Keep this file
-- re-runnable after that upgrade: the broad revoke above also removes column
-- grants added by later migrations, so restore the baseline grant when present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'player_quests'
      and column_name = 'baseline'
  ) then
    grant insert (baseline) on public.player_quests to authenticated;
    grant update (baseline) on public.player_quests to authenticated;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The authoritative operations
-- ---------------------------------------------------------------------------
-- Both functions are `security definer` so they can write the columns and the
-- table the caller cannot, both pin `search_path` so a caller cannot shadow a
-- referenced object, both resolve the player from `auth.uid()` rather than from
-- an argument, and both return a jsonb result instead of raising: a refusal is
-- an ordinary answer the client reconciles against, not an exception.
--
-- MAX_LEDGER_ENTRIES_PER_MINUTE is 60. It is an anti-abuse ceiling, not
-- monetisation: no amount of waiting buys anything the game does not give away.

-- Remove the pre-idempotency overload when upgrading a database that already
-- ran an earlier copy of this migration. Function privileges belong to a
-- signature, so leaving it in place would preserve an unsafe public API.
drop function if exists public.worldnest_shop_trade(text, text, integer);
drop function if exists public.worldnest_claim_quest_reward(text);

create or replace function public.worldnest_shop_trade(
  p_operation_id uuid,
  p_kind text,
  p_item_id text,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid := auth.uid();
  v_price public.shop_prices;
  v_balance integer;
  v_duplicate_balance integer;
  v_delta integer;
  v_recent integer;
begin
  if v_player is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  if p_operation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_operation_id');
  end if;

  if p_kind is null or p_kind not in ('buy', 'sell') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;

  -- 99 is one full inventory stack; anything larger is not a trade the UI can
  -- ask for.
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    return jsonb_build_object('ok', false, 'reason', 'bad_quantity');
  end if;

  select * into v_price from public.shop_prices where item_id = p_item_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_item');
  end if;

  -- Every authority operation locks the purse first. That gives one total order
  -- per player and makes two concurrent calls carrying the same operation id
  -- observe the ledger row written by whichever acquired the lock first.
  select coins into v_balance from public.player_state
  where player_id = v_player
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_player_state');
  end if;

  select balance_after into v_duplicate_balance from public.coin_ledger
  where player_id = v_player and operation_id = p_operation_id;
  if found then
    return jsonb_build_object('ok', true, 'coins', v_duplicate_balance);
  end if;

  select count(*) into v_recent from public.coin_ledger
  where player_id = v_player and created_at > now() - interval '1 minute';
  if v_recent >= 60 then
    return jsonb_build_object(
      'ok', false, 'reason', 'rate_limited', 'coins', v_balance
    );
  end if;

  if p_kind = 'buy' then
    v_delta := -(v_price.buy * p_quantity);
  else
    v_delta := v_price.sell * p_quantity;
  end if;

  if v_balance + v_delta < 0 then
    return jsonb_build_object(
      'ok', false, 'reason', 'insufficient_coins', 'coins', v_balance
    );
  end if;

  -- A sell is deliberately NOT validated against the persisted inventory
  -- (decision D9): that row lags the live one by up to one autosave, so a
  -- player who harvests wood and sells it immediately would be wrongly refused.
  -- A false refusal is a worse product than an unvalidated sale, and the rate
  -- limit plus the fixed price already bound the abuse.
  v_balance := v_balance + v_delta;

  update public.player_state set coins = v_balance where player_id = v_player;

  insert into public.coin_ledger (
    player_id, operation_id, delta, reason, ref, balance_after
  )
  values (
    v_player,
    p_operation_id,
    v_delta,
    case when p_kind = 'buy' then 'shop_buy' else 'shop_sell' end,
    p_item_id || ' x' || p_quantity,
    v_balance
  );

  return jsonb_build_object('ok', true, 'coins', v_balance);
end;
$$;

create or replace function public.worldnest_claim_quest_reward(
  p_quest_id text,
  p_progress integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid := auth.uid();
  v_reward public.quest_rewards;
  v_state text;
  v_progress integer;
  v_balance integer;
  v_recent integer;
begin
  if v_player is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  if p_progress is null or p_progress < 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_progress');
  end if;

  select * into v_reward from public.quest_rewards where quest_id = p_quest_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_quest');
  end if;

  -- Share the purse lock with shop operations so all returned balances form one
  -- serial order, even when a trade and completion arrive together.
  select coins into v_balance from public.player_state
  where player_id = v_player
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_player_state');
  end if;

  select count(*) into v_recent from public.coin_ledger
  where player_id = v_player and created_at > now() - interval '1 minute';
  if v_recent >= 60 then
    return jsonb_build_object(
      'ok', false, 'reason', 'rate_limited', 'coins', v_balance
    );
  end if;

  -- Progress is explicitly client-owned. Carrying the live value into this
  -- transaction closes the autosave race without pretending it proves the
  -- objective happened. Never regress progress if an older retry arrives.
  insert into public.player_quests (player_id, quest_id, progress, updated_at)
  values (v_player, p_quest_id, p_progress, now())
  on conflict (player_id, quest_id) do update
    set progress = greatest(public.player_quests.progress, excluded.progress),
        updated_at = excluded.updated_at;

  select state, progress into v_state, v_progress from public.player_quests
  where player_id = v_player and quest_id = p_quest_id
  for update;

  -- The row is the record of payment, so the second attempt is refused rather
  -- than paid. Include the balance because this is a terminal, useful answer.
  if v_state = 'completed' then
    return jsonb_build_object(
      'ok', false, 'reason', 'already_completed', 'coins', v_balance
    );
  end if;

  if v_state <> 'active' then
    return jsonb_build_object(
      'ok', false, 'reason', 'not_active', 'coins', v_balance
    );
  end if;

  if v_progress < v_reward.target then
    return jsonb_build_object(
      'ok', false, 'reason', 'objective_unmet', 'coins', v_balance
    );
  end if;

  v_balance := v_balance + v_reward.reward_coins;

  update public.player_state set coins = v_balance where player_id = v_player;

  update public.player_quests
  set state = 'completed', updated_at = now()
  where player_id = v_player and quest_id = p_quest_id;

  insert into public.coin_ledger (
    player_id, operation_id, delta, reason, ref, balance_after
  )
  values (
    v_player,
    extensions.uuid_generate_v4(),
    v_reward.reward_coins,
    'quest_reward',
    p_quest_id,
    v_balance
  );

  return jsonb_build_object('ok', true, 'coins', v_balance);
end;
$$;

-- A function is executable by `public` unless told otherwise, and a Supabase
-- project's default privileges grant `anon` execute on new functions as well, so
-- revoke every role before granting the exact current signatures explicitly.
revoke execute on function public.worldnest_shop_trade(uuid, text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.worldnest_claim_quest_reward(text, integer)
  from public, anon, authenticated;

grant execute on function public.worldnest_shop_trade(uuid, text, text, integer)
  to authenticated;
grant execute on function public.worldnest_claim_quest_reward(text, integer)
  to authenticated;
