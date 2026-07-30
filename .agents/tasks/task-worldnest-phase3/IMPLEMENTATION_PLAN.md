# Implementation Plan — WorldNest Online Phase 3 (deferred systems, seeding, deployment)

Goal: build everything Phase 2 deliberately deferred — biomes and caves, a minimap, UI
internationalisation, sound and music, mobile/touch controls, NPCs and dialogue, quests and an
NPC-shop economy — plus the three maintainer-facing deliverables the user asked for: a paste-and-go
SQL seed script for test accounts, a fresh-clone-to-live-Vercel-URL deployment guide, and a
consolidated Korean guide covering every manual step.

Baseline: branch `feat/mvp-foundation`, HEAD `0b8e7e1`. `main` has no commits. All work stays on a
branch. The authoritative record of what the codebase does today is
`.agents/tasks/task-worldnest-phase2/IMPLEMENTATION_PLAN.md` (28 items, all done, five appended
"Implementation notes" sections) — read it before starting.

Verified baseline gates on `0b8e7e1`:

| Command | Result |
|---------|--------|
| `pnpm lint` | 9 turbo tasks, 5 real lint tasks, no warnings or errors |
| `pnpm build` | 5/5 packages |
| `pnpm test` | `@worldnest/shared` 12, `@worldnest/game-engine` 139, `@worldnest/web` 62 = **213** |
| `pnpm test:e2e` | 3/3 chromium smoke specs, actually executed |
| `docker build -t worldnest:phase2 .` | image builds |

## Ground rules for the implementing agent

- Continue on `feat/mvp-foundation`, or branch `feat/phase3-content` off it. Never commit to `main`.
- One conventional commit per numbered item. Scopes: `game-engine`, `web`, `shared`, `database`, `ui`.
- After every item the repo must be buildable: `pnpm build` green. Every item's stated verification
  must actually be run.
- **Use the real ECS API.** `docs/DEVELOPMENT.md` was corrected in Phase 2 item 26 and is now accurate:
  `Component` takes a string type (`super("position")`), `System` takes `requiredComponents: string[]`
  and implements `update(entities: Entity[], deltaTime: number)`, lookup is
  `entity.getComponent<T>("type")`, and `world.addSystem()` insertion order **is** execution order.
- Systems take their collaborators by **constructor injection** (`StatsSystem` takes `() => phase`,
  `CollisionSystem` takes a `TileQuery` plus an optional `StructureQuery`, `HarvestSystem` takes a
  `TileQuery` + `setTileOverride` + `CropSource`). Follow that; never reach into the `World`.
- Pure logic goes in a sibling directory as free functions (`inventory/inventoryOps.ts`,
  `animation/animationOps.ts`, `interaction/facing.ts`). Components stay data-only. Systems own their
  indexes and expose them as narrow query interfaces.
- Every new component/system/module must be exported from the relevant barrel
  (`components/index.ts`, `systems/index.ts`, `world/index.ts`, `src/index.ts`) and covered by Vitest
  in `src/__tests__/`.
- World generation must stay deterministic from `WORLD_SEED` so every client agrees with no server
  coordination. All player-caused terrain change keeps going through `WorldManager`'s override layer.
- Phaser is only reached through `dynamic(..., { ssr: false })` or a dynamic `import()`.
- `CONTRIBUTING.md` caps files at ~300 lines. `GameScene.ts` is at **297** — item 6 creates headroom
  and every later item adds a module rather than scene lines.
- New DB tables go in numbered migration files (next is `003`) with RLS enabled and policies scoped to
  `auth.uid()`. Every table in `packages/database/src/types.ts` must carry `Relationships: []` or
  postgrest-js 2.111 resolves inserts to `never[]`.
- **Do not run `pnpm format`.** `.prettierrc` sets `printWidth: 100` while the tree is hand-wrapped
  near 88, so it rewrites ~49 unrelated files. Check touched files only with
  `npx prettier --check <files>`, as `docs/DEVELOPMENT.md` documents.
- Audience is 10-18 worldwide: safe for children, no violence, no gambling, no mature content,
  cosmetics-only monetisation, no pay-to-win. NPC dialogue, quests and the shop must hold to that.
- There is **no display, no browser and no Supabase project** in the sandbox. Substitute engine-level
  automated assertions for every manual visual check, exactly as Phase 2 did. SQL *is* verifiable —
  item 24 builds a dockerised Postgres harness for it.

---

## Design decisions made for this plan (no design doc existed)

- **D1 Biomes are a fourth noise layer, not a generator rewrite.** `ChunkGenerator` gains a
  temperature channel (`mulberry32(seed + 3000)`) alongside the existing elevation/moisture/detail
  channels, and a pure `classifyBiome(elevation, moisture, temperature)` picks the biome, which then
  picks the surface tile. Keeps determinism, keeps the existing thresholds meaningful, and makes the
  classification unit-testable without generating a chunk.
- **D2 Caves stay on the single tile layer.** Cave regions are carved into high-elevation rock with a
  fifth noise channel (`seed + 4000`): `CAVE_WALL` blocks movement, `CAVE_FLOOR` is walkable and
  `ORE` is harvestable. A second world layer (a real cave dimension) would need a layer key threaded
  through the override map, `world_modifications`, chunk keys, the renderer and persistence — a much
  larger change for the same visible result. Recorded as a future option, not built.
- **D3 Hard-coded terrain facts move out of tests before the generator changes.** Item 1 replaces the
  literal tile coordinates in `apps/web/src/__tests__/gameWorld.test.ts` with a deterministic search
  helper, so items 3-5 can move terrain without a test rewrite. Doing this first is the whole reason
  the biome work can land green in one step.
- **D4 New generated tile ids start at 7.** `FARMLAND = 6` is override-only and must stay so;
  `SNOW = 7`, `CAVE_FLOOR = 8`, `CAVE_WALL = 9`, `ORE = 10` keeps persisted
  `world_modifications.tile_type` smallints stable.
- **D5 `GameScene` gets headroom before anything is added to it.** Network plumbing moves into
  `NetworkBridge.ts` and every visual layer becomes a `SceneOverlay` in an `OverlayStack`, so each of
  the minimap, the sound manager and later overlays costs exactly one line in a scene already at 297
  of the ~300 cap. This is the same move Phase 2 made with `NameTags.ts` and `SpriteSync.ts`.
- **D6 The minimap samples in the engine and paints in Phaser.** `sampleMinimap(tileQuery, …)` is a
  pure engine function returning tile ids, so it is testable with no canvas; `Minimap.ts` only maps
  those ids to `TILE_PROPERTIES[t].color`. A React canvas fed by a HUD event was rejected: it would
  push a few thousand tile ids across the bridge every redraw.
- **D7 i18n is hand-rolled, not `next-intl`.** Every route in `apps/web/app/` is already
  `"use client"` and `middleware.ts` is doing auth; locale routing would fight both. A typed message
  record (`MessageKey = keyof typeof en`), a `translate()` function with English fallback, a zustand
  locale store and a `useTranslation()` hook is ~80 lines, adds no dependency, and turns
  "all 12 locales have the same keys" into a unit test.
- **D8 Translatable content in the engine is stored as keys, never literals.** Dialogue nodes, quest
  titles and NPC names hold i18n keys; the React panels resolve them. That is what lets 12 languages
  share one dialogue graph, and item 18 adds a test asserting every key in the engine catalogues
  resolves in the `en` catalogue.
- **D9 Audio is synthesised at runtime, not shipped as assets.** There is not a single binary asset in
  the repo and `BootScene` already generates every texture programmatically. SFX are WebAudio
  oscillator envelopes described by a pure `SOUND_SPECS` table; music is a short procedural
  progression selected by day phase. No asset pipeline, no licensing question, fully testable with a
  fake `AudioContext`.
