#!/usr/bin/env bash
#
# Verify the SQL migrations against a real Postgres.
#
# There is no Supabase project in CI or in a fresh clone, so the migrations used
# to be shipped unexecuted. This starts a throwaway `postgres:16-alpine`
# container, applies the `auth` test double
# (`packages/database/supabase/test/auth_stub.sql`) and then every numbered
# migration with `ON_ERROR_STOP=1`, and asserts the things the schema promises:
# the provisioning trigger really does create a `profiles` and a `player_state`
# row, and the policy count is what the migrations wrote.
#
# Since 004 it also proves the server authority, which is the only way to prove
# it at all: the last section re-runs the client's own statements as the
# `authenticated` role, so a missing revoke or a missing column grant shows up
# as a write that was allowed rather than as a comment nobody checked.
#
# Usage: pnpm db:verify
# Requires: Docker. No local psql needed - psql runs inside the container.

set -euo pipefail

CONTAINER="worldnest-sql-verify"
IMAGE="postgres:16-alpine"
DB="worldnest_verify"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_SRC="$REPO_ROOT/packages/database/supabase"

# Policy counts are asserted, not just printed: a dropped policy is a silent
# security regression otherwise.
EXPECTED_POLICIES_AFTER_002=23
EXPECTED_POLICIES_AFTER_003=27
EXPECTED_POLICIES_AFTER_004=30
EXPECTED_POLICIES_AFTER_005=30
EXPECTED_POLICIES_AFTER_006=35
POLICY_COUNT="select count(*) from pg_policies where schemaname = 'public'"

# The seeded test accounts, and the predicate that finds exactly them - the
# trigger probe above is also a `@worldnest.test` address.
EXPECTED_TESTERS=3
TESTER_COUNT="select count(*) from auth.users where email like 'tester%@worldnest.test'"
TESTER_IDS="select id from auth.users where email like 'tester%@worldnest.test'"

failures=0

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# psql inside the container, as postgres, stopping on the first error.
psql_run() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -q -U postgres -d "$DB" "$@"
}

# One scalar, unaligned and untitled, so it can be compared directly.
query() {
  docker exec -i "$CONTAINER" psql -tAX -v ON_ERROR_STOP=1 -U postgres -d "$DB" -c "$1"
}

# One scalar, but as the `authenticated` role with a JWT subject - which is what
# makes auth.uid() resolve, RLS apply and the column grants from 004 bite. A
# single `-c` is a single session and a single implicit transaction, so a plain
# `set` suffices (no `set local`, no explicit `begin`) and a refused statement
# rolls the whole thing back.
query_as_authenticated() {
  local uid="$1" sql="$2"
  docker exec -i "$CONTAINER" psql -q -tAX -v ON_ERROR_STOP=1 -U postgres -d "$DB" \
    -c "set role authenticated; set \"request.jwt.claim.sub\" = '$uid'; $sql"
}

# The jsonb answer from an authority function, flattened to `true:<coins>` or
# `false:<reason>` so a single `expect` line reads it.
authority_result() {
  local uid="$1" call="$2"
  query_as_authenticated "$uid" "with r as (select $call as j)
    select case when (j->>'ok')::boolean
      then 'true:' || (j->>'coins')
      else 'false:' || (j->>'reason') end from r;"
}

# A statement the client must not be allowed to run. The refusal *is* the
# assertion, so being allowed is the failure; the reason is printed so an `ok`
# line still says which wall stopped it.
expect_denied() {
  local label="$1" uid="$2" sql="$3" out reason
  if out="$(query_as_authenticated "$uid" "$sql" 2>&1)"; then
    echo "  FAIL $label was ALLOWED"
    failures=$((failures + 1))
  else
    reason="$(printf '%s' "$out" | grep -o -m1 \
      -e 'permission denied for [a-z]* [a-z_]*' \
      -e 'violates row-level security policy' || true)"
    echo "  ok   $label denied: ${reason:-refused}"
  fi
}

