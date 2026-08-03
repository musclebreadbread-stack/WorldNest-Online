import { TILE_SIZE } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { AddEntity } from "../ecs/World";
import { DialogueComponent } from "../components/DialogueComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { NpcComponent } from "../components/NpcComponent";
import { PositionComponent } from "../components/PositionComponent";
import { RemoteInterpolationComponent } from "../components/RemoteInterpolationComponent";
import { SpriteComponent } from "../components/SpriteComponent";
import { advanceDialogue, closeDialogue, openDialogue } from "../dialogue/dialogueOps";
import { getFacedTile } from "../interaction/facing";
import { NPC_DEFINITIONS, type NpcDefinition } from "../world/NpcCatalogue";
import { scheduledEntry, type NpcScheduleEntry } from "../world/npcSchedule";
import { resolveNpcTile } from "../world/npcPlacement";
import type { StructureQuery } from "../world/StructureQuery";
import { getTileKey, type TileQuery } from "../world/TileQuery";
import type { ClockSnapshot } from "../world/WorldClock";
import { WorldLayer } from "../world/WorldLayer";

/** Entity id of a placed NPC. Stable, because placement is deterministic. */
export function npcEntityId(npcId: string): string {
  return `npc-${npcId}`;
}

/**
 * Told that the player has just started talking to an NPC.
 *
 * The seam quest `talk` objectives hang off: a visit is a moment rather than a
 * state, so it cannot be polled the way an inventory can. `QuestSystem` supplies
 * this and runs one system later, so a greeting lands in the frame it happened.
 */
export type TalkListener = (npcId: string) => void;

/** Returns the current clock snapshot. */
export type ClockSnapshotGetter = () => ClockSnapshot;

/**
 * NpcSystem places the catalogue's NPCs and runs every conversation.
 *
 * It spawns on its first update rather than in the constructor, so the terrain it
 * searches is the same terrain the rest of the world sees. It owns the tile-keyed
 * NPC index and exposes it as a `StructureQuery`, which is what makes an NPC as
 * solid as a fence without teaching `CollisionSystem` what an NPC is.
 *
 * Interaction follows the `PlantSystem` convention: the request flag is cleared
 * only when this system acted, so an interact aimed at empty ground still reaches
 * planting and harvesting in the same frame. The converse matters more — the
 * system is registered *before* planting, so talking to an NPC can never till the
 * ground they are standing on.
 */
export class NpcSystem extends System implements StructureQuery {
  private tileQuery: TileQuery;
  private addEntity: AddEntity;
  private definitions: readonly NpcDefinition[];
  private onTalk?: TalkListener;
  private getLayer: () => WorldLayer;
  private getClock?: ClockSnapshotGetter;
  /** Placed NPCs keyed by `"tileX,tileY"`. */
  private npcs: Map<string, Entity> = new Map();
  /** Definitions keyed by entity id for schedule lookup. */
  private defByEntity: Map<string, NpcDefinition> = new Map();
  /** Last active schedule entry per NPC id. */
  private lastEntry: Map<string, NpcScheduleEntry> = new Map();
  private spawned = false;

  constructor(
    tileQuery: TileQuery,
    addEntity: AddEntity,
    definitions: readonly NpcDefinition[] = NPC_DEFINITIONS,
    onTalk?: TalkListener,
    getLayer: () => WorldLayer = () => WorldLayer.SURFACE,
    getClock?: ClockSnapshotGetter,
  ) {
    super(["position", "interaction", "dialogue"]);
    this.tileQuery = tileQuery;
    this.addEntity = addEntity;
    this.definitions = definitions;
    this.onTalk = onTalk;
    this.getLayer = getLayer;
    this.getClock = getClock;
  }

