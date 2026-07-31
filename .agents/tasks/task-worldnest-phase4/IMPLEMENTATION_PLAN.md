# Implementation Plan — WorldNest Online Phase 4 (server authority, a real cave dimension, living world)

Goal: build everything the Phase 3 plan's closing "Deferred, and still true after item 31" list names,
in the order the code makes it cheap — **server authority over the economy** (the largest single piece
of work in the project so far), a **real cave dimension** on a second world layer, **NPC schedules**,
**seasons, weather and temperature effects**, **biome-dependent crops**, a **`build` objective
baseline**, a first real user for **`placeableTile`**, and the **`.prettierrc` reconciliation** — plus
the three deliverables the user asked for by name: the work itself, a Korean summary of the results,
and a Word-openable document listing every step the maintainer must still perform by hand.

Baseline: branch `feat/mvp-foundation`, HEAD `c585d62`. `main` has no commits; the whole project lives
on this branch, which is pushed. All Phase 4 work stays on a branch. The authoritative record of what
the codebase does today is the two completed plans — read both before starting:

- `.agents/tasks/task-worldnest-phase3/IMPLEMENTATION_PLAN.md` (31 items, D1-D18, seven appended
  "Implementation notes" sections)
- `.agents/tasks/task-worldnest-phase2/IMPLEMENTATION_PLAN.md` (28 items, the ECS core, persistence
  and the client-authoritative posture)

Verified baseline gates on `c585d62`:

| Command | Result |
|---------|--------|
| `pnpm lint` | 9 turbo tasks, 5 real lint tasks, no warnings or errors |
| `pnpm build` | 5/5 packages |
| `pnpm test` | shared 24, game-engine 263, web 290 = **577** |
| `pnpm test:e2e` | 3/3 chromium specs, actually executed against `next start` |
| `pnpm db:verify` | 6 SQL files, 18 assertions, exit 0 |
| `pnpm docs:check` | 62 headings match between the `.md` and the `.doc` |
| `docker build` | image builds |

---

## Ground rules for the implementing agent

- Continue on `feat/mvp-foundation`, or branch `feat/phase4-authority` off it. Never commit to `main`.
- One conventional commit per numbered item. Scopes: `game-engine`, `web`, `shared`, `database`, `ui`,
  plus `docs:` for documentation-only commits and `style:` for item 1.
- After every item the repo must be buildable: `pnpm build` green. Every item's stated verification
  must actually be run, and its result recorded.
- **Use the real ECS API.** `docs/DEVELOPMENT.md` is accurate: `Component` takes a string type
  (`super("position")`), `System` takes `requiredComponents: string[]` and implements
  `update(entities: Entity[], deltaTime: number)`, lookup is `entity.getComponent<T>("type")`, and
  `world.addSystem()` insertion order **is** execution order.
- Systems take collaborators by **constructor injection**, never by reaching into the `World`. Pure
  logic goes in a sibling directory as free functions (`inventory/inventoryOps.ts`,
  `shop/shopOps.ts`, `quests/questOps.ts`, `dialogue/dialogueOps.ts`). Components stay data-only.
  Systems own their indexes and expose them as narrow query interfaces.
- **React and every async callback write to the engine only through injected callbacks** (Phase 3
  decision D13). There are five instances today (`chatStore.sender`, `touchStore` flags,
  `dialogueStore`, `shopStore`, `questStore`), all following one template. Item 8 adds the sixth and it
  must follow the same template: a request field on a component, consumed by the owning system.
- Every new component/system/module is exported from the relevant barrel (`components/index.ts`,
  `systems/index.ts`, `world/index.ts`, `src/index.ts`) and covered by Vitest in `src/__tests__/`.
- World generation stays deterministic from `WORLD_SEED`. Player-caused terrain change keeps going
  through the override layer. Anything derived from time must be derived from the **wall clock**
  (`Date.now() - WORLD_EPOCH_MS`), never accumulated from frame deltas — Phase 2 decision D3, and the
  reason weather, seasons and NPC schedules in this plan are pure functions rather than simulations.
- Terrain-dependent web tests use `apps/web/src/__tests__/helpers/terrain.ts`
  (`findFacingPair`, `findWalkableNeighbourOf`) rather than literal coordinates. That helper path is
  not collected as a suite because Vitest's include is `src/__tests__/**/*.test.ts?(x)`. Engine tests
  for harvest, crops, build and collision use hand-written fake `TileQuery` objects.
- Phaser is only reached through `dynamic(..., { ssr: false })` or a dynamic `import()`. Anything a
  jsdom test must reason about must not live in a module that imports Phaser — importing Phaser under
  jsdom fails inside `checkInverseAlpha`. That is why `panelStack.ts`, `minimapLayout.ts` and
  `createGameWorld.ts` are Phaser-free, and it applies to every module this plan adds.
- New DB objects go in numbered migration files with RLS enabled and policies scoped to `auth.uid()`.
  **Next is `004`; this plan writes `004` and `005`.** Both must be **re-runnable** (see decision D6).
  Every table in `packages/database/src/types.ts` must carry `Relationships: []` or postgrest-js 2.111
  resolves insert/upsert arguments to `never[]`.
- **Do not restate policy counts, table counts or test counts in prose documentation.** Point at
  `pnpm db:verify` and `pnpm test`. A number in prose drifts; a number asserted in a script does not.
- `CONTRIBUTING.md` caps files at ~300 lines. Sizes at `c585d62`: `gameWorld.test.ts` 671 (a test file,
  already over), `createGameWorld.ts` **296** (the tightest constraint in the codebase — item 2 exists
  to fix it), `SessionPersistence.ts` 281, `BootScene.ts` 270, `GameScene.ts` 236, `HudBridge.ts` 200,
  `PlayerController.ts` 169, `keyBindings.ts` 145, `loadSession.ts` 110.
- **Item 1 reconciles `.prettierrc` and is the only item that runs `pnpm format`.** From item 2 onward,
  `pnpm format:check` is a real gate and every item must leave it green. Prettier normalises
  `*emphasis*` to `_emphasis_`; new prose uses `_`.
- Audience is ages 10-18 worldwide: safe for children, no violence, no gambling, no mature content,
  cosmetics-only with no pay-to-win. **Weather must not become a hazard that harms the player**
  (decision D14 below), NPC schedules stay wholesome, and every new user-visible string needs a natural
  translation in all 12 locales or five parity tests fail.
- There is **no display, no browser, no audio device and no reachable hosted Supabase project** in the
  sandbox. Substitute engine-level or jsdom assertions for every visual check, as all three previous
  phases did. **SQL genuinely is verifiable** — `pnpm db:verify` is the workhorse of this phase.

---

## Design decisions made for this plan (no design doc existed)

### Server authority

- **D1 Server authority is Postgres RPC, not Supabase Edge Functions.** An Edge Function is Deno code
  deployed by the Supabase CLI against a hosted project; there is no hosted project here, so it could
  only ever be shipped unexecuted — exactly the gap Phase 3 item 24 closed for the migrations. A
  Postgres function ships inside a numbered migration and is exercised for real by `pnpm db:verify`.
  **Probed in this sandbox, and every element works** (`postgres:16-alpine`, the existing `auth`
  test double):
  - `set role authenticated; set "request.jwt.claim.sub" = '<uuid>'` makes `auth.uid()` resolve and RLS
    apply — a `select count(*) from player_state` returned `1` of the 3 seeded rows.
  - A bare Postgres grants `authenticated` **nothing**, so the same select without grants fails with
    `ERROR: permission denied for table player_state`. That is why decision D6 puts Supabase's default
    grants in the test double.
  - `revoke update on player_state from authenticated; grant update (x, y, chunk, last_online,
    inventory) on player_state to authenticated` → `update ... set coins = 99999` fails with
    `ERROR: permission denied for table player_state` while `update ... set x = 42` succeeds.
  - An `insert ... on conflict do update` that mentions `coins` is refused; the same upsert without
    `coins` succeeds. **This is a real code consequence: `savePlayerState` must stop sending `coins`.**
  - A `security definer` function that updates `coins` and reads `auth.uid()` internally works when
    called as `authenticated`.
  - `jsonb_path_query_first(inventory, '$.slots[*] ? (@.itemId == "wood")')` reads the persisted
    inventory from SQL, so a plausibility check inside a function is possible.
- **D2 What becomes authoritative, precisely: coins and quest completion. Not inventory, position,
  harvests or crops.** There is no server tick and no server-side simulation, so terrain edits,
  harvests, crop growth and inventory contents cannot be validated — validating them would mean
  re-implementing the game in SQL. What _can_ be made authoritative is anything rule-bound and
  discrete. Every coin movement in the game is one of exactly three things: a shop trade at a
  catalogued price, a quest reward at a catalogued amount, or the one-time starting purse. All three
  are expressible in SQL. So the guarantee this phase delivers, and the only one it may claim, is:
  **a client can no longer set its coin balance to an arbitrary number, and a quest reward is paid at
  most once, at exactly the catalogued amount, with every movement recorded in an auditable ledger.**
  A forged inventory is still possible and must keep being documented as such.
- **D3 Authority is enforced by column privileges, not by triggers.** `revoke update on player_state`
  followed by a per-column `grant` is declarative, is visible in `information_schema`, and cannot be
  bypassed by a client that only speaks PostgREST. For `player_quests`, the same trick expresses the
  whole rule with no procedural code: `state` gets a default of `'active'`, and `insert`/`update` are
  granted on every column **except** `state` — so a client may take a quest on and may move `progress`,
  and only a `security definer` function can ever write `'completed'`. A trigger guarded by a
  transaction-local GUC was considered and rejected: it is more code, and it fails open if the GUC name
  is ever typo'd, whereas a missing grant fails closed.