# The complement: a statement the client must still be allowed to run, because a
# lockdown that also breaks the game is not a fix.
expect_allowed() {
  local label="$1" uid="$2" sql="$3" out
  if out="$(query_as_authenticated "$uid" "$sql" 2>&1)"; then
    echo "  ok   $label allowed"
  else
    echo "  FAIL $label was DENIED"
    printf '%s\n' "$out" | sed 's/^/       /'
    failures=$((failures + 1))
  fi
}

apply() {
  local label="$1" file="$2"
  if psql_run -f "$file" >/dev/null; then
    echo "$label OK"
  else
    echo "$label FAILED"
    exit 1
  fi
}

expect() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ok   $label=$actual"
  else
    echo "  FAIL $label=$actual (expected $expected)"
    failures=$((failures + 1))
  fi
}

echo "== starting $IMAGE =="
cleanup
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=worldnest-verify \
  -e POSTGRES_DB="$DB" \
  "$IMAGE" >/dev/null

printf "waiting for postgres"
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; then
    echo " ready"
    break
  fi
  printf "."
  sleep 1
done

if ! docker exec "$CONTAINER" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; then
  echo " timed out"
  exit 1
fi

docker cp "$SQL_SRC" "$CONTAINER:/sql" >/dev/null

echo "== applying schema =="
apply "auth stub" /sql/test/auth_stub.sql
apply "001" /sql/migrations/001_initial_schema.sql
apply "002" /sql/migrations/002_gameplay_schema.sql

echo "== asserting 002 =="
expect "policies" "$(query "$POLICY_COUNT")" "$EXPECTED_POLICIES_AFTER_002"
expect "default_world" \
  "$(query "select name from public.worlds where name = 'Default World';")" \
  "Default World"

# 003 is applied on its own so the policy count either side of it is asserted,
# and so a migration that only works on an empty database would be caught.
echo "== applying 003 =="
apply "003" /sql/migrations/003_progression_schema.sql

echo "== asserting 003 =="
expect "policies" "$(query "$POLICY_COUNT")" "$EXPECTED_POLICIES_AFTER_003"
expect "player_state.coins" \
  "$(query "select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'player_state'
       and column_name = 'coins';")" "1"
expect "player_quests rls" \
  "$(query "select relrowsecurity from pg_class
     where oid = 'public.player_quests'::regclass;")" "t"

# 004 is the authority migration, and unlike 001-003 it claims to be
# re-runnable - so it is applied twice, the way the seed already is. Re-running
# it is also how a maintainer refreshes the price list after a catalogue change.
echo "== applying 004 =="
apply "004" /sql/migrations/004_authority_schema.sql
apply "004 (re-run)" /sql/migrations/004_authority_schema.sql

echo "== asserting 004 =="
expect "policies" "$(query "$POLICY_COUNT")" "$EXPECTED_POLICIES_AFTER_004"
expect "shop_prices seeded" \
  "$(query "select count(*) from public.shop_prices;")" "18"
expect "quest_rewards seeded" \
  "$(query "select count(*) from public.quest_rewards;")" "3"
expect "coin_ledger has no write policy" \
  "$(query "select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'coin_ledger'
       and cmd <> 'SELECT';")" "0"
expect "player_state coins default" \
  "$(query "select column_default from information_schema.columns
     where table_schema = 'public' and table_name = 'player_state'
       and column_name = 'coins';")" "50"
expect "player_quests state default" \
  "$(query "select column_default from information_schema.columns
     where table_schema = 'public' and table_name = 'player_quests'
       and column_name = 'state';")" "'active'::text"

# Seed one terrain edit before 005 to prove the new default preserves every
# existing modification as a surface-layer row.
psql_run -c "insert into public.world_modifications
    (world_id, tile_x, tile_y, tile_type)
  select id, 17, 23, 1 from public.worlds where name = 'Default World';" >/dev/null

# 005 adds layer-aware terrain keys and the quest baseline. It is deliberately
# applied twice, then 004 is applied again: this proves both migrations remain
# safe when a maintainer re-runs authority after the schema extension.
echo "== applying 005 and compatibility re-run =="
apply "005" /sql/migrations/005_world_layer_schema.sql
apply "005 (re-run)" /sql/migrations/005_world_layer_schema.sql
apply "004 (after 005)" /sql/migrations/004_authority_schema.sql

