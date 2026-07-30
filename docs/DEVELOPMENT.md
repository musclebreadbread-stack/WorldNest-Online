# Development Guide

This guide covers detailed setup instructions, environment configuration, and how to extend WorldNest Online with new features.

Every code snippet below is written against the real API in `packages/game-engine/src`; if you change a signature there, update this file in the same commit.

## Development Setup

### Prerequisites

- **Node.js 22+** - Download from [nodejs.org](https://nodejs.org/) or use a version manager like `nvm`
- **pnpm 10+** - Enable via Corepack: `corepack enable`
- **Git** - For version control
- **Supabase Account** - Free tier at [supabase.com](https://supabase.com)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/musclebreadbread-stack/WorldNest-Online.git
cd WorldNest-Online

# Install all dependencies (including workspace packages)
pnpm install

# Copy environment template
cp .env.example .env.local
```

### Supabase Project Setup

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Navigate to Settings > API to find your credentials
3. Update `.env.local` with your project URL and anon key
4. Run **all three** migrations in the Supabase SQL Editor, in order:
   - `packages/database/supabase/migrations/001_initial_schema.sql` — `profiles`, `player_state`, `worlds`, RLS policies and the seeded `Default World` row
   - `packages/database/supabase/migrations/002_gameplay_schema.sql` — the `handle_new_user` trigger plus `world_modifications`, `structures`, `crops` and `chat_messages`
   - `packages/database/supabase/migrations/003_progression_schema.sql` — `player_state.coins` and the `player_quests` table, so coins and quests survive a reload
5. Optionally run `packages/database/supabase/seed/test_accounts.sql` for three ready-to-use logins (`tester1@worldnest.test` / `worldnest123`). Development only — see [`seed/README.md`](../packages/database/supabase/seed/README.md)

Without `002` a signed-up player has no `profiles` row, so nothing can be saved. The Korean walkthrough in [`SETUP_GUIDE_KR.md`](SETUP_GUIDE_KR.md) covers the same steps click by click.

The game still boots without Supabase credentials: authentication, chat and persistence quietly turn themselves off and the world runs as a single-player sandbox from the shared seed.

### Verifying SQL locally

You do not need a Supabase project to know the migrations apply. `pnpm db:verify` starts a throwaway `postgres:16-alpine` container, applies every numbered migration with `ON_ERROR_STOP=1`, and asserts what the schema promises — the policy count, the seeded `Default World` row, and that inserting an `auth.users` row really provisions a `profiles` and a `player_state` row from the GoTrue metadata username.

```bash
pnpm db:verify   # needs Docker; psql runs inside the container, none needed locally
```

A bare Postgres has none of the things Supabase provides, so `packages/database/supabase/test/auth_stub.sql` creates them first: the `anon`, `authenticated` and `service_role` roles (without them `002` fails with `role "authenticated" does not exist`), the `auth` schema with stub `auth.users` and `auth.identities` tables, `uuid-ossp` and `pgcrypto` in an `extensions` schema on the search path, and stub `auth.uid()` / `auth.role()` functions.

> The stub is a **test double of GoTrue's schema**, not a copy. It carries only the columns the migrations and the seed touch, so column defaults and password hashing are approximations — a column GoTrue requires that the stub omits would not be caught here. It is committed precisely so that gap is inspectable.

### Running Development Servers

```bash
# Start all packages in dev mode (with hot reload)
pnpm dev

# Or run specific packages
pnpm --filter @worldnest/web dev
pnpm --filter @worldnest/game-engine dev
```

The web app starts at `http://localhost:3000`.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGciOi...` |

Environment variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never put secret keys in these variables.

## The ECS API in one page

Three types make up the engine core (`packages/game-engine/src/ecs/`):

| Type | Contract |
|------|----------|
| `Component` | `constructor(type: string)`. Components are **pure data**; the string `type` is the lookup key. |
| `Entity` | `addComponent(c)` (chainable), `getComponent<T>(type: string)`, `hasComponent(type)`, `removeComponent(type)`. |
| `System` | `constructor(requiredComponents: string[])`, `matches(entity)`, and the abstract `update(entities: Entity[], deltaTime: number): void`. |
| `World` | `addEntity`, `removeEntity(id)`, `getEntity(id)`, `addSystem`, `update(deltaTime)`. Systems run in **insertion order**, and matching entities are cached until an entity or its component set changes. |

Two consequences worth remembering:

- Components are looked up **by string**, not by class: `entity.getComponent<PositionComponent>("position")`.
- A system receives the already-filtered `entities` array. It never queries the world, which is why every system is testable with a hand-built array of entities and no `World` at all.

## How to Add New Game Systems

### 1. Define a Component

Create a new component in `packages/game-engine/src/components/`:

```typescript
// packages/game-engine/src/components/HealthComponent.ts
import { Component } from "../ecs/Component";

export class HealthComponent extends Component {
  public current: number;
  public max: number;
  /** Health restored per in-game minute. */
  public regenPerMinute: number;

  constructor(max: number = 100, regenPerMinute: number = 1) {
    super("health");
    this.current = max;
    this.max = max;
    this.regenPerMinute = regenPerMinute;
  }
}
```

### 2. Create a System

Create a new system in `packages/game-engine/src/systems/`:

```typescript
// packages/game-engine/src/systems/HealthSystem.ts
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { HealthComponent } from "../components/HealthComponent";

export class HealthSystem extends System {
  constructor() {
    super(["health"]);
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const health = entity.getComponent<HealthComponent>("health")!;

      health.current = Math.min(
        health.max,
        health.current + health.regenPerMinute * deltaTime,
      );
    }
  }
}
```

Anything a system needs from outside the ECS is injected through its constructor rather than looked up: `CollisionSystem` takes a `TileQuery`, `HarvestSystem` takes a `TileQuery` plus a `setTileOverride` callback, `StatsSystem` takes a `() => DayPhase` getter, and `PlantSystem` takes `AddEntity`/`RemoveEntityById` callbacks. That is what keeps every system unit-testable with fakes.

### 3. Register the System

Systems are registered in `apps/web/src/game/createGameWorld.ts`, and **registration order is execution order**:

```typescript
world.addSystem(systems.time);
world.addSystem(systems.input);
world.addSystem(systems.collision); // must sit between input and movement
world.addSystem(systems.movement);
// ...
world.addSystem(new HealthSystem());
```

See [ARCHITECTURE.md](ARCHITECTURE.md#system-execution-order) for the full pipeline and why each position matters.

### 4. Export from Package

Update `packages/game-engine/src/components/index.ts` and `packages/game-engine/src/systems/index.ts`, then re-export from `packages/game-engine/src/index.ts`. The web app only ever imports from the package barrel.

### 5. Write Tests

Create tests in `packages/game-engine/src/__tests__/`. Build entities by hand — no `World` required:

```typescript
// packages/game-engine/src/__tests__/health.test.ts
import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { HealthComponent } from "../components/HealthComponent";
import { HealthSystem } from "../systems/HealthSystem";

describe("HealthSystem", () => {
  it("should regenerate health over time and clamp at the maximum", () => {
    const system = new HealthSystem();
    const entity = new Entity("player");
    const health = new HealthComponent(100, 10);
    health.current = 50;
    entity.addComponent(health);

    system.update([entity], 1); // one second

    expect(health.current).toBe(60);

    system.update([entity], 100);

    expect(health.current).toBe(100);
  });
});
```

## How to Add New Tile Types

Tile types are defined in `packages/game-engine/src/world/Tilemap.ts`.

### 1. Add the Tile Type

```typescript
export enum TileType {
  GRASS = 0,
  WATER = 1,
  SAND = 2,
  FOREST = 3,
  STONE = 4,
  FLOWERS = 5,
  FARMLAND = 6,
  // Add your new type:
  PATH = 7,
}
```

### 2. Define Tile Properties

`TILE_PROPERTIES` is a total `Record<TileType, TileProperties>`, so TypeScript will fail the build until the new entry exists:

```typescript
export const TILE_PROPERTIES: Record<TileType, TileProperties> = {
  // ... existing entries ...
  [TileType.PATH]: {
    walkable: true,
    collidable: false,
    buildable: true,
    harvestable: false,
    name: "path",
    color: 0xbcaaa4,
  },
};
```

Add a `TILE_HARVEST_YIELD` entry too if the tile is `harvestable` — that table maps a tile to `{ itemId, quantity, energyCost }`, and harvesting replaces the tile with grass through the override layer.

### 3. Decide Where the Tile Comes From

There are two options, and the second one is usually right:

- **Generated terrain** — modify `ChunkGenerator.getTileType()`. This changes the world for everyone and **breaks the determinism tests on purpose**, so update `chunk-generator.test.ts` and expect existing coordinates in other tests to shift.
- **The modification overlay** — `worldManager.setTileOverride(tileX, tileY, TileType.PATH)`. Nothing in the generator changes, the diff is tiny to persist, and the tile repaints in place. `FARMLAND` works exactly this way and is never generated.

### 4. Add a Texture

`apps/web/src/game/scenes/BootScene.ts` generates one placeholder texture per tile type, keyed `tile_<TileType>` — that is what `ChunkRenderer` draws. Replace `generateTileset()` with real artwork loaded from `apps/web/public/assets/` when art exists; the keys must stay the same.

## How to Extend the World Generator

The world generator lives in `packages/game-engine/src/world/`.

### ChunkGenerator

`ChunkGenerator.generateChunk(chunkX, chunkY)` returns a `CHUNK_SIZE x CHUNK_SIZE` grid of tile types from three seeded simplex-noise layers:

- **elevation** (`scale 0.02`) — water, sand and stone thresholds
- **moisture** (`scale 0.015`) — forest placement
- **detail** (`scale 0.1`) — flower patches

Each layer is seeded from `WORLD_SEED` (`seed`, `seed + 1000`, `seed + 2000` through `mulberry32`), so generation is a pure function of the seed and the world coordinate. To add a feature: sample another layer, combine it in `getTileType()`, and keep it deterministic.

### WorldManager

`WorldManager` owns chunk lifecycle **and** the terrain modification overlay, and implements the `TileQuery` interface the gameplay systems consume:

| Member | Purpose |
|--------|---------|
| `updateLoadedChunks(centerChunkX, centerChunkY)` | Loads chunks in range, unloads the rest (driven by `ChunkSystem`) |
| `getTileAt(tileX, tileY)` | Override layer first, then the owning chunk, generating it on demand |
| `isWalkableAt(pixelX, pixelY)` | `TILE_PROPERTIES[...].walkable` for the tile under a pixel |
| `setTileOverride(tileX, tileY, type)` | Records the change and fires the tile-change callback |
| `getTileOverrides()` / `applyTileOverrides(entries)` | The persistable diff, keyed `"tileX,tileY"` via `getTileKey` |
| `setCallbacks(onLoad, onUnload)` | Chunk drawing hooks used by `ChunkRenderer` |
| `setTileChangeCallback(fn)` | Fires on every override; the client both repaints that one tile and persists it |

## Gameplay Subsystems Cheat Sheet

| Area | Where the logic lives | Notes |
|------|----------------------|-------|
| Collision | `CollisionSystem` + `ColliderComponent` | Velocity veto per axis, probing the collider's four corners; gives wall sliding for free |
| World clock | `WorldClock`, `TimeComponent`, `TimeSystem` | Derived from wall-clock time, never from accumulated deltas |
| Terrain edits | `WorldManager` override layer | The only way player changes reach the map |
| Inventory | `InventoryComponent` + `inventory/inventoryOps.ts` | Pure `addItem`/`removeItem`/`countItem`/`selectSlot`/...; every mutation bumps `version`, which is the HUD's change signal |
| Interaction | `InteractionComponent` + `interaction/facing.ts` | `getFacedTile()` is the single target resolver shared by harvest, plant and build |
| Harvesting | `HarvestSystem` | Crops first, then tiles; refuses to consume a tile when the yield would not fit |
| Farming | `PlantSystem`, `CropGrowthSystem`, `world/Crops.ts` | `CropComponent.itemId` is the **seed**; stage is a function of the clock, not of frames |
| Building | `BuildSystem`, `StructureComponent`, `world/StructureQuery.ts` | Owns the occupancy index that `CollisionSystem` reads as walls |
| Animation | `AnimationComponent`, `AnimationSystem`, `animation/animationOps.ts` | Direction from the dominant movement axis; `directionalTextureKey()` builds the `player_<dir>_<n>` key both `BootScene` and `SpriteSync` use |
| Persistence | `apps/web/src/lib/persistence.ts`, `game/loadSession.ts`, `game/SessionPersistence.ts` | `SaveScheduler` debounces; structures and crops are diffed from the owning systems' indexes |
| Chat | `packages/database/src/chat.ts`, `realtime.ts`, `apps/web/src/game/ChatBridge.ts` | Broadcast for latency, a row for durability |

## How to Add New UI Features

UI components live in two places:

- `packages/ui/` - Reusable, game-agnostic components (`Button`, `Card`)
- `apps/web/src/components/` - Game-specific UI (`ClockHud`, `HotBar`, `InventoryPanel`, `StatusBars`, `BuildMenu`, `ChatPanel`, `SignOutButton`)

### Getting Game State into React

React never reads the ECS directly. `apps/web/src/game/HudBridge.ts` runs once per frame from `GameScene.update()` and emits Phaser game events, de-duplicating so React only re-renders on real changes (clock by `totalMinutes`, inventory by `version`, stats by rounded points). `GameCanvas` subscribes and writes into the Zustand stores.

To surface something new:

1. Add the event name and payload type to `apps/web/src/game/events.ts`
2. Emit it from `HudBridge` with a cheap change check
3. Subscribe in `apps/web/src/components/GameCanvas.tsx` and store it in `gameStore` / `uiStore`
4. Read it with a Zustand selector in your component

### Adding a Game UI Panel

```typescript
// apps/web/src/components/EnergyReadout.tsx
"use client";

import { useGameStore } from "../stores/gameStore";

export function EnergyReadout() {
  const energy = useGameStore((state) => state.energy);

  return (
    <div className="rounded bg-black/70 px-3 py-2 text-xs text-white">
      Energy: {Math.round(energy)}
    </div>
  );
}
```

Mount it in `GameUI.tsx` inside a positioned wrapper. `GameUI` is `pointer-events-none` overall, so any interactive block needs `pointer-events-auto`.

Keyboard shortcuts do **not** belong in React: all key handling lives in `apps/web/src/game/PlayerController.ts`. Bind keys there with capture disabled (`addUncapturedKey`) and wrap one-shot handlers in `whenPlaying(...)` so they are ignored while the chat composer has focus.

### Adding a Shared UI Component

1. Create the component in `packages/ui/src/`
2. Export it from `packages/ui/src/index.ts`
3. Import it in the web app: `import { Card } from "@worldnest/ui"`

## Testing

| Suite | Command | Scope |
|-------|---------|-------|
| `@worldnest/shared` | `pnpm --filter @worldnest/shared test` | Tunables, coordinate helpers, item catalogue |
| `@worldnest/game-engine` | `pnpm --filter @worldnest/game-engine test` | ECS core plus every system, with fake `TileQuery`/clock injections |
| `@worldnest/web` | `pnpm --filter @worldnest/web test` | Stores, pure helpers, and Phaser-free ECS wiring driven through `createGameWorld` under jsdom |
| E2E | `pnpm test:e2e` | Playwright smoke specs against a production build |

`pnpm test` runs the three Vitest suites through Turborepo and stays browser-free; Playwright is deliberately excluded so it can be run separately (and in its own CI job).

The web tests never import Phaser. `createGameWorld` is Phaser-free on purpose, so gameplay wiring is asserted at the ECS level; anything that genuinely needs a canvas belongs in the Playwright layer.

## Project Scripts Reference

### Root Level

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in dev/watch mode |
| `pnpm build` | Build all packages (respects dependency order) |
| `pnpm test` | Run the Vitest suites across the monorepo |
| `pnpm test:e2e` | Run the Playwright smoke specs (needs `pnpm build` first) |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm db:verify` | Apply the migrations to a throwaway dockerised Postgres and assert the schema |
| `pnpm format` | Format all files with Prettier |

> `pnpm format` currently rewrites files it did not need to: `.prettierrc` sets `printWidth: 100` while the tree is hand-wrapped at ~88 columns. Until that is reconciled in a dedicated formatting commit, check only what you touched: `npx prettier --check <your files>`.

### Package-Specific

```bash
# Run commands for a specific package
pnpm --filter @worldnest/game-engine test
pnpm --filter @worldnest/web dev
pnpm --filter @worldnest/shared build
```

## Debugging Tips

- **Phaser not loading?** Check the browser console. Phaser requires a DOM element and fails silently if loaded during SSR — it must stay behind `dynamic(..., { ssr: false })`.
- **Type errors across packages?** Run `pnpm build` to regenerate `.d.ts` files in dependency packages. The web tests resolve `@worldnest/game-engine` from `dist`, so a new engine export needs a build before `pnpm --filter @worldnest/web test` can see it.
- **Chunks not generating?** Verify `WORLD_SEED` is consistent. Different seeds produce different worlds.
- **Realtime not connecting?** Check Supabase credentials in `.env.local` and ensure the project is active.
- **Nothing persists?** Confirm migration `002` ran. Persistence switches itself off when there is no `worldId`, which is what happens when `worlds` has no `Default World` row.
- **Typing in chat walks the player?** The gate is `chatStore.inputFocused`, read by `PlayerController`. New key bindings must go through `whenPlaying(...)`.
- **Turborepo cache stale?** Run `pnpm build --force` to bypass the cache.
