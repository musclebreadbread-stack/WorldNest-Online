# Architecture Guide

This document describes the high-level architecture of WorldNest Online, the design decisions behind it, and how the major subsystems interact.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                          │
│                                                                 │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Next.js │  │  Zustand  │  │  Phaser   │  │  ECS Engine  │  │
│  │  App     │──│  Stores   │──│  Renderer │──│  (Systems)   │  │
│  └──────────┘  └───────────┘  └──────────┘  └──────────────┘  │
│       │                                           │             │
│       │              ┌────────────┐               │             │
│       └──────────────│  Realtime  │───────────────┘             │
│                      │  Client    │                             │
└──────────────────────┴─────┬──────┴─────────────────────────────┘
                             │
                     WebSocket Connection
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                      Supabase Platform                           │
│                                                                 │
│  ┌──────────┐  ┌───────────────┐  ┌─────────────────────────┐  │
│  │   Auth   │  │   Realtime    │  │      PostgreSQL          │  │
│  │          │  │  (Presence +  │  │  (profiles, player_state │  │
│  │          │  │   Broadcast)  │  │   worlds, terrain, chat) │  │
│  └──────────┘  └───────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

Supabase is optional at runtime. Without credentials the client still boots: authentication, chat and persistence disable themselves and the world runs as a single-player sandbox generated from the shared seed.

## Client Architecture

The client runs entirely in the browser as a Next.js application with Phaser handling game rendering.

### Next.js App (apps/web)

- **App Router** - Next.js 14 App Router with three routes: `/` (landing), `/auth` (sign in / sign up) and `/game`
- **Route guard** - `middleware.ts` checks for an `sb-*-auth-token` cookie (`src/lib/authCookie.ts`) and redirects `/game` to `/auth` when it is missing
- **Dynamic Loading** - Phaser is loaded dynamically (`next/dynamic` with `ssr: false`) so it never reaches the server render path
- **React UI** - HUD, panels and overlays are React components rendered on top of the Phaser canvas
- **TailwindCSS** - All UI styling uses Tailwind utility classes

### State Management (Zustand)

| Store           | Contents                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `authStore`     | Signed-in user, session, loading flag                                                                                  |
| `gameStore`     | Player position/chunk, inventory mirror, stats mirror, coins, online players, connection status                        |
| `uiStore`       | Panel toggles (inventory, minimap, quest log, settings), build mode, latest clock snapshot                             |
| `chatStore`     | Message list (capped at 100), unread count, a monotonic `received` counter, `inputFocused`, the injected send function |
| `localeStore`   | Active locale, `hydrated` flag; persisted to `localStorage["worldnest.locale"]`                                        |
| `audioStore`    | Master volume, music volume, muted; persisted to `localStorage["worldnest.audio"]`                                     |
| `touchStore`    | Virtual axis and the one-shot interact/place flags written by the on-screen controls                                   |
| `dialogueStore` | The open conversation node and its options, plus the injected `respond`/`close`                                        |
| `shopStore`     | The open shop, plus the injected `trade`/`close`                                                                       |
| `questStore`    | The quest log mirror, plus the injected `turnIn`                                                                       |

Zustand was chosen for its minimal boilerplate, TypeScript support, and compatibility with React's concurrent features.

### The injected-callback seam (D13)

The last four stores in that table, plus `chatStore.sender` and `touchStore`'s flags, are six instances of one pattern, and it is the rule that keeps the mirrors from desyncing:

```
React panel  →  injected callback  →  a request field on a component  →  the owning system
                (nullable, no-ops                                        decides next frame
                 before injection)
```

Every one of them has: nullable callback fields, public wrappers that no-op until a bridge injects them, a `setSnapshot` fed by exactly one `HudBridge` event, and a module-level `isXOpen()` predicate the input gate reads. React **asks**; the system **decides**, which is why a refused trade or a refused quest turn-in changes nothing at all. The bridges that do the injecting are `ChatBridge`, `DialogueBridge`, `ShopBridge` and `QuestBridge`; `DialogueBridge` additionally owns _action routing_, turning the picked option's `openShop` / `offerQuest` / `turnInQuest` into the matching request.

A test that resets one of these stores with `setState({...})` has to clear its callbacks too.

### The Phaser ↔ ECS ↔ React seam

Three one-way channels keep the layers decoupled:

```
React → Phaser    GameBootstrap object published on the Phaser registry
                  (playerId, username, spawn, worldId, saved inventory, saved world)

ECS → Phaser      RenderSystem.renderData, mirrored onto sprites by SpriteSync
                  (depth/tint/texture rules live only there; NameTags rides along)

Phaser → React    HudBridge, once per frame, de-duplicated per payload
                  (clock by totalMinutes, inventory/dialogue/shop/quests by
                   version, stats by whole points, coins by value)

React → ECS       an injected callback writing a request field on a component,
                  consumed by the owning system on the next frame (see above)
```

`HudBridge` publishes eight events, listed in `apps/web/src/game/events.ts`: `players-changed`, `player-position`, `clock-changed`, `inventory-changed`, `stats-changed`, `wallet-changed`, `shop-changed`, `quests-changed` and `dialogue-changed`. Each has its own `lastX` field rather than a generic diff map, which is what makes "did this actually change?" a single comparison.

The Phaser side of `apps/web/src/game/` is deliberately split so no file approaches the ~300-line cap in `CONTRIBUTING.md`:

| File                                                                                                | Responsibility                                                                                            |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `createGameWorld.ts`                                                                                | ECS assembly and system registration — **Phaser-free**, which is what makes gameplay testable under jsdom |
| `savedWorld.ts`                                                                                     | Restoring persisted terrain, structures and crops into a fresh world                                      |
| `PlayerController.ts`                                                                               | Movement polling, facing, and the rate-limited request helpers                                            |
| `keyBindings.ts`                                                                                    | `ONE_SHOT_BINDINGS`, the number-key handler and the `whenPlaying` gate (imports Phaser)                   |
| `panelStack.ts`                                                                                     | `isTyping()`, `isHudModal()`, `closeTopmostPanel()` — **Phaser-free on purpose** (see below)              |
| `SpriteSync.ts` + `NameTags.ts`                                                                     | Every sprite, its depth and tint; every floating label                                                    |
| `ChunkRenderer.ts`                                                                                  | One `RenderTexture` per loaded chunk, plus single-tile repaints                                           |
| `SceneOverlay.ts`                                                                                   | The `SceneOverlay` / `OverlayContext` contract and the `OverlayStack`                                     |
| `DayNightOverlay.ts`, `BuildGhost.ts`, `Minimap.ts` (+ `minimapLayout.ts`), `audio/SoundManager.ts` | The registered overlays                                                                                   |
| `HudBridge.ts`                                                                                      | The one per-frame ECS → React publisher                                                                   |
| `ChatBridge.ts`, `DialogueBridge.ts`, `ShopBridge.ts`, `QuestBridge.ts`                             | Callback injection and action routing                                                                     |
| `NetworkBridge.ts`                                                                                  | All realtime plumbing, behind a narrow `NetworkTransport` interface                                       |
| `loadSession.ts`, `SessionPersistence.ts`                                                           | Session load and autosave                                                                                 |

Two of those splits exist for a reason worth remembering: **importing Phaser under jsdom throws** (inside `checkInverseAlpha`), so anything a Vitest suite needs to reason about must live in a module that does not import it. That is why `panelStack.ts` is separate from `keyBindings.ts` and `minimapLayout.ts` separate from `Minimap.ts`.

### Scene overlays

`GameScene.update()` calls `this.overlays.update(ctx)` exactly once. An overlay is anything wanting a per-frame tick:

```typescript
interface OverlayContext {
  phase: DayPhase;
  buildMode: boolean;
  playerEntity: Entity;
  worldManager: WorldManager;
  deltaMs: number;
}

interface SceneOverlay {
  update(ctx: OverlayContext): void;
  destroy(): void;
}
```