echo "== asserting 005 and 004 -> 005 -> 004 compatibility =="
expect "policies" "$(query "$POLICY_COUNT")" "$EXPECTED_POLICIES_AFTER_005"
expect "world_modifications primary key" \
  "$(query "select string_agg(kcu.column_name, ',' order by kcu.ordinal_position)
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on kcu.constraint_schema = tc.constraint_schema
      and kcu.constraint_name = tc.constraint_name
     where tc.table_schema = 'public'
       and tc.table_name = 'world_modifications'
       and tc.constraint_type = 'PRIMARY KEY';")" \
  "world_id,layer,tile_x,tile_y"
expect "pre-005 terrain defaults to surface" \
  "$(query "select layer from public.world_modifications
     where tile_x = 17 and tile_y = 23;")" "0"

psql_run -c "insert into public.world_modifications
    (world_id, layer, tile_x, tile_y, tile_type)
  select id, 1, 17, 23, 9 from public.worlds where name = 'Default World';" >/dev/null
expect "same coordinates coexist on two layers" \
  "$(query "select string_agg(layer || ':' || tile_type, ',' order by layer)
     from public.world_modifications where tile_x = 17 and tile_y = 23;")" \
  "0:1,1:9"
expect "player_quests baseline exists" \
  "$(query "select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'player_quests'
       and column_name = 'baseline' and is_nullable = 'NO';")" "1"
expect "player_quests baseline default" \
  "$(query "select column_default from information_schema.columns
     where table_schema = 'public' and table_name = 'player_quests'
       and column_name = 'baseline';")" "0"

# The whole point of 002: inserting into auth.users must provision the two
# public rows a session needs, taking the username from the GoTrue metadata.
echo "== asserting the provisioning trigger =="
psql_run -c "insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'trigger-probe@worldnest.test',
    jsonb_build_object('username', 'TriggerProbe')
  );" >/dev/null

expect "trigger provisioned profiles" \
  "$(query "select count(*) from public.profiles
     where id = '11111111-1111-1111-1111-111111111111';")" "1"
expect "trigger provisioned player_state" \
  "$(query "select count(*) from public.player_state
     where player_id = '11111111-1111-1111-1111-111111111111';")" "1"
expect "trigger used the metadata username" \
  "$(query "select username from public.profiles
     where id = '11111111-1111-1111-1111-111111111111';")" "TriggerProbe"

echo "== applying the test-account seed =="
apply "seed" /sql/seed/test_accounts.sql
# Applied twice on purpose: the seed claims to be idempotent, so prove it.
apply "seed (re-run)" /sql/seed/test_accounts.sql

expect "seed accounts" "$(query "$TESTER_COUNT")" "$EXPECTED_TESTERS"
expect "seed profiles" \
  "$(query "select count(*) from public.profiles where id in ($TESTER_IDS);")" \
  "$EXPECTED_TESTERS"
expect "seed player_state" \
  "$(query "select count(*) from public.player_state where player_id in ($TESTER_IDS);")" \
  "$EXPECTED_TESTERS"
expect "seed identities" \
  "$(query "select count(*) from auth.identities
     where provider = 'email' and provider_id like 'tester%@worldnest.test';")" \
  "$EXPECTED_TESTERS"
expect "seed confirmed" \
  "$(query "$TESTER_COUNT and email_confirmed_at is not null;")" "$EXPECTED_TESTERS"
# The password is the point of the seed: if this hash does not verify, the
# account exists but nobody can sign in with it.
expect "seed password verifies" \
  "$(query "$TESTER_COUNT and encrypted_password = crypt('worldnest123', encrypted_password);")" \
  "$EXPECTED_TESTERS"

# What item 27 writes on every autosave, exercised against a real row: coins on
# player_state, and a quest upserted twice on the composite key.
echo "== asserting progression persistence =="
psql_run -c "update public.player_state set coins = 137
  where player_id = (select id from auth.users where email = 'tester1@worldnest.test');" >/dev/null
expect "coins persist" \
  "$(query "select coins from public.player_state
     where player_id = (select id from auth.users
       where email = 'tester1@worldnest.test');")" "137"

