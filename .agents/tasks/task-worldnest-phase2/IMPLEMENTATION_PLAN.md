# Implementation Plan — WorldNest Online Phase 2 (staged expansion)

Goal: develop every remaining developable area of the project, in dependency order, on top of
`feat/mvp-foundation` (HEAD `5dbc784`).

## Ground rules for the implementing agent

- Branch: continue on `feat/mvp-foundation`, or branch `feat/phase2-gameplay` off it. Never commit to `main`.
- One conventional commit per numbered item (or per phase where noted). Scopes: `game-engine`, `web`, `shared`, `database`, `ui`.
- After every item the repo must be buildable: `pnpm build` green.
- Full gate before finishing: `pnpm lint && pnpm build && pnpm test` all green.
- **Use the real ECS API, not the one in `docs/DEVELOPMENT.md`** — that doc is wrong and item 26 fixes it.
  Actual API (verified in `packages/game-engine/src/ecs/`):
  - `Component` constructor takes a string `type`: `super("position")`.
  - `System` constructor takes `requiredComponents: string[]`; the abstract method is
    `update(entities: Entity[], deltaTime: number): void` — **not** `update(world, deltaTime)`.
  - Lookup is by string: `entity.getComponent<PositionComponent>("position")`.
  - `world.addSystem()` order **is** execution order (`World.update` iterates `this.systems` in insertion order).
- Every new component/system must be exported from `packages/game-engine/src/components/index.ts`,
  `src/systems/index.ts` and `src/index.ts`, and covered by Vitest in `src/__tests__/`.
- Terrain generation must stay deterministic from `WORLD_SEED`. All player-caused terrain changes go
  through the modification **overlay** introduced in item 8 — never into `ChunkGenerator`.
- Phaser stays behind `dynamic(..., { ssr: false })` / dynamic `import()`; never import `phaser` from a
  module reachable by the server render path.

## Design decisions made for this plan (no design doc existed)

- **D1 Collision as a velocity veto.** A new `CollisionSystem` registered *between* `InputSystem` and
  `MovementSystem` zeroes the offending velocity axis when the next step would enter a non-walkable tile.
  Chosen over rewriting `MovementSystem` because `MovementSystem` is already covered by 7 tests, and a
  pre-pass keeps per-axis sliding trivial and unit-testable with a fake tile source.
- **D2 Terrain edits as an overlay.** `WorldManager` gets a `Map<"tileX,tileY", TileType>` override layer
  consulted before generated tiles. Keeps `ChunkGenerator` deterministic (existing determinism tests keep
  passing) while allowing harvesting/tilling/building, and gives persistence a tiny diff to store.
- **D3 Clock derived from wall time, not accumulated delta.** `WorldClock` computes the game time from
  `Date.now() - WORLD_EPOCH_MS`, so every client agrees on day/night with zero server coordination — the
  same rationale as the shared `WORLD_SEED`. Accumulated-delta clocks drift per client and break shared crops.
- **D4 Item catalogue lives in `@worldnest/shared`.** Both the engine (inventory, harvest yields) and the
  database layer (inventory jsonb) need item ids, and `shared` is the only package both depend on.
- **D5 Inventory mutation as pure functions.** `CONTRIBUTING.md` requires components to be pure data, so
  `InventoryComponent` holds slots only and `inventory/inventoryOps.ts` holds `addItem`/`removeItem`/etc.
  as pure functions — also far easier to test than methods on a component.
- **D6 Remote players become real ECS entities.** Today `GameScene` keeps a side map of Phaser sprites and
  `RenderSystem` is never registered at all. Making remote players entities with an interpolation component
  gives one render path (`RenderSystem.renderData`), fixes the always-zero "Players online" counter, and
  makes smoothing testable without Phaser.
- **D7 Web tests exclude Phaser.** `apps/web` gets Vitest + jsdom for stores and pure helpers only.
  Canvas/WebGL mocking is high-cost and low-value; the Phaser layer is covered by the Playwright smoke test (item 27).
- **D8 Migration 002 is a single gameplay migration.** All new tables land together in
  `002_gameplay_schema.sql` so a fresh Supabase project needs exactly two SQL runs; RLS on every table,
  policies scoped to `auth.uid()`, per the established convention.

---

# Implementation Plan

## Phase A — Test & lint infrastructure (do first; later items verify with it)

- [x] 1. Extend lint coverage from one package to all five. Add `parserOptions.ecmaFeatures.jsx: true` and
      `env.browser: true` to the root ESLint config, then add a `lint` script
      (`eslint \"src/**/*.{ts,tsx}\" --max-warnings=0`) to the four packages that lack one. Fix whatever it
      reports (prefix intentionally unused args with `_`, per the existing rule config).
      Files: `.eslintrc.js`, `packages/shared/package.json`, `packages/game-engine/package.json`,
      `packages/database/package.json`, `packages/ui/package.json`
      Verify: `pnpm lint` — turbo now runs 5 lint tasks (was 1: only `@worldnest/web`), all reporting no errors/warnings.