- **D4 The client keeps its optimistic simulation; the server reconciles.** The engine already trades
  and pays out instantly, which is what makes the game playable with no backend at all, and matches the
  "client-authoritative with optimistic display" posture movement already has. Reconciliation is one
  new field, `WalletComponent.requestedBalance`, applied by `ShopSystem` — the wallet's owning system —
  so the injected-callback seam (D13) still holds and no async code touches ECS state directly. When
  the server disagrees, the balance snaps to the server's number and the player is told once.
- **D5 The starting purse becomes a column default, which deletes a subtle special case.** Migration
  `004` sets `player_state.coins` default to `50` and backfills existing zero rows once. The client can
  no longer write `coins`, so it cannot grant itself the starting purse anyway — and the whole
  "coins are judged from the row, not the column" rule that Phase 3 item 27 needed (`hasSaved =
  hasSpawn || inventory !== null`) disappears with it. `loadSession` simply trusts the column, and
  `createGameWorld`'s `bootstrap.coins ?? STARTING_COINS` fallback survives for the no-backend path
  only. `STARTING_COINS` in `@worldnest/shared` and the SQL default are pinned to each other by the
  parity test in item 5.
- **D6 Supabase's default table grants belong in the test double; migration `004` contains only the
  deliberate lockdown.** A real Supabase project grants `authenticated` full privileges on everything
  in `public` through default privileges, which is why RLS is the only thing protecting those tables
  today. A bare Postgres grants nothing (probed), so `auth_stub.sql` — which exists to reproduce the
  Supabase environment — gains those grants, and `004` contains only the revokes and per-column
  re-grants that are the actual security change. The alternative (putting every grant in `004`) would
  mean the migration silently re-granting things on a real project and the harness testing a privilege
  set no real project has.
- **D7 Every coin movement is written to an append-only ledger, and the ledger is what makes the
  guarantee checkable.** `coin_ledger` has a select policy for its owner and **no insert, update or
  delete grant or policy for `authenticated` at all** — only the `security definer` functions write it.
  It carries the balance after each movement, so a maintainer can audit an account with one query, and
  it is also the rate limiter's data source: a function refuses when the caller has already written
  more than `MAX_LEDGER_ENTRIES_PER_MINUTE` rows in the last minute. This is the honest first step
  toward the admin/analytics dashboard the brief mentions, and it is the only part of it worth building
  now.
- **D8 Phase 3's decision D14 — no player-to-player trading — still stands, and this plan says what
  would have to be true first.** Authoritative coins are not sufficient: a trade moves _items_, and
  items are still client-authored, so a modified client could mint goods for other players even with a
  perfect coin ledger. Trading needs authoritative **inventory**, which needs the server to know what a
  legal harvest is, which needs a server-side simulation of the world clock, terrain and energy budget.
  That is a separate project and item 21 documents it in exactly those terms.
- **D9 A sell is not validated against the persisted inventory.** It is technically possible (probed),
  but the persisted inventory lags the live one by up to one autosave interval, so a player who
  harvests wood and immediately sells it would be refused. A false refusal is a worse product than an
  unvalidated sale, and the rate limit plus the fixed price already bound the abuse. The function
  validates the item, the direction, the quantity bounds and — for a purchase — the balance.

### The cave dimension

- **D10 The cave dimension is a layer owned by `WorldManager`, not a third coordinate on `TileQuery`.**
  The player is on exactly one layer at a time, and every consumer (collision, harvest, build, plant,
  minimap, renderer) only ever asks about the layer the player is on, so `TileQuery` stays a two-argument
  interface and not one of the seventeen systems changes shape. `WorldManager` gains an active layer,
  `setLayer` unloads every chunk and resets the streaming guard so the next frame reloads, and the
  generator takes the layer as an argument. This is the whole reason the change is affordable at all.
- **D11 Surface override keys keep the exact `"x,y"` format; only underground keys are prefixed.**
  `getLayerTileKey(layer, x, y)` returns `"x,y"` for the surface and `"1:x,y"` underground. Every
  persisted `world_modifications` row written before this phase therefore keeps its meaning, every
  existing test that builds a key with `getTileKey` keeps passing, and migration `005` only has to add
  a `layer smallint default 0` column whose default is right for every existing row.
- **D12 Building and planting stay surface-only, so `structures` and `crops` need no layer column.**
  `CAVE_FLOOR` and the new `CAVE_ENTRANCE` become `buildable: false`, which by construction stops a
  fence underground; farmland is only reachable by tilling `GRASS`, and there is no grass underground,
  so crops are impossible there already. This keeps both systems' tile-keyed indexes two-dimensional
  and keeps `SessionPersistence`'s structure and crop diffs untouched. `isNpcPlaceableTile` already
  excludes cave tiles explicitly, so NPC placement is unaffected.
- **D13 The ladder is one tile type present at the same coordinates on both layers, and the layer is
  deliberately not persisted.** A surface cave mouth — the existing "cave floor bordering walkable
  non-cave land" condition the generator already computes — becomes `CAVE_ENTRANCE` instead of
  `CAVE_FLOOR`, and the underground layer forces `CAVE_ENTRANCE` plus walkable neighbours at the same
  coordinates. A player who saves underground therefore reloads on the surface **on a walkable tile by
  construction**, with no layer column on `player_state` and no risk of resuming inside rock.
