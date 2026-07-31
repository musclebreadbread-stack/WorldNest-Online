# Contributing to WorldNest Online

Thank you for your interest in contributing to WorldNest Online! This guide covers the development workflow, conventions, and standards we follow.

## Development Workflow

1. **Create a branch** from `main` using the naming conventions below
2. **Implement your changes** following our code style guidelines
3. **Write/update tests** for any new functionality
4. **Run the full check suite** — `pnpm lint && pnpm build && pnpm test`, plus whichever of these your change touches:

   | Command                       | When                                                        |
   | ----------------------------- | ----------------------------------------------------------- |
   | `pnpm test:e2e`               | anything in `apps/web` (needs `pnpm build` first)           |
   | `pnpm db:verify`              | anything under `packages/database/supabase/` (needs Docker) |
   | `pnpm docs:check`             | any edit to `docs/SETUP_GUIDE_KR.md` or its `.doc` mirror   |
   | `docker build -t worldnest .` | anything affecting the production image                     |

5. **Submit a Pull Request** with a clear description

## Branch Naming Conventions

Use the following prefixes for branch names:

| Prefix      | Purpose               | Example                     |
| ----------- | --------------------- | --------------------------- |
| `feat/`     | New features          | `feat/fishing-system`       |
| `fix/`      | Bug fixes             | `fix/chunk-loading-race`    |
| `chore/`    | Maintenance, deps, CI | `chore/update-dependencies` |
| `docs/`     | Documentation only    | `docs/add-api-reference`    |
| `refactor/` | Code restructuring    | `refactor/ecs-performance`  |

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat` - A new feature
- `fix` - A bug fix
- `chore` - Maintenance tasks (deps, CI, tooling)
- `docs` - Documentation changes
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or updating tests
- `perf` - Performance improvements

### Scopes

Use the package name as scope when applicable:

- `game-engine` - Changes to the ECS game engine
- `web` - Changes to the Next.js web app
- `shared` - Changes to shared types/utils
- `database` - Changes to Supabase/database layer
- `ui` - Changes to shared UI components

Documentation-only commits use `docs:` with no scope.

### Examples

```
feat(game-engine): add farming system with crop growth cycles
fix(web): resolve chunk flickering during rapid movement
chore(database): add migration for inventory table
docs: update architecture diagram with new systems
```

## Pull Request Process

1. **Title** should follow the commit message format
2. **Description** should include:
   - What changes were made and why
   - How to test the changes
   - Screenshots/recordings for visual changes
   - Any breaking changes or migration steps
3. **All CI checks must pass** before merging
4. **At least one review** is required for approval
5. **Squash merge** is preferred for feature branches

## Code Style

### TypeScript

- **Strict mode** is enabled across all packages
- Use explicit types for function parameters and return values
- Prefer `interface` over `type` for object shapes
- Use `const` by default, `let` only when reassignment is needed
- No `any` types - use `unknown` with type guards instead

### ESLint & Prettier

- ESLint enforces code quality rules
- Prettier owns the formatting and the whole tree is formatted, so **run `pnpm format` before you commit**. `.prettierrc` sets `printWidth: 88`, which is what the code was already hand-wrapped at, so formatting now only touches what you changed. `pnpm format:check` is a CI gate: if it lists a file, run `pnpm format` and commit the result.

### File Organization

- One component/class per file (with its related types)
- File names match the primary export (PascalCase for classes/components, camelCase for utilities)
- Index files (`index.ts`) re-export public API from a directory
- Keep files focused - split when they exceed ~300 lines

### ECS Patterns (Game Engine)

- Components are pure data containers (no methods beyond constructor)
- Systems contain all logic and operate on entities with specific component sets
- Use the `World` class to create/destroy entities and register systems
- Systems should be independent and composable

## Testing Requirements

### Unit Tests

- All new game systems must have corresponding tests
- All utility functions must be tested
- Use Vitest as the test runner (`pnpm test`)
- Tests live alongside source code in `__tests__/` directories
- Aim for meaningful coverage of business logic

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("ComponentName", () => {
  beforeEach(() => {
    // Setup
  });

  it("should describe expected behavior", () => {
    // Arrange, Act, Assert
  });
});
```

### What to Test

- Game systems: input/output behavior, edge cases
- World generation: determinism (same seed = same output), boundary conditions
- State management: store actions, derived state
- Utilities: all branches and edge cases

## Development Environment

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions, including:

- Environment variable configuration
- How to add new game systems
- How to extend world generation
- How to add new UI features