psql_run -c "insert into public.player_quests (player_id, quest_id, state, progress)
  select id, 'collect_wood', 'active', 3 from auth.users
  where email = 'tester1@worldnest.test'
  on conflict (player_id, quest_id) do update
    set state = excluded.state, progress = excluded.progress;" >/dev/null
psql_run -c "insert into public.player_quests (player_id, quest_id, state, progress)
  select id, 'collect_wood', 'completed', 5 from auth.users
  where email = 'tester1@worldnest.test'
  on conflict (player_id, quest_id) do update
    set state = excluded.state, progress = excluded.progress;" >/dev/null
expect "quest upsert is one row" \
  "$(query "select count(*) from public.player_quests where quest_id = 'collect_wood';")" "1"
expect "quest upsert overwrote" \
  "$(query "select state || ':' || progress from public.player_quests
     where quest_id = 'collect_wood';")" "completed:5"

# The check constraint is the only thing stopping a typo'd state reaching the
# client, so prove it actually rejects one.
if psql_run -c "insert into public.player_quests (player_id, quest_id, state)
  select id, 'bad_state_probe', 'nonsense' from auth.users
  where email = 'tester1@worldnest.test';" >/dev/null 2>&1; then
  expect "quest state constraint rejects nonsense" "accepted" "rejected"
else
  expect "quest state constraint rejects nonsense" "rejected" "rejected"
fi

# Everything above runs as `postgres`, which owns the tables and is therefore
# exempt from both RLS and 004's revokes. This is the part that actually proves
# the authority: the same statements as the role a browser gets.
echo "== asserting authority as the authenticated role =="
TESTER2="11111111-2222-4333-8444-555555550002"

# Decision D5: the starting purse is a column default now, so the trigger hands
# it out and the client cannot.
expect "trigger provisioned coins" \
  "$(query "select coins from public.player_state
     where player_id = '11111111-1111-1111-1111-111111111111';")" "50"
expect "seeded account coins" \
  "$(query "select coins from public.player_state where player_id = '$TESTER2';")" "50"

# player_state: coins are no longer the client's to write, everything else is.
expect_denied "player_state coins update" "$TESTER2" \
  "update public.player_state set coins = 99999 where player_id = '$TESTER2';"
expect_allowed "player_state position update" "$TESTER2" \
  "update public.player_state set x = 42, last_online = now()
   where player_id = '$TESTER2';"
expect "position update landed" \
  "$(query "select x from public.player_state where player_id = '$TESTER2';")" "42"

# The client's real write path is an upsert, so exercise it both ways: the shape
# savePlayerState sends today is refused outright, which is why item 6 must drop
# `coins` from it.
expect_denied "player_state upsert mentioning coins" "$TESTER2" \
  "insert into public.player_state
     (player_id, x, y, chunk, last_online, inventory, coins)
   values ('$TESTER2', 7, 9, '0,0', now(), '{}'::jsonb, 12345)
   on conflict (player_id) do update
     set x = excluded.x, y = excluded.y, chunk = excluded.chunk,
         last_online = excluded.last_online, inventory = excluded.inventory,
         coins = excluded.coins;"
expect_allowed "player_state upsert without coins" "$TESTER2" \
  "insert into public.player_state
     (player_id, x, y, chunk, last_online, inventory)
   values ('$TESTER2', 7, 9, '0,0', now(), '{\"slots\": []}'::jsonb)
   on conflict (player_id) do update
     set x = excluded.x, y = excluded.y, chunk = excluded.chunk,
         last_online = excluded.last_online, inventory = excluded.inventory;"
expect "upsert left coins alone" \
  "$(query "select coins from public.player_state where player_id = '$TESTER2';")" "50"

# player_quests: `state` is the one column with no grant, and its new default is
# what lets a client still take a quest on.
expect_denied "player_quests insert naming state" "$TESTER2" \
  "insert into public.player_quests (player_id, quest_id, progress, state)
   values ('$TESTER2', 'collect_wood', 0, 'completed');"
expect_allowed "player_quests insert without state" "$TESTER2" \
  "insert into public.player_quests
     (player_id, quest_id, progress, baseline, updated_at)
   values ('$TESTER2', 'collect_wood', 0, 4, now());"