- **D10 Sound cues are derived from state diffs, not from new engine events.** `SoundManager` is a
  `SceneOverlay` that diffs `InventoryComponent.version`, energy, `uiStore.buildMode`, chat length and
  the clock phase once per frame — precisely the de-duplication `HudBridge` already does. This avoids
  adding an event bus to the engine or sprinkling `playSound()` calls through six systems.
- **D11 Touch controls are DOM, not Phaser.** A React overlay writes a virtual axis and one-shot flags
  into `touchStore`; `PlayerController` merges them with the keyboard each frame. Input still funnels
  through the one place Phase 2 established, and the buttons get Tailwind styling, 44 px targets and
  real accessibility instead of being drawn into the canvas.
- **D12 NPCs are static and deterministically placed.** Wandering NPCs would drift per client for the
  same reason an accumulated-delta clock does, and syncing them needs a server. NPCs are anchored by
  a catalogue and snapped to the nearest walkable tile by a deterministic spiral search
  (`resolveNpcTile`), so every client agrees and a biome change can never bury an NPC in water.
- **D13 React writes to the engine only through injected callbacks.** Dialogue choices, quest turn-ins
  and shop trades follow the `chatStore.sender` pattern: the panel calls an injected callback that
  sets a request flag on a component, and the owning system consumes it on the next frame. React never
  mutates ECS state directly — that is what keeps the store mirrors from desyncing, and it is why
  `BuildMenu` was deliberately read-only.
- **D14 No player-to-player trading.** The architecture is client-authoritative and anti-cheat is
  explicitly out of scope, so a malicious client can already forge inventory; a market or direct trade
  would let it mint value for other players too. The economy is therefore an **NPC shop with fixed
  prices** and a `coins` wallet. Sell price is always strictly below buy price and item 19 adds a test
  enforcing it, so no arbitrage loop exists. No gambling, no random loot boxes, no real-money
  purchases. Item 29 documents this posture plainly in `ARCHITECTURE.md`.
- **D15 Coins live in a column on `player_state`, not a new table.** It is already the one row per
  player that autosave writes; a `player_wallet` table would double the write traffic for one integer.
- **D16 SQL is verified against a dockerised Postgres.** `scripts/verify-sql.sh` creates the
  `anon`/`authenticated`/`service_role` roles plus a stub `auth` schema, then applies `001`, `002`,
  `003` and the seed and asserts the trigger provisioned rows. **Probed in this sandbox and it works**:
  `postgres:16-alpine` starts, `uuid-ossp` and `pgcrypto` (`crypt`/`gen_salt`) are available, `002`
  fails at `create policy … to authenticated` unless the role exists, and with the roles present all
  23 policies apply and `handle_new_user` provisions `profiles` + `player_state` from
  `raw_user_meta_data.username`. This closes the Phase 2 gap where `002` had never been executed.
- **D17 The test-account seed is a seed file, not a migration.** It inserts fake `auth.users` rows and
  must never run in production, so it lives outside the numbered sequence in
  `packages/database/supabase/seed/` and is idempotent.
- **D18 One Korean document, kept in sync automatically.** `docs/SETUP_GUIDE_KR.md` stays the single
  Korean entry point (a second Korean doc would drift) and gains the consolidated manual checklist;
  `scripts/check-kr-doc-sync.mjs` asserts every heading in the `.md` has a matching heading in the
  Word-openable `.doc` mirror, so the pair cannot silently diverge.

## Terrain facts as of `0b8e7e1` (surveyed, not assumed)

Measured by generating chunks with `WORLD_SEED = 42`: over chunks `(0,0)`-`(3,3)` the tile counts are
grass 1423, water 1231, sand 583, forest 380, stone 356, flowers 123. Default spawn `(496, 336)` is
tile `(15, 10)` = grass. Tile `(20, 14)` is grass, `(21, 14)` is stone, `(19, 14)` is grass. Tile
`(6, 4)` is **sand** (the comment in `gameWorld.test.ts` says grass; only its walkability and the
water at `(5, 4)` are actually asserted). Items 3-5 will move all of these, which is what item 1 is
for. The engine's own `harvest.test.ts`, `crops.test.ts` and `build.test.ts` use hand-written fake
`TileQuery` objects and are unaffected; `world-query.test.ts` already searches for the tile it needs.

---

## Suggested delegation batches

Each phase is self-contained and leaves the tree green, so a coder delegation can take a contiguous
range: **A (1-6)**, **B+C (7-11)**, **D+E (12-15)**, **F (16-18)**, **G+H (19-23)**, **I (24-27)**,
**J (28-31)**. Phase A must go first — it is what lets the generator change land without a test
rewrite and what gives `GameScene` the line budget everything later needs. Phase C must precede
F, G and H, because dialogue, quest and shop text are i18n keys (decision D8).

---

# Implementation Plan

## Phase A — Terrain foundations and scene headroom (items 1-6)

- [ ] 1. Make the web tests find their terrain instead of hard-coding it (decision D3; do this before
      any generator change). Add `apps/web/src/__tests__/helpers/terrain.ts` — not collected by
      Vitest, whose `include` is `src/__tests__/**/*.test.ts?(x)` — exporting
      `findFacingPair(worldManager, standType, targetType, facing)` which scans tiles `0..63` on both
      axes in a fixed order and returns `{ standTileX, standTileY, targetTileX, targetTileY, spawnX,
      spawnY }`, plus `findWalkableNeighbourOf(worldManager, blockedType)` for the water-edge case.
      Rewrite the four coordinate-dependent describes in `gameWorld.test.ts` (water edge, harvest
      wiring, farming wiring, building wiring) to call them, and delete the stale
      "Tile (6, 4) is grass" comment.
      Files: `apps/web/src/__tests__/helpers/terrain.ts`, `apps/web/src/__tests__/gameWorld.test.ts`
      Verify: `pnpm --filter @worldnest/web test` — still 62 tests, all passing, with no literal tile
      coordinates left in `gameWorld.test.ts`.

- [ ] 2. Extend the tile and item catalogues for biomes and caves (decision D4). In
      `packages/game-engine/src/world/Tilemap.ts` add `SNOW = 7` (walkable, buildable, not
      harvestable), `CAVE_FLOOR = 8` (walkable, buildable, not harvestable), `CAVE_WALL = 9` (not
      walkable, not buildable, not harvestable) and `ORE = 10` (walkable, not buildable, harvestable)
      with `TILE_PROPERTIES` colours, and add `[TileType.ORE]: { itemId: "ore", quantity: 1,
      energyCost: 10 }` to `TILE_HARVEST_YIELD`. In `packages/shared/src/items.ts` add the `ore` item
      (`displayName: "Ore"`, `stackSize: 99`). Widen the `chunk-generator.test.ts` assertion "only
      generate valid tile types (0-5)" to "every generated tile is a known `TileType` and never
      `FARMLAND`", since `FARMLAND` must remain override-only.
      Files: `packages/game-engine/src/world/Tilemap.ts`, `packages/shared/src/items.ts`,
      `packages/shared/src/__tests__/items.test.ts`,
      `packages/game-engine/src/__tests__/chunk-generator.test.ts`
      Verify: `pnpm --filter @worldnest/shared test && pnpm --filter @worldnest/game-engine test` —
      shared 12→13+, engine 139 still green.