  update(entities: Entity[], _deltaTime: number): void {
    if (!this.spawned) this.spawnAll();
    this.updateSchedules();

    for (const entity of entities) {
      const dialogue = entity.getComponent<DialogueComponent>("dialogue")!;
      this.consumeRequests(dialogue);

      const interaction = entity.getComponent<InteractionComponent>("interaction")!;
      if (!interaction.interactRequested) continue;

      if (this.tryTalk(entity, interaction, dialogue)) {
        interaction.interactRequested = false;
      }
    }
  }

  hasStructureAt(tileX: number, tileY: number): boolean {
    return this.npcs.has(getTileKey(tileX, tileY));
  }

  /** NPCs are always solid: walking through one would look like a bug. */
  isBlockedByStructure(tileX: number, tileY: number): boolean {
    return this.hasStructureAt(tileX, tileY);
  }

  /** The NPC standing on a tile, if any. */
  getNpcAt(tileX: number, tileY: number): Entity | undefined {
    return this.npcs.get(getTileKey(tileX, tileY));
  }

  /** Every placed NPC, keyed by `"tileX,tileY"`. */
  getNpcs(): Map<string, Entity> {
    return this.npcs;
  }

  /**
   * Place every catalogue NPC on the nearest tile it can stand on. An NPC with no
   * suitable tile within range is skipped rather than dropped into water, and the
   * index doubles as the "already taken" test so two nearby anchors cannot
   * resolve to the same tile.
   */
  private spawnAll(): void {
    this.spawned = true;

    for (const definition of this.definitions) {
      // Use the schedule's current entry as the anchor if the NPC has one
      const anchor = this.currentAnchor(definition);
      const tile = resolveNpcTile(
        this.tileQuery,
        anchor.tileX,
        anchor.tileY,
        undefined,
        (tileX, tileY) => this.hasStructureAt(tileX, tileY),
      );
      if (!tile) continue;

      const key = getTileKey(tile.tileX, tile.tileY);
      const entity = this.spawnNpc(definition, tile);
      this.npcs.set(key, entity);
      this.defByEntity.set(entity.id, definition);

      // Record the initial schedule entry so the first schedule check
      // does not trigger a spurious move
      if (definition.schedule && this.getClock) {
        const entry = scheduledEntry(definition.schedule, this.getClock());
        this.lastEntry.set(definition.id, entry);
        const npc = entity.getComponent<NpcComponent>("npc")!;
        npc.activity = entry.activity;
      }
    }
  }

  private spawnNpc(
    definition: NpcDefinition,
    tile: { tileX: number; tileY: number },
  ): Entity {
    const entity = new Entity(npcEntityId(definition.id));
    entity
      .addComponent(
        new PositionComponent(
          tile.tileX * TILE_SIZE + TILE_SIZE / 2,
          tile.tileY * TILE_SIZE + TILE_SIZE / 2,
        ),
      )
      .addComponent(new SpriteComponent(definition.textureKey, 0, true))
      .addComponent(
        new NpcComponent(
          definition.id,
          definition.nameKey,
          definition.dialogueId,
          definition.role,
          tile.tileX,
          tile.tileY,
        ),
      )
      .addComponent(
        new RemoteInterpolationComponent(
          tile.tileX * TILE_SIZE + TILE_SIZE / 2,
          tile.tileY * TILE_SIZE + TILE_SIZE / 2,
          0.15,
        ),
      );

    this.addEntity(entity);
    return entity;
  }

  /**
   * Resolve the current anchor for an NPC definition: the scheduled entry's
   * tile if the NPC has a schedule, otherwise the catalogue anchor.
   */
  private currentAnchor(definition: NpcDefinition): {
    tileX: number;
    tileY: number;
  } {
    if (definition.schedule && this.getClock) {
      const entry = scheduledEntry(definition.schedule, this.getClock());
      return { tileX: entry.tileX, tileY: entry.tileY };
    }
    return { tileX: definition.anchorTileX, tileY: definition.anchorTileY };
  }