expect "quest default state and baseline write" \
  "$(query "select state || ':' || baseline from public.player_quests
     where player_id = '$TESTER2' and quest_id = 'collect_wood';")" "active:4"
expect_denied "player_quests state update" "$TESTER2" \
  "update public.player_quests set state = 'completed'
   where player_id = '$TESTER2' and quest_id = 'collect_wood';"
expect_allowed "player_quests progress and baseline update" "$TESTER2" \
  "update public.player_quests set progress = 2, baseline = 6, updated_at = now()
   where player_id = '$TESTER2' and quest_id = 'collect_wood';"
expect "quest baseline update landed" \
  "$(query "select progress || ':' || baseline from public.player_quests
     where player_id = '$TESTER2' and quest_id = 'collect_wood';")" "2:6"

# The ledger is the audit trail, so nothing but the functions may write it.
expect_denied "coin_ledger insert" "$TESTER2" \
  "insert into public.coin_ledger (player_id, delta, reason, balance_after)
   values ('$TESTER2', 100000, 'shop_sell', 100000);"

# Stable UUIDs stand in for the browser-generated operation ids.
OP_BUY_FENCE="aaaaaaaa-0000-4000-8000-000000000001"
OP_SELL_WOOD="aaaaaaaa-0000-4000-8000-000000000002"

# The shop function: the price comes from shop_prices, never from the caller.
expect "buy fence" "$(authority_result "$TESTER2" \
  "public.worldnest_shop_trade('$OP_BUY_FENCE', 'buy', 'fence', 1)")" "true:30"
expect "buy wrote one ledger row" \
  "$(query "select count(*) from public.coin_ledger where player_id = '$TESTER2';")" "1"
expect "ledger records the balance" \
  "$(query "select delta || '@' || balance_after from public.coin_ledger
     where player_id = '$TESTER2';")" "-20@30"
expect "owner can read their ledger" \
  "$(query_as_authenticated "$TESTER2" "select count(*) from public.coin_ledger;")" "1"

# A sell is deliberately not checked against the persisted inventory (decision
# D9), and tester2 owns no wood - so this succeeding is the decision, asserted.
expect "sell wood the row does not hold" "$(authority_result "$TESTER2" \
  "public.worldnest_shop_trade('$OP_SELL_WOOD', 'sell', 'wood', 2)")" "true:36"

expect "duplicate trade returns original balance" "$(authority_result "$TESTER2" \
  "public.worldnest_shop_trade('$OP_BUY_FENCE', 'buy', 'fence', 1)")" "true:30"
expect "duplicate trade wrote no ledger row" \
  "$(query "select count(*) from public.coin_ledger
     where player_id = '$TESTER2' and operation_id = '$OP_BUY_FENCE';")" "1"

expect "buy beyond the balance" "$(authority_result "$TESTER2" \
  "public.worldnest_shop_trade('aaaaaaaa-0000-4000-8000-000000000003', 'buy', 'fence', 99)")" "false:insufficient_coins"
expect "buy an unknown item" "$(authority_result "$TESTER2" \
  "public.worldnest_shop_trade('aaaaaaaa-0000-4000-8000-000000000004', 'buy', 'not_an_item', 1)")" "false:unknown_item"
expect "trade in an unknown direction" "$(authority_result "$TESTER2" \
  "public.worldnest_shop_trade('aaaaaaaa-0000-4000-8000-000000000005', 'sideways', 'fence', 1)")" "false:bad_kind"
expect "trade zero" "$(authority_result "$TESTER2" \
  "public.worldnest_shop_trade('aaaaaaaa-0000-4000-8000-000000000006', 'buy', 'fence', 0)")" "false:bad_quantity"
expect "trade a thousand" "$(authority_result "$TESTER2" \
  "public.worldnest_shop_trade('aaaaaaaa-0000-4000-8000-000000000007', 'buy', 'fence', 1000)")" "false:bad_quantity"
expect_denied "malformed operation id" "$TESTER2" \
  "select public.worldnest_shop_trade('not-a-uuid', 'sell', 'wood', 1);"
expect "refusals moved nothing" \
  "$(query "select coins || '/' || (select count(*) from public.coin_ledger
     where player_id = '$TESTER2') from public.player_state
     where player_id = '$TESTER2';")" "36/2"

