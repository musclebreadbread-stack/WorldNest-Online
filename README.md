# WorldNest Online

A cozy pixel-art MMO life simulation built with modern web technologies. Explore a procedurally generated world, build your homestead, interact with other players in real-time, and create your own story in a charming 2D universe.

## Tech Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Frontend         | Next.js 14 (App Router), React 18, TailwindCSS  |
| Game Engine      | Phaser 3 + Custom ECS (Entity Component System) |
| State Management | Zustand (client), React Query (server)          |
| Backend          | Supabase (Auth, Realtime, PostgreSQL)           |
| Build System     | pnpm Workspaces + Turborepo                     |
| Testing          | Vitest (unit), Playwright (E2E)                 |
| Language         | TypeScript (strict mode)                        |

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
├── docs/                     # Architecture, development, deployment, 한국어 설정 가이드
├── e2e/                      # Playwright smoke specs
├── scripts/                  # verify-sql.sh, check-kr-doc-sync.mjs
├── .github/workflows/        # CI/CD configuration
├── turbo.json                # Turborepo task configuration
├── pnpm-workspace.yaml       # Workspace package definitions
├── vercel.json               # Install/build commands for the Vercel deployment
└── Dockerfile                # Multi-stage production build
```

## Features

| Area        | What is implemented                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World       | Deterministic simplex-noise terrain streamed as 16x16 chunks, eleven tile types, a modification overlay for every player-caused change                        |
| Biomes      | Six climate zones (tundra, taiga, grassland, forest, savanna, desert) from a temperature channel, with elevation acting as a lapse rate                       |
| Caves       | Tunnels carved into the mountains by a fifth noise channel, always open to the surface, with ore veins inside them                                            |
| Movement    | Per-axis collision with wall sliding, WASD/arrow input, directional walk animation                                                                            |
| Day/night   | A shared world clock derived from wall-clock time (24 real minutes per in-game day), dawn/day/dusk/night tinting and a clock HUD                              |
| Survival    | Health and energy with night-boosted regeneration, energy costs on every interaction                                                                          |
| Gathering   | Harvest forest, stone and flower tiles into a 20-slot inventory with an 8-slot hotbar                                                                         |
| Farming     | Till grass into farmland, sow seeds, watch crops grow off the shared clock, harvest the produce                                                               |
| Building    | Build mode with a green/red placement ghost; placed structures become real obstacles                                                                          |
| NPCs        | Three villagers, statically and deterministically placed, with branching dialogue trees in every supported language                                           |
| Economy     | A coin wallet and an NPC shop with fixed prices. Selling always pays less than buying, so there is no arbitrage loop, and there is no trading between players |
| Quests      | Three starter quests (collect, build, talk) with a quest log and an on-screen tracker                                                                         |
| Minimap     | A corner map sampled in the engine and painted in Phaser, showing terrain and every nearby player                                                             |
| Multiplayer | Supabase Presence + Broadcast, smoothed remote players with floating name tags, a live player counter                                                         |
| Chat        | Instant broadcast delivery plus durable history, client-side rate limiting, and a keyboard gate so typing never moves the player                              |
| Audio       | Sound effects and a day/night-aware music pad, both synthesised at runtime — there is not one binary asset in the repository                                  |
| Languages   | 12 complete UI translations with browser detection, a language picker, and right-to-left support for Arabic                                                   |
| Mobile      | An on-screen thumb-stick and action buttons that appear on coarse-pointer devices                                                                             |
| Persistence | Position, inventory, coins, quest progress, terrain diff, structures and crops restored on sign-in and autosaved while playing                                |
| Accounts    | Email sign-up/sign-in, a middleware-guarded `/game` route, and in-game sign-out                                                                               |

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

# Run all three SQL migrations in the Supabase SQL Editor, in this order:
#   packages/database/supabase/migrations/001_initial_schema.sql
#   packages/database/supabase/migrations/002_gameplay_schema.sql
#   packages/database/supabase/migrations/003_progression_schema.sql
#
# Optional, development only — three ready-to-use test logins:
#   packages/database/supabase/seed/test_accounts.sql

# Start development servers
pnpm dev
```

Have Docker? `pnpm db:verify` applies all four files to a throwaway Postgres and asserts the schema,
so you can check the SQL before pasting it into a project that matters.