- [x] 2. Grow `@worldnest/shared` into the single source of tunables and add its first test suite. Add
      `src/items.ts` (`ItemId` union, `ItemDefinition`, `ITEM_DEFINITIONS` covering `wood`, `stone`, `fiber`,
      `flower`, `wheat_seed`, `wheat`, `fence`, `chest`, with `stackSize`, `displayName`, `placeableTile?`),
      re-export it from `src/index.ts`, and add to `src/constants.ts`: `PLAYER_SPEED = 200`,
      `SYNC_INTERVAL_MS = 50`, `PRESENCE_INTERVAL_MS = 1000`, `AUTOSAVE_INTERVAL_MS = 10000`,
      `INVENTORY_SLOTS = 20`, `HOTBAR_SLOTS = 8`, `INTERACT_RANGE_TILES = 1`,
      `GAME_MINUTES_PER_REAL_SECOND = 1`, `DAY_LENGTH_MINUTES = 1440`, `WORLD_EPOCH_MS = 1700000000000`,
      `MAX_ENERGY = 100`. Add `vitest` devDependency, `vitest.config.ts` (copy the game-engine one), a
      `test: "vitest run"` script, and `src/__tests__/utils.test.ts` + `src/__tests__/items.test.ts`
      (round-trip `pixelToTile`/`tileToPixel`, `getChunkKey`/`parseChunkKey`, negative coordinates,
      every `ItemId` has a definition with `stackSize >= 1`). Finally replace the local
      `const PLAYER_SPEED = 200` in `InputSystem.ts` with the shared constant.
      Files: `packages/shared/src/items.ts`, `packages/shared/src/constants.ts`, `packages/shared/src/index.ts`,
      `packages/shared/vitest.config.ts`, `packages/shared/package.json`,
      `packages/shared/src/__tests__/utils.test.ts`, `packages/shared/src/__tests__/items.test.ts`,
      `packages/game-engine/src/systems/InputSystem.ts`
      Verify: `pnpm test` — a new `@worldnest/shared:test` task appears and passes; the 29 existing
      game-engine tests still pass (movement tests depend on the speed constant).

- [x] 3. Give `apps/web` a unit-test setup and cover the untested client logic. Add devDeps `vitest`,
      `jsdom`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`; add
      `vitest.config.ts` (environment `jsdom`, include `src/__tests__/**/*.test.ts?(x)`) and a
      `test: "vitest run"` script. Extract the cookie predicate from `middleware.ts` into
      `src/lib/authCookie.ts` (`hasSupabaseAuthCookie(names: string[]): boolean`, keeping the existing
      `/^sb-.*-auth-token/` regex) and import it in the middleware. Add tests for that predicate and for
      `authStore` / `gameStore` actions (set/clear user, add/remove/update online player immutability).
      Files: `apps/web/vitest.config.ts`, `apps/web/package.json`, `apps/web/src/lib/authCookie.ts`,
      `apps/web/middleware.ts`, `apps/web/src/__tests__/authCookie.test.ts`,
      `apps/web/src/__tests__/stores.test.ts`
      Verify: `pnpm --filter @worldnest/web test` passes; `pnpm build` still green (middleware bundles).

## Phase B — Fix the ECS ↔ Phaser ↔ store integration

- [x] 4. Pure refactor: split `GameScene` before growing it. `CONTRIBUTING.md` caps files at ~300 lines and
      this file is about to double. Extract chunk drawing into `apps/web/src/game/ChunkRenderer.ts` (class
      owning the `RenderTexture`-per-chunk map, `drawChunk(chunk)`, `removeChunk(x, y)`, `redrawTile(...)`
      stub) and world/system/entity construction into `apps/web/src/game/createGameWorld.ts`
      (returns `{ world, worldManager, systems: {...}, playerEntity }`). Also extend
      `createPhaserGame(parent, bootstrap: GameBootstrap)` to publish the bootstrap
      (`{ playerId, username, spawnX, spawnY }`) via `callbacks.preBoot` → `game.registry.set("bootstrap", …)`,
      and have `GameScene.create()` read it so the player entity uses the real user id/username instead of
      the hardcoded `"local"` / `"Player"`. `GameCanvas` passes the authenticated user.
      No behavior change beyond correct identity.
      Files: `apps/web/src/game/ChunkRenderer.ts`, `apps/web/src/game/createGameWorld.ts`,
      `apps/web/src/game/PhaserGame.ts`, `apps/web/src/game/scenes/GameScene.ts`,
      `apps/web/src/components/GameCanvas.tsx`
      Verify: `pnpm --filter @worldnest/web build` succeeds and `pnpm lint` reports no errors; `GameScene.ts`
      is under 300 lines.

- [x] 5. Add remote-player smoothing to the engine: `RemoteInterpolationComponent` (type `"remoteInterpolation"`;
      `targetX`, `targetY`, `lerpFactor` default 0.2) and `InterpolationSystem`
      (`["position", "remoteInterpolation"]`) that eases `position` toward the target with
      `1 - (1 - lerpFactor) ** (deltaTime * 60)` so smoothing is frame-rate independent, snapping when within
      0.5 px. Export from all three barrels. Tests: converges monotonically toward target, is a no-op when
      already at target, and is frame-rate independent (one 1/30 s step ≈ two 1/60 s steps within 1 px).
      Files: `packages/game-engine/src/components/RemoteInterpolationComponent.ts`,
      `packages/game-engine/src/systems/InterpolationSystem.ts`,
      `packages/game-engine/src/components/index.ts`, `packages/game-engine/src/systems/index.ts`,
      `packages/game-engine/src/index.ts`, `packages/game-engine/src/__tests__/interpolation.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — new suite passes, previous 29 still pass.