- **D14 Underground is visually single-player, and that is recorded rather than fixed.** The layer is
  not part of the network payload, so remote players and every surface entity are simply not drawn
  while the local player is underground, and the layer-aware blocker guard stops a surface fence or
  villager from blocking a corridor below it. Broadcasting the layer is a protocol change
  (`NetworkSyncSystem`'s payload plus the presence body) and it is noted as the one-line-per-side
  follow-up, not attempted here.

### The living world

- **D15 NPC schedules are derived from the wall clock, exactly like `WorldClock`.** Phase 3 decision
  D12 kept NPCs static because a wandering NPC drifts per client for the same reason an
  accumulated-delta clock does. A **schedule** has neither problem: `scheduledAnchor(definition,
  snapshot)` is a pure function of the clock, so every client computes the same anchor for the same
  minute with zero coordination, and `resolveNpcTile` snaps it the same deterministic way it already
  snaps the fixed anchor. The sprite is lerped toward the scheduled tile purely for looks; the tile
  index — the thing collision and conversation read — jumps, and is always the derived value.
- **D16 Weather and seasons are derived, not simulated.** `seasonForDay(day)` and
  `weatherAt(periodIndex, biome, season)` are pure functions; the weather period index is
  `floor(totalMinutes / WEATHER_PERIOD_MINUTES)` and the choice is a hash of that index, the biome and
  the season, seeded from `WORLD_SEED`. Nothing is stored, nothing is broadcast, no server is needed,
  and two clients standing together always see the same sky. Snow only falls in cold biomes, aurora
  only at night in the cold ones, a rainbow only in daylight after rain — all expressible as pure
  conditions and all unit-testable without a canvas.
- **D17 Weather modulates energy regeneration and nothing else. It never harms the player.** The
  audience is 10-18 and the brief forbids hazards, so there is no cold damage, no drowning, no storm
  that hurts. A biting winter night regenerates energy more slowly; a mild spring day regenerates it
  faster; `StatsComponent.health` is not touched by any of it. This is enforced by a test asserting
  that no environment value can produce a negative multiplier or change health.
- **D18 Biome and season gating lives on `CropDefinition`, and a refusal is audible.**
  `CROP_DEFINITIONS` entries gain optional `biomes` and `seasons` allow-lists, `PlantSystem` refuses to
  sow outside them, and the refusal bumps a new `InteractionComponent.refusals` counter that
  `readSoundState` folds into the existing `deny` cue — so the player hears why nothing happened rather
  than pressing `E` at a confusing patch of soil. Two new crops are added (a cool-climate carrot and a
  hot-climate melon) because a gate with one crop behind it is a gate nobody can see.

### The loose ends

- **D19 The `build` objective baseline is a third field on `QuestEntry`, and it has to be persisted.**
  `activateQuest` records how many matching structures already stood when the quest was taken on, and
  `objectiveProgress` subtracts it. Nothing else works: the count is polled from the world, so without
  a stored baseline a reload re-completes the quest. `player_quests` gains a `baseline integer default
  0 not null` column in migration `005`, and `questSnapshot.ts` round-trips it with the same validation
  `progress` already gets.
- **D20 `placeableTile` gets exactly one real user.** A new `path_stone` item and `TileType.PATH = 12`
  give `BuildSystem` a tile-placing branch: the item overrides the target tile through
  `setTileOverride` instead of spawning a structure entity. The alternative — deleting the unused field
  — was rejected because a decorative path is genuinely wanted, it costs one tile, one item and one
  branch, and it persists for free through the existing `world_modifications` path.
- **D21 `.prettierrc` moves to `printWidth: 88` and lands first, as a lone `style:` commit.** Measured
  on `c585d62`: reformatting at the configured `printWidth: 100` rewrites **118** files, while moving
  the config to 88 — which is what the tree is actually hand-wrapped at — rewrites **73**. Smaller
  diff, and it matches the code that exists rather than fighting it. Landing it **first** means every
  later item in this plan is verified with a plain `pnpm format:check` and the trap is gone for the
  whole phase; landing it last would leave twenty items still hand-checking files. It does not bury a
  review because it is one commit that changes nothing but whitespace, and because a new
  `format:check` script wired into CI turns "the tree is formatted" into a gate that cannot silently
  regress again. `.agents/` is added to a new `.prettierignore` so the three historical plan files stay
  byte-exact.
- **D22 The user's "Word 문서 파일" is a second, _generated_ `.doc` — not a second hand-maintained
  Korean document.** Phase 3 decision D18 chose one Korean document because a second would drift, and
  that reasoning is still right. But the user asked specifically for a Word-openable file listing what
  they have to do by hand, and `docs/SETUP_GUIDE_KR.doc` is a 754-line full setup guide in which that
  list is section 10. So item 23 adds `scripts/build-manual-work-doc.mjs`, which slices section 10 out
  of the existing `.doc` mirror's HTML — no markdown-to-HTML conversion, no new dependency — wraps it
  in the same `<head>`/`<style>`, and writes `docs/MANUAL_WORK_KR.doc`. `pnpm docs:check` then asserts
  the generated file matches what the generator would produce right now, so it is impossible for it to
  drift: it is a derived artefact with a freshness gate, not a second source of truth.

### Judged out of scope, with the reason

- **A server-side simulation, and therefore authoritative inventory, harvests and crop growth.** See
  D2. This is the boundary of what one phase can honestly do, and it is also the reason trading stays
  out (D8).
- **Animals and pets.** The schedule machinery this phase builds (D15) is most of what a wandering
  animal needs, so this becomes cheap _after_ Phase 4 — but a pet is also per-player persisted state, a
  care loop, new textures and new UI, on top of server authority in the same phase. Deferred as the
  single most reachable next feature, not as a rejection.
- **More mini-games.** There is no mini-game framework at all: each one is a new Phaser scene, its own
  input handling, scoring, persistence and 12-locale copy. Nothing in the codebase makes the second one
  cheaper than the first, which is what "framework" would have to mean.
- **An ESG / sustainability mission system.** This is content over the existing quest system rather
  than new machinery, so it is cheap in code and expensive in copy: every mission is a title, a
  description and a completion line in twelve languages. Recorded as the cheapest content-only
  expansion available, and left out so this phase's translation budget goes to weather and seasons,
  which have no other way to be legible.
- **Guilds and friends.** Needs new tables, an invitation flow, moderation, and — the blocker —
  cross-player reads, which `player_state`'s deliberately owner-only select policy forbids. Opening
  that up is a security decision that deserves its own phase, and a social graph for 10-18 year olds
  needs a safety design before it needs a schema.
- **A museum / collection system.** One new per-player table and one panel; genuinely medium-sized.
  Left out only because it competes with server authority for the same phase, and noted as the second
  most reachable next feature after pets.
- **A modding SDK.** Publishing an API is a commitment to keep it stable, and the engine's surface is
  still moving in this very phase (a new layer argument, a new system, three new components). Doing it
  now would either freeze the wrong shape or ship a version nobody can rely on.
- **An admin / analytics dashboard.** Every route in `apps/web/app/` is `"use client"` and there is no
  server route anywhere, so reading aggregate data would need either a service-role key in the browser
  (never) or the app's first server-side surface. The `coin_ledger` from D7 is the part of this that is
  worth having now, and it is built.
- **`pnpm db:verify` in CI.** Deferred again, for the reason the Phase 3 notes recorded: the script
  starts its own container and runs everything through `docker exec … psql`, so adopting a GitHub
  `services: postgres` block means rewriting it to take a connection string and giving up
  runnable-by-a-maintainer-with-only-Docker. That is a change to the thing being verified, not a CI
  tweak. Item 1 does add `format:check` to CI, which is a genuine gate with no such cost.

---

## Facts as of `c585d62` (surveyed or probed, not assumed)

- **Terrain**, over tiles `(0, 0)`-`(95, 95)` with `WORLD_SEED = 42`: water 3423, grass 1715, sand
  1533, forest 969, snow 508, stone 486, flowers 257, cave floor 232, cave wall 68, ore 25. All six
  biomes occur. Default spawn `(496, 336)` is tile `(15, 10)`, grass, in grassland. **Do not hard-code
  any of these**; use `apps/web/src/__tests__/helpers/terrain.ts`.
- **NPC anchors** for this seed resolve to exactly `13,11` (Pip), `18,10` (Juno) and `15,13` (Ada) —
  again, do not hard-code them; the existing tests search `NpcSystem.getNpcs()`.
- **`ChunkGenerator`** has five channels: elevation, moisture, detail (`seed + 2000`), temperature
  (`seed + 3000`), caves (`seed + 4000`). Thresholds: water `< -0.3`, sand `< -0.1`, stone `> 0.6`,
  accent detail `> 0.5`, cave `> 0.2`, ore detail `> 0.6`. A cave tile bordering un-hollowed rock
  becomes `CAVE_WALL`; where the mountain slopes below the rock line the cave **opens onto the
  surface**, and that mouth is what decision D13 turns into a ladder.
- **Tile ids** run 0-10 with `FARMLAND = 6` override-only. This plan adds `CAVE_ENTRANCE = 11` and
  `PATH = 12`. `world_modifications.tile_type` is a smallint, so ids only ever append.
- **Registration order** today, pinned by a test asserting `Object.keys(context.systems)` against
  `docs/ARCHITECTURE.md`: Time → Input → Collision → Movement → Chunk → Interpolation → Stats → Npc →
  Shop → Quest → Plant → CropGrowth → Build → Harvest → NetworkSync → Animation → Render. This plan
  inserts **Environment** after Time (item 16) and **Layer** immediately before Plant (item 10), and
  every item that changes it must update both that test and the document.
- **i18n**: `en.ts` is 115 keys, twelve complete catalogues, five parity tests. `LOCALE_AGNOSTIC_KEYS`
  has three entries. `ITEM_NAME_KEYS: Record<ItemId, MessageKey>` means **adding an item to
  `@worldnest/shared` fails to compile until it has a translation key** — this plan adds five items and
  roughly 26 keys in total, so budget twelve edits per key.
- **`pnpm db:verify`** asserts `EXPECTED_POLICIES_AFTER_002=23` and `EXPECTED_POLICIES_AFTER_003=27`.
  Items 3 and 12 add the equivalent constants for `004` and `005`, set to whatever the migrations
  actually write. Do not guess the number: run it and assert what you see.
- **`docs:check`** passes at 62 headings. Any new `##`/`###` heading in `docs/SETUP_GUIDE_KR.md` must be
  mirrored in `docs/SETUP_GUIDE_KR.doc`.
- **Prettier**: 118 files differ at the configured `printWidth: 100`, 73 at 88, 62 of those excluding
  markdown. Three places document the trap and must be corrected by item 1:
  `CONTRIBUTING.md:101`, `docs/DEVELOPMENT.md:488-490`, `README.md:138`.

---

## Suggested delegation batches

Each batch leaves the tree green, so a coder delegation can take a contiguous range:
**A (1-2)**, **B1 (3-5)**, **B2 (6-8)**, **C (9-12)**, **D+E (13-18)**, **F (19-20)**, **G (21-24)**.

Batch A must go first: item 1 removes the formatting trap for the whole phase and item 2 creates the
line budget in `createGameWorld.ts` that items 8, 10 and 16 all need. B1 must precede B2 (the SQL has
to exist before the TypeScript that calls it). C is independent of B. D+E depend on nothing but A.
F item 19 depends on migration `005` from item 12. G is last and item 24 is the final gate.

---

# Implementation Plan

## Phase A — Groundwork and headroom (items 1-2)

- [x] 1. Reconcile `.prettierrc` with the tree, as one mechanical `style:` commit, and turn it into a
      gate (decision D21). Set `printWidth: 88` in `.prettierrc`. Add `.prettierignore` covering
      `node_modules/`, `dist/`, `.next/`, `.turbo/`, `test-results/`, `playwright-report/`,
      `pnpm-lock.yaml` and **`.agents/`** (so the three historical plan files stay byte-exact). Add a
      root script `"format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\""`, then run
      `pnpm format` **once** and commit the result. Rewrite the three places that document the old trap
      so they now say the opposite: `CONTRIBUTING.md` (the "ESLint & Prettier" bullet), the scripts
      table plus the caveat blockquote in `docs/DEVELOPMENT.md`, and the `pnpm format` row in
      `README.md`. Add a `Check formatting` step running `pnpm format:check` to the `ci` job in
      `.github/workflows/ci.yml`, so the tree can never silently drift out of format again. Leave the
      commit message explicit that the diff is whitespace only.
      Files: `.prettierrc`, `.prettierignore`, `package.json`, `.github/workflows/ci.yml`,
      `CONTRIBUTING.md`, `docs/DEVELOPMENT.md`, `README.md`, plus the ~73 files prettier rewrites
      Verify: `pnpm format:check` exits 0 with nothing listed; then `pnpm lint && pnpm build && pnpm
      test && pnpm docs:check` — 5 lint tasks clean, 5/5 builds, 577 tests still green (formatting must
      not change behaviour), and the Korean doc pair still matches at 62 headings because repadding a
      markdown table does not touch a heading.

- [x] 2. Give `createGameWorld.ts` room before three later items add to it. It is at **296** of the
      ~300 cap and items 8, 10 and 16 all add to it. Extract the player entity into a new Phaser-free
      `apps/web/src/game/playerEntity.ts` exporting `PLAYER_COLLIDER_SIZE`, `STARTING_WHEAT_SEEDS` and
      `createPlayerEntity(bootstrap): Entity` — the component assembly plus the three "granted only
      when nothing was saved" seeding rules for the inventory, the purse and the quest log.
      `createGameWorld.ts` re-exports the two constants so `loadSession`, `SessionPersistence` and the
      existing tests are not touched, exactly as `savedWorld.ts` was extracted in Phase 3.
      Files: `apps/web/src/game/playerEntity.ts`, `apps/web/src/game/createGameWorld.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build && pnpm format:check` — 290 web tests
      unchanged and green (this is a pure move), and `createGameWorld.ts` is back under 220 lines.

## Phase B1 — Server authority: the SQL, and proving it (items 3-5)

- [ ] 3. Write `004_authority_schema.sql` — the whole authority migration in one file, because a
      maintainer pastes one file (decisions D1-D7). It must be **re-runnable**: `create table if not
      exists`, `drop policy if exists` before each `create policy`, `create or replace function`, and
      `insert … on conflict … do update` for the seeded reference rows, so re-running it is also how a
      maintainer refreshes the price table after a catalogue change. Contents:
      - `public.shop_prices (item_id text primary key, buy integer not null check (buy > 0), sell
        integer not null check (sell > 0), check (sell < buy))`, seeded from `ITEM_PRICES` — this is the
        server's own copy of the price list and the reason a client cannot name its own price.
      - `public.quest_rewards (quest_id text primary key, target integer not null check (target > 0),
        reward_coins integer not null check (reward_coins >= 0), reward_items jsonb not null default
        '[]'::jsonb)`, seeded from `QUEST_DEFINITIONS`.
      - `public.coin_ledger (id uuid primary key default uuid_generate_v4(), player_id uuid references
        public.profiles(id) on delete cascade not null, delta integer not null, reason text not null
        check (reason in ('shop_buy','shop_sell','quest_reward')), ref text, balance_after integer not
        null check (balance_after >= 0), created_at timestamptz default now() not null)` plus an index
        on `(player_id, created_at desc)` for the rate-limit lookup.
      - RLS on all three: `select` for `authenticated` scoped to `auth.uid() = player_id` on
        `coin_ledger` and unrestricted `select` on the two reference tables. **No insert, update or
        delete policy or grant on `coin_ledger` for `anon` or `authenticated`** (decision D7).
      - The lockdown (decision D3): `alter table public.player_state alter column coins set default
        50`; a one-time `update public.player_state set coins = 50 where coins = 0` with a comment
        saying it is a backfill for rows created before this migration; `revoke insert, update on
        public.player_state from anon, authenticated` then `grant insert (player_id, x, y, chunk,
        last_online, inventory), update (x, y, chunk, last_online, inventory) … to authenticated`; and
        for quests, `alter table public.player_quests alter column state set default 'active'`,
        `revoke insert, update on public.player_quests from anon, authenticated`, then `grant insert
        (player_id, quest_id, progress, updated_at), update (progress, updated_at) … to authenticated`.
      - `public.worldnest_shop_trade(p_kind text, p_item_id text, p_quantity integer) returns jsonb`
        and `public.worldnest_claim_quest_reward(p_quest_id text) returns jsonb`, both `language
        plpgsql security definer set search_path = public`, both followed by `revoke execute … from
        public` and `grant execute … to authenticated`. Each one resolves `auth.uid()` and returns
        `{"ok": false, "reason": "unauthenticated"}` when it is null; locks the caller's `player_state`
        row `for update`; validates its arguments (`p_kind in ('buy','sell')`, `p_quantity between 1 and
        99`, the price or reward row exists); refuses when the caller has written more than
        `MAX_LEDGER_ENTRIES_PER_MINUTE` (use 60) ledger rows in the last minute; and on success writes
        the new balance, inserts the ledger row and returns `{"ok": true, "coins": <balance>}`. A buy is
        refused when the balance is short. A sell is **not** validated against the persisted inventory
        (decision D9). A quest reward is refused unless the row exists, is `'active'`, and its
        `progress >= quest_rewards.target`; on success it sets `state = 'completed'` — the only place in
        the system that can — and pays `reward_coins` exactly once, which re-running proves by
        refusing with `{"ok": false, "reason": "already_completed"}`.
      Files: `packages/database/supabase/migrations/004_authority_schema.sql`
      Verify: `pnpm db:verify` — the harness does not assert the new file yet, so extend it minimally
      here to apply `004` **twice** (proving re-runnability, the way it already applies the seed twice)
      and to assert the policy count either side of it via a new `EXPECTED_POLICIES_AFTER_004` constant
      set to the number the migration actually writes. Exit 0.

- [ ] 4. Prove the authority, as `authenticated`, against real Postgres. Add the Supabase default table
      grants to `packages/database/supabase/test/auth_stub.sql` (decision D6) — `grant usage on schema
      public` plus `grant all on all tables in schema public to anon, authenticated, service_role` and
      the matching `alter default privileges`, with a comment that this reproduces what a real project
      grants and is precisely why `004`'s revokes are the security change. Extend
      `scripts/verify-sql.sh` with a `query_as_authenticated <uuid> <sql>` helper (one `docker exec …
      psql -c "set role authenticated; set \"request.jwt.claim.sub\" = '<uuid>'; <sql>"` — one `-c` is
      one session, so a plain `set` suffices) and an `expect_denied` helper, then assert, all against a
      seeded tester account:
      - `update player_state set coins = …` is **denied** (`permission denied for table player_state`),
        and `update player_state set x = …` still succeeds;
      - an `insert … on conflict do update` mentioning `coins` is denied and the same upsert without
        `coins` succeeds — the client's real write path;
      - `insert into player_quests (…, state) values (…, 'completed')` is denied, and
        `update player_quests set state = 'completed'` is denied, while `update … set progress = …`
        succeeds;
      - `insert into coin_ledger …` is denied;
      - `select worldnest_shop_trade('buy','fence',1)` returns `ok=true`, moves the balance by exactly
        the `shop_prices` amount and writes one ledger row; a second call with a quantity the balance
        cannot cover returns `ok=false` and moves **nothing**; `('buy','not_an_item',1)`,
        `('sideways','fence',1)`, quantity `0` and quantity `1000` are each refused;
      - `worldnest_claim_quest_reward` refuses an unmet objective, pays a met one exactly once, refuses
        the second attempt, and leaves `state = 'completed'` behind;
      - a brand-new account provisioned by the trigger has `coins = 50` (decision D5).
      Files: `packages/database/supabase/test/auth_stub.sql`, `scripts/verify-sql.sh`
      Verify: `pnpm db:verify` — exit 0, with the assertion count risen well above 18 and every new
      line printed as `ok`. Deliberately break one revoke in `004` once to confirm the harness turns
      red, then restore it.

- [ ] 5. Pin the SQL reference tables to the client catalogues with tests, so they cannot drift. Add
      `packages/shared/src/__tests__/authoritySql.test.ts`, which reads
      `packages/database/supabase/migrations/004_authority_schema.sql` relative to `import.meta.url`
      and asserts: every `shop_prices` row matches `ITEM_PRICES` exactly in both directions (no missing
      item, no extra row, identical `buy`/`sell`), and the `coins` column default in the migration
      equals `STARTING_COINS`. Add the mirror for quests as
      `packages/game-engine/src/__tests__/authoritySql.test.ts`, asserting every `quest_rewards` row
      matches `QUEST_DEFINITIONS` (`target` equals `objectiveTarget(objective)`, `reward_coins` equals
      `rewards.coins`, `reward_items` equals `rewards.items`) in both directions. The quest test lives
      in the engine because `QUEST_DEFINITIONS` does, and `@worldnest/database` has no Vitest harness
      by design.
      Files: `packages/shared/src/__tests__/authoritySql.test.ts`,
      `packages/game-engine/src/__tests__/authoritySql.test.ts`
      Verify: `pnpm --filter @worldnest/shared test && pnpm --filter @worldnest/game-engine test` — both
      new suites pass. Then change one price in `@worldnest/shared` and confirm the shared suite fails
      until `004` is updated, and revert.

## Phase B2 — Server authority: the client side (items 6-8)

- [ ] 6. Teach `@worldnest/database` about the functions and take `coins` out of the write path.
      Add the two functions to `Database["public"]["Functions"]` in `packages/database/src/types.ts`
      (`Args` and `Returns` per function) so `client.rpc(...)` typechecks instead of resolving to
      `never`, and add `coin_ledger`, `shop_prices` and `quest_rewards` to `Tables` — **each with
      `Relationships: []`**. Add `packages/database/src/authority.ts` exporting
      `AuthorityResult { ok: boolean; coins: number | null; reason: string | null }`,
      `shopTrade(kind, itemId, quantity)`, `claimQuestReward(questId)` and
      `loadCoinLedger(playerId, limit)`, each returning the `DbResult<T>` shape the rest of the package
      uses and each parsing the function's `jsonb` return defensively (an unexpected shape is a
      `reason`, never a throw). Remove `coins` from `PlayerStateSave` and from `savePlayerState`'s
      upsert — the probe in decision D1 proves the write is now refused outright, so leaving it in
      would break every save. Export everything from the barrel.
      Files: `packages/database/src/{types,authority,playerState,index}.ts`
      Verify: `pnpm --filter @worldnest/database build && pnpm lint && pnpm build` — `tsc` accepts the
      `Functions` shape (this is the check that the `rpc` argument types are right), and the web build
      still succeeds, which is what proves nothing else was still passing `coins`.

