# WorldNest Online

A cozy pixel-art MMO life simulation built with modern web technologies. Explore a procedurally generated world, build your homestead, interact with other players in real-time, and create your own story in a charming 2D universe.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, TailwindCSS |
| Game Engine | Phaser 3 + Custom ECS (Entity Component System) |
| State Management | Zustand (client), React Query (server) |
| Backend | Supabase (Auth, Realtime, PostgreSQL) |
| Build System | pnpm Workspaces + Turborepo |
| Testing | Vitest (unit), Playwright (E2E) |
| Language | TypeScript (strict mode) |

## Monorepo Structure

```
worldnest-online/
├── apps/
│   └── web/                  # Next.js 14 App Router - main game client
├── packages/
│   ├── game-engine/          # ECS framework, systems, world generation
│   ├── shared/               # Shared types, constants, utilities
│   ├── database/             # Supabase client, auth, realtime, migrations
│   └── ui/                   # Shared React UI components
├── docs/                     # Architecture & development documentation
├── .github/workflows/        # CI/CD configuration
├── turbo.json                # Turborepo task configuration
├── pnpm-workspace.yaml       # Workspace package definitions
└── Dockerfile                # Multi-stage production build
```

## Features

| Area | What is implemented |
|------|--------------------|
| World | Deterministic simplex-noise terrain streamed as 16x16 chunks, seven tile types, a modification overlay for every player-caused change |
| Movement | Per-axis collision with wall sliding, WASD/arrow input, directional walk animation |
| Day/night | A shared world clock derived from wall-clock time (24 real minutes per in-game day), dawn/day/dusk/night tinting and a clock HUD |
| Survival | Health and energy with night-boosted regeneration, energy costs on every interaction |
| Gathering | Harvest forest, stone and flower tiles into a 20-slot inventory with an 8-slot hotbar |
| Farming | Till grass into farmland, sow seeds, watch crops grow off the shared clock, harvest the produce |
| Building | Build mode with a green/red placement ghost; placed structures become real obstacles |
| Multiplayer | Supabase Presence + Broadcast, smoothed remote players with floating name tags, a live player counter |
| Chat | Instant broadcast delivery plus durable history, client-side rate limiting, and a keyboard gate so typing never moves the player |
| Persistence | Position, inventory, terrain diff, structures and crops restored on sign-in and autosaved while playing |
| Accounts | Email sign-up/sign-in, a middleware-guarded `/game` route, and in-game sign-out |

## Quick Start

### Prerequisites

- **Node.js** 22+ (LTS recommended)
- **pnpm** 10+ (`corepack enable` to activate)
- A **Supabase** project (free tier works for development)

### Setup

```bash
# Clone the repository
git clone https://github.com/musclebreadbread-stack/WorldNest-Online.git
cd WorldNest-Online

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run both SQL migrations in the Supabase SQL Editor, in order:
#   packages/database/supabase/migrations/001_initial_schema.sql
#   packages/database/supabase/migrations/002_gameplay_schema.sql

# Start development servers
pnpm dev
```

The game will be available at `http://localhost:3000`. Without Supabase credentials it still boots as a single-player sandbox — authentication, chat and persistence switch themselves off.

### Controls

| Input | Action |
|-------|--------|
| `WASD` / arrows | Move |
| `1`-`8` | Select a hotbar slot |
| `I` | Toggle the inventory panel |
| `E` / `Space` | Interact with the faced tile: harvest, till, sow or reap |
| `B` | Toggle build mode |
| `Q` / left click | Place the selected item (build mode only) |
| `M` | Toggle the corner minimap |
| `P` | Toggle the settings panel (language) |
| `Enter` / `Esc` | Focus / blur the chat composer |

The UI ships in 12 languages (en, ko, ja, zh, es, fr, de, pt, ar, hi, th, vi). The browser's
language is detected on first load and the choice is remembered per device; Arabic renders
right to left.

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in development mode |
| `pnpm build` | Build all packages (via Turborepo) |
| `pnpm test` | Run unit tests across the monorepo (Vitest, browser-free) |
| `pnpm test:e2e` | Run the Playwright smoke specs against a production build |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm format` | Format all files with Prettier |

## Architecture Overview

WorldNest Online uses a **client-authoritative** architecture with server validation via Supabase Realtime:

- **ECS Game Engine** - Custom Entity Component System drives all game logic. Entities are composed of reusable components looked up by string type (`position`, `velocity`, `sprite`, `inventory`, `interaction`, ...) and processed by fourteen independent systems whose registration order is their execution order.

- **Chunk Streaming** - The world is divided into 16x16 tile chunks generated procedurally using simplex noise with a configurable world seed. Chunks load/unload dynamically based on player proximity.

- **Supabase Realtime** - Multiplayer synchronization uses Supabase Presence (player state) and Broadcast (positions and chat) channels for low-latency communication between clients. The client is authoritative by design; anti-cheat is out of scope.

- **Persistence** - Terrain is regenerated from the seed rather than stored, so only the diff is persisted: changed tiles, structures, crops, player position and inventory.

- **Rendering Pipeline** - Phaser 3 renders the game world in a canvas element, loaded dynamically in Next.js to avoid SSR issues. The ECS RenderSystem bridges game state to Phaser scenes.

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md) - System design and technical decisions
- [Development Guide](docs/DEVELOPMENT.md) - Detailed setup and extension guide
- [Contributing](CONTRIBUTING.md) - How to contribute to the project

## License

This project is private and proprietary.
