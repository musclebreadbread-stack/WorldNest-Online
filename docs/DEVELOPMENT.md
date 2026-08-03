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

| Variable                        | Description                 | Example                     |
| ------------------------------- | --------------------------- | --------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL   | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGciOi...`             |

Environment variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never put secret keys in these variables.

## The ECS API in one page

Three types make up the engine core (`packages/game-engine/src/ecs/`):

| Type        | Contract                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Component` | `constructor(type: string)`. Components are **pure data**; the string `type` is the lookup key.                                                                                                        |
| `Entity`    | `addComponent(c)` (chainable), `getComponent<T>(type: string)`, `hasComponent(type)`, `removeComponent(type)`.                                                                                         |
| `System`    | `constructor(requiredComponents: string[])`, `matches(entity)`, and the abstract `update(entities: Entity[], deltaTime: number): void`.                                                                |
| `World`     | `addEntity`, `removeEntity(id)`, `getEntity(id)`, `addSystem`, `update(deltaTime)`. Systems run in **insertion order**, and matching entities are cached until an entity or its component set changes. |

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

```
time → input → collision → movement → chunk → interpolation → stats →
npc → shop → quest → plant → cropGrowth → build → harvest →
networkSync → animation → render
```

```typescript
world.addSystem(systems.time);
world.addSystem(systems.input);
world.addSystem(systems.collision); // must sit between input and movement
world.addSystem(systems.movement);
// ...
world.addSystem(new HealthSystem());
```

