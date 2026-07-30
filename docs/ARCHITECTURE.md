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
│  │          │  │  (Presence +  │  │  (Players, World State,  │  │
│  │          │  │   Broadcast)  │  │   Inventory, Chat)       │  │
│  └──────────┘  └───────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Client Architecture

The client runs entirely in the browser as a Next.js application with Phaser handling game rendering.

### Next.js App (apps/web)

- **App Router** - Uses Next.js 14 App Router for routing and layouts
- **Dynamic Loading** - Phaser is loaded dynamically (`next/dynamic` with `ssr: false`) to avoid server-side rendering issues with the canvas
- **React UI** - HUD, menus, and overlays are React components rendered on top of the Phaser canvas
- **TailwindCSS** - All UI styling uses Tailwind utility classes

### State Management (Zustand)

Client state is managed through Zustand stores:

- **Game Store** - Current player state, active entities, world position
- **UI Store** - Menu visibility, dialog state, notifications
- **Network Store** - Connection status, player list, sync state

Zustand was chosen for its minimal boilerplate, TypeScript support, and compatibility with React's concurrent features.

## ECS Game Engine (packages/game-engine)

The game engine follows the Entity Component System pattern for maximum flexibility and performance.

### Core Architecture

```
World
├── Entity Registry (Map<string, Entity>)
├── Component Storage (per-entity component maps)
├── System Pipeline (ordered execution)
└── Event Bus (system communication)
```

### Entity

An entity is a unique identifier (string UUID) that serves as a container for components. Entities have no behavior on their own.

### Component

Components are pure data containers that describe a single aspect of an entity:

| Component | Data | Purpose |
|-----------|------|---------|
| `PositionComponent` | x, y | World position |
| `VelocityComponent` | vx, vy | Movement vector |
| `SpriteComponent` | texture, frame, layer | Visual representation |
| `PlayerComponent` | id, name, level | Player identity |
| `ChunkComponent` | chunkX, chunkY | Chunk membership |
| `InputComponent` | keyState | Current input state |
| `NetworkComponent` | lastSync, owned | Network sync info |

### System

Systems contain all game logic and run each frame in a defined order:

1. **InputSystem** - Reads keyboard/mouse state, updates InputComponent
2. **MovementSystem** - Applies velocity to position, handles collision
3. **ChunkSystem** - Manages chunk loading/unloading based on player position
4. **NetworkSyncSystem** - Broadcasts local state, applies remote updates
5. **RenderSystem** - Produces render data for Phaser to display

Systems query entities by required components and operate only on matching sets.

## Chunk Streaming Algorithm

The world is divided into fixed-size chunks (16x16 tiles, 32px per tile).

### Generation

```
1. Player moves to position (x, y)
2. Calculate current chunk: (floor(x / CHUNK_SIZE), floor(y / CHUNK_SIZE))
3. Determine visible radius (typically 3x3 chunks around player)
4. For each chunk in radius:
   a. If not loaded: generate using ChunkGenerator
   b. ChunkGenerator uses simplex noise seeded with WORLD_SEED
   c. Noise value mapped to TileType (water, sand, grass, forest, stone)
5. Chunks outside radius + buffer are unloaded
```

### Determinism

World generation is fully deterministic: the same seed always produces the same world. This means:

- Chunks can be regenerated on-demand without storing them
- All clients see the same world without server coordination
- The seed (`WORLD_SEED = 42`) is shared in the `@worldnest/shared` package

### Tile Types

Tiles are determined by noise amplitude thresholds:

| Noise Range | Tile Type | Properties |
|-------------|-----------|------------|
| < -0.3 | Water | Not walkable |
| -0.3 to -0.1 | Sand | Walkable |
| -0.1 to 0.4 | Grass | Walkable, buildable |
| 0.4 to 0.7 | Forest | Walkable, harvestable |
| > 0.7 | Stone | Not walkable |

## Multiplayer Sync

### Approach: Client Prediction + Server Authority

WorldNest uses an optimistic multiplayer model via Supabase Realtime:

1. **Local player** moves immediately (client prediction)
2. **Position broadcast** sent via Supabase Broadcast channel
3. **Other clients** receive broadcast and interpolate remote player positions
4. **Presence** channel tracks who is online and their current state

### Supabase Realtime Channels

- **Presence Channel** - Tracks online players, their current position, and metadata
- **Broadcast Channel** - Low-latency game events (movement, actions, chat)

### Sync Flow

```
Player Input
    │
    ▼
Local ECS Update (immediate)
    │
    ├──▶ Broadcast position to channel
    │
    ▼
Render locally (no wait)

Meanwhile:
    Remote broadcasts received
        │
        ▼
    Update remote entity positions
        │
        ▼
    Interpolate for smooth display
```

## Rendering Pipeline (Phaser 3)

### Scene Structure

The Phaser game runs within a single scene that manages:

- **Tilemap Layer** - Renders chunk tiles as a tilemap
- **Entity Layer** - Renders player sprites and game objects
- **Effect Layer** - Particle effects, animations

### Bridge to ECS

The `RenderSystem` in the ECS produces `RenderData` each frame:

```typescript
interface RenderData {
  entities: Array<{
    id: string;
    x: number;
    y: number;
    texture: string;
    frame: number;
  }>;
  chunks: Array<ChunkData>;
}
```

The Phaser scene consumes this data and updates its display objects accordingly.

## Database Schema

The PostgreSQL database (via Supabase) stores persistent game state:

### Tables

- **profiles** - Player profiles (linked to Supabase Auth users)
- **characters** - Player characters with position, stats, inventory reference
- **world_state** - Persistent world modifications (placed buildings, grown crops)
- **chat_messages** - Message history for chat channels

### Row Level Security (RLS)

All tables use Supabase RLS policies to ensure:

- Players can only modify their own data
- World state modifications are validated
- Chat messages are attributed to authenticated users

## Package Dependencies

```
@worldnest/web
├── @worldnest/game-engine
│   └── @worldnest/shared
├── @worldnest/shared
├── @worldnest/database
└── @worldnest/ui

@worldnest/game-engine
└── @worldnest/shared

@worldnest/database
└── (standalone - only @supabase/supabase-js)

@worldnest/ui
└── (standalone - only react)
```

The build order (managed by Turborepo) ensures dependencies are built before dependents:

1. `@worldnest/shared` (no internal deps)
2. `@worldnest/database` (no internal deps)
3. `@worldnest/ui` (no internal deps)
4. `@worldnest/game-engine` (depends on shared)
5. `@worldnest/web` (depends on all)