- [x] 6. Route all rendering through `RenderSystem` and fix the dead player counter. Register `RenderSystem`
      and `InterpolationSystem` in `createGameWorld` (order: Input → Movement → Chunk → Interpolation →
      NetworkSync → Render). In `GameScene`, replace the `otherPlayers` sprite map and manual
      `playerSprite.setPosition` with a single `syncSprites()` pass driven by `renderSystem.renderData`
      (create/update/destroy Phaser sprites keyed by `entityId`, tint non-local players, depth 100 local /
      99 remote). `addRemotePlayer` now creates an ECS entity (`position`, `sprite`, `player(isLocal:false)`,
      `remoteInterpolation`), `updateRemotePlayer` writes the interpolation target, `removeRemotePlayer`
      calls `world.removeEntity`. Mirror joins/leaves/moves into `gameStore` (`addOnlinePlayer`,
      `removeOnlinePlayer`, `updateOnlinePlayer`) via `game.events.emit("players-changed", …)` consumed in
      `GameCanvas`, so `GameUI`'s "Players online" stops always showing 0.
      Files: `apps/web/src/game/createGameWorld.ts`, `apps/web/src/game/scenes/GameScene.ts`,
      `apps/web/src/components/GameCanvas.tsx`
      Verify: `pnpm --filter @worldnest/web build` and `pnpm --filter @worldnest/web test` pass;
      `pnpm lint` clean.

- [x] 7. Make Supabase Presence reflect live positions. `RealtimeManager.joinRoom` currently `track()`s
      `{x:0,y:0}` once and never updates, so a late joiner sees everyone at the origin. Add
      `updatePresence(position: PlayerPosition): Promise<void>` that re-`track()`s at most every
      `PRESENCE_INTERVAL_MS` (timestamp guard inside the manager), store the last known position so
      `joinRoom` tracks the real spawn point, and also expose `getPlayerId()`. Call `updatePresence` from
      `GameScene.flushNetworkPayloads` alongside `broadcastPosition`.
      Files: `packages/database/src/realtime.ts`, `packages/database/src/index.ts`,
      `apps/web/src/game/scenes/GameScene.ts`
      Verify: `pnpm build` green (database `tsc` + web `next build`); `pnpm lint` clean.

## Phase C — Collision and the terrain-modification overlay

- [x] 8. Give `WorldManager` a tile query plus the modification overlay (foundation for collision, harvesting,
      farming, building and persistence). Add `packages/game-engine/src/world/TileQuery.ts` with
      `interface TileQuery { getTileAt(tileX, tileY): TileType; isWalkableAt(pixelX, pixelY): boolean }`.
      Implement it on `WorldManager`: resolve the owning chunk from `loadedChunks`, and for out-of-range
      tiles generate the chunk on demand (deterministic, so this is safe and needs no cache) — plus
      `setTileOverride(tileX, tileY, type)`, `getTileOverrides(): Map<string, TileType>`,
      `applyTileOverrides(entries)` and an `onTileChanged` callback, with overrides consulted before
      generated data. Extend `TileProperties` with `buildable: boolean` and `harvestable: boolean` and fill
      them in for all six tile types (grass buildable, forest/stone/flowers harvestable, water neither).
      Tests: overrides win over generated tiles; `getTileAt` agrees with `ChunkGenerator` for unmodified
      tiles; `isWalkableAt` is false over water and true over grass; negative coordinates resolve correctly.
      Files: `packages/game-engine/src/world/TileQuery.ts`, `packages/game-engine/src/world/WorldManager.ts`,
      `packages/game-engine/src/world/Tilemap.ts`, `packages/game-engine/src/world/index.ts`,
      `packages/game-engine/src/index.ts`, `packages/game-engine/src/__tests__/world-query.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — new suite passes and
      `chunk-generator.test.ts` determinism tests still pass unchanged.

- [x] 9. Add collision to the engine per decision D1: `ColliderComponent` (type `"collider"`; `width`,
      `height`, `enabled`) and `CollisionSystem` (`["position", "velocity", "collider"]`) constructed with a
      `TileQuery`. For each axis independently, probe the four corners of the collider box at the projected
      position and set that axis' velocity to 0 if any probe hits a non-walkable tile, which yields wall
      sliding for free. Tests use a hand-written fake `TileQuery` (no `WorldManager`): blocked on X only,
      blocked on Y only, diagonal into a corner slides along the free axis, `enabled: false` is a no-op,
      open ground leaves velocity untouched.
      Files: `packages/game-engine/src/components/ColliderComponent.ts`,
      `packages/game-engine/src/systems/CollisionSystem.ts`,
      `packages/game-engine/src/components/index.ts`, `packages/game-engine/src/systems/index.ts`,
      `packages/game-engine/src/index.ts`, `packages/game-engine/src/__tests__/collision.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — new suite passes.

- [x] 10. Wire collision into the game: add `new ColliderComponent(24, 24)` to the player entity and register
      `new CollisionSystem(worldManager)` **between** `InputSystem` and `MovementSystem` in `createGameWorld`
      (order matters — see D1). Depends on items 8 and 9.
      Files: `apps/web/src/game/createGameWorld.ts`
      Verify: `pnpm build && pnpm test` green. Manual check with `pnpm --filter @worldnest/web dev`:
      walking into water stops the player instead of passing through.

## Phase D — World clock and day/night

