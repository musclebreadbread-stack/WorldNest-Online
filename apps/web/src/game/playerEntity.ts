import {
  Entity,
  PositionComponent,
  VelocityComponent,
  SpriteComponent,
  PlayerComponent,
  InputComponent,
  NetworkComponent,
  RemoteInterpolationComponent,
  ColliderComponent,
  InventoryComponent,
  StatsComponent,
  InteractionComponent,
  DialogueComponent,
  QuestComponent,
  ShopComponent,
  WalletComponent,
  AnimationComponent,
  AchievementComponent,
  CollectionComponent,
  addItem,
} from "@worldnest/game-engine";
import type { QuestEntry } from "@worldnest/game-engine";
import { STARTING_COINS } from "@worldnest/shared";
import type { PersistedInventory } from "@worldnest/database";
import { restoreInventory } from "../lib/inventorySnapshot";
import { restoreQuests } from "../lib/questSnapshot";
import type { SavedWorldState } from "./savedWorld";

/**
 * Assembling player entities — the local one and its remote counterparts.
 *
 * Split out of `createGameWorld.ts` to keep that file under the ~300-line cap
 * `CONTRIBUTING.md` sets, exactly as `savedWorld.ts` was: this is component
 * assembly plus the "granted only when nothing was saved" seeding rules, and
 * none of it has anything to do with wiring systems. Everything here is
 * re-exported from `createGameWorld`, which is still the module the rest of the
 * app imports from, so no caller changed.
 *
 * Deliberately free of Phaser imports — the jsdom suites reason about these
 * entities, and importing Phaser under jsdom fails inside `checkInverseAlpha`.
 */

/**
 * Identity, spawn and saved state handed to the game by React through the
 * Phaser registry. Everything past the identity is optional so the game still
 * boots when Supabase is unconfigured.
 */
export interface GameBootstrap {
  playerId: string;
  username: string;
  spawnX: number;
  spawnY: number;
  /** World rows are written against this id; `null` disables persistence. */
  worldId?: string | null;
  /** Saved inventory; when absent the starting kit is granted instead. */
  inventory?: PersistedInventory | null;
  /** Saved coin balance; when absent the starting purse is granted instead. */
  coins?: number | null;
  /** Saved quest log; when absent the player starts with no quests taken. */
  quests?: Record<string, QuestEntry> | null;
  /** Saved shared-world state, applied before the first chunk load. */
  savedWorld?: SavedWorldState | null;
}

/** Entity id the local player is registered under. */
export const LOCAL_PLAYER_ENTITY_ID = "local-player";

/** Player collision box, slightly smaller than a tile so doorways feel forgiving. */
export const PLAYER_COLLIDER_SIZE = 24;

/** Seeds handed to a new player so the farming loop is playable immediately. */
export const STARTING_WHEAT_SEEDS = 5;

/**
 * Build the local player entity from the bootstrap payload.
 *
 * The inventory, the purse and the quest log are each seeded only when nothing
 * was saved. `loadSession` judges that for the purse from the row rather than
 * the column — `0` is a balance a player genuinely reaches, so a per-column rule
 * would hand out another starting purse on every reload.
 */
export function createPlayerEntity(bootstrap: GameBootstrap): Entity {
  const inventory = new InventoryComponent();
  if (bootstrap.inventory) {
    restoreInventory(inventory, bootstrap.inventory);
  } else {
    addItem(inventory, "wheat_seed", STARTING_WHEAT_SEEDS);
  }

  // Coins and quests are granted only when nothing was saved, the same rule the
  // starting seeds follow: a returning player who spent down to zero keeps their
  // empty purse instead of being handed another fifty on every reload.
  const wallet = new WalletComponent(bootstrap.coins ?? STARTING_COINS);
  const questLog = new QuestComponent();
  if (bootstrap.quests) {
    restoreQuests(questLog, bootstrap.quests);
  }

  const playerEntity = new Entity(LOCAL_PLAYER_ENTITY_ID);
  playerEntity
    .addComponent(new PositionComponent(bootstrap.spawnX, bootstrap.spawnY))
    .addComponent(new VelocityComponent(0, 0))
    .addComponent(new SpriteComponent("player", 0, true))
    .addComponent(new PlayerComponent(bootstrap.playerId, bootstrap.username, true))
    .addComponent(new InputComponent())
    .addComponent(new NetworkComponent())
    .addComponent(new ColliderComponent(PLAYER_COLLIDER_SIZE, PLAYER_COLLIDER_SIZE))
    .addComponent(inventory)
    .addComponent(new StatsComponent())
    .addComponent(new InteractionComponent())
    .addComponent(new DialogueComponent())
    .addComponent(wallet)
    .addComponent(new ShopComponent())
    .addComponent(questLog)
    .addComponent(new AnimationComponent())
    .addComponent(new AchievementComponent())
    .addComponent(new CollectionComponent());

  return playerEntity;
}

/** Entity id used for the remote player owned by `playerId`. */
export function remotePlayerEntityId(playerId: string): string {
  return `remote-${playerId}`;
}

/**
 * Build a remote player entity. Remote players are real ECS entities so they
 * share the single render path and get network smoothing for free.
 */
export function createRemotePlayerEntity(
  playerId: string,
  username: string,
  x: number,
  y: number,
): Entity {
  const entity = new Entity(remotePlayerEntityId(playerId));
  entity
    .addComponent(new PositionComponent(x, y))
    .addComponent(new SpriteComponent("player", 0, true))
    .addComponent(new PlayerComponent(playerId, username, false))
    .addComponent(new RemoteInterpolationComponent(x, y))
    // No velocity component: MovementSystem would integrate it and fight the
    // smoothing, so InterpolationSystem drives this animation instead.
    .addComponent(new AnimationComponent());
  return entity;
}
