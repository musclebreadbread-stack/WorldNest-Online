import {
  deleteCrop,
  deleteStructure,
  savePlayerState,
  saveCrop,
  saveQuests,
  saveStructure,
  saveWorldModification,
} from "@worldnest/database";
import { parseTileKey } from "@worldnest/game-engine";
import type {
  BuildSystem,
  CropComponent,
  Entity,
  InventoryComponent,
  PlantSystem,
  PositionComponent,
  QuestComponent,
  StructureComponent,
  TileType,
  WalletComponent,
} from "@worldnest/game-engine";
import { getChunkKey } from "@worldnest/shared";
import { SaveScheduler } from "../lib/persistence";
import { toPersistedInventory } from "../lib/inventorySnapshot";
import { toPersistedQuests } from "../lib/questSnapshot";
import type { GameBootstrap, GameWorldContext } from "./createGameWorld";

/** Any database write; the result is inspected only to swallow failures. */
type Write = () => Promise<{ error: Error | null }>;

/**
 * Writes the session back to Supabase.
 *
 * Player position and inventory are debounced through a `SaveScheduler`, while
 * terrain changes, structures and crops are written the moment they appear
 * because they are shared world state other players are waiting to see.
 *
 * Every write is best-effort: a missing or unreachable backend must never
 * interrupt play, so failures are swallowed rather than surfaced.
 */
export class SessionPersistence {
  private playerId: string;
  private worldId: string;
  private playerEntity: Entity;
  private build: BuildSystem;
  private plant: PlantSystem;
  private scheduler: SaveScheduler;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private lastInventoryVersion = -1;
  private lastCoins = Number.NaN;
  private lastQuestVersion = -1;
  private writtenQuestVersion = -1;
  private knownStructures = new Set<string>();
  private knownCrops = new Set<string>();
  private onUnload = () => this.flush();