- [x] 11. Add the shared clock: `packages/game-engine/src/world/WorldClock.ts` with
      `WorldClock.fromWallClock(nowMs)` → `{ totalMinutes, day, hour, minute, phase }` where `phase` is
      `"dawn" | "day" | "dusk" | "night"`, derived from `WORLD_EPOCH_MS`, `GAME_MINUTES_PER_REAL_SECOND` and
      `DAY_LENGTH_MINUTES` (decision D3), plus `TimeComponent` (type `"time"`, holds the latest snapshot)
      and `TimeSystem` (`["time"]`) that refreshes it from an injectable `nowFn` (defaults to `Date.now`).
      Tests inject a fixed `nowFn`: epoch is day 1 hour 0, phase boundaries land in the right buckets, a
      full day wraps to day 2, and two clocks built from the same timestamp are identical (client agreement).
      Files: `packages/game-engine/src/world/WorldClock.ts`,
      `packages/game-engine/src/components/TimeComponent.ts`,
      `packages/game-engine/src/systems/TimeSystem.ts`, the three barrels,
      `packages/game-engine/src/__tests__/world-clock.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — new suite passes.

- [x] 12. Surface time in the client: register `TimeSystem` on a singleton `world-clock` entity, tint the
      camera per phase in `GameScene` (a full-screen `Phaser.GameObjects.Rectangle` with `setScrollFactor(0)`
      whose alpha/colour is driven by phase, tweened over 1 s on change), emit `clock-changed` to React, hold
      it in a new `uiStore`, and render a `ClockHud` (`Day 3 · 07:20 · dawn`) in `GameUI`. Add a unit test for
      the pure `formatClock(snapshot)` helper placed in `apps/web/src/lib/formatClock.ts`.
      Files: `packages/game-engine/src/index.ts` (if new exports needed),
      `apps/web/src/game/createGameWorld.ts`, `apps/web/src/game/scenes/GameScene.ts`,
      `apps/web/src/stores/uiStore.ts`, `apps/web/src/lib/formatClock.ts`,
      `apps/web/src/components/ClockHud.tsx`, `apps/web/src/components/GameUI.tsx`,
      `apps/web/src/__tests__/formatClock.test.ts`
      Verify: `pnpm --filter @worldnest/web test` and `pnpm build` pass.

## Phase E — Items and inventory

- [x] 13. Add inventory to the engine per decision D5: `InventoryComponent` (type `"inventory"`;
      `slots: Array<{ itemId: ItemId; quantity: number } | null>` sized `INVENTORY_SLOTS`,
      `selectedSlot: number`) and `packages/game-engine/src/inventory/inventoryOps.ts` with pure
      `addItem(inv, itemId, qty): number` (returns the remainder that did not fit, respecting
      `ITEM_DEFINITIONS[itemId].stackSize`), `removeItem`, `countItem`, `getSelectedItem`, `selectSlot`,
      `moveSlot`. Export via `src/inventory/index.ts` and the package barrel. Tests: fills partial stacks
      before empty slots, splits across slots at `stackSize`, returns the overflow when full, `removeItem`
      spanning multiple slots clears emptied slots, `selectSlot` clamps to range.
      Files: `packages/game-engine/src/components/InventoryComponent.ts`,
      `packages/game-engine/src/inventory/inventoryOps.ts`, `packages/game-engine/src/inventory/index.ts`,
      `packages/game-engine/src/components/index.ts`, `packages/game-engine/src/index.ts`,
      `packages/game-engine/src/__tests__/inventory.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — new suite passes.

- [x] 14. Add the inventory UI. Put `inventorySlots` + `selectedSlot` + `setInventory`/`setSelectedSlot` in
      `gameStore`; give the player entity an `InventoryComponent`; emit `inventory-changed` from `GameScene`
      whenever the component version counter changes; bind number keys `1`–`8` and `I` in `GameScene`
      (hotbar select / toggle panel via `uiStore`). Build `HotBar` (bottom-centre, 8 slots, selection ring)
      and `InventoryPanel` (grid, framer-motion enter/exit, `@worldnest/ui` `Card`) and mount both in
      `GameUI`. Test the new store actions.
      Files: `apps/web/src/stores/gameStore.ts`, `apps/web/src/stores/uiStore.ts`,
      `apps/web/src/components/HotBar.tsx`, `apps/web/src/components/InventoryPanel.tsx`,
      `apps/web/src/components/GameUI.tsx`, `apps/web/src/game/createGameWorld.ts`,
      `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/__tests__/stores.test.ts`
      Verify: `pnpm --filter @worldnest/web test` and `pnpm build` pass.

## Phase F — Interaction, stats, harvesting

