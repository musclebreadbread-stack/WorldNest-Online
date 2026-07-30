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

# Start development servers
pnpm dev
```

The game will be available at `http://localhost:3000`.

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in development mode |
| `pnpm build` | Build all packages (via Turborepo) |
| `pnpm test` | Run unit tests across the monorepo |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm format` | Format all files with Prettier |

## Architecture Overview

WorldNest Online uses a **client-authoritative** architecture with server validation via Supabase Realtime:

- **ECS Game Engine** - Custom Entity Component System drives all game logic. Entities are composed of reusable components (Position, Velocity, Sprite, Network) and processed by independent systems (Movement, Input, Chunk, Render, NetworkSync).

- **Chunk Streaming** - The world is divided into 16x16 tile chunks generated procedurally using simplex noise with a configurable world seed. Chunks load/unload dynamically based on player proximity.

- **Supabase Realtime** - Multiplayer synchronization uses Supabase Presence (player state) and Broadcast (game events) channels for low-latency communication between clients.

- **Rendering Pipeline** - Phaser 3 renders the game world in a canvas element, loaded dynamically in Next.js to avoid SSR issues. The ECS RenderSystem bridges game state to Phaser scenes.

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md) - System design and technical decisions
- [Development Guide](docs/DEVELOPMENT.md) - Detailed setup and extension guide
- [Contributing](CONTRIBUTING.md) - How to contribute to the project

## License

This project is private and proprietary.