- [ ] 3. Add the biome layer to the generator (decision D1). New
      `packages/game-engine/src/world/Biomes.ts`: `enum Biome { TUNDRA, TAIGA, GRASSLAND, FOREST,
      SAVANNA, DESERT }`, `BIOME_DEFINITIONS: Record<Biome, { name: string; surfaceTile: TileType;
      accentTile: TileType; minimapColor: number }>`, and a pure
      `classifyBiome(elevation, moisture, temperature): Biome`. In `ChunkGenerator.ts` add the
      temperature channel from `mulberry32(seed + 3000)` at its own scale, expose
      `getBiomeAt(worldX, worldY): Biome`, and route surface tile choice through the biome: water and
      sand still come from the elevation thresholds first, then the biome's `surfaceTile` replaces the
      old grass default (snow in TUNDRA, forest in FOREST/TAIGA, sand in DESERT, grass in
      GRASSLAND/SAVANNA) with the detail channel placing `accentTile` (flowers, forest) as before.
      Files: `packages/game-engine/src/world/Biomes.ts`,
      `packages/game-engine/src/world/ChunkGenerator.ts`, `packages/game-engine/src/world/index.ts`,
      `packages/game-engine/src/index.ts`, `packages/game-engine/src/__tests__/biomes.test.ts`,
      `packages/game-engine/src/__tests__/chunk-generator.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — the new suite asserts `classifyBiome` is
      total over the corners and centre of the noise cube, that two generators with seed 42 produce
      identical chunks and identical `getBiomeAt` results, that a 64x64 tile survey contains at least
      four distinct biomes, and that water and sand still occur; `chunk-generator.test.ts` determinism
      tests pass unchanged.

- [ ] 4. Carve caves into the mountains (decision D2). Add a cave channel to `ChunkGenerator` from
      `mulberry32(seed + 4000)`: where elevation exceeds the stone threshold and the cave channel is
      above its own threshold, emit `CAVE_FLOOR`; on the boundary of that region emit `CAVE_WALL`; and
      where the detail channel is high inside a cave region emit `ORE`. Caves must never be produced
      where the elevation is at or below the water threshold, so no cave ever floods.
      Files: `packages/game-engine/src/world/ChunkGenerator.ts`,
      `packages/game-engine/src/__tests__/caves.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — the new suite surveys a 96x96 tile region
      and asserts at least one `CAVE_FLOOR`, at least one `CAVE_WALL` and at least one `ORE` exist,
      that no cave tile sits where the generator would otherwise place water, that every `ORE` tile
      is adjacent to a cave tile, and that the survey is byte-identical across two generators.

- [ ] 5. Surface biomes and the new tiles in the client, and re-confirm the spawn. Add
      `getBiomeAt(tileX, tileY): Biome` to `WorldManager` (delegating to the generator, no override
      layer involvement — biomes are generated, not edited). In `BootScene.generateTileset()` derive
      the tile list from `Object.values(TileType).filter((v) => typeof v === "number")` instead of the
      hand-written array, so no future tile type can be missed, and draw distinguishing detail for
      snow, cave floor, cave wall and ore. Then confirm `DEFAULT_SPAWN_X/Y` is still a walkable
      non-cave tile; if the biome change moved it, pick the nearest walkable grass tile by the same
      deterministic search used in item 1 and update the constants and their comment.
      Files: `packages/game-engine/src/world/WorldManager.ts`,
      `packages/game-engine/src/__tests__/world-query.test.ts`,
      `apps/web/src/game/scenes/BootScene.ts`, `apps/web/src/game/createGameWorld.ts` (only if the
      spawn moves), `apps/web/src/__tests__/gameWorld.test.ts`
      Verify: `pnpm test && pnpm build` — all three suites green; the existing
      "should spawn the player on a walkable tile" test is what proves the spawn constant survived,
      and a new `world-query` case asserts `getBiomeAt` agrees with `ChunkGenerator.getBiomeAt`.

- [ ] 6. Create headroom in `GameScene` before Phase 3 adds anything to it (decision D5). Extract all
      realtime plumbing into `apps/web/src/game/NetworkBridge.ts` — `setRealtimeManager`'s callback
      wiring, `flushNetworkPayloads`, `getLocalPlayerPosition`, `addRemotePlayer`,
      `updateRemotePlayer`, `removeRemotePlayer` and `emitPlayersChanged` — constructed with the
      `World`, the player entity, the `NetworkSyncSystem` and an emitter, so it is Phaser-free.
      `GameScene.setRealtimeManager` stays as a one-line delegate because `GameCanvas` calls it. Add
      `apps/web/src/game/SceneOverlay.ts` with `interface OverlayContext { phase: DayPhase; buildMode:
      boolean; playerEntity: Entity; worldManager: WorldManager; deltaMs: number }`,
      `interface SceneOverlay { update(ctx: OverlayContext): void; destroy(): void }` and an
      `OverlayStack` that fans `update`/`destroy` out to its members; migrate `DayNightOverlay` and
      `BuildGhost` onto it so `GameScene.update` calls `this.overlays.update(ctx)` once.
      Files: `apps/web/src/game/NetworkBridge.ts`, `apps/web/src/game/SceneOverlay.ts`,
      `apps/web/src/game/DayNightOverlay.ts`, `apps/web/src/game/BuildGhost.ts`,
      `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/__tests__/networkBridge.test.ts`
      Verify: `pnpm --filter @worldnest/web test` (62 plus the new bridge suite: a join creates a
      remote entity, a move writes the interpolation target, a move arriving before a join creates the
      entity, a leave removes it, and `players-changed` is emitted for each), then
      `pnpm build && pnpm test:e2e` — 3/3 specs still pass and `GameScene.ts` is back under 230 lines.

## Phase B — Minimap (items 7-8)