- [x] 15. Add the interaction loop to the engine. `StatsComponent` (`health`, `maxHealth`, `energy`,
      `maxEnergy`, `regenPerMinute`), `StatsSystem` (`["stats"]`, regenerates energy from `deltaTime`,
      clamped, at double rate during the `night` phase read from the time entity via an injected getter),
      `InteractionComponent` (`facing: "up"|"down"|"left"|"right"`, `interactRequested: boolean`,
      `lastInteractAt: number`), and `HarvestSystem`
      (`["position", "interaction", "inventory", "stats"]`) constructed with a `TileQuery` + a
      `setTileOverride` callback: on request it resolves the faced tile within `INTERACT_RANGE_TILES`,
      checks `TILE_PROPERTIES[t].harvestable`, checks energy, adds the yield from a new
      `TILE_HARVEST_YIELD: Partial<Record<TileType, { itemId: ItemId; quantity: number; energyCost: number }>>`
      table in `Tilemap.ts` (forest→wood, stone→stone, flowers→flower), spends energy, overrides the tile to
      `GRASS`, and clears `interactRequested`. Tests with a fake `TileQuery`: harvesting forest yields wood
      and grass-ifies the tile, non-harvestable tiles do nothing, insufficient energy does nothing, a full
      inventory does not consume the tile, energy regen is clamped at max.
      Files: `packages/game-engine/src/components/StatsComponent.ts`,
      `packages/game-engine/src/components/InteractionComponent.ts`,
      `packages/game-engine/src/systems/StatsSystem.ts`,
      `packages/game-engine/src/systems/HarvestSystem.ts`,
      `packages/game-engine/src/world/Tilemap.ts`, the three barrels,
      `packages/game-engine/src/__tests__/harvest.test.ts`, `packages/game-engine/src/__tests__/stats.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — both new suites pass.

- [x] 16. Wire interaction into the client: track facing from the last non-zero input direction, bind `E` /
      `Space` to set `interactRequested`, register `StatsSystem` + `HarvestSystem`, implement
      `ChunkRenderer.redrawTile(tileX, tileY, tileType)` and hook it to `WorldManager.onTileChanged` so
      harvested tiles repaint without rebuilding the whole chunk texture, and add an energy/health bar to
      `GameUI` fed by a `stats-changed` event into `gameStore`.
      Files: `apps/web/src/game/createGameWorld.ts`, `apps/web/src/game/scenes/GameScene.ts`,
      `apps/web/src/game/ChunkRenderer.ts`, `apps/web/src/stores/gameStore.ts`,
      `apps/web/src/components/StatusBars.tsx`, `apps/web/src/components/GameUI.tsx`
      Verify: `pnpm build && pnpm test` green. Manual `pnpm --filter @worldnest/web dev`: facing a forest
      tile and pressing `E` adds wood to the hotbar and repaints the tile as grass.

## Phase G — Farming

- [ ] 17. Add farming to the engine. Add `TileType.FARMLAND = 6` with properties (walkable, buildable,
      not harvestable, brown) — reachable only through the override layer, so `ChunkGenerator` and its
      determinism tests are untouched. Add `CropComponent` (`itemId`, `plantedAtMinute`, `stageCount`,
      `minutesPerStage`, `stage`, `tileX`, `tileY`), `PlantSystem` (tills `GRASS`→`FARMLAND` with a hoe-less
      interact when the selected item is a seed, then spawns a crop entity with
      `Position`/`Sprite`/`Crop` and consumes the seed) and `CropGrowthSystem` (`["crop"]`, sets
      `stage = clamp(floor((nowMinutes - plantedAtMinute) / minutesPerStage), 0, stageCount - 1)` from the
      injected clock getter). Harvesting a fully grown crop entity yields the produce and removes the entity
      — extend `HarvestSystem` to check for a crop entity on the faced tile before falling back to tiles.
      Tests: planting consumes exactly one seed and creates one crop entity on farmland; growth stage
      advances with the injected clock and saturates at the last stage; harvesting an immature crop yields
      nothing; harvesting a mature crop yields produce and removes the entity.
      Files: `packages/game-engine/src/world/Tilemap.ts`,
      `packages/game-engine/src/components/CropComponent.ts`,
      `packages/game-engine/src/systems/PlantSystem.ts`,
      `packages/game-engine/src/systems/CropGrowthSystem.ts`,
      `packages/game-engine/src/systems/HarvestSystem.ts`, the three barrels,
      `packages/game-engine/src/__tests__/crops.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — new suite passes and
      `chunk-generator.test.ts` is unchanged and still green.

- [ ] 18. Render crops and farmland: generate `tile_6` (farmland) and `crop_wheat_0..3` placeholder textures
      in `BootScene`, register `PlantSystem` + `CropGrowthSystem`, and let the `RenderSystem`-driven
      `syncSprites()` pick up crop entities (depth 50, texture from `SpriteComponent.textureKey` +
      `CropComponent.stage`). Seed the starting inventory with `wheat_seed` ×5 so the loop is playable.
      Files: `apps/web/src/game/scenes/BootScene.ts`, `apps/web/src/game/createGameWorld.ts`,
      `apps/web/src/game/scenes/GameScene.ts`
      Verify: `pnpm build && pnpm test` green. Manual: plant on grass, wait for stage changes, harvest wheat.

## Phase H — Building

- [ ] 19. Add placement to the engine: `StructureComponent` (`itemId`, `tileX`, `tileY`, `collidable`) and
      `BuildSystem` (`["position", "interaction", "inventory"]`) constructed with the `TileQuery` and an
      entity factory. On a build request (a new `buildRequested` flag on `InteractionComponent`) it checks
      `TILE_PROPERTIES[target].buildable`, that no structure already occupies the tile, and that the selected
      item has `placeableTile`/`placeableStructure` metadata in `ITEM_DEFINITIONS`; then consumes one item
      and creates the structure entity with a `ColliderComponent` when `collidable`. Also extend
      `CollisionSystem` to veto movement into tiles occupied by a collidable structure (structure occupancy
      map maintained by `BuildSystem`, injected into `CollisionSystem`). Tests: placing a fence consumes one
      item and creates one entity; placing on water or on an occupied tile does nothing; a placed collidable
      structure blocks movement through `CollisionSystem`.
      Files: `packages/game-engine/src/components/StructureComponent.ts`,
      `packages/game-engine/src/systems/BuildSystem.ts`,
      `packages/game-engine/src/systems/CollisionSystem.ts`,
      `packages/game-engine/src/components/InteractionComponent.ts`, `packages/shared/src/items.ts`,
      the three barrels, `packages/game-engine/src/__tests__/build.test.ts`
      Verify: `pnpm --filter @worldnest/game-engine test` — new suite passes, `collision.test.ts` still passes.

