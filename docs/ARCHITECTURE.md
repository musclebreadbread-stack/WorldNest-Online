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

| Store | Contents |
|-------|----------|
| `authStore` | Signed-in user, session, loading flag |
| `gameStore` | Player position/chunk, inventory mirror, stats mirror, online players, connection status |
| `uiStore` | Panel toggles (inventory), build mode, latest clock snapshot |
| `chatStore` | Message list (capped at 100), unread count, `inputFocused`, the injected send function |

Zustand was chosen for its minimal boilerplate, TypeScript support, and compatibility with React's concurrent features.

### The Phaser ↔ ECS ↔ React seam

Three one-way channels keep the layers decoupled:

```
React → Phaser    GameBootstrap object published on the Phaser registry
                  (playerId, username, spawn, worldId, saved inventory, saved world)

ECS → Phaser      RenderSystem.renderData, mirrored onto sprites by SpriteSync
                  (depth/tint/texture rules live only there; NameTags rides along)

Phaser → React    HudBridge, once per frame, de-duplicated per payload
                  (clock by totalMinutes, inventory by version, stats by whole points)
```

The Phaser side of `apps/web/src/game/` is deliberately split so no file approaches the ~300-line cap in `CONTRIBUTING.md`: `createGameWorld` (ECS assembly, Phaser-free), `PlayerController` (all input), `SpriteSync` + `NameTags` (all sprites and labels), `ChunkRenderer` (chunk textures), `DayNightOverlay`, `BuildGhost`, `HudBridge`, `ChatBridge`, `loadSession` and `SessionPersistence`.

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

| Component | Type key | Data |
|-----------|----------|------|
| `PositionComponent` | `position` | x, y, chunkX, chunkY |
| `VelocityComponent` | `velocity` | vx, vy |
| `SpriteComponent` | `sprite` | textureKey, frame, visible |
| `AnimationComponent` | `animation` | state, direction, elapsed, frameIndex, frameDurationMs, frameCount |
| `PlayerComponent` | `player` | playerId, username, isLocal |
| `ChunkComponent` | `chunk` | chunkX, chunkY |
| `InputComponent` | `input` | key state |
| `NetworkComponent` | `network` | dirty flag, last sync time |
| `RemoteInterpolationComponent` | `remoteInterpolation` | targetX, targetY, lerpFactor |
| `ColliderComponent` | `collider` | width, height, enabled |
| `TimeComponent` | `time` | latest `ClockSnapshot` |
| `InventoryComponent` | `inventory` | slots, selectedSlot, version |
| `StatsComponent` | `stats` | health, maxHealth, energy, maxEnergy, regenPerMinute |
| `InteractionComponent` | `interaction` | facing, interactRequested/lastInteractAt, buildRequested/lastBuildAt |
| `CropComponent` | `crop` | seed itemId, plantedAtMinute, stage, stageCount, minutesPerStage, tileX, tileY |
| `StructureComponent` | `structure` | itemId, tileX, tileY, collidable |

### System Execution Order

Registered in `apps/web/src/game/createGameWorld.ts`; insertion order **is** execution order, and several positions are load-bearing:

| # | System | Why it sits here |
|---|--------|------------------|
| 1 | `TimeSystem` | Refreshes the clock first so every later system sees the same instant |
| 2 | `InputSystem` | Turns key state into velocity |
| 3 | `CollisionSystem` | Vetoes velocity **before** it is integrated, which is what makes per-axis wall sliding trivial |
| 4 | `MovementSystem` | Integrates the surviving velocity |
| 5 | `ChunkSystem` | Streams chunks around the new position |
| 6 | `InterpolationSystem` | Eases remote players toward their network target (and animates them) |
| 7 | `StatsSystem` | Regenerates energy, at double rate at night |
| 8 | `PlantSystem` | Tills/sows; only clears `interactRequested` when it acted |
| 9 | `CropGrowthSystem` | Recomputes crop stages from the clock |
| 10 | `BuildSystem` | Consumes `buildRequested`, spawns structures, owns the occupancy index |
| 11 | `HarvestSystem` | Last consumer of `interactRequested`, so it sees requests planting ignored |
| 12 | `NetworkSyncSystem` | Emits throttled position payloads |
| 13 | `AnimationSystem` | Runs after velocity has settled, so a player pressed against a wall reads as idle |
| 14 | `RenderSystem` | Collects `renderData` for the Phaser layer |