- [ ] 7. Add the pure minimap sampler to the engine (decision D6).
      `packages/game-engine/src/world/minimap.ts` exporting
      `interface MinimapSample { originTileX: number; originTileY: number; size: number; tiles:
      Uint8Array }` and `sampleMinimap(tileQuery: TileQuery, centerTileX: number, centerTileY: number,
      radius: number): MinimapSample`, walking the square window row-major so index
      `y * size + x` is stable.
      Files: `packages/game-engine/src/world/minimap.ts`, `packages/game-engine/src/world/index.ts`,
      `packages/game-engine/src/index.ts`, `packages/game-engine/src/__tests__/minimap.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — the suite asserts `size === 2 * radius + 1`
      and `tiles.length === size ** 2`, that the centre index holds the centre tile, that an applied
      tile override shows through the sample, and that negative centre coordinates resolve correctly.

- [ ] 8. Add the minimap overlay and the `M` binding. `apps/web/src/game/Minimap.ts` implements
      `SceneOverlay`: a `Phaser.GameObjects.Graphics` at `setScrollFactor(0)`, depth 900, top-right,
      2 px per tile over a 24-tile radius, filled from `sampleMinimap` using
      `TILE_PROPERTIES[t].color`, with a white dot for the local player and tinted dots for every
      remote player entity; it redraws only when the player's centre tile changes or 500 ms have
      elapsed, and hides itself when `uiStore.minimapOpen` is false. While editing
      `PlayerController.ts`, convert the one-shot key bindings into a declarative
      `ONE_SHOT_BINDINGS: Array<{ keyCode: number; handler: () => void }>` table and add `M` as a row,
      so later phases add rows rather than blocks and the file stays well under the cap.
      Files: `apps/web/src/game/Minimap.ts`, `apps/web/src/game/scenes/GameScene.ts`,
      `apps/web/src/game/PlayerController.ts`, `apps/web/src/stores/uiStore.ts`,
      `apps/web/src/__tests__/stores.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build && pnpm test:e2e` — the store test
      covers `minimapOpen`/`toggleMinimap`, the build succeeds and the 3 smoke specs still pass.

## Phase C — Internationalisation (items 9-11)

- [ ] 9. Build the i18n foundation with English and Korean (decision D7).
      `apps/web/src/i18n/messages/en.ts` is the source of truth: a flat
      `export const en = { ... } as const` covering the landing page, auth page, HUD, hotbar,
      inventory, build menu, chat, clock phases, item display names and settings — aim for one key per
      user-visible string, roughly 70-90 keys. `apps/web/src/i18n/index.ts` exports
      `LOCALES = ["en","ko","ja","zh","es","fr","de","pt","ar","hi","th","vi"] as const`,
      `type Locale`, `type MessageKey = keyof typeof en`, `RTL_LOCALES = ["ar"]`,
      `MESSAGES: Record<Locale, Partial<Record<MessageKey, string>>>`,
      `resolveLocale(navigatorLanguage: string): Locale` and
      `translate(locale, key, params?): string` (English fallback, then the key itself, with
      `{name}`-style interpolation). `apps/web/src/stores/localeStore.ts` initialises from
      `navigator.language` and persists to `localStorage["worldnest.locale"]`;
      `apps/web/src/i18n/useTranslation.ts` returns `{ t, locale, dir, setLocale }`; and
      `apps/web/src/components/DocumentLocale.tsx` (client) writes
      `document.documentElement.lang`/`dir` and is mounted in `app/providers.tsx`.
      Files: `apps/web/src/i18n/messages/en.ts`, `apps/web/src/i18n/messages/ko.ts`,
      `apps/web/src/i18n/index.ts`, `apps/web/src/i18n/useTranslation.ts`,
      `apps/web/src/stores/localeStore.ts`, `apps/web/src/components/DocumentLocale.tsx`,
      `apps/web/app/providers.tsx`, `apps/web/src/__tests__/i18n.test.ts`
      Verify: `pnpm --filter @worldnest/web test` — the new suite asserts `ko` has exactly the `en` key
      set with no empty values, that an untranslated key falls back to English and an unknown key
      returns itself, that `{name}` interpolation works, that `resolveLocale("ko-KR")` is `ko` and
      `resolveLocale("xx")` is `en`, and that `dir` is `rtl` only for `ar`.

- [ ] 10. Add the remaining ten locales and right-to-left support. One file per locale under
      `apps/web/src/i18n/messages/`, each a complete translation of the `en` key set:
      `ja`, `zh`, `es`, `fr`, `de`, `pt`, `ar`, `hi`, `th`, `vi`. Register them in
      `apps/web/src/i18n/index.ts`. In `apps/web/app/globals.css` add the RTL adjustments the HUD
      needs (logical-property utilities for the corner-anchored panels so Arabic mirrors instead of
      overlapping) and confirm the hotbar and status bars, which are centre-anchored, need none.
      Files: `apps/web/src/i18n/messages/{ja,zh,es,fr,de,pt,ar,hi,th,vi}.ts`,
      `apps/web/src/i18n/index.ts`, `apps/web/app/globals.css`,
      `apps/web/src/__tests__/i18n.test.ts`
      Verify: `pnpm --filter @worldnest/web test` — a parity test loops all 12 locales and asserts each
      has exactly the `en` keys, no value is empty, and no value still equals the English string for a
      locale other than `en` (catches copy-paste gaps).

- [ ] 11. Route every UI string through the catalogue and add the settings panel. Replace the literals
      in the landing page, auth page, game page loading states and every HUD component with `t(...)`,
      and add `apps/web/src/components/SettingsPanel.tsx` (a `@worldnest/ui` `Card` with a language
      `<select>` listing all 12 locales by endonym) opened from a gear button in `GameUI`'s top-right
      stack and by the `P` key (a new row in `ONE_SHOT_BINDINGS`). **The `en` catalogue must reproduce
      the exact strings `e2e/smoke.spec.ts` asserts** — "Sign In", "Sign Up", "Sign in to your
      account", "Create a new account", "Choose a username", "Play Now" — or the smoke suite breaks.
      Files: `apps/web/app/page.tsx`, `apps/web/app/auth/page.tsx`, `apps/web/app/game/page.tsx`,
      `apps/web/src/components/{GameUI,ClockHud,HotBar,InventoryPanel,ItemSlot,StatusBars,BuildMenu,ChatPanel,SignOutButton,SettingsPanel}.tsx`,
      `apps/web/src/game/PlayerController.ts`, `apps/web/src/stores/uiStore.ts`,
      `apps/web/src/__tests__/i18n.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build && pnpm test:e2e` — 3/3 smoke specs
      still pass against the English catalogue, and a test renders `SettingsPanel` with
      `@testing-library/react` and asserts changing the select updates `localeStore`.

## Phase D — Sound and music (items 12-13)

- [ ] 12. Add the audio primitives (decision D9). `apps/web/src/game/audio/soundSpecs.ts`:
      `type SoundCue = "pickup" | "harvest" | "plant" | "build" | "deny" | "ui" | "dialogue" | "quest"
      | "shop"` and `SOUND_SPECS: Record<SoundCue, SoundSpec>` where `SoundSpec` is
      `{ waveform: OscillatorType; frequency: number; endFrequency?: number; durationMs: number;
      gain: number }` — pure data, no WebAudio import. `apps/web/src/game/audio/SoundSynth.ts` takes an
      `AudioContextFactory` (defaulting to `() => new AudioContext()`), creates the context lazily on
      the first `play` so the browser autoplay policy is satisfied, and exposes `play(cue)`,
      `setVolume`, `setMuted` and `resume()`. `apps/web/src/stores/audioStore.ts` holds
      `masterVolume`, `musicVolume` and `muted`, persisted to `localStorage["worldnest.audio"]`.
      Files: `apps/web/src/game/audio/soundSpecs.ts`, `apps/web/src/game/audio/SoundSynth.ts`,
      `apps/web/src/stores/audioStore.ts`, `apps/web/src/__tests__/audio.test.ts`
      Verify: `pnpm --filter @worldnest/web test` — the suite drives `SoundSynth` with a fake
      `AudioContext` double and asserts every cue has a positive duration and a gain ≤ 1, that `play`
      creates an oscillator and a gain node, connects them to the destination and schedules a stop,
      that the context is not created until the first `play`, that `setMuted(true)` creates no nodes,
      and that `setVolume` scales the scheduled gain.

- [ ] 13. Add the sound manager, procedural music and the audio settings (decision D10).
      `apps/web/src/game/audio/soundDiff.ts` holds the pure part: `diffCues(prev, next):
      SoundCue[]` over a `SoundState` snapshot of `{ inventoryVersion, energy, buildMode,
      chatCount, phase }`. `apps/web/src/game/audio/SoundManager.ts` implements `SceneOverlay`, builds
      the snapshot from the overlay context plus `useUIStore`/`useChatStore`, plays the diffed cues
      through `SoundSynth`, and owns a `MusicLoop` that schedules a short four-chord progression whose
      key changes with the day phase (bright for day/dawn, low for dusk/night). It resumes the audio
      context on the scene's first pointer or key event. Register it as one line in `GameScene`, and
      extend `SettingsPanel` with master-volume, music-volume and mute controls bound to `audioStore`.
      Files: `apps/web/src/game/audio/soundDiff.ts`, `apps/web/src/game/audio/SoundManager.ts`,
      `apps/web/src/game/audio/MusicLoop.ts`, `apps/web/src/game/scenes/GameScene.ts`,
      `apps/web/src/components/SettingsPanel.tsx`, `apps/web/src/__tests__/audio.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build` — the diff tests assert an inventory
      version bump emits `pickup`, an energy drop emits `harvest`, a `buildMode` toggle emits `ui`, a
      chat arrival emits `ui`, an unchanged frame emits nothing, and the first-ever snapshot emits
      nothing (no burst of cues on boot).

## Phase E — Mobile and touch controls (items 14-15)

- [ ] 14. Add the virtual input path (decision D11). `apps/web/src/stores/touchStore.ts` holds
      `{ active: boolean; axisX: number; axisY: number; interactRequested: boolean;
      buildRequested: boolean }` with `setAxis`, `requestInteract`, `requestBuild` and
      `consumeRequests()`. `apps/web/src/game/inputMerge.ts` holds the pure
      `mergeInput(keys: KeyState, axisX: number, axisY: number, deadzone: number): KeyState`. Wire
      both into `PlayerController.update()`: merge the axis into the polled keys, and consume the
      one-shot flags into `interactRequested`/`buildRequested` through the existing cooldown helpers so
      touch cannot bypass the 250 ms gate.
      Files: `apps/web/src/stores/touchStore.ts`, `apps/web/src/game/inputMerge.ts`,
      `apps/web/src/game/PlayerController.ts`, `apps/web/src/__tests__/input.test.ts`
      Verify: `pnpm --filter @worldnest/web test` — the suite asserts a sub-deadzone axis produces no
      movement, a diagonal axis sets two keys, keyboard input still wins when both are active, and
      `consumeRequests` clears the flags so a single tap fires exactly once.

- [ ] 15. Add the on-screen controls. `apps/web/src/components/TouchControls.tsx` renders a thumb-stick
      (pointer-down/move/up writing a normalised axis into `touchStore`) and E / B / I / M buttons at
      44 px minimum, `pointer-events-auto`, mounted in `GameUI` only when
      `apps/web/src/hooks/useCoarsePointer.ts` reports `matchMedia("(pointer: coarse)")`. Add a Next
      `viewport` export to `app/layout.tsx` (`width=device-width, initial-scale=1, maximum-scale=1,
      user-scalable=no`) and `touch-action: none` plus safe-area padding for the canvas host in
      `globals.css`, so dragging the stick does not scroll or pinch-zoom the page.
      Files: `apps/web/src/components/TouchControls.tsx`, `apps/web/src/hooks/useCoarsePointer.ts`,
      `apps/web/src/components/GameUI.tsx`, `apps/web/app/layout.tsx`, `apps/web/app/globals.css`,
      `apps/web/src/__tests__/touchControls.test.tsx`
      Verify: `pnpm --filter @worldnest/web test && pnpm build && pnpm test:e2e` — the component test
      mocks `matchMedia` and asserts the controls render only for a coarse pointer and that a
      pointer-down on the stick updates `touchStore`; the 3 smoke specs still pass. Playwright cannot
      reach `/game` (the middleware redirects an unauthenticated visitor to `/auth`), so there is no
      e2e coverage of the controls — that is why the jsdom test carries the weight.

## Phase F — NPCs and dialogue (items 16-18)

- [ ] 16. Add the dialogue module to the engine (decisions D8, D13).
      `packages/game-engine/src/dialogue/dialogueDefinitions.ts`:
      `interface DialogueOption { labelKey: string; next?: string; action?: DialogueAction }`,
      `type DialogueAction = { kind: "close" } | { kind: "openShop" } | { kind: "offerQuest";
      questId: string } | { kind: "turnInQuest"; questId: string }`,
      `interface DialogueNode { textKey: string; options: DialogueOption[] }`,
      `interface DialogueDefinition { rootNodeId: string; nodes: Record<string, DialogueNode> }` and
      `DIALOGUE_DEFINITIONS` with one tree per NPC — friendly, age-appropriate, no violence.
      `packages/game-engine/src/dialogue/dialogueOps.ts` holds pure `getNode`,
      `resolveOption(definition, nodeId, optionIndex)` and `advanceDialogue(state, optionIndex)`.
      `packages/game-engine/src/components/DialogueComponent.ts` carries
      `{ activeNpcId: string | null; dialogueId: string | null; nodeId: string | null;
      requestedOption: number | null; closeRequested: boolean; version: number }`.
      Files: `packages/game-engine/src/dialogue/{dialogueDefinitions,dialogueOps,index}.ts`,
      `packages/game-engine/src/components/DialogueComponent.ts`,
      `packages/game-engine/src/components/index.ts`, `packages/game-engine/src/index.ts`,
      `packages/game-engine/src/__tests__/dialogue.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — the suite asserts every option either
      points at an existing node in the same tree or carries an action, that every tree's
      `rootNodeId` exists, that advancing follows `next` and bumps `version`, that an out-of-range
      option index is ignored, and that a `close` action clears `activeNpcId`/`nodeId`.