- [ ] 20. Client build mode: `B` toggles build mode in `uiStore`, a ghost preview sprite follows the faced
      tile (green/red tint from a `canPlace` check), left-click or `Q` sets `buildRequested`, structures
      render through `syncSprites()` (depth 60), and a small `BuildMenu` lists placeable items from the
      inventory. Generate `structure_fence` / `structure_chest` textures in `BootScene`.
      Files: `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/scenes/BootScene.ts`,
      `apps/web/src/game/createGameWorld.ts`, `apps/web/src/stores/uiStore.ts`,
      `apps/web/src/components/BuildMenu.tsx`, `apps/web/src/components/GameUI.tsx`
      Verify: `pnpm build && pnpm test` green. Manual: place a fence, then confirm you cannot walk through it.

## Phase I — Persistence

- [ ] 21. Add migration `002_gameplay_schema.sql`: a `handle_new_user()` trigger
      (`security definer`, `search_path = public`) that inserts a `profiles` row plus a `player_state` row on
      `auth.users` insert — today nothing ever creates a profile, so the `player_state` FK is unusable — and
      new tables `world_modifications` (world_id, tile_x, tile_y, tile_type, modified_by, updated_at, PK
      (world_id, tile_x, tile_y)), `structures` (id, world_id, owner_id, item_id, tile_x, tile_y, created_at),
      `crops` (id, world_id, owner_id, item_id, tile_x, tile_y, planted_at_minute, created_at) and
      `chat_messages` (id, world_id, sender_id, username, body, created_at). RLS enabled on all four:
      `select` open to authenticated users (shared world), `insert`/`update`/`delete` restricted to
      `auth.uid() = owner_id` / `modified_by` / `sender_id`. Also add an index on
      `chat_messages(world_id, created_at desc)` and mirror all four tables into `packages/database/src/types.ts`.
      Files: `packages/database/supabase/migrations/002_gameplay_schema.sql`, `packages/database/src/types.ts`
      Verify: `pnpm --filter @worldnest/database build` (tsc typechecks the new `Database` type) and
      `pnpm lint` clean. Confirm by reading that every new table has `enable row level security` and at
      least one `auth.uid()`-scoped write policy.

- [ ] 22. Add the data-access modules: `src/profiles.ts` (`getProfile`, `upsertProfile`),
      `src/playerState.ts` (`loadPlayerState(playerId)`, `savePlayerState(playerId, { x, y, chunk, inventory })`
      using `upsert`), `src/worldMods.ts` (`loadWorldModifications(worldId)`,
      `saveWorldModification(...)`, `loadStructures`, `saveStructure`, `deleteStructure`, `loadCrops`,
      `saveCrop`, `deleteCrop`) and `src/worlds.ts` (`getDefaultWorld()` returning the seeded
      `Default World` row). Each returns `{ data, error }` shaped results and never throws for missing
      config beyond the existing `createSupabaseClient` error. Export all from the barrel. Depends on item 21.
      Files: `packages/database/src/profiles.ts`, `packages/database/src/playerState.ts`,
      `packages/database/src/worldMods.ts`, `packages/database/src/worlds.ts`,
      `packages/database/src/index.ts`
      Verify: `pnpm build` green; `pnpm lint` clean.

- [ ] 23. Persist and restore a session in the client. In `GameCanvas`, before creating the Phaser game,
      load the default world + player state and pass `spawnX`/`spawnY`/`inventory`/`worldId` through the
      `GameBootstrap` registry object from item 4 (fall back to the current 256/256 spawn and an empty
      inventory when Supabase is unconfigured — the existing try/catch tolerance pattern in `AuthProvider`).
      Apply loaded `world_modifications` via `WorldManager.applyTileOverrides` before the first chunk load,
      and rehydrate structures/crops as entities. Add an autosave every `AUTOSAVE_INTERVAL_MS` plus a
      `beforeunload`/unmount flush that writes position + inventory, and persist each tile override,
      structure and crop as it is created. Extract the debounce/dirty-flag logic into
      `apps/web/src/lib/persistence.ts` and unit-test it (saves at most once per interval, always flushes
      pending state on `flush()`).
      Files: `apps/web/src/components/GameCanvas.tsx`, `apps/web/src/game/PhaserGame.ts`,
      `apps/web/src/game/createGameWorld.ts`, `apps/web/src/game/scenes/GameScene.ts`,
      `apps/web/src/lib/persistence.ts`, `apps/web/src/__tests__/persistence.test.ts`
      Verify: `pnpm --filter @worldnest/web test` and `pnpm build` pass. Manual (with real Supabase creds):
      move, reload the page, and the player respawns at the saved position with the saved inventory.

## Phase J — Chat

- [ ] 24. Add chat end to end. In `packages/database`: `src/chat.ts` with
      `loadRecentMessages(worldId, limit = 50)` and `sendMessage(worldId, senderId, username, body)`
      (writes to `chat_messages`), and extend `RealtimeManager` with `sendChat(body)`, an
      `onChatMessage` callback registered through `setCallbacks`, and a `broadcast` event `"chat"` so
      delivery is instant while the row write is the durable record. In `apps/web`: a `chatStore`
      (messages array capped at 100, `unread`, `inputFocused`), a `ChatPanel` (bottom-left, `Enter` to
      focus, `Esc` to blur, framer-motion), and — important — gate `GameScene`'s keyboard handling on
      `chatStore.inputFocused` so typing does not move the player. Client-side rate limit of 1 message per
      500 ms in a pure helper. Tests cover the store cap/unread logic and the rate-limit helper.
      Files: `packages/database/src/chat.ts`, `packages/database/src/realtime.ts`,
      `packages/database/src/index.ts`, `apps/web/src/stores/chatStore.ts`,
      `apps/web/src/components/ChatPanel.tsx`, `apps/web/src/components/GameUI.tsx`,
      `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/lib/rateLimit.ts`,
      `apps/web/src/__tests__/chat.test.ts`
      Verify: `pnpm build && pnpm test` green. Manual with two browser tabs: a message sent in one appears
      in the other and reloading shows history.