The game will be available at `http://localhost:3000`. Without Supabase credentials it still boots as a single-player sandbox — authentication, chat and persistence switch themselves off.

### Controls

| Input            | Action                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------- |
| `WASD` / arrows  | Move                                                                                    |
| `1`-`8`          | Select a hotbar slot                                                                    |
| `I`              | Toggle the inventory panel                                                              |
| `E` / `Space`    | Interact with the faced tile: harvest, till, sow or reap                                |
| `B`              | Toggle build mode                                                                       |
| `Q` / left click | Place the selected item (build mode only)                                               |
| `M`              | Toggle the corner minimap                                                               |
| `J`              | Toggle the quest log                                                                    |
| `P`              | Toggle the settings panel (language, sound)                                             |
| `1`-`4`          | Answer the open conversation                                                            |
| `Esc`            | Close the topmost panel: conversation, shop, quest log, inventory, settings, build mode |
| `Enter` / `Esc`  | Focus / blur the chat composer                                                          |

Talk to a villager with `E`. Juno the shopkeeper opens the shop from her first answer — prices are
fixed, selling always pays a little less than buying, and there is no trading between players.
Ada the explorer hands out the three starter quests and takes them back in.

The UI ships in 12 languages (en, ko, ja, zh, es, fr, de, pt, ar, hi, th, vi). The browser's
language is detected on first load and the choice is remembered per device; Arabic renders
right to left.

## Available Scripts

| Command             | Description                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm dev`          | Start all packages in development mode                                                      |
| `pnpm build`        | Build all packages (via Turborepo)                                                          |
| `pnpm test`         | Run unit tests across the monorepo (Vitest, browser-free)                                   |
| `pnpm test:e2e`     | Run the Playwright smoke specs against a production build                                   |
| `pnpm lint`         | Run ESLint on all packages                                                                  |
| `pnpm db:verify`    | Apply every migration and the seed to a throwaway dockerised Postgres and assert the schema |
| `pnpm docs:check`   | Assert the Korean guide and its Word mirror have matching headings                          |
| `pnpm format`       | Format all files with Prettier (`printWidth: 88`, run it before committing)                 |
| `pnpm format:check` | Assert the whole tree is already formatted — the same check CI runs                         |

## Architecture Overview

WorldNest Online uses a **client-authoritative** architecture with server validation via Supabase Realtime:

- **ECS Game Engine** - Custom Entity Component System drives all game logic. Entities are composed of reusable components looked up by string type (`position`, `velocity`, `sprite`, `inventory`, `interaction`, `dialogue`, `quest`, ...) and processed by seventeen independent systems whose registration order is their execution order.

- **Chunk Streaming** - The world is divided into 16x16 tile chunks generated procedurally from five seeded simplex-noise channels and a configurable world seed. Chunks load/unload dynamically based on player proximity.

- **React never touches the ECS** - HUD panels call an injected callback that sets a request field on a component, and the owning system decides on the next frame. That is what lets a refused trade or quest turn-in change nothing at all.

- **Supabase Realtime** - Multiplayer synchronization uses Supabase Presence (player state) and Broadcast (positions and chat) channels for low-latency communication between clients. The client is authoritative by design; **anti-cheat is out of scope**, so coins, inventory, harvests and quest progress are all forgeable. That is precisely why the economy is a fixed-price NPC shop with no player-to-player trading — a cheat stays inside one save file instead of leaking into everyone else's.

- **Persistence** - Terrain is regenerated from the seed rather than stored, so only the diff is persisted: changed tiles, structures, crops, player position and inventory.

- **Rendering Pipeline** - Phaser 3 renders the game world in a canvas element, loaded dynamically in Next.js to avoid SSR issues. The ECS RenderSystem bridges game state to Phaser scenes.

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md) - System design and technical decisions
- [Development Guide](docs/DEVELOPMENT.md) - Detailed setup and extension guide
- [Deployment Guide](docs/DEPLOYMENT.md) - Fresh clone to a live public URL on Vercel + Supabase
- [설정 가이드 (한국어)](docs/SETUP_GUIDE_KR.md) - 직접 해야 하는 모든 작업을 정리한 한국어 안내서
- [Contributing](CONTRIBUTING.md) - How to contribute to the project

## License

This project is private and proprietary.