  /**
   * Check each scheduled NPC and relocate it if the active entry changed.
   * The tile index _jumps_ (collision is always correct); only the sprite is
   * smoothed by `RemoteInterpolationComponent` + `InterpolationSystem`.
   */
  private updateSchedules(): void {
    if (!this.getClock) return;

    const snapshot = this.getClock();

    for (const [key, entity] of this.npcs) {
      const definition = this.defByEntity.get(entity.id);
      if (!definition?.schedule) continue;

      const entry = scheduledEntry(definition.schedule, snapshot);
      const last = this.lastEntry.get(definition.id);
      if (entry === last) continue;

      this.lastEntry.set(definition.id, entry);
      this.relocateNpc(entity, definition, entry, key);
    }
  }

  /**
   * Move an NPC to a new tile for a schedule change.
   */
  private relocateNpc(
    entity: Entity,
    definition: NpcDefinition,
    entry: NpcScheduleEntry,
    oldKey: string,
  ): void {
    const tile = resolveNpcTile(
      this.tileQuery,
      entry.tileX,
      entry.tileY,
      undefined,
      (tileX, tileY) => {
        // Allow the NPC's own tile so it does not block itself
        const npc = entity.getComponent<NpcComponent>("npc")!;
        if (tileX === npc.tileX && tileY === npc.tileY) return false;
        return this.hasStructureAt(tileX, tileY);
      },
    );
    if (!tile) return;

    // Update the tile index
    this.npcs.delete(oldKey);
    const newKey = getTileKey(tile.tileX, tile.tileY);
    this.npcs.set(newKey, entity);

    // Update the NPC component
    const npc = entity.getComponent<NpcComponent>("npc")!;
    npc.tileX = tile.tileX;
    npc.tileY = tile.tileY;
    npc.activity = entry.activity;

    // Set the interpolation target so the sprite eases toward the new tile
    const targetX = tile.tileX * TILE_SIZE + TILE_SIZE / 2;
    const targetY = tile.tileY * TILE_SIZE + TILE_SIZE / 2;
    const interp =
      entity.getComponent<RemoteInterpolationComponent>("remoteInterpolation");
    if (interp) {
      interp.targetX = targetX;
      interp.targetY = targetY;
    }
  }

  /**
   * Apply whatever the HUD asked for since the last frame (decision D13). React
   * only ever raises these flags through an injected callback; the state change
   * itself happens here.
   */
  private consumeRequests(dialogue: DialogueComponent): void {
    if (dialogue.closeRequested) {
      closeDialogue(dialogue);
      dialogue.closeRequested = false;
    }

    if (dialogue.requestedOption !== null) {
      advanceDialogue(dialogue, dialogue.requestedOption);
      dialogue.requestedOption = null;
    }
  }

  /**
   * Talk to the NPC on the faced tile: open the conversation, or advance it by
   * its first option when it is already open, so `E` alone can carry a chat.
   *
   * Returns whether an NPC absorbed the interaction. Facing an NPC always counts,
   * even if their dialogue tree is missing — the alternative is tilling the tile
   * they are standing on.
   */
  private tryTalk(
    entity: Entity,
    interaction: InteractionComponent,
    dialogue: DialogueComponent,
  ): boolean {
    if (this.getLayer() !== WorldLayer.SURFACE) return false;

    const position = entity.getComponent<PositionComponent>("position")!;
    const { tileX, tileY } = getFacedTile(position.x, position.y, interaction.facing);
    const npcEntity = this.getNpcAt(tileX, tileY);
    if (!npcEntity) return false;

    const npc = npcEntity.getComponent<NpcComponent>("npc")!;
    if (dialogue.activeNpcId === npc.npcId) {
      advanceDialogue(dialogue, 0);
    } else {
      openDialogue(dialogue, npc.npcId, npc.dialogueId);
      // Reported on opening only: saying hello once is what a `talk` objective
      // asks for, and every later option is the same conversation.
      this.onTalk?.(npc.npcId);
    }

    return true;
  }
}