Add the system to the `GameWorldSystems` interface **in the position it runs**, because `gameWorld.test.ts` asserts `Object.keys(context.systems)` equals the order documented in [ARCHITECTURE.md](ARCHITECTURE.md#system-execution-order) — so registering a system without documenting it fails the suite, and vice versa. That guide also explains why each position matters; the load-bearing ones are collision between input and movement, and npc/shop/quest before plant.

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
  SNOW = 7,
  CAVE_FLOOR = 8,
  CAVE_WALL = 9,
  ORE = 10,
  // Add your new type at the end:
  PATH = 11,
}
```

**Append; never renumber.** Tile ids are persisted as `world_modifications.tile_type` smallints, so changing an existing value silently rewrites every saved world.

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

Add a `TILE_HARVEST_YIELD` entry too if the tile is `harvestable` — that table maps a tile to `{ itemId, quantity, energyCost, replacementTile? }`. Harvesting replaces the tile through the override layer, with grass unless `replacementTile` says otherwise (`ORE` sets it to `CAVE_FLOOR`, so mining underground does not leave a patch of grassland in a cave).

### 3. Decide Where the Tile Comes From

There are two options, and the second one is usually right:

- **Generated terrain** — modify `ChunkGenerator.getTileType()`. This changes the world for everyone and **breaks the determinism tests on purpose**, so update `chunk-generator.test.ts` and expect existing coordinates in other tests to shift.
- **The modification overlay** — `worldManager.setTileOverride(tileX, tileY, TileType.PATH)`. Nothing in the generator changes, the diff is tiny to persist, and the tile repaints in place. `FARMLAND` works exactly this way and is never generated.

### 4. Add a Texture

`apps/web/src/game/scenes/BootScene.ts` generates one placeholder texture per tile type, keyed `tile_<TileType>` — that is what `ChunkRenderer` draws. The list comes from `Object.values(TileType)`, so a new tile automatically gets a flat `TILE_PROPERTIES[t].color` texture; add a branch to `drawTileDetail(graphics, tileType)` if you want it to look like anything more. Replace `generateTileset()` with real artwork loaded from `apps/web/public/assets/` when art exists; the keys must stay the same.

## How to Extend the World Generator

The world generator lives in `packages/game-engine/src/world/`.

### ChunkGenerator

`ChunkGenerator.generateChunk(chunkX, chunkY)` returns a `CHUNK_SIZE x CHUNK_SIZE` grid of tile types from **five** seeded simplex-noise layers:

| Layer       | Seed offset | Scale | Decides                                                           |
| ----------- | ----------- | ----- | ----------------------------------------------------------------- |
| elevation   | `seed`      | 0.02  | water, sand and stone thresholds, and a lapse rate on temperature |
| moisture    | `+ 1000`    | 0.015 | half of the biome classification                                  |
| detail      | `+ 2000`    | 0.1   | accent-tile scatter, ore veins                                    |
| temperature | `+ 3000`    | 0.008 | the other half of the classification                              |
| caves       | `+ 4000`    | 0.06  | which high rock is hollowed out                                   |

Each is seeded from `WORLD_SEED` through `mulberry32`, so generation is a pure function of the seed and the world coordinate. To add a feature: sample another layer at its own seed offset, combine it in `getTileType()`, and keep it deterministic.

Dry land is not chosen by the generator directly — `classifyBiome(elevation, moisture, temperature)` in `world/Biomes.ts` picks a `Biome`, and `BIOME_DEFINITIONS[biome]` supplies its `surfaceTile` and `accentTile`. To add a biome: add the enum member, add its definition (the `Record` is total, so the build fails until you do), and add a branch in `classifyBiome`. Keep it pure — that is what lets `biomes.test.ts` cover the whole noise cube without generating a chunk. Expect the determinism tests and any test with a literal tile coordinate to shift; `apps/web/src/__tests__/helpers/terrain.ts` exists so the web suite searches for the terrain it needs instead.

### WorldManager

`WorldManager` owns chunk lifecycle **and** the terrain modification overlay, and implements the `TileQuery` interface the gameplay systems consume:

| Member                                               | Purpose                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `updateLoadedChunks(centerChunkX, centerChunkY)`     | Loads chunks in range, unloads the rest (driven by `ChunkSystem`)               |
| `getTileAt(tileX, tileY)`                            | Override layer first, then the owning chunk, generating it on demand            |
| `isWalkableAt(pixelX, pixelY)`                       | `TILE_PROPERTIES[...].walkable` for the tile under a pixel                      |
| `setTileOverride(tileX, tileY, type)`                | Records the change and fires the tile-change callback                           |
| `getTileOverrides()` / `applyTileOverrides(entries)` | The persistable diff, keyed `"tileX,tileY"` via `getTileKey`                    |
| `setCallbacks(onLoad, onUnload)`                     | Chunk drawing hooks used by `ChunkRenderer`                                     |
| `setTileChangeCallback(fn)`                          | Fires on every override; the client both repaints that one tile and persists it |

## Gameplay Subsystems Cheat Sheet

| Area              | Where the logic lives                                                                                          | Notes                                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collision         | `CollisionSystem` + `ColliderComponent`                                                                        | Velocity veto per axis, probing the collider's four corners; gives wall sliding for free                                                                         |
| World clock       | `WorldClock`, `TimeComponent`, `TimeSystem`                                                                    | Derived from wall-clock time, never from accumulated deltas                                                                                                      |
| Terrain edits     | `WorldManager` override layer                                                                                  | The only way player changes reach the map                                                                                                                        |
| Inventory         | `InventoryComponent` + `inventory/inventoryOps.ts`                                                             | Pure `addItem`/`removeItem`/`countItem`/`selectSlot`/...; every mutation bumps `version`, which is the HUD's change signal                                       |
| Interaction       | `InteractionComponent` + `interaction/facing.ts`                                                               | `getFacedTile()` is the single target resolver shared by harvest, plant and build                                                                                |
| Harvesting        | `HarvestSystem`                                                                                                | Crops first, then tiles; refuses to consume a tile when the yield would not fit                                                                                  |
| Farming           | `PlantSystem`, `CropGrowthSystem`, `world/Crops.ts`                                                            | `CropComponent.itemId` is the **seed**; stage is a function of the clock, not of frames                                                                          |
| Building          | `BuildSystem`, `StructureComponent`, `world/StructureQuery.ts`                                                 | Owns the occupancy index that `CollisionSystem` reads as walls                                                                                                   |
| Animation         | `AnimationComponent`, `AnimationSystem`, `animation/animationOps.ts`                                           | Direction from the dominant movement axis; `directionalTextureKey()` builds the `player_<dir>_<n>` key both `BootScene` and `SpriteSync` use                     |
| Persistence       | `apps/web/src/lib/persistence.ts`, `game/loadSession.ts`, `game/SessionPersistence.ts`, `lib/questSnapshot.ts` | `SaveScheduler` debounces; structures and crops are diffed from the owning systems' indexes; coins ride the `player_state` upsert and quests get their own write |
| Chat              | `packages/database/src/chat.ts`, `realtime.ts`, `apps/web/src/game/ChatBridge.ts`                              | Broadcast for latency, a row for durability                                                                                                                      |
| Biomes and caves  | `world/Biomes.ts`, `world/ChunkGenerator.ts`                                                                   | `classifyBiome` is pure; caves are a fifth noise channel on the single tile layer                                                                                |
| Minimap           | `world/minimap.ts` (engine), `game/Minimap.ts` + `game/minimapLayout.ts` (client)                              | Sampling is a pure engine function; the layout module exists because camera zoom scales a `scrollFactor(0)` object                                               |
| NPCs and dialogue | `world/NpcCatalogue.ts`, `world/npcPlacement.ts`, `dialogue/`, `systems/NpcSystem.ts`                          | Static, deterministic placement; every string is an i18n **key**                                                                                                 |
| Shop and coins    | `packages/shared/src/economy.ts`, `shop/shopOps.ts`, `systems/ShopSystem.ts`                                   | Fixed prices, `sell < buy` enforced by test, no player-to-player trading                                                                                         |
| Quests            | `quests/questDefinitions.ts`, `quests/questOps.ts`, `systems/QuestSystem.ts`                                   | Objectives are polled, never pushed; a turn-in that would not fit is refused whole                                                                               |
| Audio             | `game/audio/{soundSpecs,SoundSynth,soundDiff,SoundManager,MusicLoop}.ts`                                       | Synthesised WebAudio; cues come from a per-frame state diff                                                                                                      |
| Touch input       | `stores/touchStore.ts`, `game/inputMerge.ts`, `components/TouchControls.tsx`                                   | Virtual axis merged with the keyboard, which wins outright                                                                                                       |
| Input gating      | `game/keyBindings.ts`, `game/panelStack.ts`                                                                    | `isHudModal()` gates movement and toggles; `closeTopmostPanel()` gives `Esc` its precedence                                                                      |
| i18n              | `src/i18n/`, `stores/localeStore.ts`, `components/DocumentLocale.tsx`                                          | `en` is the source of truth; five parity tests guard the twelve catalogues                                                                                       |

## How to Add a Translatable String or a Language

Every user-visible string is a key. There are no literals in the UI, and the engine holds keys too — that is what lets twelve languages share one dialogue graph.

### A new string

1. Add the key to `apps/web/src/i18n/messages/en.ts`. It is the source of truth, and `MessageKey = keyof typeof en`.
2. The build now **fails for all eleven other catalogues** until each has a translation. That is 12 edits per string, and it is the price paid once instead of per feature.
3. Use it with `const { t } = useTranslation()` and `t("your.key", { name })`.

The three parity tests will also fail if a value is empty, if it is byte-identical to the English one (add it to `LOCALE_AGNOSTIC_KEYS` only when that is genuinely correct — there are three such keys), or if it uses different `{placeholders}` than English.

> Watch for false friends: `Item` is byte-identical in Portuguese and `Shop` in German, so those became `Objeto` and `Laden`. A bare NPC given name has the same problem, which is why every NPC name carries their role ("Pip the Gardener", "정원사 핍").

### A new language

Three edits, and the compiler enforces completeness:

1. `apps/web/src/i18n/messages/<locale>.ts` — a full `LocaleMessages` record.
2. `LOCALES` and `MESSAGES` in `apps/web/src/i18n/index.ts`.
3. `LOCALE_LABELS` in the same file — the endonym, which lives there rather than in the catalogues because it is the same in every language.

Add the locale to `RTL_LOCALES` if it is right-to-left. The HUD already uses Tailwind logical utilities (`start-*` / `end-*`) and `.hud-numeric` for digits, so mirroring generally needs no new CSS; the Phaser canvas does not mirror at all.

## How to Add a Dialogue Tree, an NPC or a Quest

### A dialogue tree

Add an entry to `DIALOGUE_DEFINITIONS` in `packages/game-engine/src/dialogue/dialogueDefinitions.ts`. Nodes hold a `textKey` and up to **four** options, each with a `labelKey` and either a `next` node id or an `action` (`close`, `openShop`, `offerQuest`, `turnInQuest`). Constraints the tests enforce for you: the root must exist, every `next` must resolve inside the same tree, every node must be leaveable, and no node may have a fifth option (the UI binds `1`-`4`).

Then add every key to all twelve catalogues — the i18n suite asserts each one resolves and is translated.

### An NPC

Add a `NpcDefinition` to `NPC_DEFINITIONS` with an anchor tile, a `dialogueId` and a `role`. `resolveNpcTile` snaps the anchor to the nearest walkable, buildable, non-cave tile, so the anchor is a wish rather than a guarantee — never hard-code the resulting tile in a test; search `NpcSystem.getNpcs()` instead. `NPC_COLORS` in `apps/web/src/game/scenes/npcTextures.ts` is keyed by role, so a new role fails to compile until it has a colour and no NPC can ship faceless.

### A quest

Add a `QuestDefinition` to `QUEST_DEFINITIONS` with a `titleKey`, `descriptionKey`, a `giverNpcId` that exists, one objective (`collect`, `build` or `talk`) and its rewards. **The giver's dialogue tree must offer and take it in**: `quests.test.ts` asserts `dialogueQuestIds()` equals `Object.keys(QUEST_DEFINITIONS)`, so a quest with no way to take it, or an offer for a quest that does not exist, fails the suite. Objectives are polled from state the engine already owns, so a fourth kind needs a new poll in `questOps.pollProgress`, not an event.

## How to Add a Scene Overlay

Anything wanting a per-frame tick inside `GameScene` — visual or not — implements `SceneOverlay`:

```typescript
// apps/web/src/game/WeatherOverlay.ts
import type { OverlayContext, SceneOverlay } from "./SceneOverlay";

