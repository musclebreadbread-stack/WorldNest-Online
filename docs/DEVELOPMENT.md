# Development Guide

This guide covers detailed setup instructions, environment configuration, and how to extend WorldNest Online with new features.

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
4. Run the migration SQL from `packages/database/supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor

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

## How to Add New Game Systems

The game engine uses an Entity Component System (ECS). To add new gameplay, follow this pattern:

### 1. Define a Component

Create a new component in `packages/game-engine/src/components/`:

```typescript
// packages/game-engine/src/components/HealthComponent.ts
import { Component } from "../ecs/Component";

export class HealthComponent extends Component {
  constructor(
    public current: number = 100,
    public max: number = 100,
    public regeneration: number = 1
  ) {
    super();
  }
}
```

### 2. Create a System

Create a new system in `packages/game-engine/src/systems/`:

```typescript
// packages/game-engine/src/systems/HealthSystem.ts
import { System } from "../ecs/System";
import { World } from "../ecs/World";
import { HealthComponent } from "../components/HealthComponent";

export class HealthSystem extends System {
  update(world: World, deltaTime: number): void {
    const entities = world.getEntitiesWith(HealthComponent);

    for (const entity of entities) {
      const health = entity.getComponent(HealthComponent);
      if (health.current < health.max) {
        health.current = Math.min(
          health.max,
          health.current + health.regeneration * deltaTime
        );
      }
    }
  }
}
```

### 3. Register the System

Add the system to the World in the initialization code:

```typescript
import { HealthSystem } from "./systems/HealthSystem";

// During world setup
world.addSystem(new HealthSystem());
```

### 4. Export from Package

Update `packages/game-engine/src/components/index.ts` and `packages/game-engine/src/systems/index.ts` to export your new additions, then update `packages/game-engine/src/index.ts`.

### 5. Write Tests

Create tests in `packages/game-engine/src/__tests__/`:

```typescript
// packages/game-engine/src/__tests__/HealthSystem.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../ecs/World";
import { HealthComponent } from "../components/HealthComponent";
import { HealthSystem } from "../systems/HealthSystem";

describe("HealthSystem", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.addSystem(new HealthSystem());
  });

  it("should regenerate health over time", () => {
    const entity = world.createEntity();
    entity.addComponent(new HealthComponent(50, 100, 10));

    world.update(1); // 1 second

    const health = entity.getComponent(HealthComponent);
    expect(health.current).toBe(60);
  });
});
```

## How to Add New Tile Types

Tile types are defined in `packages/game-engine/src/world/Tilemap.ts`.

### 1. Add the Tile Type

```typescript
export enum TileType {
  Water = 0,
  Sand = 1,
  Grass = 2,
  Forest = 3,
  Stone = 4,
  // Add your new type:
  Farmland = 5,
}
```

### 2. Define Tile Properties

```typescript
export const TILE_PROPERTIES: Record<TileType, TileProperties> = {
  // ... existing entries ...
  [TileType.Farmland]: {
    walkable: true,
    buildable: false,
    harvestable: true,
    color: "#8B4513",
  },
};
```

### 3. Update the Chunk Generator

Modify `packages/game-engine/src/world/ChunkGenerator.ts` to include your tile in the generation logic. Tiles are assigned based on noise value thresholds.

### 4. Add Sprite Assets

Place tile sprite assets in `apps/web/public/assets/tiles/` and update the Phaser tileset configuration to include the new tile graphic.

## How to Extend the World Generator

The world generator lives in `packages/game-engine/src/world/`.

### ChunkGenerator

The `ChunkGenerator` class uses simplex noise to generate terrain:

- **Primary noise layer** - Large-scale terrain features (continents, oceans)
- **Secondary noise layer** - Detail variation (forest density, stone patches)
- **Moisture/temperature** - Can be added as additional noise layers for biome diversity

To add a new generation feature:

1. Add additional noise sampling in `ChunkGenerator.generateChunk()`
2. Combine noise values to determine tile placement
3. Keep generation deterministic (use the shared `WORLD_SEED`)

### WorldManager

The `WorldManager` handles chunk lifecycle:

- `loadChunk(x, y)` - Generate or retrieve a chunk
- `unloadChunk(x, y)` - Release chunk resources
- `getVisibleChunks(playerX, playerY)` - Calculate which chunks should be loaded

Extend it to support features like:

- Persistent world modifications (save changes to Supabase)
- Chunk caching (LRU cache for recently visited areas)
- Dynamic events (weather, seasons affecting generation)

## How to Add New UI Features

UI components live in two places:

- `packages/ui/` - Reusable, game-agnostic components (Button, Card)
- `apps/web/src/` - Game-specific UI (HUD, inventory, chat)

### Adding a Game UI Panel

1. Create a React component in `apps/web/src/components/`:

```typescript
// apps/web/src/components/InventoryPanel.tsx
"use client";

import { useGameStore } from "@/stores/gameStore";

export function InventoryPanel() {
  const inventory = useGameStore((state) => state.inventory);

  return (
    <div className="absolute top-4 right-4 bg-slate-800/90 rounded-lg p-4">
      <h2 className="text-lg font-bold text-white">Inventory</h2>
      {/* Render inventory items */}
    </div>
  );
}
```

2. Add state to the appropriate Zustand store
3. Wire up keyboard shortcuts for toggling panels
4. Use Framer Motion for enter/exit animations

### Adding a Shared UI Component

1. Create the component in `packages/ui/src/`:

```typescript
// packages/ui/src/Tooltip.tsx
import React from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group">
      {children}
      <span className="absolute hidden group-hover:block bg-black text-white text-sm px-2 py-1 rounded">
        {content}
      </span>
    </div>
  );
}
```

2. Export from `packages/ui/src/index.ts`
3. Import in the web app: `import { Tooltip } from "@worldnest/ui"`

## Project Scripts Reference

### Root Level

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in dev/watch mode |
| `pnpm build` | Build all packages (respects dependency order) |
| `pnpm test` | Run all tests via Vitest |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm format` | Format all files with Prettier |

### Package-Specific

```bash
# Run commands for a specific package
pnpm --filter @worldnest/game-engine test
pnpm --filter @worldnest/web dev
pnpm --filter @worldnest/shared build
```

## Debugging Tips

- **Phaser not loading?** Check the browser console. Phaser requires a DOM element and fails silently if loaded during SSR.
- **Type errors across packages?** Run `pnpm build` to regenerate `.d.ts` files in dependency packages.
- **Chunks not generating?** Verify `WORLD_SEED` is consistent. Different seeds produce different worlds.
- **Realtime not connecting?** Check Supabase credentials in `.env.local` and ensure the project is active.
- **Turborepo cache stale?** Run `pnpm build --force` to bypass the cache.