- [ ] 17. Add NPCs to the engine (decision D12). `packages/game-engine/src/world/NpcCatalogue.ts`:
      `interface NpcDefinition { id: string; nameKey: string; dialogueId: string; anchorTileX: number;
      anchorTileY: number; textureKey: string; role: "villager" | "shopkeeper" | "questgiver" }` and
      `NPC_DEFINITIONS` with three NPCs anchored near the default spawn.
      `packages/game-engine/src/world/npcPlacement.ts` holds the pure
      `resolveNpcTile(tileQuery, anchorTileX, anchorTileY, maxRadius)` spiral search for the nearest
      walkable, buildable, non-cave tile. `packages/game-engine/src/components/NpcComponent.ts` is
      data only. `packages/game-engine/src/systems/NpcSystem.ts` (`["position", "interaction",
      "dialogue"]`) spawns every catalogue NPC on its first update through an injected `AddEntity`,
      owns the tile-keyed NPC index, **implements `StructureQuery`** so collision treats an NPC as
      solid, and on `interactRequested` opens or advances the faced NPC's dialogue and clears the flag
      **only when it acted** — the `PlantSystem` convention. Add `composeBlockers(...queries):
      StructureQuery` to `packages/game-engine/src/world/StructureQuery.ts`. Register `NpcSystem`
      **between `StatsSystem` and `PlantSystem`** so talking to an NPC never tills the ground under
      them, pass `composeBlockers(build, npc)` to `CollisionSystem`, and add a `DialogueComponent` to
      the player in `createGameWorld`.
      Files: `packages/game-engine/src/world/{NpcCatalogue,npcPlacement}.ts`,
      `packages/game-engine/src/components/NpcComponent.ts`,
      `packages/game-engine/src/systems/NpcSystem.ts`,
      `packages/game-engine/src/world/StructureQuery.ts`, the four barrels,
      `packages/game-engine/src/__tests__/npc.test.ts`, `apps/web/src/game/createGameWorld.ts`,
      `apps/web/src/__tests__/gameWorld.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test && pnpm --filter @worldnest/web test` — the
      engine suite asserts every NPC lands on a walkable tile for `WORLD_SEED`, that a second update
      does not duplicate them, that `composeBlockers` reports blocked when either source does, and
      that advancing dialogue works through the system; the web wiring test asserts that facing an NPC
      and interacting opens dialogue **and leaves the tile untilled**, and that the player cannot walk
      onto an NPC's tile.