export class WeatherOverlay implements SceneOverlay {
  update(ctx: OverlayContext): void {
    // ctx: { phase, buildMode, playerEntity, worldManager, deltaMs }
  }

  destroy(): void {}
}
```

Register it with one line in `GameScene.create()`: `this.weather = this.overlays.add(new WeatherOverlay(this));` — `add<T>` returns its argument, so the scene keeps a typed handle. `update` and `destroy` are fanned out by the stack, so the scene never grows a branch per layer.

Take anything else the overlay needs (the `World`, a system, a counter) through the **constructor**. Do not widen `OverlayContext`; `Minimap`, `BuildGhost` and `SoundManager` all follow that rule.

## How to Add a Sound Cue

Two edits, sometimes three:

1. A row in `SOUND_SPECS` (`apps/web/src/game/audio/soundSpecs.ts`) — waveform, start/end frequency, duration, gain. Pure data, no WebAudio import, so the table is testable on its own.
2. A comparison in `diffCues` (`audio/soundDiff.ts`), which turns a per-frame `SoundState` diff into cues.
3. If the diff cannot see the signal, add the field to `SoundState` **and** to `readSoundState`. The latter takes an `Entity` and is Phaser-free, so it is testable against a world built by `createGameWorld`. Two cues needed this: `plant` and `build` change the _world_, not the player, so `readSoundState` takes an optional `WorldCounts { crops(); structures() }` injected by `GameScene`.

Never call `playSound()` from a system. Cues are derived from state, which is what keeps the engine free of an event bus.

## How to Add New UI Features

UI components live in two places:

- `packages/ui/` - Reusable, game-agnostic components (`Button`, `Card`)
- `apps/web/src/components/` - Game-specific UI: `ClockHud`, `HotBar`, `ItemSlot`, `InventoryPanel`, `StatusBars`, `BuildMenu`, `ChatPanel`, `SignOutButton`, `SettingsPanel`, `CoinCounter`, `DialoguePanel`, `ShopPanel`, `QuestLog`, `QuestTracker`, `TouchControls`, `DocumentLocale`

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

### Getting a React Action into the Engine

Never mutate ECS state from a React handler. A panel calls an **injected callback** that sets a request field on a component, and the owning system consumes it on the next frame; `dialogueStore` / `shopStore` / `questStore` / `chatStore.sender` are four instances of one template. Adding a fifth:

1. Add the request field to the component and consume it in the owning system, bumping `version` **only** when the change was accepted (and a `refusals` counter when it was not — that is what the `deny` cue is played from).
2. Add the store with nullable callback fields and public wrappers that no-op before injection, plus a `setSnapshot` fed by one `HudBridge` event.
3. Add a bridge under `apps/web/src/game/` that injects the callbacks against the player's component.
4. If the panel is modal, add it to `panelStack.ts` — two lines, and it joins both the `Esc` precedence order and the input gate.

Any test that resets one of those stores with `setState({...})` must clear its callbacks too.

### Keyboard and touch

Keyboard shortcuts do **not** belong in React. Key handling lives in `apps/web/src/game/keyBindings.ts`: add a row to `ONE_SHOT_BINDINGS` (`{ keyCode, handler }`) and, if it needs one, a field on `OneShotActions`, which `PlayerController` supplies. Keys are bound with capture disabled (`addUncapturedKey`) and one-shot handlers are wrapped in `whenPlaying(...)` so they are ignored while a modal panel is open or the chat composer has focus.

For a touch equivalent, raise a flag in `touchStore`, consume it in `PlayerController.update` before the typing gate, and route it through the same cooldown helper the key uses — never straight to an engine method.

### Adding a Shared UI Component

1. Create the component in `packages/ui/src/`
2. Export it from `packages/ui/src/index.ts`
3. Import it in the web app: `import { Card } from "@worldnest/ui"`

## Testing

| Suite                    | Command                                     | Scope                                                                                                                                    |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `@worldnest/shared`      | `pnpm --filter @worldnest/shared test`      | Tunables, coordinate helpers, item catalogue                                                                                             |
| `@worldnest/game-engine` | `pnpm --filter @worldnest/game-engine test` | ECS core plus every system, with fake `TileQuery`/clock injections                                                                       |
| `@worldnest/web`         | `pnpm --filter @worldnest/web test`         | Stores, pure helpers, React panels via `@testing-library/react`, and Phaser-free ECS wiring driven through `createGameWorld` under jsdom |
| E2E                      | `pnpm test:e2e`                             | Playwright smoke specs against a production build                                                                                        |
| SQL                      | `pnpm db:verify`                            | Every migration and the seed against a dockerised Postgres                                                                               |
| Docs                     | `pnpm docs:check`                           | The Korean guide and its Word mirror have the same headings                                                                              |

`pnpm test` runs the three Vitest suites through Turborepo and stays browser-free; Playwright is deliberately excluded so it can be run separately (and in its own CI job).

The web tests never import Phaser. `createGameWorld` is Phaser-free on purpose, so gameplay wiring is asserted at the ECS level; anything that genuinely needs a canvas belongs in the Playwright layer.

Three things to know before writing a web test:

- **Importing Phaser under jsdom throws** (inside `checkInverseAlpha`). If a suite needs to reason about something, that something must live in a module that does not import Phaser — which is why `panelStack.ts` and `minimapLayout.ts` are separate from `keyBindings.ts` and `Minimap.ts`.
- There is **no Vitest setup file**, so component tests call `cleanup()` in their own `afterEach` and use plain assertions rather than `jest-dom` matchers.
- Playwright cannot reach `/game`: `middleware.ts` redirects an unauthenticated visitor to `/auth`, and the smoke suite has no credentials. The jsdom suites therefore carry all of the UI weight.

## Project Scripts Reference

### Root Level

| Command             | Description                                                                   |
| ------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`          | Start all packages in dev/watch mode                                          |
| `pnpm build`        | Build all packages (respects dependency order)                                |
| `pnpm test`         | Run the Vitest suites across the monorepo                                     |
| `pnpm test:e2e`     | Run the Playwright smoke specs (needs `pnpm build` first)                     |
| `pnpm lint`         | Run ESLint across all packages                                                |
| `pnpm db:verify`    | Apply the migrations to a throwaway dockerised Postgres and assert the schema |
| `pnpm docs:check`   | Assert `docs/SETUP_GUIDE_KR.md` and its `.doc` mirror have matching headings  |
| `pnpm format`       | Format all files with Prettier                                                |
| `pnpm format:check` | Assert every file is already formatted (run in CI)                            |

> The tree is fully formatted and `.prettierrc` sets `printWidth: 88`, which is the width the code was hand-wrapped at all along, so `pnpm format` only rewrites what you actually changed. Run it before committing; `pnpm format:check` fails the `ci` job if anything drifts. `.prettierignore` excludes build output, `pnpm-lock.yaml` and `.agents/`, so the historical implementation plans stay byte-exact.

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
- **Coins or quests not coming back?** Confirm migration `003` ran. `pnpm db:verify` is the quickest way to prove all three apply.
- **Typing in chat walks the player?** The gate is `chatStore.inputFocused`, read through `panelStack.isTyping()`. New key bindings must go through `whenPlaying(...)`.
- **No sound?** Expected until the first click or keypress: every browser blocks audio before a user gesture, and `SoundSynth` deliberately does not create its `AudioContext` until then. After that, check the mute toggle in the settings panel (`P`).
- **A string shows as `hud.something` in the UI?** `translate()` falls back to English and then to the key itself, so a bare key on screen means it is missing from `en.ts`.
- **Turborepo cache stale?** Run `pnpm build --force` to bypass the cache.
- **`pnpm docs:check` failing?** The Korean guide and its `.doc` mirror have diverged. Both files are hand-maintained: apply the same headings to both, in the same order.