`OverlayStack.add<T>(overlay): T` returns its argument, so the scene keeps a typed handle and still registers in one line. Anything an overlay needs beyond the context (the `World` for the minimap's remote dots, a `BuildSystem` for the ghost, the crop and structure counts for the sound cues) is taken by **constructor injection** rather than widening `OverlayContext` — the same rule the engine's systems follow.

## ECS Game Engine (packages/game-engine)

### Core Architecture

```
World
├── Entity Registry (Map<string, Entity>)
├── Query Cache (per system, invalidated by entity change listeners)
└── System Pipeline (insertion order = execution order)
```

- **Entity** — an id plus a `Map<string, Component>`. No behaviour.
- **Component** — pure data, identified by a string `type` passed to `super("position")`.
- **System** — declares `requiredComponents: string[]` and implements `update(entities: Entity[], deltaTime: number)`. It receives the already-filtered entity array; it never queries the world.
- **World** — caches each system's matching entities and invalidates that cache when an entity is added, removed, or has its component set changed (`EntityChangeListener`).

Anything external a system needs is injected through its constructor: a `TileQuery`, a `setTileOverride` callback, a clock getter, or `AddEntity`/`RemoveEntityById` callbacks. That is what lets every system be tested with fakes and no `World`.

### Components

| Component                      | Type key              | Data                                                                                                 |
| ------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------- |
| `PositionComponent`            | `position`            | x, y, chunkX, chunkY                                                                                 |
| `VelocityComponent`            | `velocity`            | vx, vy                                                                                               |
| `SpriteComponent`              | `sprite`              | textureKey, frame, visible                                                                           |
| `AnimationComponent`           | `animation`           | state, direction, elapsed, frameIndex, frameDurationMs, frameCount                                   |
| `PlayerComponent`              | `player`              | playerId, username, isLocal                                                                          |
| `ChunkComponent`               | `chunk`               | chunkX, chunkY                                                                                       |
| `InputComponent`               | `input`               | key state                                                                                            |
| `NetworkComponent`             | `network`             | dirty flag, last sync time                                                                           |
| `RemoteInterpolationComponent` | `remoteInterpolation` | targetX, targetY, lerpFactor                                                                         |
| `ColliderComponent`            | `collider`            | width, height, enabled                                                                               |
| `TimeComponent`                | `time`                | latest `ClockSnapshot`                                                                               |
| `InventoryComponent`           | `inventory`           | slots, selectedSlot, version                                                                         |
| `StatsComponent`               | `stats`               | health, maxHealth, energy, maxEnergy, regenPerMinute                                                 |
| `InteractionComponent`         | `interaction`         | facing, interactRequested/lastInteractAt, buildRequested/lastBuildAt                                 |
| `CropComponent`                | `crop`                | seed itemId, plantedAtMinute, stage, stageCount, minutesPerStage, tileX, tileY                       |
| `StructureComponent`           | `structure`           | itemId, tileX, tileY, collidable                                                                     |
| `NpcComponent`                 | `npc`                 | npcId, nameKey, dialogueId, role, tileX, tileY                                                       |
| `DialogueComponent`            | `dialogue`            | activeNpcId, dialogueId, nodeId, requestedOption, closeRequested, version                            |
| `WalletComponent`              | `wallet`              | coins                                                                                                |
| `ShopComponent`                | `shop`                | openNpcId, requestedOpenNpcId, closeRequested, requestedTrade, refusals, version                     |
| `QuestComponent`               | `quest`               | entries (`Record<questId, { state, progress }>`), requestedOffer, requestedTurnIn, refusals, version |

The last three follow one shape deliberately: a **request** field React writes, a **state** field only the system writes, a `refusals` counter (which is what the apologetic `deny` sound is played from) and a `version` bumped **only** by accepted changes, so the HUD never re-renders on a no-op.

### System Execution Order

Registered in `apps/web/src/game/createGameWorld.ts`; insertion order **is** execution order, and several positions are load-bearing:

| #   | System                | Why it sits here                                                                                                                                                                                                |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `TimeSystem`          | Refreshes the clock first so every later system sees the same instant                                                                                                                                           |
| 2   | `InputSystem`         | Turns key state into velocity                                                                                                                                                                                   |
| 3   | `CollisionSystem`     | Vetoes velocity **before** it is integrated, which is what makes per-axis wall sliding trivial                                                                                                                  |
| 4   | `MovementSystem`      | Integrates the surviving velocity                                                                                                                                                                               |
| 5   | `ChunkSystem`         | Streams chunks around the new position                                                                                                                                                                          |
| 6   | `InterpolationSystem` | Eases remote players toward their network target (and animates them)                                                                                                                                            |
| 7   | `StatsSystem`         | Regenerates energy, at double rate at night                                                                                                                                                                     |
| 8   | `NpcSystem`           | Spawns the catalogue NPCs, owns their occupancy index, opens/advances conversations. **Before planting**, so talking to a villager can never till the ground under them — it consumes `interactRequested` first |
| 9   | `ShopSystem`          | Resolves open/trade/close requests, so a shop a conversation asked for opens in that same frame                                                                                                                 |
| 10  | `QuestSystem`         | Polls objective progress, records greetings, pays out turn-ins — after the conversation that triggered them                                                                                                     |
| 11  | `PlantSystem`         | Tills/sows; only clears `interactRequested` when it acted                                                                                                                                                       |
| 12  | `CropGrowthSystem`    | Recomputes crop stages from the clock                                                                                                                                                                           |
| 13  | `BuildSystem`         | Consumes `buildRequested`, spawns structures, owns the occupancy index                                                                                                                                          |
| 14  | `HarvestSystem`       | Last consumer of `interactRequested`, so it sees requests planting ignored                                                                                                                                      |
| 15  | `NetworkSyncSystem`   | Emits throttled position payloads                                                                                                                                                                               |
| 16  | `AnimationSystem`     | Runs after velocity has settled, so a player pressed against a wall reads as idle                                                                                                                               |
| 17  | `RenderSystem`        | Collects `renderData` for the Phaser layer                                                                                                                                                                      |

This list is not documentation on trust: `apps/web/src/__tests__/gameWorld.test.ts` asserts `Object.keys(context.systems)` equals it verbatim, so changing the registration order without updating this table fails the suite.

### Design decisions

- **D1 Collision as a velocity veto.** `CollisionSystem` probes the collider's four corners at the projected position, per axis, and zeroes the offending axis. Sliding along walls falls out for free and needs no rewrite of `MovementSystem`.
- **D2 Terrain edits as an overlay.** `WorldManager` keeps a `Map<"tileX,tileY", TileType>` consulted before generated tiles. `ChunkGenerator` stays deterministic, and persistence only has to store the diff.
- **D3 Clock from wall time.** `WorldClock.fromWallClock(Date.now())` means every client agrees on day/night and crop growth with zero server coordination. Accumulated-delta clocks drift per client.
- **D4 Item catalogue in `@worldnest/shared`.** Both the engine and the database layer need item ids, and `shared` is the only package both depend on.
- **D5 Inventory mutation as pure functions.** Components stay pure data; `inventory/inventoryOps.ts` holds the operations and bumps a `version` counter the HUD watches.
- **D6 Remote players are real entities.** One render path, working interpolation, and a player counter that reflects reality.
- **D7 Web unit tests exclude Phaser.** `createGameWorld` is Phaser-free, so gameplay wiring is asserted at the ECS level under jsdom; canvas behaviour belongs to Playwright.
- **D8 One migration per phase.** Gameplay tables land in `002_gameplay_schema.sql` and progression in `003_progression_schema.sql`, so a fresh project needs three SQL runs in a fixed order and no migration is ever edited after it ships.
- **D9 Biomes are a noise layer, not a generator rewrite.** A temperature channel plus a pure `classifyBiome(elevation, moisture, temperature)` decides what dry land is made of. Determinism, the existing elevation thresholds and the coastline shape are all untouched, and the classification is unit-testable without generating a chunk.
- **D10 Caves stay on the single tile layer.** A real cave dimension would need a layer key threaded through the override map, `world_modifications`, chunk keys, the renderer and persistence, for the same visible result. Recorded as a future option, not built.
- **D11 The minimap samples in the engine and paints in Phaser.** `sampleMinimap()` is a pure function returning tile ids, so it is testable with no canvas. A React canvas fed by a HUD event was rejected: it would push a few thousand tile ids across the bridge on every redraw.
- **D12 i18n is hand-rolled, not `next-intl`.** Every route is already `"use client"` and `middleware.ts` is doing auth, so locale routing would fight both. A typed message record, a `translate()` with English fallback, one store and one hook add no dependency and turn "all 12 locales have the same keys" into a unit test.
- **D13 React writes to the engine only through injected callbacks.** See [the injected-callback seam](#the-injected-callback-seam-d13).
- **D14 Audio is synthesised at runtime, not shipped as assets.** There is not one binary asset in this repository — `BootScene` already draws every texture programmatically, so sound follows suit as WebAudio oscillator envelopes described by a pure data table. No asset pipeline, no licensing question, and fully testable against a fake `AudioContext`.
- **D15 Sound cues come from state diffs, not from new engine events.** `SoundManager` diffs a snapshot once per frame, exactly as `HudBridge` does, instead of sprinkling `playSound()` through six systems.
- **D16 Touch controls are DOM, not Phaser.** A React overlay writes a virtual axis into `touchStore` and `PlayerController` merges it with the keyboard, so input still funnels through one place — and the buttons get real 44 px targets, Tailwind styling and `aria-label`s instead of being drawn into the canvas.
- **D17 NPCs are static and deterministically placed.** Wandering NPCs would drift per client for the same reason an accumulated-delta clock does, and syncing them needs a server. A spiral search snaps each catalogue anchor to the nearest suitable tile, so every client agrees and a biome change can never bury a shopkeeper in water.
- **D18 No player-to-player trading.** See [Economy and its security posture](#economy-and-its-security-posture).
- **D19 Coins are a column on `player_state`, not a table.** That row is already written by every autosave; a `player_wallet` table would double the write traffic for one integer.

## World Generation

The world is divided into fixed-size chunks (`CHUNK_SIZE = 16` tiles of `TILE_SIZE = 32` px).

### Generation

```
1. Player moves to position (x, y)
2. ChunkSystem converts it to a chunk coordinate and calls
   WorldManager.updateLoadedChunks(chunkX, chunkY)
3. Chunks within the load radius are generated if missing, others unloaded
4. ChunkGenerator samples five seeded simplex layers per tile (see below)
5. The override layer is consulted before generated data on every tile read
```

### The five noise channels

| Channel     | Seed          | Scale | What it decides                                                                  |
| ----------- | ------------- | ----- | -------------------------------------------------------------------------------- |
| elevation   | `seed`        | 0.02  | Water, shore and rock; also a lapse rate on temperature                          |
| moisture    | `seed + 1000` | 0.015 | Half of the biome classification                                                 |
| detail      | `seed + 2000` | 0.1   | Accent-tile scatter, and where an ore vein sits                                  |
| temperature | `seed + 3000` | 0.008 | The other half of the classification — broadest scale, so climate bands are wide |
| caves       | `seed + 4000` | 0.06  | Which high rock is hollowed out                                                  |

`getTileType()` resolves them in a fixed priority order, and the order is the design:

```
elevation < -0.3   → WATER            (thresholds unchanged since the MVP, so the
elevation < -0.1   → SAND              coastline has the same shape it always had)
in a cave region   → CAVE_WALL | ORE | CAVE_FLOOR
elevation > 0.6    → STONE
otherwise          → the biome's surfaceTile, or its accentTile where detail > 0.5
```

### Biomes

`classifyBiome(elevation, moisture, temperature)` in `world/Biomes.ts` is pure, total over the whole noise cube, and free of the generator. It first applies elevation as a **lapse rate** — `effective = temperature - max(0, elevation) * 0.25`, so highlands are colder than lowlands at the same latitude — then splits on temperature and moisture:

| Biome       | Surface | Accent  |
| ----------- | ------- | ------- |
| `TUNDRA`    | snow    | stone   |
| `TAIGA`     | forest  | snow    |
| `GRASSLAND` | grass   | flowers |
| `FOREST`    | forest  | flowers |
| `SAVANNA`   | grass   | forest  |
| `DESERT`    | sand    | stone   |

The chill constant is deliberately small. A larger one turned every mountain fringe into tundra and removed the grass-beside-stone tiles the gameplay tests search for. `WorldManager.getBiomeAt(tileX, tileY)` exposes the classification and deliberately **ignores the override layer** — a tilled field is still in the biome it was dug from — which is why it is a method on the class and not part of `TileQuery`.

### Caves

Where elevation is above the stone threshold (well above the water line, so a cave can never flood) and the cave channel is above its own threshold, the tile is hollowed out:

- A cave tile whose orthogonal neighbour is **rock that was not hollowed out** becomes `CAVE_WALL`, so tunnels read as carved.
- Where the mountain slopes below the rock line, the cave simply opens onto the surface. That is how the player gets in; walling the whole perimeter would seal every cave and make `ore` unobtainable.
- `ORE` replaces the floor where the detail channel is high **and** a cave tile is adjacent, so a vein is never a lone speck on an isolated rock. Mining it leaves `CAVE_FLOOR` behind, not grassland, via `TileHarvestYield.replacementTile`.

### Determinism

Generation is a pure function of `WORLD_SEED` (42, in `@worldnest/shared`) and the world coordinate, seeded through `mulberry32`. So:

- Chunks are regenerated on demand instead of stored
- Every client sees the same terrain with no server coordination
- Only player _modifications_ need persisting — see `world_modifications`

### Tile Types

| Tile       | Value | Source                                 | walkable | buildable | harvestable  |
| ---------- | ----- | -------------------------------------- | -------- | --------- | ------------ |
| Grass      | 0     | elevation default                      | yes      | yes       | no           |
| Water      | 1     | elevation `< -0.3`                     | **no**   | no        | no           |
| Sand       | 2     | elevation `< -0.1`                     | yes      | yes       | no           |
| Forest     | 3     | moisture `> 0.2` and elevation `> 0.1` | yes      | no        | yes → wood   |
| Stone      | 4     | elevation `> 0.6`                      | yes      | no        | yes → stone  |
| Flowers    | 5     | biome accent (grassland, forest)       | yes      | no        | yes → flower |
| Farmland   | 6     | **override layer only** (tilling)      | yes      | yes       | no           |
| Snow       | 7     | tundra surface, taiga accent           | yes      | yes       | no           |
| Cave floor | 8     | cave channel                           | yes      | yes       | no           |
| Cave wall  | 9     | cave boundary against solid rock       | **no**   | no        | no           |
| Ore        | 10    | cave interior, high detail             | yes      | no        | yes → ore    |

New generated tile ids start at 7 on purpose: `FARMLAND = 6` is override-only and must stay so, and every id is a persisted `world_modifications.tile_type` smallint that cannot be renumbered.

Water and cave walls are the only tiles that block movement. Harvest yields and their energy costs live in `TILE_HARVEST_YIELD`; a harvested tile is replaced through the override layer — with grass by default, or with `replacementTile` where that would be absurd (ore becomes cave floor) — which repaints just that tile and queues it for persistence.

## Gameplay Loops

### Interaction targeting

`getFacedTile(pixelX, pixelY, facing, range = INTERACT_RANGE_TILES)` in `interaction/facing.ts` is the single target resolver. Harvesting, planting and building all call it, so they can never disagree about what the player is pointing at. Facing comes from the last non-zero movement direction, held after the keys are released.

`E` / `Space` set `interactRequested`; `B` toggles build mode and `Q` / left-click set `buildRequested`. Both are rate-limited to one request per 250 ms in `PlayerController`.

### World clock and day/night

`WorldClock.fromWallClock(nowMs)` yields `{ totalMinutes, day, hour, minute, phase }` with `GAME_MINUTES_PER_REAL_SECOND = 1` and `DAY_LENGTH_MINUTES = 1440` — a full day is 24 real minutes. Phases start at 05:00 dawn, 08:00 day, 18:00 dusk, 21:00 night. `TimeSystem` refreshes the snapshot every frame; `DayNightOverlay` tweens a scroll-factor-0 rectangle over 1 s on phase change, `StatsSystem` doubles energy regeneration at night, and `ClockHud` renders `Day 3 · 07:20 · dawn`.

### Inventory

20 slots, of which the first 8 are the hotbar. `inventoryOps` fills partial stacks before empty slots, splits at `ITEM_DEFINITIONS[itemId].stackSize`, returns any overflow that did not fit, and bumps `version` on every mutation. Selection lives in the engine — the `BuildMenu` is read-only precisely so React cannot desync the mirror in `gameStore`.

### Farming

`CROP_DEFINITIONS` is keyed by **seed** item id, so persistence only stores the seed plus `planted_at_minute`. Interacting with grass while holding a seed tills it to farmland; interacting again sows a crop entity and consumes one seed. `CropGrowthSystem` derives `stage = clamp(floor((nowMinutes - plantedAtMinute) / minutesPerStage), 0, stageCount - 1)` from the shared clock, which is why two clients always see the same stage. `wheat_seed` → 4 stages × 30 game minutes → 2 `wheat`.

### Building

`BuildSystem` places structure entities for items flagged `placeableStructure`, after checking `TILE_PROPERTIES[target].buildable` and its own occupancy index. That index is exposed as a `StructureQuery` and injected into `CollisionSystem`, so a collidable structure becomes a wall. `BuildSystem.canPlaceAt()` is public and drives the green/red build ghost, so the preview and the rules cannot drift apart.

### Animation

`AnimationSystem` derives `state` and `direction` from the settled velocity, advances `frameIndex` on a `frameDurationMs` timer, and writes `SpriteComponent.frame`. `SpriteSync` resolves the texture with `directionalTextureKey(textureKey, direction, frameIndex)` — the same helper `BootScene` generates the `player_<dir>_<n>` placeholders with. Remote players carry no velocity (that would let `MovementSystem` fight the smoothing), so `InterpolationSystem` advances their animation from the distance it actually moved them.

### NPCs and dialogue

`NPC_DEFINITIONS` holds three villagers anchored a few tiles from the default spawn: `villager_pip` the gardener, `shopkeeper_juno` and `questgiver_ada`. `resolveNpcTile()` snaps each anchor to the nearest **walkable, buildable, non-cave** tile by a deterministic spiral search, skipping any NPC with nowhere to stand within 12 tiles rather than relocating them out to sea. `buildable` is what keeps them off forest and stone without a second list to maintain.

`NpcSystem` owns the resulting tile index and **implements `StructureQuery`**, so `composeBlockers(build, npc)` makes a villager as solid as a fence without `CollisionSystem` knowing either exists. `BuildSystem` takes the same index as a second occupancy source, so a fence cannot be dropped on someone.

A dialogue tree is `{ rootNodeId, nodes: Record<string, DialogueNode> }`, where every option carries a `labelKey` plus either a `next` node or an `action` (`close`, `openShop`, `offerQuest`, `turnInQuest`). `dialogueOps` holds every transition as a pure function over a `DialogueState`, and the invariants are asserted rather than hoped for: every root exists, every option resolves, `MAX_DIALOGUE_OPTIONS = 4` (the UI binds number keys `1`-`4`, so a fifth would be keyboard-unreachable), and every node is leaveable, so no conversation can trap a player. An out-of-range option index is ignored **and does not bump `version`**, so a stale click from a panel that has already moved on publishes nothing.

`advanceDialogue` acts on `close` itself and returns the other three actions untouched; routing them is `DialogueBridge`'s job, which is what keeps every React → ECS write on the one seam.

### Economy and its security posture

The economy is an **NPC shop with fixed prices** plus a `coins` wallet starting at 50. `ITEM_PRICES` in `@worldnest/shared` covers nine items, and two invariants are enforced by tests rather than intended:

- **`sell < buy` for every single item**, so there is no buy-then-sell arbitrage loop.
- A wheat seed costs less than the wheat it yields, so farming is profitable (+8 coins per seed) but fixed and non-compounding.

Ore is the most valuable raw material (30/14), which is what makes the caves worth walking into. `shopOps` is pure and returns a boolean per trade, so a refused trade — not enough coins, no space, an item you do not hold, an untradable item — changes **nothing**, and in particular never takes the coins.

**Why there is no player-to-player trading, and why that is a security decision, not a scope cut:** this architecture is client-authoritative and anti-cheat is explicitly out of scope. A malicious client can already forge its own coins, inventory, harvests and quest progress — all of it is client-authored and none of it is validated anywhere. A market or a direct trade would let that client mint value _for other players too_, turning a local cheat into an economy-wide one. Fixed NPC prices keep the blast radius at one save file.

For the same audience reason (ages 10-18) there is no gambling, no randomised rewards, no loot boxes and no real-money path anywhere in the game. Server-side validation would need Postgres RPC or Supabase Edge Functions and is a separate project.

### Quests

Three starter quests, all given by Ada, one per objective kind: `collect_wood` (5 wood), `build_fence` (2 fences) and `greet_pip` (talk to Pip). Objectives are limited to `collect`, `build` and `talk` because all three can be judged by **polling state the engine already owns** — no event bus is needed. `build_fence` needs 2 fences at 20 coins each against 50 starting coins, so it teaches the shop and cannot be brute-forced on day one.

Two rules worth knowing:

- A turn-in is **refused whole** if the reward items would not fit, and the quest stays active. Space is checked by replaying the additions on a copy of the inventory, because two rewards can each fit alone and not fit together. Same promise `HarvestSystem` makes: nothing is ever silently destroyed.
- Turning a quest in **does not consume** the collected items. Progress is polled from the inventory, so "show it to Ada" is the honest wording, and that is what the description keys say in all twelve languages.

The quest ids are pinned to Ada's dialogue tree by a test (`dialogueQuestIds()` must equal `Object.keys(QUEST_DEFINITIONS)`), so a quest can never be offered by a conversation that no longer exists, or exist with no way to take it.

### The minimap

`sampleMinimap(tileQuery, centerTileX, centerTileY, radius)` walks a square window row-major into a `Uint8Array`, so index `y * size + x` is stable and the override layer shows through. That is the whole engine side, and it needs no canvas to test.

`Minimap.ts` maps those ids to `TILE_PROPERTIES[t].color` and paints them, with a white dot for the local player and tinted dots for remote ones, redrawing only when the centre tile changes or 500 ms have elapsed. The geometry lives in `minimapLayout.ts` because of a real trap: `setScrollFactor(0)` stops an object scrolling but **not** the camera zoom from scaling it about the camera midpoint, and `GameScene` runs at `setZoom(2)`. `fixedScreenPosition()` inverts that transform and the graphics is drawn at `setScale(1 / zoom)` so one drawing unit is one screen pixel.

### Internationalisation

`apps/web/src/i18n/messages/en.ts` is the source of truth — a flat `as const` record, currently 115 keys — and `MessageKey = keyof typeof en` makes every other catalogue a `Record` the compiler demands in full. Twelve locales ship complete: `en, ko, ja, zh, es, fr, de, pt, ar, hi, th, vi`. `translate(locale, key, params?)` falls back to English, then to the key itself, and interpolates `{name}`-style placeholders.

Five parity tests guard the catalogues, and they are the reason a translation gap cannot ship:

1. Every locale has exactly the `en` key set, with no empty values.
2. No non-English value equals its English string, except three entries listed in `LOCALE_AGNOSTIC_KEYS` (`you@example.com`, `X: {x} Y: {y}`, `{current} / {target}`) that legitimately cannot differ. This is what catches a copy-pasted catalogue.
3. Every locale uses exactly the placeholders English does, which catches a translated `{count}`.
4. `resolveLocale` handles script subtags, underscores and case (`zh-Hans-CN`, `es_MX`).
5. **Every `textKey`, `labelKey`, `nameKey`, `titleKey` and `descriptionKey` in the engine's dialogue, NPC and quest catalogues resolves in `en` and is translated everywhere.** That is the automated guard for the rule that translatable content in the engine is stored as **keys, never literals** — which is what lets twelve languages share one dialogue graph.

Two `Record`s map enums to keys (`ITEM_NAME_KEYS`, `CLOCK_PHASE_KEYS`) rather than building `` `item.${id}` `` templates, so adding an item to `@worldnest/shared` **fails to compile** until it has a translation key.

Arabic renders right-to-left through Tailwind logical utilities (`start-*` / `end-*`) plus `.hud-numeric` (`direction: ltr; unicode-bidi: isolate`) for coordinates, chunk indices and slot quantities, which the bidi algorithm would otherwise reorder inside Arabic text. The Phaser canvas does not mirror — a canvas has no `dir` — and that is accepted rather than fixed.

### Audio

`SOUND_SPECS` is a pure data table of nine cues (`pickup`, `harvest`, `plant`, `build`, `deny`, `ui`, `dialogue`, `quest`, `shop`), each an oscillator envelope: waveform, start and end frequency, duration and gain. `SoundSynth` creates its `AudioContext` **lazily on the first `play()` or `resume()`**, which is precisely the user gesture every browser's autoplay policy requires, and stays silent rather than throwing if the context cannot be created at all. There is no master gain node: `setVolume` scales each voice's scheduled peak, so a volume change does not affect a cue already sounding — every cue is under 260 ms, so nothing perceptible is lost.

`SoundManager` is a `SceneOverlay` that draws nothing. Once per frame it builds a `SoundState` snapshot — inventory version, energy, build mode, chat count, clock phase, dialogue/shop/quest versions, the refusal counter, and the crop and structure counts — and `diffCues(prev, next)` turns the differences into cues in a fixed order. Three details that are the design, not accidents:

- The **first** snapshot emits nothing, so booting does not fire a burst of chimes.
- Sowing and building **replace** the `pickup` chirp rather than layering with it, because the inventory bump they cause is the item being spent. Harvesting does layer `harvest` + `pickup`, because it spends energy and gains an item.
- `chatStore` carries a monotonic `received` counter and the diff watches that, not `messages.length`: the log is capped at 100, so a length-based diff would go deaf exactly when chat is busiest.

`MusicLoop` schedules a slow four-chord pad whose key follows the day phase. The progression advances even at zero volume, so nudging the slider picks up mid-bar instead of restarting.

### Touch input and the panel stack

`touchStore` holds a virtual axis plus one-shot interact/place flags; `TouchControls.tsx` renders a thumb-stick and six buttons (`E`, `B`, `Q`, `I`, `M`, `J`) at 44 px minimum, mounted only when `matchMedia("(pointer: coarse)")` reports true. `mergeInput(keys, axisX, axisY, deadzone)` is pure, and it lets **the keyboard win outright** rather than OR-ing the axis in: OR semantics would set `left` and `right` together when a held key opposes a stale axis, and `MovementSystem` resolves that as standing still — a much worse failure than the stick being ignored while a key is down. Touch requests are consumed _before_ the typing gate, so a tap that lands while the chat composer has focus is dropped rather than queued.

`panelStack.ts` holds the two predicates every input path consults. `isHudModal()` is true while typing or while a conversation or shop is open, and it suppresses movement _and_ every toggle — the player stands still while trading. `closeTopmostPanel()` gives `Esc` its precedence, one press per press:

```
dialogue → shop → quest log → inventory → settings → build mode
```

Chat is deliberately not in that list: the composer blurs itself on `Escape`, so the handler returns early while it has focus. Adding a panel is two lines in `panelStack.ts` plus a row in `keyBindings.ts`'s `ONE_SHOT_BINDINGS` table.

## Multiplayer Sync

### Approach: client-authoritative with optimistic display

1. **Local player** moves immediately — no round trip
2. **Position broadcast** every `SYNC_INTERVAL_MS` (50 ms) over the Broadcast channel
3. **Presence** is re-tracked at most every `PRESENCE_INTERVAL_MS` (1 s) with the real position, so a late joiner does not see everyone at the origin
4. **Remote clients** write the incoming position as an interpolation target and ease toward it

### Supabase Realtime channels

- **Presence** — who is online, and where they were last seen
- **Broadcast** — positions and chat messages, with `self: false`, so a sender adds its own chat copy locally

`RealtimeManager` keeps `setChatCallback` separate from `setCallbacks`: the player callbacks are registered by `GameScene` while chat is registered by `GameCanvas`, and one combined setter would let whichever ran last wipe the other's handlers.

### Sync Flow

```
Player Input
    │
    ▼
Local ECS Update (immediate)
    │
    ├──▶ Broadcast position (throttled) + update Presence (throttled)
    │
    ▼
Render locally (no wait)

Meanwhile:
    Remote broadcast received
        │
        ▼
    Remote entity's interpolation target updated
        │
        ▼
    InterpolationSystem eases position (and animates)
```

**Anti-cheat is out of scope.** The client is authoritative by design, so a malicious client can forge positions, harvests, inventory, **coins and quest progress** — all of it is client-authored and none of it is validated anywhere. Server-side validation would require Postgres RPC or Edge Functions and is a separate project. That consequence is not just accepted, it is _designed around_: see [Economy and its security posture](#economy-and-its-security-posture) for why it rules out player-to-player trading.

## Rendering Pipeline (Phaser 3)

### Scene structure

| Scene       | Responsibility                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BootScene` | Generates every placeholder texture — one `tile_<n>` per `TileType` (derived from `Object.values(TileType)`, so a new tile can never be missed), `crop_wheat_0..3`, `structure_*`, one `npc_<role>` per catalogue role (via `scenes/npcTextures.ts`), and the 4-direction × 2-frame `player_<dir>_<n>` spritesheet — then starts the other scenes. **There are no binary assets in this repository** |
| `GameScene` | Owns the ECS world, chunk textures, camera, input, networking and persistence wiring                                                                                                                                                                                                                                                                                                                 |
| `UIScene`   | A minimal canvas-side position/chunk readout (depth 1000, scroll factor 0); the real HUD is React                                                                                                                                                                                                                                                                                                    |

### Depth layers

| Depth         | Contents                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------- |
| 1000          | `UIScene`'s canvas-side position/chunk readout                                            |
| 900           | Day/night tint, then the minimap — registered after it, so the map is not dimmed at night |
| 110           | Remote player and NPC labels (`NameTags`)                                                 |
| 100 / 99 / 98 | Local player / remote players / NPCs                                                      |
| 61 / 60       | Build ghost / placed structures                                                           |
| 50            | Crops and other world-bound sprites                                                       |
| 0             | Chunk render textures drawn by `ChunkRenderer`                                            |

`NameTags` compares `label.text` every pass, so switching language relabels the whole village without a reload.

### Bridge to ECS

`RenderSystem` produces a flat array each frame:

```typescript
interface RenderData {
  entityId: string;
  x: number;
  y: number;
  textureKey: string;
  frame: number;
  visible: boolean;
}
```

`SpriteSync` creates, moves and destroys one Phaser sprite per entry, and is the only place that decides depth, tint and texture. Chunks are separate: `ChunkRenderer` keeps one `RenderTexture` per chunk, driven by `WorldManager`'s load/unload callbacks, and `redrawTile` repaints a single tile when the override layer changes rather than rebuilding the chunk.

## Persistence

### Session start

`GameCanvas` waits for auth to settle, then `loadSession` reads the default world, the player's saved state, the terrain diff, structures, crops, **coins and the quest log**. All of it is handed to the game as a single `GameBootstrap` object on the Phaser registry. Any failure returns `null` and the game boots with defaults; a saved position of exactly `(0, 0)` is treated as "never saved", because that is what the new-user trigger inserts.

Coins are the one place that rule needed care. `0` is a balance a player genuinely reaches by spending, so treating the column default as "never saved" would hand them another 50 coins on every reload — a free-money loop in an economy that is otherwise carefully bounded. `loadSession` therefore judges it from the **row**, not the column: `hasSaved = hasSpawn || inventory !== null` (one upsert writes the whole row, so one signal answers for all of it), and `createGameWorld` does `bootstrap.coins ?? STARTING_COINS`. `null` grants the purse; a saved `0` stays `0`.

`questSnapshot.ts` validates persisted quest ids against `QUEST_DEFINITIONS` the way `isItemId` guards persisted items, so removing a quest from the catalogue drops its row instead of crashing a session. An empty or entirely-unusable result parses to `null`, which is the same "nothing was saved" signal the inventory gives.

### While playing

`SessionPersistence` writes through a `SaveScheduler` (`apps/web/src/lib/persistence.ts`), which coalesces dirty state into at most one save per `AUTOSAVE_INTERVAL_MS` (10 s) and always flushes on `flush()` — called on unmount and `beforeunload`. Tile overrides piggyback on `WorldManager.setTileChangeCallback`; structures and crops are diffed once per frame from `BuildSystem.getStructures()` and `PlantSystem.getCrops()`, guarded by a cheap size comparison, which also catches a harvested crop and issues the delete.

The autosave tick diffs five things — x, y, inventory version, coins and quest version. Coins ride along in the `player_state` upsert; quest rows go to `player_quests` in their own write, skipped entirely when the save was triggered by walking. A restored quest log records its version in the constructor, so loading a session does not immediately write it straight back.

Item ids read back from the database are validated with `isItemId()`, so removing an item from the catalogue drops those rows instead of crashing a session.

## Database Schema

PostgreSQL via Supabase. **Three** migrations, run in order, in `packages/database/supabase/migrations/`, plus an optional development-only seed in `packages/database/supabase/seed/`.

`pnpm db:verify` applies all of them to a throwaway dockerised Postgres and asserts what they promise — the policy counts, the seeded world, the trigger, RLS on the new table, the composite-key upsert and the `state` check constraint. Treat that command, not this document, as the authoritative statement of how many policies exist: a number written here would drift, and a dropped policy is a silent security regression.

### 001_initial_schema.sql

| Table          | Key columns                                                                   | Notes                                            |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| `profiles`     | `id` → `auth.users`, `username`, `avatar`, `created_at`                       | Public read, owner-only writes                   |
| `player_state` | `player_id` → `profiles`, `x`, `y`, `chunk`, `inventory` jsonb, `last_online` | Owner-only read **and** write                    |
| `worlds`       | `id`, `name`, `seed`, `created_at`                                            | Public read; seeded with `('Default World', 42)` |

### 002_gameplay_schema.sql

| Object                                               | Purpose                                                                                                                                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handle_new_user()` + `on_auth_user_created` trigger | `security definer`, inserts a `profiles` row and a `player_state` row on sign-up (`on conflict do nothing`). Without it the `player_state` foreign key is unusable, because nothing else ever creates a profile. |
| `world_modifications`                                | PK `(world_id, tile_x, tile_y)`, `tile_type`, `modified_by` (`on delete set null`), `updated_at` — the terrain diff                                                                                              |
| `structures`                                         | `id`, `world_id`, `owner_id`, `item_id`, tile, unique `(world_id, tile_x, tile_y)`                                                                                                                               |
| `crops`                                              | as above plus `planted_at_minute`; `item_id` is the **seed**                                                                                                                                                     |
| `chat_messages`                                      | `id`, `world_id`, `sender_id`, `username`, `body`, `created_at`, indexed `(world_id, created_at desc)`                                                                                                           |

### 003_progression_schema.sql

| Object               | Purpose                                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `player_state.coins` | `integer default 0 not null`, added with `add column if not exists`. One column rather than a `player_wallet` table (D19), because that row is already written by every autosave       |
| `player_quests`      | Primary key `(player_id, quest_id)`, `state text` with a `check (state in ('available','active','completed'))`, `progress integer`, `updated_at`. `player_id` cascades from `profiles` |

`quest_id` is plain `text` and **deliberately not a foreign key**: the quest catalogue lives in the client, so a quest removed from it must leave a harmless orphan row rather than break the schema. The client validates ids on the way back in. The `check` constraint is the only thing stopping a typo'd state reaching a session, which is why `pnpm db:verify` asserts it rejects one.

### seed/test_accounts.sql (development only)

Three confirmed accounts (`tester1..3@worldnest.test`, all `worldnest123`) with fixed uuids, `email_confirmed_at` set and an `auth.identities` row each, so newer GoTrue accepts an email sign-in. It is a **seed, not a migration**: it inserts fake `auth.users` rows, so it lives outside the numbered sequence, is idempotent, and must run after `002` because it relies on the `handle_new_user` trigger to create the `profiles` and `player_state` rows. **Never run it against a project that matters** — the password is published in this repository.

### Row Level Security

RLS is enabled on every table. The four gameplay tables follow one rule: `select` is open to any authenticated user, because the world is shared, while `insert`/`update`/`delete` require `auth.uid()` to match `owner_id`, `modified_by` or `sender_id`. Chat has no `update` policy — history is append-only apart from deleting your own message. `player_quests` is private progression, so it follows `player_state` instead: owner-only for reads as well as writes, on all four verbs.

Two known gaps inherited from `001`: `worlds` has no `update`/`delete` policy, and `player_state` `select` is owner-only, so other players' saved positions cannot be read. Live positions come from Realtime instead, so nothing depends on it.

### Generated types

`packages/database/src/types.ts` mirrors all eight tables. Each entry needs `Row`, `Insert`, `Update` **and** `Relationships` — postgrest-js only treats a table as writable when all four are present, and without `Relationships: []` every `insert`/`upsert` argument resolves to `never[]`. `packages/database` never imports `@worldnest/game-engine` (the dependency runs the other way), so the inventory column is typed as `PersistedInventory` with plain `string` item ids, and `PersistedQuest.state` is a plain `string` rather than the engine's `QuestState` union. Both are as loose as the columns are, and both are narrowed on the client.

## Package Dependencies

```
@worldnest/web
├── @worldnest/game-engine
│   └── @worldnest/shared
├── @worldnest/shared
├── @worldnest/database
│   └── @worldnest/shared
└── @worldnest/ui

@worldnest/game-engine
└── @worldnest/shared

@worldnest/database
└── @worldnest/shared (+ @supabase/supabase-js)

@worldnest/ui
└── (standalone - only react)
```

The build order (managed by Turborepo) ensures dependencies are built before dependents:

1. `@worldnest/shared` (no internal deps)
2. `@worldnest/ui` (no internal deps)
3. `@worldnest/database` (depends on shared)
4. `@worldnest/game-engine` (depends on shared)
5. `@worldnest/web` (depends on all)