## Phase K — Animation and account polish

- [ ] 25. Add directional animation plus the missing account controls. Engine: `AnimationComponent`
      (`state: "idle" | "walk"`, `direction`, `elapsed`, `frameIndex`, `frameDurationMs`) and
      `AnimationSystem` (`["velocity", "animation", "sprite"]`) that derives state/direction from velocity,
      advances `frameIndex` on a timer, and writes `SpriteComponent.frame` — tests: idle at zero velocity,
      direction from the dominant axis, frame advance only after `frameDurationMs`, deterministic given
      fixed deltas. Web: `BootScene` generates a 4-direction × 2-frame `player` spritesheet (replace
      `generateTexture` with `generateTexture` per frame into keys `player_<dir>_<n>` and pick in
      `syncSprites`), plus floating username labels above remote players, and a sign-out button in `GameUI`
      that calls `signOut()` and routes to `/auth`.
      Files: `packages/game-engine/src/components/AnimationComponent.ts`,
      `packages/game-engine/src/systems/AnimationSystem.ts`, the three barrels,
      `packages/game-engine/src/__tests__/animation.test.ts`,
      `apps/web/src/game/scenes/BootScene.ts`, `apps/web/src/game/scenes/GameScene.ts`,
      `apps/web/src/game/createGameWorld.ts`, `apps/web/src/components/GameUI.tsx`
      Verify: `pnpm build && pnpm test` green.

## Phase L — Documentation and end-to-end tests

- [ ] 26. Correct and extend the docs, which currently drift from the code in two confirmed ways:
      `docs/DEVELOPMENT.md` shows `update(world, deltaTime)` and `entity.getComponent(HealthComponent)`
      (the real signatures are `update(entities, deltaTime)` and `getComponent<T>("type")`), and
      `docs/ARCHITECTURE.md` documents tables `characters` / `world_state` / `chat_messages` that never
      existed. Rewrite both examples against the real API, replace the schema section with the actual
      `001` + `002` tables, add sections for collision, the world clock, the tile-override layer, inventory,
      farming, building, chat and persistence, document the system execution order, refresh the README
      feature list and scripts table, and update `docs/SETUP_GUIDE_KR.md` to mention running migration `002`.
      Files: `docs/DEVELOPMENT.md`, `docs/ARCHITECTURE.md`, `README.md`, `docs/SETUP_GUIDE_KR.md`
      Verify: `pnpm format` leaves the tree clean and `pnpm lint` passes; spot-check that every code
      snippet in `docs/DEVELOPMENT.md` matches a real signature in `packages/game-engine/src`.

- [ ] 27. Add the Playwright E2E layer the README already advertises. Add `@playwright/test` at the root,
      `playwright.config.ts` (webServer `pnpm --filter @worldnest/web start`, baseURL
      `http://localhost:3000`, chromium only), `e2e/smoke.spec.ts` covering: the landing page renders the
      "WorldNest Online" heading and a Play Now link; `/game` unauthenticated redirects to `/auth`; the auth
      page toggles between Sign In and Sign Up. Add a root `test:e2e` script and a separate `e2e` job in
      `.github/workflows/ci.yml` (needs the build, runs `npx playwright install --with-deps chromium`).
      Keep it out of `turbo run test` so `pnpm test` stays fast and browser-free.
      Files: `playwright.config.ts`, `e2e/smoke.spec.ts`, `package.json`, `.github/workflows/ci.yml`,
      `.gitignore` (ignore `playwright-report/`, `test-results/`)
      Verify: `pnpm build && pnpm test:e2e` — 3 specs pass. If `playwright install` cannot fetch browsers
      in this sandbox, still commit the config, specs and CI job, verify `npx playwright test --list`
      enumerates the 3 specs, and report E2E execution as deferred to CI.

- [ ] 28. Final gate. Run the full check suite and confirm nothing regressed across all phases.
      Files: none
      Verify: `pnpm lint && pnpm build && pnpm test` — 5 lint tasks clean, 5 builds succeed, and the
      Vitest total is well above the 29-test baseline with `@worldnest/game-engine`,
      `@worldnest/shared` and `@worldnest/web` suites all green. Also re-run
      `docker build -t worldnest:phase2 .` to confirm the multi-stage image still builds.

---

## Assumptions and known gaps

- **No Supabase project is reachable from the sandbox.** Every database item is therefore verified by
  `tsc`/lint plus SQL review, not by executing migrations. Items 23 and 24 include manual browser checks
  that only a maintainer with real `.env.local` credentials can perform; note them as unverified in the PR.
- **`worlds` has no `update`/`delete` policy** in `001`, and `player_state` `select` is owner-only, which
  prevents reading other players' saved positions. Item 21 keeps the existing policies and adds
  authenticated-read policies only on the new tables; changing `001` retroactively is out of scope, and
  live positions already come from Realtime rather than the table.