- [ ] 7. Add balance reconciliation to the engine (decision D4). `WalletComponent` gains
      `requestedBalance: number | null` and `adjustments: number` — the first is what the server's
      answer is written into, the second a counter of how many times the server disagreed, so the HUD
      can tell the player once without polling. `ShopComponent` gains `lastTrade: ShopTrade | null` and
      `tradeSeq: number`, both written by `ShopSystem` on an **accepted** trade only, which is what
      gives item 8 something to send. `ShopSystem` becomes the single applier of `requestedBalance`:
      it consumes it before the frame's trade, clamps it at zero, bumps `adjustments` when the value
      actually differs from the local balance, and leaves `version` alone when it does not — the same
      "only accepted changes publish" rule the rest of the component follows. `QuestSystem` keeps
      crediting a reward optimistically; the server's answer arrives as a reconciliation and wins.
      Files: `packages/game-engine/src/components/{WalletComponent,ShopComponent}.ts`,
      `packages/game-engine/src/systems/ShopSystem.ts`,
      `packages/game-engine/src/__tests__/shop.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — new cases assert that a reconciliation to a
      different number sets the balance and bumps `adjustments`, that a reconciliation to the same
      number changes nothing at all, that a negative server balance clamps to zero, that an accepted
      trade records `lastTrade` and bumps `tradeSeq` while a refused one records neither, and that the
      existing 263 tests still pass.

- [ ] 8. Wire the client to the authority (decisions D2, D4, D5). Add
      `apps/web/src/game/AuthorityBridge.ts` — Phaser-free, constructed with the player entity plus an
      injected `AuthorityClient` (`shopTrade`, `claimQuestReward`) so it is testable with a stub, and
      called once per frame from `GameScene.update` beside `hudBridge.flush()`, which is the pattern it
      copies. Each frame it diffs `ShopComponent.tradeSeq` and the set of quest ids that have newly
      become `completed`, fires the matching RPC, and on the answer writes
      `WalletComponent.requestedBalance` through an injected callback — never touching any other ECS
      state (decision D13). A failed or unreachable call is swallowed exactly as
      `SessionPersistence.write` swallows one: no backend must never interrupt play. It is created only
      when `bootstrap.worldId` is present, the same single switch that turns persistence off. Then:
      drop the `coins` write from `SessionPersistence.writePlayerState` and `coins` from
      `trackPlayerState`'s diff (it now diffs four things, and the wallet is no longer its business);
      simplify `loadSession` to pass `saved.coins` directly and delete the `hasSaved` computation
      (decision D5); and show the adjustment once in `CoinCounter` from a new `hud.coinsAdjusted`
      key, translated into all twelve locales.
      Files: `apps/web/src/game/{AuthorityBridge,SessionPersistence,loadSession}.ts`,
      `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/HudBridge.ts`,
      `apps/web/src/components/CoinCounter.tsx`, `apps/web/src/i18n/messages/*.ts`,
      `apps/web/src/__tests__/{authorityBridge,persistence,sessionPersistence,i18n}.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build && pnpm test:e2e` — the new suite drives
      `AuthorityBridge` against a stub client and asserts one RPC per accepted trade and none for a
      refused one, one claim per quest completion and never a second for the same quest, a server
      balance landing in `requestedBalance`, a rejected trade snapping the balance back, and a
      throwing client leaving the engine untouched; `persistence.test.ts` loses its coin cases and
      gains the "the row's coins are trusted verbatim" one; 3/3 smoke specs still pass.

## Phase C — A real cave dimension (items 9-12)

- [ ] 9. Make the world two-layered in the engine (decisions D10, D11). Add
      `packages/game-engine/src/world/WorldLayer.ts`: `enum WorldLayer { SURFACE = 0, UNDERGROUND = 1 }`
      plus `getLayerTileKey(layer, tileX, tileY)` returning `"x,y"` for the surface and `"1:x,y"`
      underground, and `parseLayerTileKey(key)`. `getTileKey`/`parseTileKey` stay exactly as they are
      and remain the surface codec. Give `ChunkGenerator` a `layer` argument on `generateChunk` and a
      private underground pass: `CAVE_WALL` where the cave channel is below its threshold, `CAVE_FLOOR`
      above it, `ORE` on high detail inside a cavern, and a forced `CAVE_ENTRANCE` with walkable
      orthogonal neighbours wherever the **surface** has an entrance, so a descent can never seal the
      player in. Give `WorldManager` an active layer: `getLayer()`, `setLayer(layer)` which unloads
      every loaded chunk through the existing unload callback and resets `currentCenterX/Y` so the next
      `updateLoadedChunks` reloads, layer-keyed overrides, and a `TileChangeCallback` widened with the
      layer. `setTileOverride` writes on the active layer.
      Files: `packages/game-engine/src/world/{WorldLayer,ChunkGenerator,WorldManager,index}.ts`,
      `packages/game-engine/src/index.ts`,
      `packages/game-engine/src/__tests__/{caves,world-query,chunk-generator}.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — new cases assert that a surface key is
      byte-identical to `getTileKey`'s output (the backward-compatibility promise), that two generators
      with seed 42 produce identical underground chunks, that a 96×96 underground survey contains cave
      floor, wall and ore and **no** grass, water or sand, that every underground tile under a surface
      entrance is walkable, that an override on one layer is invisible from the other, and that
      `setLayer` fires an unload for every loaded chunk. The existing determinism tests pass unchanged
      because `generateChunk`'s layer argument defaults to `SURFACE`.

- [ ] 10. Add the ladder and the descent (decisions D12, D13). Add `TileType.CAVE_ENTRANCE = 11`
      (walkable, **not** buildable, not harvestable, its own colour) to `Tilemap.ts` and flip
      `CAVE_FLOOR` to `buildable: false`, which is what keeps building and planting surface-only. Make
      the surface generator emit `CAVE_ENTRANCE` instead of `CAVE_FLOOR` at a cave mouth — the existing
      "cave tile with a walkable non-cave neighbour" condition, so no new noise channel is involved.
      Add `packages/game-engine/src/systems/LayerSystem.ts` (`["position", "interaction"]`),
      constructed with a `TileQuery` and a `setLayer` callback: on `interactRequested` it resolves the
      faced tile with `getFacedTile`, and if it is a `CAVE_ENTRANCE` it toggles the layer and consumes
      the request — the `PlantSystem` convention of clearing the flag only when it acted. Add
      `layerGuardedBlockers(getLayer, query)` to `world/StructureQuery.ts`, a `StructureQuery` that
      reports nothing blocked while the player is not on the surface, and pass the composed blockers
      through it in `createGameWorld`; give `NpcSystem` the same layer getter so a surface villager
      cannot be talked to from a corridor beneath them. Register `LayerSystem` **immediately before
      `PlantSystem`** — after conversations, shops and quests have had the interact, and before
      anything can till the ground — and update `GameWorldSystems`, the documented-order test and
      `docs/ARCHITECTURE.md`'s order list in the same commit.
      Files: `packages/game-engine/src/world/{Tilemap,ChunkGenerator,StructureQuery}.ts`,
      `packages/game-engine/src/systems/{LayerSystem,NpcSystem}.ts`, the barrels,
      `packages/game-engine/src/__tests__/{layer,caves,npc,build}.test.ts`,
      `apps/web/src/game/createGameWorld.ts`, `apps/web/src/__tests__/gameWorld.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test && pnpm --filter @worldnest/web test` — the
      engine suite asserts facing an entrance and interacting switches the layer, that a second
      interact comes back up, that facing anything else leaves the layer alone **and leaves the request
      for planting**, that `layerGuardedBlockers` reports clear underground and blocked on the surface,
      and that a fence is refused on a cave floor; the web suite's documented-order test now expects
      the eighteen-system list with `layer` in it.

- [ ] 11. Show the cave (decision D14). Widen `OverlayContext` with `layer: WorldLayer` — this is
      genuine per-frame state, which is exactly what the context is for, unlike the `World` and system
      handles that are injected — and populate it in `GameScene.getOverlayContext`. `DayNightOverlay`
      holds a fixed dark tint underground regardless of phase, tweened on the transition with the same
      1 s tween it already uses. `ChunkRenderer` needs no change (the layer switch arrives as unload
      callbacks followed by loads) but `GameScene`'s tile-change callback now takes the layer and
      repaints only when it is the active one. Give `SpriteSync` a layer getter and hide every sprite
      except the local player while underground, since everything else in the world is surface-only by
      construction. Add the `tile_11` texture branch to `BootScene.drawTileDetail` (a ladder) — the
      tile list already derives from `Object.values(TileType)`, so a missing branch would only mean a
      flat colour, never a crash. The minimap needs nothing: it samples through `WorldManager`.
      Files: `apps/web/src/game/{SceneOverlay,DayNightOverlay,SpriteSync}.ts`,
      `apps/web/src/game/scenes/{GameScene,BootScene}.ts`,
      `apps/web/src/__tests__/gameWorld.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build && pnpm test:e2e` — a web test drives
      `createGameWorld`, descends through `LayerSystem`, and asserts the minimap sampler now returns
      cave tiles for the same coordinates that returned grass before; 3/3 smoke specs still pass and
      `GameScene.ts` stays under the ~300 cap.

- [ ] 12. Persist the layer's terrain, and add the quest baseline column (decisions D11, D19). Write
      `005_world_layer_schema.sql`, re-runnable like `004`: `alter table public.world_modifications add
      column if not exists layer smallint default 0 not null` and swap the primary key to
      `(world_id, layer, tile_x, tile_y)` inside a `do $$` block that checks whether `layer` is already
      part of it; `alter table public.player_quests add column if not exists baseline integer default 0
      not null`; and extend the per-column grant on `player_quests` from item 3 to include `baseline`,
      since the client owns it the same way it owns `progress`. Mirror both into
      `packages/database/src/types.ts`, add `layer` to `WorldModificationSave` and change
      `saveWorldModification`'s upsert `onConflict` to `"world_id,layer,tile_x,tile_y"`, add `baseline`
      to `PersistedQuest` and `saveQuest`. On the client, `loadSession` builds override keys with
      `getLayerTileKey(row.layer, …)` and `SessionPersistence.saveTile` passes the layer it was given.
      Files: `packages/database/supabase/migrations/005_world_layer_schema.sql`,
      `packages/database/src/{types,worldMods,progression}.ts`,
      `apps/web/src/game/{loadSession,SessionPersistence}.ts`, `scripts/verify-sql.sh`,
      `apps/web/src/__tests__/persistence.test.ts`
      Verify: `pnpm db:verify && pnpm --filter @worldnest/web test && pnpm build` — the harness applies
      `005` twice, asserts the new primary key contains `layer`, that two rows differing only by layer
      can coexist for one tile (the whole point of the change), that a pre-existing row still reads as
      layer 0, that `baseline` exists and is client-writable while `state` still is not, and sets
      `EXPECTED_POLICIES_AFTER_005` to the count it actually observes.

## Phase D — NPC schedules (items 13-14)

- [ ] 13. Make a schedule a pure function of the clock (decision D15). Add
      `packages/game-engine/src/world/npcSchedule.ts`: `type NpcActivity = "home" | "work" | "market"
      | "rest"`, `interface NpcScheduleEntry { fromHour: number; activity: NpcActivity; tileX: number;
      tileY: number }`, and `scheduledEntry(schedule, snapshot): NpcScheduleEntry` picking the last
      entry whose `fromHour` is at or before the clock's hour, wrapping past midnight to the final
      entry of the day. Give `NpcDefinition` an optional `schedule?: readonly NpcScheduleEntry[]` and
      fill one in for each of the three NPCs — a few tiles of movement each, all near the spawn, all
      wholesome (Pip tends the garden by day and goes home at dusk; Juno opens the stall in the
      morning; Ada waits by the noticeboard and rests at night). An NPC with no schedule keeps its
      fixed anchor, so the field is additive and `resolveNpcTile` is unchanged.
      Files: `packages/game-engine/src/world/{npcSchedule,NpcCatalogue,index}.ts`,
      `packages/game-engine/src/index.ts`, `packages/game-engine/src/__tests__/npcSchedule.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — the suite asserts `scheduledEntry` is total
      over all 24 hours for every catalogued schedule, that hour 0 resolves to the last entry of the
      previous day rather than to nothing, that two calls with the same snapshot are identical (the
      determinism promise), that every schedule is sorted and starts at hour 0, and that every
      `activity` is one of the four.

- [ ] 14. Let the village move (decision D15). `NpcSystem` takes a `ClockSnapshotGetter` and, when the
      scheduled entry for an NPC changes, re-resolves its tile with `resolveNpcTile` (same spiral, same
      `isTaken` set, so placement stays deterministic and collision-free), rewrites the tile index and
      the `PositionComponent` target, and records the activity on `NpcComponent`. The **index jumps**;
      only the sprite is smoothed. Add that smoothing where remote-player smoothing already lives:
      give the NPC entity a `RemoteInterpolationComponent` so `InterpolationSystem` eases it and
      advances its walk animation for free, which is precisely the mechanism Phase 2 built for remote
      players and costs no new system. Show the activity in `DialoguePanel`'s header from four new
      `npc.activity.*` keys, translated into all twelve locales.
      Files: `packages/game-engine/src/systems/NpcSystem.ts`,
      `packages/game-engine/src/components/NpcComponent.ts`, `apps/web/src/game/HudBridge.ts`,
      `apps/web/src/components/DialoguePanel.tsx`, `apps/web/src/game/createGameWorld.ts`,
      `apps/web/src/i18n/messages/*.ts`,
      `packages/game-engine/src/__tests__/npc.test.ts`, `apps/web/src/__tests__/{dialogue,i18n}.test.tsx`
      Verify: `pnpm --filter @worldnest/game-engine test && pnpm --filter @worldnest/web test && pnpm
      build` — the engine suite asserts an NPC's tile changes when the injected clock crosses a
      schedule boundary and not otherwise, that two systems driven by the same clock place every NPC
      identically, that no two NPCs ever share a tile across a whole simulated day, that an NPC always
      lands on a walkable non-cave tile, and that a conversation already open is not interrupted by a
      schedule change; the i18n parity tests cover the four new keys.

## Phase E — Seasons, weather and the environment (items 15-18)

- [ ] 15. Add seasons and weather as pure functions (decision D16). Add
      `DAYS_PER_SEASON = 7` and `WEATHER_PERIOD_MINUTES = 180` to `packages/shared/src/constants.ts`.
      Add `packages/game-engine/src/world/Seasons.ts` (`enum Season { SPRING, SUMMER, AUTUMN, WINTER }`,
      `SEASON_DEFINITIONS` with a `temperatureShift`, and `seasonForDay(day): Season`) and
      `packages/game-engine/src/world/Weather.ts` (`type WeatherKind = "clear" | "rain" | "snow" |
      "fog" | "storm" | "rainbow" | "aurora" | "wind"`, `weatherPeriodIndex(totalMinutes)` and
      `weatherAt(periodIndex, biome, season, phase): WeatherKind`). `weatherAt` hashes the period index
      with `WORLD_SEED` and the biome, then filters by climate: snow only in cold biomes or winter,
      aurora only at night in cold biomes, rainbow only in daylight and only in the period following
      rain, storm never at the same time as fog. Nothing is stored and nothing is broadcast.
      Files: `packages/shared/src/constants.ts`,
      `packages/game-engine/src/world/{Seasons,Weather,index}.ts`,
      `packages/game-engine/src/index.ts`, `packages/game-engine/src/__tests__/weather.test.ts`
      Verify: `pnpm --filter @worldnest/shared test && pnpm --filter @worldnest/game-engine test` — the
      suite asserts `seasonForDay` cycles with period `4 * DAYS_PER_SEASON` and is total for days 1
      through 200, that `weatherAt` is total over every biome × season × phase combination, that it is
      deterministic for the same arguments, that snow never occurs in a desert outside winter, that
      aurora only ever occurs at night, that a rainbow only follows rain, and that a 200-period sweep
      produces at least five of the eight kinds so the sky is not effectively constant.

- [ ] 16. Put the environment in the world (decisions D16, D17). Add `EnvironmentComponent` (data only:
      `season`, `weather`, `biome`, `temperature`, `energyRegenMultiplier`) and `EnvironmentSystem`
      (`["time", "environment"]`), constructed with a `() => Biome` getter, which derives the whole
      snapshot from the clock plus the biome and writes it — with a `version` bumped only when
      something actually changed, the pattern every other component uses. Put the derivation itself in
      a pure `world/environmentOps.ts` (`deriveEnvironment(snapshot, biome)`), which is where the
      multiplier rule lives: bounded to `[0.5, 1.5]`, **never** applied to health, and never negative.
      `StatsSystem` takes a second optional getter for the multiplier and folds it into the existing
      night bonus. Register `EnvironmentSystem` **immediately after `TimeSystem`** so every later
      system sees this frame's weather, add the `EnvironmentComponent` to the clock entity, inject
      `() => worldManager.getBiomeAt(...player tile...)` in `createGameWorld`, and update
      `GameWorldSystems`, the documented-order test and `docs/ARCHITECTURE.md` in the same commit.
      Files: `packages/game-engine/src/components/EnvironmentComponent.ts`,
      `packages/game-engine/src/systems/{EnvironmentSystem,StatsSystem}.ts`,
      `packages/game-engine/src/world/environmentOps.ts`, the barrels,
      `packages/game-engine/src/__tests__/{environment,stats}.test.ts`,
      `apps/web/src/game/createGameWorld.ts`, `apps/web/src/__tests__/gameWorld.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test && pnpm --filter @worldnest/web test` — the
      suite asserts the multiplier stays inside `[0.5, 1.5]` for every biome × season × weather
      combination, that **no combination changes `health` at all** (the decision D17 guard), that a
      cold night regenerates more slowly than a mild day, that `version` moves only on a real change,
      and that the documented order now has nineteen systems.

- [ ] 17. Show the weather (decision D17). Add `apps/web/src/game/WeatherOverlay.ts`, a `SceneOverlay`
      that draws rain, snow, fog, storm flashes, wind streaks, a rainbow arc and an aurora band from
      Phaser graphics and tweens only — there is not one binary asset in this repository and there must
      not be one now — reading `ctx` plus the environment component it is constructed with, and drawing
      nothing at all underground. Add `apps/web/src/components/WeatherHud.tsx` beside `ClockHud`,
      showing the season and the weather, fed by a new `ENVIRONMENT_CHANGED_EVENT` published from
      `HudBridge` off the component's version — the ninth event, following the per-event `lastX` field
      pattern rather than a generic diff map — held in `uiStore`. Add eight `weather.*` and four
      `season.*` keys as `Record`s (`WEATHER_KEYS: Record<WeatherKind, MessageKey>`,
      `SEASON_KEYS: Record<Season, MessageKey>`) in `apps/web/src/i18n/index.ts`, so adding a kind
      fails to compile until it is keyed, and translate all twelve of them into all twelve locales.
      Files: `apps/web/src/game/{WeatherOverlay,HudBridge,events}.ts`,
      `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/components/{WeatherHud,GameUI}.tsx`,
      `apps/web/src/stores/uiStore.ts`, `apps/web/src/i18n/{index}.ts`,
      `apps/web/src/i18n/messages/*.ts`,
      `apps/web/src/__tests__/{hudBridge,weatherHud,i18n,stores}.test.tsx`
      Verify: `pnpm --filter @worldnest/web test && pnpm build && pnpm test:e2e` — the HUD test asserts
      `environment-changed` fires once per version change and not otherwise, the component test renders
      `WeatherHud` in English and Korean and asserts both labels resolve, the i18n parity tests cover
      all twelve new keys (watch the trap: short weather words are often byte-identical across
      Latin-script locales, which is exactly what parity test 2 is for), and 3/3 smoke specs pass.

- [ ] 18. Make crops care where and when they are planted (decision D18). Give `CropDefinition`
      optional `biomes?: readonly Biome[]` and `seasons?: readonly Season[]` allow-lists. Add two crops
      to `CROP_DEFINITIONS`: `carrot_seed` → `carrot` (cool biomes, not summer) and `melon_seed` →
      `melon` (hot biomes, not winter), with the four new items in `packages/shared/src/items.ts`,
      prices in `ITEM_PRICES` obeying `sell < buy` **and** staying below ore's 14 so the "ore beats
      every surface material" test still holds, `ITEM_NAME_KEYS` entries and translations in all twelve
      locales, and `crop_carrot_0..3` / `crop_melon_0..3` textures in `BootScene` derived from
      `CROP_DEFINITIONS` as the wheat ones already are. `PlantSystem` takes a `() => Biome` getter and a
      `() => Season` getter and refuses to sow outside the allow-lists, bumping a new
      `InteractionComponent.refusals`; fold that counter into `readSoundState` so the existing `deny`
      cue plays.
      Files: `packages/game-engine/src/world/Crops.ts`,
      `packages/game-engine/src/components/InteractionComponent.ts`,
      `packages/game-engine/src/systems/PlantSystem.ts`, `packages/shared/src/{items,economy}.ts`,
      `apps/web/src/game/{createGameWorld,scenes/BootScene}.ts`,
      `apps/web/src/game/audio/soundDiff.ts`, `apps/web/src/i18n/index.ts`,
      `apps/web/src/i18n/messages/*.ts`,
      `packages/game-engine/src/__tests__/crops.test.ts`,
      `packages/shared/src/__tests__/{items,economy}.test.ts`,
      `apps/web/src/__tests__/{audio,i18n}.test.ts`
      Verify: `pnpm test && pnpm build` — the crop suite asserts sowing a carrot in a desert is refused
      and bumps `refusals` without consuming the seed, that the same seed in a grassland succeeds, that
      an out-of-season sow is refused, that wheat with no allow-list still sows anywhere (the additive
      promise), and that every produce item exists in the catalogue; the economy suite still enforces
      `sell < buy` everywhere and ore's primacy; `authoritySql.test.ts` from item 5 **fails until the
      new prices are added to `004`'s `shop_prices` seed**, which is the drift guard doing its job.

## Phase F — The two remaining loose ends (items 19-20)

- [ ] 19. Give `build` objectives a baseline (decision D19). Add `baseline: number` to `QuestEntry`.
      `activateQuest` takes the `QuestProgressSource` and records the current matching structure count
      for a `build` objective (zero for every other kind); `objectiveProgress` subtracts it and clamps
      at zero, so only fences raised **after** the quest was taken on count. Round-trip it through
      `apps/web/src/lib/questSnapshot.ts` against the `player_quests.baseline` column added by item 12,
      validating it the way `progress` already is (a non-finite or negative value becomes zero).
      Depends on item 12.
      Files: `packages/game-engine/src/components/QuestComponent.ts`,
      `packages/game-engine/src/quests/questOps.ts`,
      `packages/game-engine/src/systems/QuestSystem.ts`, `apps/web/src/lib/questSnapshot.ts`,
      `packages/game-engine/src/__tests__/quests.test.ts`,
      `apps/web/src/__tests__/{persistence,gameWorld}.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test && pnpm --filter @worldnest/web test` — the
      suite asserts that a player already holding two fences **does not** complete `build_fence` on
      acceptance (the exact bug the Phase 3 notes recorded), that building two more completes it, that
      the baseline survives a save/restore round trip, and that tearing a pre-existing fence down does
      not drive progress negative.

- [ ] 20. Put `placeableTile` to work (decision D20). Add `TileType.PATH = 12` (walkable, buildable,
      not harvestable, its own colour) and a `path_stone` item with `placeableTile: TileType.PATH`, a
      shop price, an `ITEM_NAME_KEYS` entry and twelve translations. Give `BuildSystem` a
      `setTileOverride` callback and a tile-placing branch taken **before** the structure branch: with
      such an item selected, a build request on a buildable tile that is not already `PATH` consumes
      one item and overrides the tile, which persists through the existing `world_modifications` path
      and repaints through the existing tile-change callback for free. Add the `tile_12` detail branch
      to `BootScene`, add the price row to `004`'s `shop_prices` seed, and make sure `BuildGhost` still
      agrees with `canPlaceAt` for the new kind.
      Files: `packages/game-engine/src/world/Tilemap.ts`,
      `packages/game-engine/src/systems/BuildSystem.ts`, `packages/shared/src/{items,economy}.ts`,
      `packages/database/supabase/migrations/004_authority_schema.sql`,
      `apps/web/src/game/{createGameWorld,BuildGhost,scenes/BootScene}.ts`,
      `apps/web/src/i18n/{index}.ts`, `apps/web/src/i18n/messages/*.ts`,
      `packages/game-engine/src/__tests__/build.test.ts`,
      `packages/shared/src/__tests__/{items,economy,authoritySql}.test.ts`,
      `apps/web/src/__tests__/i18n.test.ts`
      Verify: `pnpm test && pnpm db:verify && pnpm build` — the build suite asserts placing a path
      consumes exactly one item and calls `setTileOverride` with `PATH`, that no structure entity is
      created, that a second placement on the same tile is refused without consuming anything, that
      placing on water is refused, and that a fence still behaves exactly as before; `db:verify` still
      passes with the extra price row and the parity test from item 5 is green again.

## Phase G — Documentation, the Korean deliverables and the final gate (items 21-24)

- [ ] 21. Bring the English documentation up to date, and **rewrite the security-posture section**.
      `docs/ARCHITECTURE.md`: replace "Economy and its security posture" with a section that states
      plainly, as a table, what is authoritative and what is not (coins and quest completion:
      server-owned, enforced by column privileges, audited in `coin_ledger`, rate-limited; inventory,
      position, harvests, crops, terrain: still client-authored and still forgeable, with the reason
      being that there is no server-side simulation), why player-to-player trading is still out
      (decision D8) and exactly what would have to be true first. Then add: migrations `004` and `005`
      with their shapes, the two RPCs and the reconciliation seam, the world layer and the ladder, NPC
      schedules, seasons and weather, the environment component, the two new tile types and five new
      items, and the nineteen-system order. `docs/DEVELOPMENT.md`: how to add a weather kind, a
      schedule, a crop and an RPC; the `pnpm format`/`format:check` status after item 1; and how to run
      the authority assertions. `README.md`: features, controls, scripts and the **five**-migration
      setup step. Keep pointing at `pnpm db:verify` instead of restating any count.
      Files: `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md`, `README.md`,
      `CONTRIBUTING.md`
      Verify: `pnpm --filter @worldnest/web test && pnpm lint && pnpm format:check` — the
      documented-order test is what fails if the order in the prose and in `createGameWorld` disagree,
      and `format:check` now covers markdown, so there is no per-file prettier step to remember.

- [ ] 22. Extend the single Korean guide and its Word mirror together (Phase 3 decision D18). In
      `docs/SETUP_GUIDE_KR.md`: a `004` section explaining in plain Korean that it is what stops a
      modified client from inventing coins, that it must be run **after** `003`, and that re-running it
      is safe and is how the price list is refreshed; a `005` section; a short "서버 권한과 코인 원장"
      explanation including how to audit an account with one `coin_ledger` query and what the phase
      does **not** protect; the new controls and features (동굴 입장, 계절과 날씨, NPC 일과, 길 놓기,
      새 작물 두 종); new troubleshooting entries for the three failures this phase can cause — a shop
      purchase that reverts (004 not run, so the RPC is missing), coins never changing (the client's
      write is refused and that is correct), and a quest that cannot be handed in (`state` is
      server-owned now); and — most importantly — every new manual step added to the section 10
      체크리스트 with its 결과물 and 확인 방법, keeping the existing row order and numbering style.
      Apply **every one** of those edits to `docs/SETUP_GUIDE_KR.doc` as HTML in its existing
      vocabulary (`.warning` / `.danger` / `.success` / `.checkbox` / `blockquote`).
      Files: `docs/SETUP_GUIDE_KR.md`, `docs/SETUP_GUIDE_KR.doc`
      Verify: `pnpm docs:check` — exits 0 and prints the new matched heading count (higher than 62);
      break one new heading once to confirm it exits non-zero, then restore it. `pnpm format:check`
      stays green.

- [ ] 23. Deliver the Word document the user asked for, as a generated artefact (decision D22). Add
      `scripts/build-manual-work-doc.mjs`, which reads `docs/SETUP_GUIDE_KR.doc`, slices out the
      `<h2>10. 직접 해야 하는 작업 체크리스트</h2>` section up to the next `<h2>`, wraps it in the same
      `<head>`/`<style>` block with the title `WorldNest Online - 직접 해야 하는 작업 목록`, prepends a
      short Korean preamble saying which document it was generated from and that
      `docs/SETUP_GUIDE_KR.doc` is the full guide, and writes `docs/MANUAL_WORK_KR.doc`. Support
      `--check`, which regenerates into memory and exits non-zero if the committed file differs. Commit
      the generated file (a reader has no build step) and extend the root script to
      `"docs:check": "node scripts/check-kr-doc-sync.mjs && node scripts/build-manual-work-doc.mjs
      --check"` so it can never drift. Add a line to `docs/SETUP_GUIDE_KR.md` and its mirror pointing
      at the new file, and note in `README.md` that it is generated, not edited.
      Files: `scripts/build-manual-work-doc.mjs`, `docs/MANUAL_WORK_KR.doc`,
      `docs/SETUP_GUIDE_KR.md`, `docs/SETUP_GUIDE_KR.doc`, `package.json`, `README.md`
      Verify: `pnpm docs:check` — both checks pass; then edit `docs/MANUAL_WORK_KR.doc` by hand and
      confirm `docs:check` fails, regenerate with `node scripts/build-manual-work-doc.mjs` and confirm
      it passes again. Open-in-Word cannot be verified here (no Word, no display); the file is the same
      HTML-in-`.doc` format `docs/SETUP_GUIDE_KR.doc` has used since Phase 2, which is what makes that
      claim credible rather than new.

- [ ] 24. Final gate, the record, and the Korean report. Run every check and record the results in a
      table. Append an "Implementation notes" section to this plan file in the same style as the seven
      Phase 3 sections — deviations, what is verified and what still needs a human, and notes for a
      Phase 5 — and finish it with a **`## 결과 요약 (한국어)`** section: what was built, what is now
      protected and what is still forgeable, which files the maintainer must open, and the list of
      steps only they can perform. The delegation's own report to the user is written in Korean and
      must name `docs/MANUAL_WORK_KR.doc` and `docs/SETUP_GUIDE_KR.doc` explicitly, and must not
      promise a live URL — nothing in this pipeline can create one, for the reasons the Phase 3 notes
      spell out.
      Files: `.agents/tasks/task-worldnest-phase4/IMPLEMENTATION_PLAN.md`
      Verify: `pnpm lint && pnpm format:check && pnpm build && pnpm test && pnpm test:e2e && pnpm
      db:verify && pnpm docs:check && docker build -t worldnest:phase4 .` — 5 lint tasks clean, the
      tree fully formatted, 5/5 builds, the Vitest total well above the 577 baseline with all three
      suites green, 3/3 Playwright specs, the SQL harness applying `001`+`002`+`003`+`004`+`005`+seed
      with every authority assertion holding, both Korean documents in sync, and the multi-stage image
      still building.

---

## Assumptions and known gaps

- **No hosted Supabase project, no browser, no display, no audio device.** SQL is genuinely verified
  against a dockerised Postgres, including — new in this phase — RLS and column privileges exercised as
  the `authenticated` role. Not verifiable here: GoTrue accepting the seeded accounts, the deployed URL,
  the audio, real touch input, and how any of this looks. All of it is already on the maintainer list
  in `docs/SETUP_GUIDE_KR.md` section 10, and items 22-23 extend that list rather than starting a
  new one.
- **The `auth` schema in the harness is a test double**, and item 4 makes it a slightly larger one by
  adding Supabase's default table grants. It reproduces what the migrations and the seed touch, not
  GoTrue's full schema. A privilege a real project grants differently would not be caught.
- **A forged inventory is still possible, and so are forged harvests, positions, crops and terrain
  edits.** This phase makes coins and quest completion authoritative and nothing else (decision D2).
  Every document this phase touches must say so in those words; overstating it would be worse than not
  doing it.
- **Progress on a `collect` objective is still client-written**, so a cheat can set it to the target
  without gathering anything. What it cannot do is be paid twice, be paid an amount other than the
  catalogued one, or set its balance directly. That is the honest shape of the guarantee.
- **Underground is visually single-player** (decision D14). The fix is broadcasting the layer in the
  network payload and filtering remote sprites by it — one line each side, deliberately not done here.
- **Weather and seasons are not persisted and not broadcast**, because they are derived. A future
  feature that wants "it rained yesterday" as durable state would need a table and would break that
  property.
- **`pnpm db:verify` is still not in CI**, for the reason recorded in the out-of-scope list. Item 1 adds
  `format:check` to the existing `ci` job instead, which is a real gate with none of that cost.
- If any item's verification cannot be performed, complete what can be, commit, and record the gap
  rather than blocking the remaining items.

---

## Implementation notes for items 1-2 (deviations worth knowing for items 3-24)

Phase A is complete. Commits, one per item, on `feat/mvp-foundation`:
`87d8160` (plan tracked), `af4a57d` (1), `adaac44` (2).

### Gate results after item 2

| Command | Result |
|---------|--------|
| `pnpm format:check` | **exit 0, nothing listed** — the gate is now real for items 3-24 |
| `pnpm lint` | 9 turbo tasks, 5 real lint tasks, no warnings or errors |
| `pnpm build` | 5/5 packages |
| `pnpm test` | shared 24, game-engine 263, web 290 = **577**, unchanged from the baseline |
| `pnpm test:e2e` | 3/3 chromium specs, executed against `next start` |
| `pnpm db:verify` | 18 assertions, exit 0 |
| `pnpm docs:check` | 62 headings still match |
| `docker build -t worldnest:phase4-a .` | image builds |
| `createGameWorld.ts` | **201** lines (was 296; item 2 required < 220) |

### Item 1 — the numbers, and the one number that changed

Prettier rewrote **69 files** (62 of them non-markdown), not the 73 the plan predicted. The
difference is the four markdown files under `.agents/` that `.prettierignore` now excludes — the plan
measured 73 _before_ that ignore file existed, and 62 non-markdown matches its measurement exactly.
`printWidth` is `88`; the diff in those 69 files is whitespace only: re-wrapped lines, repadded
markdown tables, and Prettier's `*emphasis*` → `_emphasis_` normalisation. The 577 tests and
`pnpm docs:check` were green before and after, which is what makes "whitespace only" a claim rather
than a hope.

- `.prettierignore` covers `node_modules/`, `dist/`, `.next/`, `.turbo/`, `test-results/`,
  `playwright-report/`, `pnpm-lock.yaml` and `.agents/`. **The three plan files are byte-exact**, so
  editing this file from item 3 onward will never be reformatted either.
- `format:check` is wired into the `ci` job immediately after `Run lint`, so a drifted tree fails CI
  before the longer build and test steps run.
- The three documents that told contributors _not_ to run `pnpm format` now say the opposite:
  `CONTRIBUTING.md` ("ESLint & Prettier"), `docs/DEVELOPMENT.md` (the scripts table gained a
  `format:check` row and the caveat blockquote was rewritten), `README.md` (the `pnpm format` row plus
  a new `format:check` row). No other document mentioned the trap.
- **`.sql` is not in the format glob** (`**/*.{ts,tsx,js,jsx,json,md}`), so items 3 and 12 can format
  their migrations by hand exactly as `001`-`003` are, and `format:check` will not object.

### Item 2 — what moved, and the one deviation

`apps/web/src/game/playerEntity.ts` (144 lines) is Phaser-free and now owns:

- `GameBootstrap` — moved rather than left behind, because the alternative was `playerEntity.ts`
  importing its own parameter type back out of `createGameWorld.ts`, which is an import cycle even if
  a type-only one.
- `LOCAL_PLAYER_ENTITY_ID`, `PLAYER_COLLIDER_SIZE`, `STARTING_WHEAT_SEEDS`.
- `createPlayerEntity(bootstrap)` — the fifteen-component assembly plus the three seeding rules.
- `remotePlayerEntityId` / `createRemotePlayerEntity`.

**Deviation:** the plan named only `createPlayerEntity` and the two constants. Moving just those left
`createGameWorld.ts` at **251** lines, which misses the item's own `< 220` gate, so the entity id, the
bootstrap interface and the remote-player pair — all entity assembly, none of it system wiring — went
with them. `createGameWorld.ts` re-exports **every** one of those names, so `loadSession.ts`,
`SessionPersistence.ts`, `NetworkBridge.ts`, `PhaserGame.ts`, `GameScene.ts` and all four test files
that import them are untouched, which is why the 290 web tests are unchanged and green. One row was
added to the `apps/web/src/game/` table in `docs/ARCHITECTURE.md`, the same way `savedWorld.ts` has
one.

The purse rule is preserved verbatim for item 8 to delete: `bootstrap.coins ?? STARTING_COINS`, with
`loadSession` still deciding `hasSaved` at row level. Nothing about it was "cleaned up" on the way
past.

### Notes for items 3-24

- **`pnpm format` is now the normal workflow.** Run it before committing; it only touches what you
  changed. Do not hand-wrap to fight it, and note that Prettier will collapse a short multi-line union
  onto one line at 88 columns.
- **New prose uses `_emphasis_`**, not `*emphasis*`, or `format:check` will rewrite it.
- **`createGameWorld.ts` has 99 lines of headroom** under the ~300 cap for items 8, 10 and 16. If any
  of them needs more, `playerEntity.ts` is the precedent: extract, re-export, touch no caller.
- **Playwright's chromium binary was not present in the sandbox** and had to be installed with
  `npx playwright install chromium` before `pnpm test:e2e` would run. That is an environment
  characteristic, not a repository change — expect to do it again in a fresh sandbox.