- [ ] 18. Add the dialogue UI (decisions D8, D13). Add `DIALOGUE_CHANGED_EVENT` to
      `apps/web/src/game/events.ts` and emit it from `HudBridge` on a `DialogueComponent.version`
      change. `apps/web/src/stores/dialogueStore.ts` holds the active node plus an injected
      `respond(optionIndex)` / `close()` pair — the `chatStore.sender` pattern — and
      `apps/web/src/game/DialogueBridge.ts` injects callbacks that write `requestedOption` /
      `closeRequested` onto the player's component. `apps/web/src/components/DialoguePanel.tsx`
      renders `t(node.textKey)` and the option labels; while it is open `PlayerController`'s
      `whenPlaying` gate suppresses movement and interaction, and number keys `1`-`4` pick options
      instead of hotbar slots. `BootScene` generates one texture per NPC role, `SpriteSync` gives NPCs
      depth 98, and `NameTags` labels them from `t(nameKey)`. Add the dialogue and NPC-name keys to all
      12 locale files.
      Files: `apps/web/src/game/{events,HudBridge,DialogueBridge}.ts`,
      `apps/web/src/stores/dialogueStore.ts`, `apps/web/src/components/DialoguePanel.tsx`,
      `apps/web/src/components/GameUI.tsx`, `apps/web/src/game/PlayerController.ts`,
      `apps/web/src/game/scenes/BootScene.ts`, `apps/web/src/game/SpriteSync.ts`,
      `apps/web/src/game/NameTags.ts`, `apps/web/src/i18n/messages/*.ts`,
      `apps/web/src/__tests__/{dialogue,hudBridge,i18n}.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build && pnpm test:e2e` — the HUD test
      asserts `dialogue-changed` fires once per version change and not otherwise, the dialogue test
      asserts the injected `respond` writes the request flag, and **the i18n test asserts every
      `textKey`, `labelKey` and `nameKey` in the engine catalogues resolves in the `en` catalogue** —
      the automated guard for decision D8.

## Phase G — Economy and the NPC shop (items 19-21)

Ordered before quests because quest rewards pay coins, so `WalletComponent` and the shared price
table have to exist first.

- [ ] 19. Add the price table to `@worldnest/shared` (decision D14).
      `packages/shared/src/economy.ts`: `interface ItemPrice { buy: number; sell: number }`,
      `ITEM_PRICES: Partial<Record<ItemId, ItemPrice>>` covering wood, stone, ore, fiber, flower,
      wheat, wheat_seed, fence and chest, `isTradable(itemId)`, `TRADABLE_ITEM_IDS` and
      `STARTING_COINS = 50`. Prices live in `shared` for the same reason the item catalogue does: both
      the engine (shop maths) and the database layer (the `coins` column) need them.
      Files: `packages/shared/src/economy.ts`, `packages/shared/src/index.ts`,
      `packages/shared/src/__tests__/economy.test.ts`
      Verify: `pnpm --filter @worldnest/shared test` — the suite asserts every entry's key is a real
      `ItemId`, that all prices are positive integers, that **`sell < buy` for every item** so no
      buy-then-sell arbitrage loop exists, and that a wheat seed costs less than the wheat it yields
      times its yield quantity, so farming is profitable but bounded.

- [ ] 20. Add the wallet and shop to the engine. `packages/game-engine/src/components/`
      gains `WalletComponent` (`coins`) and `ShopComponent`
      (`{ openNpcId: string | null; requestedTrade: { kind: "buy" | "sell"; itemId: ItemId;
      quantity: number } | null; version: number }`). `packages/game-engine/src/shop/shopOps.ts` holds
      pure `tradeQuote(kind, itemId, quantity)`, `buy(inventory, wallet, itemId, quantity)` and
      `sell(inventory, wallet, itemId, quantity)`, each returning a boolean so a failed trade changes
      nothing. `packages/game-engine/src/systems/ShopSystem.ts` (`["inventory", "wallet", "shop"]`)
      consumes `requestedTrade` and bumps `version`. Register it immediately after `NpcSystem` in
      `createGameWorld`, add `WalletComponent`/`ShopComponent` to the player, and seed
      `STARTING_COINS`. Depends on items 17 and 19.
      Files: `packages/game-engine/src/components/{WalletComponent,ShopComponent}.ts`,
      `packages/game-engine/src/shop/{shopOps,index}.ts`,
      `packages/game-engine/src/systems/ShopSystem.ts`, the barrels,
      `packages/game-engine/src/__tests__/shop.test.ts`, `apps/web/src/game/createGameWorld.ts`
      Verify: `pnpm --filter @worldnest/game-engine test && pnpm --filter @worldnest/web test` — the
      shop suite asserts buying spends coins and adds the item, that insufficient coins changes
      nothing, that a full inventory changes nothing (coins are not taken), that selling removes the
      item and credits the sell price, that selling an item you do not hold changes nothing, and that
      a non-tradable item is refused.

- [ ] 21. Add the shop UI. Add `WALLET_CHANGED_EVENT` and `SHOP_CHANGED_EVENT` to `events.ts`, emitted
      from `HudBridge` on coin and shop-version changes. Add `apps/web/src/stores/shopStore.ts` (the
      open shop plus an injected `trade(kind, itemId, quantity)`),
      `apps/web/src/components/ShopPanel.tsx` (buy/sell columns from `ITEM_PRICES`, quantities of 1
      and 10, disabled when unaffordable) and `apps/web/src/components/CoinCounter.tsx` in the
      top-right stack. Wire the `openShop` dialogue action in `DialogueBridge`. Make `Esc` close the
      topmost open panel before falling through to blurring the chat composer. Add shop keys to all 12
      locale files.
      Files: `apps/web/src/game/{events,HudBridge,DialogueBridge}.ts`,
      `apps/web/src/stores/shopStore.ts`,
      `apps/web/src/components/{ShopPanel,CoinCounter,GameUI}.tsx`,
      `apps/web/src/game/PlayerController.ts`, `apps/web/src/i18n/messages/*.ts`,
      `apps/web/src/__tests__/{shop,hudBridge,i18n}.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build && pnpm test:e2e` — the shop test
      renders the panel with a stubbed injected `trade` and asserts a buy click calls it with the
      right arguments and that an unaffordable row is disabled; 3/3 smoke specs still pass.

## Phase H — Quests (items 22-23)