- **Anti-cheat is out of scope.** The architecture is client-authoritative by design (documented in
  `ARCHITECTURE.md`), so a malicious client can forge positions, harvests and inventory. Server-side
  validation would need Supabase Edge Functions or Postgres RPC and is a separate project.
- **Deliberately deferred**: NPCs and dialogue, quests, a trading/economy system, sound and music,
  mobile/touch controls, i18n of the UI, a minimap, and biome-level generator work (temperature layers,
  caves). Each is additive on top of the systems above and can follow the same
  Component + System + tests pattern.
- If any item's manual browser check cannot be performed, complete the automated verification, commit,
  and record the gap rather than blocking the remaining phases.

---

## Implementation notes for items 1-10 (deviations worth knowing for items 11-28)

- `@worldnest/database` now depends on `@worldnest/shared` (item 7 needs `PRESENCE_INTERVAL_MS`);
  item 22 can rely on that dependency being in place.
- `ChunkRenderer.redrawTile` is implemented, not stubbed, and `WorldManager.setTileChangeCallback`
  is the hook item 16 should wire it to.
- `WorldManager.applyTileOverrides` takes `Iterable<[tileKey, TileType]>`; `getTileKey`/`parseTileKey`
  are exported from the package barrel for persistence.
- The default spawn moved from `(256, 256)` to `(496, 336)` — tile `(15, 10)` — because tile `(8, 8)`
  is water for `WORLD_SEED` and collision would have trapped the player there.
- `GameScene` reads its identity/spawn from `registry.get("bootstrap")`; `GameCanvas` waits for
  `authStore.loading === false` before creating the game so the real user id is used.
- Remote players are entities with id `remote-<playerId>` (`remotePlayerEntityId`), created by
  `createRemotePlayerEntity` in `createGameWorld.ts`. `syncSprites()` in `GameScene` is the single
  sprite path; new renderable entity kinds only need depth/tint rules there.
- React consumes `players-changed` (payload type in `apps/web/src/game/events.ts`); later HUD events
  should follow the same pattern.
- Generated `*.tsbuildinfo` files are now gitignored and untracked.

---

## Implementation notes for items 11-16 (deviations worth knowing for items 17-28)

- `createGameWorld` now also returns `clockEntity` (id `WORLD_CLOCK_ENTITY_ID = "world-clock"`), and the
  clock entity is built **before** the systems object so `StatsSystem` can be constructed with a
  `() => timeComponent.snapshot.phase` getter. Item 17's `CropGrowthSystem` should take its clock the same
  way (`() => timeComponent.snapshot.totalMinutes`) instead of querying the world for the entity.
- System registration order is now: Time → Input → Collision → Movement → Chunk → Interpolation → Stats →
  Harvest → NetworkSync → Render. `PlantSystem`/`CropGrowthSystem`/`BuildSystem` belong next to Harvest,
  before NetworkSync, so a request made this frame is consumed this frame.
- Facing lives in `packages/game-engine/src/interaction/facing.ts` (a new directory, exported from the
  package barrel as `Facing`, `FACING_OFFSETS`, `getFacedTile`). `getFacedTile(pixelX, pixelY, facing,
  range?)` is the shared target resolver — planting and building must use it so all three agree.
- `InventoryComponent` carries a `version` counter that every mutating op in `inventoryOps` bumps; that is
  how the HUD detects changes. `inventoryOps` also exports `hasSpaceFor` (not in the plan text), which
  `HarvestSystem` uses to avoid consuming a tile when the yield would not fit.
- Phaser keyboard handling moved out of `GameScene` into `apps/web/src/game/PlayerController.ts` (movement
  polling, facing from the last non-zero direction, hotbar `1`-`8`, `I`, and `E`/`Space` interact with a
  250 ms cooldown written through `InteractionComponent.lastInteractAt`). Item 20's `B`/`Q` build bindings
  and item 24's chat-focus gate belong there, not in the scene.
- All Phaser→React HUD traffic goes through `apps/web/src/game/HudBridge.ts`, called once per frame from
  `GameScene.update`. It de-duplicates: clock by `totalMinutes`, inventory by `version`, stats by rounded
  whole points. New HUD events should be added there plus `apps/web/src/game/events.ts` and subscribed in
  `GameCanvas`.
- Day/night tinting lives in `apps/web/src/game/DayNightOverlay.ts` (scroll-factor-0 rectangle, 1 s tween
  on phase change), not inline in the scene.
- `WorldManager.setTileChangeCallback` is wired to `ChunkRenderer.redrawTile` in `GameScene.create`, so any
  `setTileOverride` call now repaints that one tile. Item 17's `FARMLAND` needs only a `tile_6` texture in
  `BootScene` for this to work, and item 23 can reuse the same callback to persist the diff.
- HUD components: `ClockHud`, `HotBar`, `InventoryPanel` and `StatusBars`, with a shared `ItemSlot` cell.
  Clock/inventory-panel toggles live in `uiStore`; position, inventory mirror and stats live in `gameStore`.
- Web test placement: engine-level gameplay wiring is covered in `apps/web/src/__tests__/gameWorld.test.ts`
  by driving `createGameWorld` directly (it is Phaser-free). The harvest test stands the player on tile
  `(20, 14)` facing east into the stone tile `(21, 14)` — a deterministic pair for `WORLD_SEED = 42`;
  there is no forest within the first few chunks, so use stone for tile-harvest tests.
- Test totals after item 16: `@worldnest/shared` 10, `@worldnest/game-engine` 101, `@worldnest/web` 31 = 142.