  constructor(
    playerId: string,
    worldId: string,
    playerEntity: Entity,
    build: BuildSystem,
    plant: PlantSystem,
  ) {
    this.playerId = playerId;
    this.worldId = worldId;
    this.playerEntity = playerEntity;
    this.build = build;
    this.plant = plant;
    this.scheduler = new SaveScheduler(() => this.writeSession());

    // Restored structures, crops and quests are already persisted; only changes
    // made during this session are worth writing back.
    this.knownStructures = new Set(build.getStructures().keys());
    this.knownCrops = new Set(plant.getCrops().keys());
    this.writtenQuestVersion =
      playerEntity.getComponent<QuestComponent>("quest")?.version ?? -1;

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.onUnload);
    }
  }

  /** Detect changes, sync shared world state and autosave. Call once per frame. */
  update(): void {
    this.trackPlayerState();
    this.syncStructures();
    this.syncCrops();
    this.scheduler.tick();
  }

  /** Persist a tile the player just changed. */
  saveTile(tileX: number, tileY: number, tileType: TileType): void {
    this.write(() =>
      saveWorldModification(this.worldId, {
        tileX,
        tileY,
        tileType,
        modifiedBy: this.playerId,
      }),
    );
  }

  /** Write pending player state immediately, for unload and unmount. */
  flush(): void {
    this.trackPlayerState();
    this.scheduler.flush();
  }

  /** Stop listening for page unload. */
  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.onUnload);
    }
  }

  /**
   * Mark the session dirty when the player moved, or their inventory, coins or
   * quest log changed. Coins and quests are diffed here rather than written
   * eagerly so a shopping spree still costs one save per interval.
   */
  private trackPlayerState(): void {
    const position = this.playerEntity.getComponent<PositionComponent>("position")!;
    const inventory = this.playerEntity.getComponent<InventoryComponent>("inventory")!;
    const wallet = this.playerEntity.getComponent<WalletComponent>("wallet")!;
    const quests = this.playerEntity.getComponent<QuestComponent>("quest")!;

    if (
      position.x === this.lastX &&
      position.y === this.lastY &&
      inventory.version === this.lastInventoryVersion &&
      wallet.coins === this.lastCoins &&
      quests.version === this.lastQuestVersion
    ) {
      return;
    }

    this.lastX = position.x;
    this.lastY = position.y;
    this.lastInventoryVersion = inventory.version;
    this.lastCoins = wallet.coins;
    this.lastQuestVersion = quests.version;
    this.scheduler.markDirty();
  }

  private writeSession(): void {
    this.writePlayerState();
    this.writeQuests();
  }

  private writePlayerState(): void {
    const position = this.playerEntity.getComponent<PositionComponent>("position")!;
    const inventory = this.playerEntity.getComponent<InventoryComponent>("inventory")!;
    const wallet = this.playerEntity.getComponent<WalletComponent>("wallet")!;

    this.write(() =>
      savePlayerState(this.playerId, {
        x: position.x,
        y: position.y,
        chunk: getChunkKey(position.chunkX, position.chunkY),
        inventory: toPersistedInventory(inventory),
        coins: wallet.coins,
      }),
    );
  }

  /**
   * Write the quest log, which lives in its own table.
   *
   * Skipped unless the version moved since the last write: a save triggered by
   * walking around must not re-upsert every quest row, and an empty log has
   * nothing to say.
   */
  private writeQuests(): void {
    const quests = this.playerEntity.getComponent<QuestComponent>("quest")!;
    if (quests.version === this.writtenQuestVersion) return;

    this.writtenQuestVersion = quests.version;
    const rows = toPersistedQuests(quests);
    if (rows.length === 0) return;

    this.write(() => saveQuests(this.playerId, rows));
  }

  /**
   * Diff the structure index against what has been written. The index is keyed
   * by tile and only ever holds one entry per tile, so a size change is enough
   * to know a walk is worth doing.
   */
  private syncStructures(): void {
    const structures = this.build.getStructures();
    if (structures.size === this.knownStructures.size) return;

    for (const [key, entity] of structures) {
      if (this.knownStructures.has(key)) continue;

      const structure = entity.getComponent<StructureComponent>("structure")!;
      this.knownStructures.add(key);
      this.write(() =>
        saveStructure(this.worldId, {
          ownerId: this.playerId,
          itemId: structure.itemId,
          tileX: structure.tileX,
          tileY: structure.tileY,
        }),
      );
    }

    this.forgetRemoved(this.knownStructures, structures, (tileX, tileY) =>
      this.write(() => deleteStructure(this.worldId, tileX, tileY)),
    );
  }

  private syncCrops(): void {
    const crops = this.plant.getCrops();
    if (crops.size === this.knownCrops.size) return;

    for (const [key, entity] of crops) {
      if (this.knownCrops.has(key)) continue;

      const crop = entity.getComponent<CropComponent>("crop")!;
      this.knownCrops.add(key);
      this.write(() =>
        saveCrop(this.worldId, {
          ownerId: this.playerId,
          itemId: crop.itemId,
          tileX: crop.tileX,
          tileY: crop.tileY,
          plantedAtMinute: crop.plantedAtMinute,
        }),
      );
    }

    this.forgetRemoved(this.knownCrops, crops, (tileX, tileY) =>
      this.write(() => deleteCrop(this.worldId, tileX, tileY)),
    );
  }

  /** Delete rows for tiles that are no longer in the live index. */
  private forgetRemoved(
    known: Set<string>,
    live: Map<string, Entity>,
    remove: (tileX: number, tileY: number) => void,
  ): void {
    for (const key of known) {
      if (live.has(key)) continue;

      known.delete(key);
      const { tileX, tileY } = parseTileKey(key);
      remove(tileX, tileY);
    }
  }

  private write(action: Write): void {
    try {
      void action().catch(() => undefined);
    } catch {
      // Supabase not configured; persistence is best-effort by design
    }
  }
}

/**
 * Build a persistence layer for this session, or `null` when there is nothing
 * to write to (no world id means Supabase was unavailable at boot).
 */
export function createSessionPersistence(
  bootstrap: GameBootstrap,
  context: GameWorldContext,
): SessionPersistence | null {
  if (!bootstrap.worldId) return null;

  return new SessionPersistence(
    bootstrap.playerId,
    bootstrap.worldId,
    context.playerEntity,
    context.systems.build,
    context.systems.plant,
  );
}