- [ ] 22. Add quests to the engine. `packages/game-engine/src/quests/questDefinitions.ts`:
      `type QuestObjective = { kind: "collect"; itemId: ItemId; count: number } | { kind: "build";
      itemId: ItemId; count: number } | { kind: "talk"; npcId: string }`,
      `interface QuestDefinition { id: string; titleKey: string; descriptionKey: string;
      giverNpcId: string; objective: QuestObjective; rewards: { items: Array<{ itemId: ItemId;
      quantity: number }>; coins: number } }` and `QUEST_DEFINITIONS` with three starter quests (one
      per objective kind). `packages/game-engine/src/quests/questOps.ts` holds pure `offerQuest`,
      `activateQuest`, `objectiveProgress(entry, ctx)`, `isObjectiveMet` and `completeQuest`.
      `packages/game-engine/src/components/QuestComponent.ts` holds
      `{ entries: Record<string, QuestEntry>; requestedTurnIn: string | null; version: number }` where
      `QuestEntry` is `{ state: "available" | "active" | "completed"; progress: number }`.
      `packages/game-engine/src/systems/QuestSystem.ts` (`["quest", "inventory", "wallet"]`) polls
      progress from the inventory (`countItem`) and an injected structure-count getter backed by
      `BuildSystem.getStructures()`, records `talk` progress written by `NpcSystem`, and on
      `requestedTurnIn` grants the rewards exactly once — **refusing the turn-in if the reward items
      would not fit**, so nothing is silently destroyed. Objectives are limited to these three kinds
      because all three can be evaluated by polling state the engine already owns; no event bus is
      needed. Depends on items 17 (NPC ids) and 20 (`WalletComponent`).
      Files: `packages/game-engine/src/quests/{questDefinitions,questOps,index}.ts`,
      `packages/game-engine/src/components/QuestComponent.ts`,
      `packages/game-engine/src/systems/QuestSystem.ts`, the barrels,
      `packages/game-engine/src/__tests__/quests.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — the suite asserts a collect objective
      completes at exactly the required count, that rewards land once and not twice, that a full
      inventory blocks the turn-in without consuming the quest, that progress is clamped, and that
      every quest's `giverNpcId` exists in `NPC_DEFINITIONS` and every reward `itemId` is a catalogue
      item.

- [ ] 23. Add the quest UI and hook quests into dialogue. Add `QUESTS_CHANGED_EVENT` and emit it from
      `HudBridge` on `QuestComponent.version`. Add `apps/web/src/stores/questStore.ts` (entries plus an
      injected `turnIn(questId)`), `apps/web/src/components/QuestLog.tsx` (toggled by `J`, listing
      title/description/progress from `t(...)`) and `apps/web/src/components/QuestTracker.tsx` (the
      active objective, under the clock). Wire the `offerQuest` and `turnInQuest` dialogue actions in
      `DialogueBridge` to `QuestComponent`, register `QuestSystem` in `createGameWorld` and give the
      player a `QuestComponent`. Add quest keys to all 12 locale files.
      Files: `apps/web/src/game/{events,HudBridge,DialogueBridge}.ts`,
      `apps/web/src/stores/questStore.ts`,
      `apps/web/src/components/{QuestLog,QuestTracker,GameUI}.tsx`,
      `apps/web/src/game/{PlayerController,createGameWorld}.ts`,
      `apps/web/src/i18n/messages/*.ts`,
      `apps/web/src/__tests__/{quests,stores,gameWorld,i18n}.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build` — `gameWorld.test.ts` gains an
      end-to-end engine assertion driving the whole loop with no Phaser: face the giver, interact,
      accept the quest through the dialogue action, `addItem` the objective items, request the
      turn-in, update, and assert the rewards and coins landed and the entry is `completed`.

## Phase I — Database: SQL harness, seed accounts, migration 003, persistence (items 24-27)

- [ ] 24. Build the SQL verification harness (decision D16) — this also closes the Phase 2 gap where
      migration `002` had never been executed. `packages/database/supabase/test/auth_stub.sql` creates
      the `anon`, `authenticated` and `service_role` roles if absent (**required**: `002` fails with
      `role "authenticated" does not exist` without them), the `auth` schema, `uuid-ossp` and
      `pgcrypto`, stub `auth.users` and `auth.identities` tables with the columns GoTrue actually
      exposes, and stub `auth.uid()` / `auth.role()` functions. `scripts/verify-sql.sh` starts
      `postgres:16-alpine` in Docker, waits on `pg_isready`, applies the stub then `001` then `002`
      with `-v ON_ERROR_STOP=1`, inserts one fake `auth.users` row, asserts one `profiles` row and one
      `player_state` row were provisioned by the trigger and that `worlds` holds `Default World`,
      prints the `pg_policies` count, and removes the container in a `trap`. Add
      `"db:verify": "bash scripts/verify-sql.sh"` to the root `package.json` and a
      "Verifying SQL locally" section to `docs/DEVELOPMENT.md` noting that the stub is a test double
      of GoTrue's schema, so column defaults and password hashing are approximations.
      Files: `packages/database/supabase/test/auth_stub.sql`, `scripts/verify-sql.sh`,
      `package.json`, `docs/DEVELOPMENT.md`
      Verify: `pnpm db:verify` — exits 0, printing `001 OK`, `002 OK`, `policies=23` and
      `trigger provisioned profiles=1 player_state=1`.

- [ ] 25. Add the ready-to-use test accounts seed (decision D17).
      `packages/database/supabase/seed/test_accounts.sql` provisions three confirmed accounts a
      maintainer can paste into the Supabase SQL Editor and immediately sign in with —
      `tester1@worldnest.test` / `tester2@…` / `tester3@…`, all with password `worldnest123`. Each
      insert into `auth.users` sets `instance_id = '00000000-0000-0000-0000-000000000000'`,
      `aud`/`role` = `authenticated`, `encrypted_password = crypt('worldnest123', gen_salt('bf'))`,
      `email_confirmed_at = now()` (so no mail step is needed) and
      `raw_user_meta_data = jsonb_build_object('username', …)` so the **existing `handle_new_user`
      trigger** creates the `profiles` and `player_state` rows — the script must not insert those
      itself. Each account also gets an `auth.identities` row (`provider = 'email'`,
      `provider_id = <email>`, `identity_data` carrying `sub` and `email`), which newer GoTrue
      requires for email sign-in. Everything is `on conflict do nothing` so re-running is safe, and a
      commented-out cleanup block deletes the three `auth.users` rows (the cascades remove the rest).
      Add `packages/database/supabase/seed/README.md` stating it must run **after** `002` and never in
      production. Extend `scripts/verify-sql.sh` to apply the seed and assert the outcome.
      Files: `packages/database/supabase/seed/test_accounts.sql`,
      `packages/database/supabase/seed/README.md`, `scripts/verify-sql.sh`
      Verify: `pnpm db:verify` — after the seed it prints `seed profiles=3 player_state=3` and
      confirms `encrypted_password = crypt('worldnest123', encrypted_password)` for each account, so
      the password really would authenticate.

- [ ] 26. Add migration `003_progression_schema.sql` and its data access (decision D15). New table
      `player_quests` (`player_id` → `profiles(id)` on delete cascade, `quest_id text`, `state text`
      with a check constraint over `available|active|completed`, `progress integer default 0`,
      `updated_at timestamptz default now()`, primary key `(player_id, quest_id)`), plus
      `alter table public.player_state add column if not exists coins integer default 0 not null`.
      RLS enabled on `player_quests` with select/insert/update/delete all scoped to
      `auth.uid() = player_id`. Mirror both into `packages/database/src/types.ts` — `player_quests`
      with `Relationships: []`, `coins` added to all three `player_state` shapes — and add
      `packages/database/src/progression.ts` (`loadQuests(playerId)`, `saveQuest(playerId, questId,
      state, progress)` upserting on the composite key) plus `coins` handling in `playerState.ts`.
      `001`'s missing `worlds` update/delete policies and owner-only `player_state` select are left
      alone, as in Phase 2: live positions come from Realtime, not the table.
      Files: `packages/database/supabase/migrations/003_progression_schema.sql`,
      `packages/database/src/{types,progression,playerState,index}.ts`, `scripts/verify-sql.sh`
      Verify: `pnpm --filter @worldnest/database build && pnpm lint && pnpm db:verify` — `003` applies
      cleanly after `002`, the harness asserts `player_state.coins` exists and that an insert into
      `player_quests` for a seeded account succeeds.

- [ ] 27. Persist and restore progression in the client. Extend `GameBootstrap` with optional
      `quests` and `coins`, load them in `loadSession.ts`, apply them in `createGameWorld` (seeding
      `STARTING_COINS` and no quests only when nothing was saved — the same "treat the column default
      as never saved" rule that `(0, 0)` and `'{}'` already follow), and write them back from
      `SessionPersistence.ts` by diffing `QuestComponent.version` and `WalletComponent.coins` on the
      existing autosave tick. Add `apps/web/src/lib/questSnapshot.ts` with
      `toPersistedQuests`/`parsePersistedQuests`, validating quest ids against `QUEST_DEFINITIONS` the
      way `isItemId` guards persisted items, so a removed quest drops its row instead of crashing a
      session.
      Files: `apps/web/src/game/{loadSession,SessionPersistence,createGameWorld}.ts`,
      `apps/web/src/lib/questSnapshot.ts`, `apps/web/src/__tests__/persistence.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm build` — the persistence suite asserts an
      unknown quest id is dropped on parse, that a saved wallet suppresses the starting coins, that a
      missing wallet grants them, and that the scheduler flushes a quest change at most once per
      interval.

## Phase J — Documentation, deployment, the Korean guide and the final gate (items 28-31)

- [ ] 28. Write the deployment guide and pin the Vercel build. `docs/DEPLOYMENT.md` takes a maintainer
      from a fresh clone to a live public URL: prerequisites (Node 22, pnpm 10, GitHub, Vercel,
      Supabase accounts); create the Supabase project and copy the URL and anon key; run `001`, `002`,
      `003` and optionally the test-accounts seed in the SQL Editor; disable email confirmation for
      testing; push the branch and import the repo into Vercel; monorepo settings (Root Directory
      `apps/web`, install at the workspace root, build through turbo so the four workspace packages
      are built first); the two `NEXT_PUBLIC_*` environment variables for Production, Preview and
      Development; a note that `next.config.js` sets `output: "standalone"` for the Dockerfile and
      that Vercel handles it — the warning `next start` prints locally is expected and harmless;
      Supabase Auth **Site URL and redirect allow-list must include the deployed domain** or sign-in
      bounces; a custom-domain step; and a post-deploy smoke checklist (sign up, `/game` loads, move
      and reload to confirm persistence, two tabs to confirm chat and remote players). Add a root
      `vercel.json` capturing the install and build commands so the guide is not guesswork, and link
      the guide from `README.md`.
      Files: `docs/DEPLOYMENT.md`, `vercel.json`, `README.md`
      Verify: run the exact commands the guide documents — `pnpm install --frozen-lockfile` then
      `pnpm exec turbo run build --filter=@worldnest/web...` builds the web app and its four workspace
      dependencies, and `pnpm test:e2e` (whose `webServer` is `pnpm --filter @worldnest/web start`)
      passes 3/3, which is the same production server Vercel runs.

- [ ] 29. Update the English documentation for everything Phase 3 added. `docs/ARCHITECTURE.md`: the
      biome and cave layers with their noise channels and thresholds, the four new tile types, the
      minimap sampler, the NPC/dialogue/quest/shop systems with their place in the registration order,
      the audio and touch-input paths, the i18n design, migration `003` with its RLS shape, the
      injected-callback seam (D13), and a plainly worded section on the economy's security posture
      (D14: the client is authoritative, inventory and coins are forgeable, which is exactly why there
      is no player-to-player trading). `docs/DEVELOPMENT.md`: the updated system order, how to add a
      locale, how to add a dialogue tree or quest, how to add a `SceneOverlay`, how to add a sound cue,
      and the `pnpm db:verify` harness. `README.md`: refreshed feature and controls tables (`M`, `J`,
      `P`, touch), the `db:verify` and `docs:check` scripts, the three-migration setup step and the
      deployment link. Add an automated guard against doc drift: assert in `gameWorld.test.ts` that
      `Object.keys(context.systems)` equals the documented registration order.
      Files: `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `README.md`, `CONTRIBUTING.md`,
      `apps/web/src/__tests__/gameWorld.test.ts`
      Verify: `pnpm --filter @worldnest/web test && pnpm lint` — the system-order test fails if the
      docs and `createGameWorld` disagree; check touched files with
      `npx prettier --check docs/ARCHITECTURE.md docs/DEVELOPMENT.md README.md` and, if prettier wants
      to repad the markdown tables, leave them compact and consistent with their neighbours as Phase 2
      item 26 did (`pnpm format` is still a stale gate — do not run it).

- [ ] 30. Rewrite the Korean guide as the single consolidated manual-work document, and make the `.doc`
      mirror checkable (decision D18). `docs/SETUP_GUIDE_KR.md` gains: a `003` migration section; a
      "테스트 계정 시드" section explaining that pasting `seed/test_accounts.sql` into the SQL Editor
      creates three ready-to-use logins (`tester1@worldnest.test` / `worldnest123`) and that it must
      run after `002`; a Korean summary of `docs/DEPLOYMENT.md` replacing the thin existing section 8
      with the full fresh-clone-to-live-URL path including the Auth redirect URL step; updated
      controls (`M` 미니맵, `J` 퀘스트, `P` 설정, 터치 조작); the language selector and sound settings;
      new troubleshooting entries (Vercel build failure from the monorepo root directory, sign-in
      failing because the deployed domain is not in the Auth allow-list, no sound until the first
      click because of the browser autoplay policy); and — the headline — one consolidated
      "직접 해야 하는 작업 체크리스트" table listing every manual step end to end with what it produces
      and how to confirm it. Apply **every** one of those edits to `docs/SETUP_GUIDE_KR.doc` as HTML in
      its existing style so the Word-openable mirror stays consistent. Add
      `scripts/check-kr-doc-sync.mjs`, which normalises the `##`/`###` headings of the `.md` and the
      `<h2>`/`<h3>` headings of the `.doc` and fails on the first mismatch, plus a
      `"docs:check": "node scripts/check-kr-doc-sync.mjs"` root script wired into the `ci` job of
      `.github/workflows/ci.yml`.
      Files: `docs/SETUP_GUIDE_KR.md`, `docs/SETUP_GUIDE_KR.doc`, `scripts/check-kr-doc-sync.mjs`,
      `package.json`, `.github/workflows/ci.yml`
      Verify: `pnpm docs:check` — exits 0 and prints the matched heading count; deliberately break one
      heading once to confirm it exits non-zero, then restore it. `pnpm lint` stays clean.

- [ ] 31. Final gate. Run every check and record the results, then append an
      "Implementation notes" section to this plan file covering the deviations from the plan text, in
      the same style as the five Phase 2 sections, so the next delegation inherits an accurate record.
      Files: `.agents/tasks/task-worldnest-phase3/IMPLEMENTATION_PLAN.md`
      Verify: `pnpm lint && pnpm build && pnpm test && pnpm test:e2e && pnpm db:verify && pnpm
      docs:check && docker build -t worldnest:phase3 .` — 5 lint tasks clean, 5 builds succeed, the
      Vitest total is well above the 213 baseline with all three suites green, 3/3 Playwright specs
      pass, the SQL harness applies `001`+`002`+`003`+seed and provisions three accounts, the Korean
      doc pair is in sync, and the multi-stage image still builds.

---

## Assumptions and known gaps

- **No Supabase project and no browser in the sandbox.** SQL is now genuinely verified against a
  dockerised Postgres (item 24), but Realtime, GoTrue sign-in and anything visual are not. Every
  visual behaviour in this plan is instead pinned by an engine-level or jsdom assertion, following
  Phase 2's precedent. Four checks still need a maintainer with real credentials and a browser: the
  seeded accounts actually signing in through GoTrue, the deployed Vercel URL end to end, the audio
  actually being audible, and the touch controls on a real phone.
- **The dockerised `auth` schema is a test double.** It reproduces the columns `handle_new_user` and
  the seed script touch, not GoTrue's full schema; a column GoTrue requires that the stub omits would
  not be caught. The stub is committed so the gap is inspectable.
- **Anti-cheat remains out of scope**, and item 29 documents the consequence: coins, inventory,
  harvests and quest progress are all client-authored and forgeable. That is the entire reason
  decision D14 keeps the economy to an NPC shop. Server-side validation would need Supabase Edge
  Functions or Postgres RPC and is a separate project.
- **Player-to-player trading, a market and any real-money or gacha mechanic are deliberately out of
  scope** — the first for the security reason above, the rest because the audience is 10-18 and the
  brief forbids gambling and pay-to-win.
- **NPC wandering, NPC schedules and multi-layer cave dimensions are deferred** (decisions D12, D2).
  Both need either server coordination or a layer key threaded through the override map, persistence
  and the renderer.
- **Biome-dependent crops, weather and temperature effects on the player are not in this plan.** The
  temperature channel exists and is exposed through `getBiomeAt`, so they are additive later.
- **`placeableTile` on `ItemDefinition` is still unused** — `BuildSystem` places structure entities
  only. Unchanged from Phase 2.
- **Reconciling `.prettierrc` with the tree's actual wrapping is still a separate one-off commit.**
  Nothing in this plan runs `pnpm format`.
- If any item's verification cannot be performed, complete what can be, commit, and record the gap
  rather than blocking the remaining phases.