# The quest function atomically upserts the supplied client-owned progress,
# pays the catalogued amount at most once, and is the only state writer.
expect "claim an unmet objective" "$(authority_result "$TESTER2" \
  "public.worldnest_claim_quest_reward('collect_wood', 2)")" "false:objective_unmet"
expect "claim an unknown quest" "$(authority_result "$TESTER2" \
  "public.worldnest_claim_quest_reward('not_a_quest', 1)")" "false:unknown_quest"
expect "claim with malformed progress" "$(authority_result "$TESTER2" \
  "public.worldnest_claim_quest_reward('collect_wood', -1)")" "false:bad_progress"
expect "claim a met objective without an autosave" "$(authority_result "$TESTER2" \
  "public.worldnest_claim_quest_reward('collect_wood', 5)")" "true:66"
expect "claim it a second time" "$(authority_result "$TESTER2" \
  "public.worldnest_claim_quest_reward('collect_wood', 5)")" "false:already_completed"
expect "the reward completed the quest" \
  "$(query "select state from public.player_quests
     where player_id = '$TESTER2' and quest_id = 'collect_wood';")" "completed"
expect "the reward was paid once" \
  "$(query "select coins || '/' || (select count(*) from public.coin_ledger
     where player_id = '$TESTER2' and reason = 'quest_reward')
     from public.player_state where player_id = '$TESTER2';")" "66/1"

# No player_quests row exists for greet_pip: progress and payment must land in
# this one call rather than racing the debounced autosave.
expect "immediate quest completion" "$(authority_result "$TESTER2" \
  "public.worldnest_claim_quest_reward('greet_pip', 1)")" "true:81"
expect "immediate quest retry pays once" "$(authority_result "$TESTER2" \
  "public.worldnest_claim_quest_reward('greet_pip', 1)")" "false:already_completed"
expect "immediate completion persisted once" \
  "$(query "select coins || '/' || (select count(*) from public.coin_ledger
     where player_id = '$TESTER2' and reason = 'quest_reward')
     from public.player_state where player_id = '$TESTER2';")" "81/2"

# Two separate authenticated sessions race the same operation id. The purse
# lock serializes them and the second session observes the first ledger row.
TESTER3="11111111-2222-4333-8444-555555550003"
CONCURRENT_OP="aaaaaaaa-0000-4000-8000-000000000008"
authority_result "$TESTER3" \
  "public.worldnest_shop_trade('$CONCURRENT_OP', 'sell', 'flower', 1)" >/dev/null &
first_pid=$!
authority_result "$TESTER3" \
  "public.worldnest_shop_trade('$CONCURRENT_OP', 'sell', 'flower', 1)" >/dev/null &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
expect "concurrent duplicate balance" \
  "$(query "select coins from public.player_state where player_id = '$TESTER3';")" "55"
expect "concurrent duplicate ledger row" \
  "$(query "select count(*) from public.coin_ledger
     where player_id = '$TESTER3' and operation_id = '$CONCURRENT_OP';")" "1"

# Upgrading 004 must remove the unsafe signatures rather than merely adding
# overloads beside them.
expect "obsolete authority overloads" \
  "$(query "select count(*) from pg_proc
     where pronamespace = 'public'::regnamespace
       and ((proname = 'worldnest_shop_trade' and pronargs = 3)
         or (proname = 'worldnest_claim_quest_reward' and pronargs = 1));")" "0"

# 006 is the chat hardening migration. It is applied twice to prove it is
# re-runnable, and it adds the `worldnest_send_chat` RPC, the `chat_config`
# and `blocked_words` tables, and the `mute_list` with player-scoped RLS.
echo "== applying 006 and re-run =="
apply "006" /sql/migrations/006_chat_hardening.sql
apply "006 (re-run)" /sql/migrations/006_chat_hardening.sql

echo "== asserting 006 =="
expect "policies" "$(query "$POLICY_COUNT")" "$EXPECTED_POLICIES_AFTER_006"
expect "worldnest_send_chat exists" \
  "$(query "select count(*) from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname = 'worldnest_send_chat';")" "1"
