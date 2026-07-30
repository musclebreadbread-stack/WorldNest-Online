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

echo
if [ "$failures" -ne 0 ]; then
  echo "FAILED: $failures assertion(s) did not hold"
  exit 1
fi

echo "SQL verification passed."