### Design decisions

- **D1 Collision as a velocity veto.** `CollisionSystem` probes the collider's four corners at the projected position, per axis, and zeroes the offending axis. Sliding along walls falls out for free and needs no rewrite of `MovementSystem`.
- **D2 Terrain edits as an overlay.** `WorldManager` keeps a `Map<"tileX,tileY", TileType>` consulted before generated tiles. `ChunkGenerator` stays deterministic, and persistence only has to store the diff.
- **D3 Clock from wall time.** `WorldClock.fromWallClock(Date.now())` means every client agrees on day/night and crop growth with zero server coordination. Accumulated-delta clocks drift per client.
- **D4 Item catalogue in `@worldnest/shared`.** Both the engine and the database layer need item ids, and `shared` is the only package both depend on.
- **D5 Inventory mutation as pure functions.** Components stay pure data; `inventory/inventoryOps.ts` holds the operations and bumps a `version` counter the HUD watches.
- **D6 Remote players are real entities.** One render path, working interpolation, and a player counter that reflects reality.
- **D7 Web unit tests exclude Phaser.** `createGameWorld` is Phaser-free, so gameplay wiring is asserted at the ECS level under jsdom; canvas behaviour belongs to Playwright.
- **D8 One gameplay migration.** All phase-2 tables land in `002_gameplay_schema.sql`, so a fresh project needs exactly two SQL runs.

## World Generation

The world is divided into fixed-size chunks (`CHUNK_SIZE = 16` tiles of `TILE_SIZE = 32` px).

### Generation

```
1. Player moves to position (x, y)
2. ChunkSystem converts it to a chunk coordinate and calls
   WorldManager.updateLoadedChunks(chunkX, chunkY)
3. Chunks within the load radius are generated if missing, others unloaded
4. ChunkGenerator samples three seeded simplex layers per tile:
   elevation (0.02), moisture (0.015), detail (0.1)
5. The override layer is consulted before generated data on every tile read
```

### Determinism

Generation is a pure function of `WORLD_SEED` (42, in `@worldnest/shared`) and the world coordinate, seeded through `mulberry32`. So:

- Chunks are regenerated on demand instead of stored
- Every client sees the same terrain with no server coordination
- Only player *modifications* need persisting — see `world_modifications`

### Tile Types

| Tile | Value | Source | walkable | buildable | harvestable |
|------|-------|--------|----------|-----------|-------------|
| Grass | 0 | elevation default | yes | yes | no |
| Water | 1 | elevation `< -0.3` | **no** | no | no |
| Sand | 2 | elevation `< -0.1` | yes | yes | no |
| Forest | 3 | moisture `> 0.2` and elevation `> 0.1` | yes | no | yes → wood |
| Stone | 4 | elevation `> 0.6` | yes | no | yes → stone |
| Flowers | 5 | detail `> 0.5` and moisture `> -0.1` | yes | no | yes → flower |
| Farmland | 6 | **override layer only** (tilling) | yes | yes | no |

Water is the only tile that blocks movement. Harvest yields and their energy costs live in `TILE_HARVEST_YIELD`; a harvested tile becomes grass through the override layer, which repaints just that tile and queues it for persistence.

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

**Anti-cheat is out of scope.** The client is authoritative by design, so a malicious client can forge positions, harvests and inventory. Server-side validation would require Postgres RPC or Edge Functions and is a separate project.

## Rendering Pipeline (Phaser 3)

### Scene structure

| Scene | Responsibility |
|-------|----------------|
| `BootScene` | Generates every placeholder texture (`tile_0..tile_6`, `crop_wheat_0..3`, `structure_*`, and the 4-direction × 2-frame `player_<dir>_<n>` spritesheet), then starts the other scenes |
| `GameScene` | Owns the ECS world, chunk textures, camera, input, networking and persistence wiring |
| `UIScene` | A minimal canvas-side position/chunk readout (depth 1000, scroll factor 0); the real HUD is React |