expect "chat_config rate limit seeded" \
  "$(query "select rate_limit_per_minute from public.chat_config where id = true;")" "10"
expect "chat_config max length seeded" \
  "$(query "select max_message_length from public.chat_config where id = true;")" "240"
expect "blocked_words has entries" \
  "$(query "select count(*) from public.blocked_words;")" "16"
expect "mute_list rls enabled" \
  "$(query "select relrowsecurity from pg_class
     where oid = 'public.mute_list'::regclass;")" "t"

# Assert RPC behavior: unauthenticated call is refused.
expect "send_chat unauthenticated" \
  "$(query "select (public.worldnest_send_chat(
     (select id from public.worlds where name = 'Default World'),
     'hello'
   ))->>'reason';")" "unauthenticated"

# Assert the mute_list RLS: tester2 can only see their own mutes.
TESTER2="11111111-2222-4333-8444-555555550002"
TESTER3="11111111-2222-4333-8444-555555550003"

# Insert a mute for tester2.
psql_run -c "insert into public.mute_list (muter_id, muted_id)
  values ('$TESTER2', '$TESTER3')
  on conflict do nothing;" >/dev/null
expect_allowed "mute_list select own" "$TESTER2" \
  "select count(*) from public.mute_list where muter_id = '$TESTER2';"
expect "mute_list invisible to other" \
  "$(query_as_authenticated "$TESTER3" "select count(*) from public.mute_list;")" "0"

# Assert the send function works for an authenticated user.
SEND_RESULT="$(query_as_authenticated "$TESTER2" \
  "select public.worldnest_send_chat(
     (select id from public.worlds where name = 'Default World'),
     'hello world'
   );")"
expect "send_chat ok" \
  "$(echo "$SEND_RESULT" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d['ok'])" 2>/dev/null || echo "parse_error")" \
  "True"

# Assert the word filter replaces blocked words with asterisks.
FILTER_RESULT="$(query_as_authenticated "$TESTER2" \
  "select public.worldnest_send_chat(
     (select id from public.worlds where name = 'Default World'),
     'hello damn world'
   );")"
expect "send_chat filters word" \
  "$(echo "$FILTER_RESULT" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('sanitized_body',''))" 2>/dev/null || echo "parse_error")" \
  "hello **** world"

# Assert the word filter does NOT match inside compound words (word boundaries).
COMPOUND_RESULT="$(query_as_authenticated "$TESTER2" \
  "select public.worldnest_send_chat(
     (select id from public.worlds where name = 'Default World'),
     'scrapyard grasshopper'
   );")"
expect "send_chat no false positive in compound words" \
  "$(echo "$COMPOUND_RESULT" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('sanitized_body',''))" 2>/dev/null || echo "parse_error")" \
  "scrapyard grasshopper"

# Assert rate limiting: send 10 messages, then the 11th should be refused.
for i in $(seq 1 8); do
  query_as_authenticated "$TESTER3" \
    "select public.worldnest_send_chat(
       (select id from public.worlds where name = 'Default World'),
       'msg $i'
     );" >/dev/null
done
# tester3 already sent 0 messages before this loop + the 8 above = 8 total.
# The two sent earlier (filter test was tester2). Send 2 more to hit 10.
query_as_authenticated "$TESTER3" \
  "select public.worldnest_send_chat(
     (select id from public.worlds where name = 'Default World'),
     'msg 9'
   );" >/dev/null
query_as_authenticated "$TESTER3" \
  "select public.worldnest_send_chat(
     (select id from public.worlds where name = 'Default World'),
     'msg 10'
   );" >/dev/null

RATE_RESULT="$(query_as_authenticated "$TESTER3" \
  "select public.worldnest_send_chat(
     (select id from public.worlds where name = 'Default World'),
     'msg 11 should fail'
   );")"
expect "send_chat rate limited" \
  "$(echo "$RATE_RESULT" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('reason',''))" 2>/dev/null || echo "parse_error")" \
  "rate_limited"

echo
if [ "$failures" -ne 0 ]; then
  echo "FAILED: $failures assertion(s) did not hold"
  exit 1
fi

echo "SQL verification passed."