### Depth layers

| Depth | Contents |
|-------|----------|
| 110 | Remote username labels (`NameTags`) |
| 100 / 99 | Local player / remote players |
| 61 / 60 | Build ghost / placed structures |
| 50 | Crops and other world-bound sprites |
| below | Chunk render textures drawn by `ChunkRenderer` |

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

`GameCanvas` waits for auth to settle, then `loadSession` reads the default world, the player's saved state, the terrain diff, structures and crops. All of it is handed to the game as a single `GameBootstrap` object on the Phaser registry. Any failure returns `null` and the game boots with defaults; a saved position of exactly `(0, 0)` is treated as "never saved", because that is what the new-user trigger inserts.

### While playing

`SessionPersistence` writes through a `SaveScheduler` (`apps/web/src/lib/persistence.ts`), which coalesces dirty state into at most one save per `AUTOSAVE_INTERVAL_MS` (10 s) and always flushes on `flush()` — called on unmount and `beforeunload`. Tile overrides piggyback on `WorldManager.setTileChangeCallback`; structures and crops are diffed once per frame from `BuildSystem.getStructures()` and `PlantSystem.getCrops()`, guarded by a cheap size comparison, which also catches a harvested crop and issues the delete.

Item ids read back from the database are validated with `isItemId()`, so removing an item from the catalogue drops those rows instead of crashing a session.

## Database Schema

PostgreSQL via Supabase. Two migrations, run in order, in `packages/database/supabase/migrations/`.

### 001_initial_schema.sql

| Table | Key columns | Notes |
|-------|-------------|-------|
| `profiles` | `id` → `auth.users`, `username`, `avatar`, `created_at` | Public read, owner-only writes |
| `player_state` | `player_id` → `profiles`, `x`, `y`, `chunk`, `inventory` jsonb, `last_online` | Owner-only read **and** write |
| `worlds` | `id`, `name`, `seed`, `created_at` | Public read; seeded with `('Default World', 42)` |

### 002_gameplay_schema.sql

| Object | Purpose |
|--------|---------|
| `handle_new_user()` + `on_auth_user_created` trigger | `security definer`, inserts a `profiles` row and a `player_state` row on sign-up (`on conflict do nothing`). Without it the `player_state` foreign key is unusable, because nothing else ever creates a profile. |
| `world_modifications` | PK `(world_id, tile_x, tile_y)`, `tile_type`, `modified_by` (`on delete set null`), `updated_at` — the terrain diff |
| `structures` | `id`, `world_id`, `owner_id`, `item_id`, tile, unique `(world_id, tile_x, tile_y)` |
| `crops` | as above plus `planted_at_minute`; `item_id` is the **seed** |
| `chat_messages` | `id`, `world_id`, `sender_id`, `username`, `body`, `created_at`, indexed `(world_id, created_at desc)` |

### Row Level Security

RLS is enabled on every table. The four gameplay tables follow one rule: `select` is open to any authenticated user, because the world is shared, while `insert`/`update`/`delete` require `auth.uid()` to match `owner_id`, `modified_by` or `sender_id`. Chat has no `update` policy — history is append-only apart from deleting your own message.

Two known gaps inherited from `001`: `worlds` has no `update`/`delete` policy, and `player_state` `select` is owner-only, so other players' saved positions cannot be read. Live positions come from Realtime instead, so nothing depends on it.

### Generated types

`packages/database/src/types.ts` mirrors all seven tables. Each entry needs `Row`, `Insert`, `Update` **and** `Relationships` — postgrest-js only treats a table as writable when all four are present, and without `Relationships: []` every `insert`/`upsert` argument resolves to `never[]`. `packages/database` never imports `@worldnest/game-engine` (the dependency runs the other way), so the inventory column is typed as `PersistedInventory` with plain `string` item ids and validated on the client.

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
