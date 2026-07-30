import { describe, it, expect } from "vitest";
import { TILE_SIZE, WORLD_SEED } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { ColliderComponent } from "../components/ColliderComponent";
import { DialogueComponent } from "../components/DialogueComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { NpcComponent } from "../components/NpcComponent";
import { PositionComponent } from "../components/PositionComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { CollisionSystem } from "../systems/CollisionSystem";
import { NpcSystem, npcEntityId } from "../systems/NpcSystem";
import { DIALOGUE_DEFINITIONS } from "../dialogue/dialogueDefinitions";
import { NPC_DEFINITIONS, NPC_ROLES, getNpcDefinition } from "../world/NpcCatalogue";
import { isNpcPlaceableTile, resolveNpcTile } from "../world/npcPlacement";
import { composeBlockers, type StructureQuery } from "../world/StructureQuery";
import { TILE_PROPERTIES, TileType } from "../world/Tilemap";
import { WorldManager } from "../world/WorldManager";
import { getTileKey, type TileQuery } from "../world/TileQuery";

/** Tile source backed by an explicit map; everything else is grass. */
class FakeTileQuery implements TileQuery {
  public tiles: Map<string, TileType> = new Map();

  constructor(entries: Array<[number, number, TileType]> = []) {
    for (const [tileX, tileY, tileType] of entries) {
      this.tiles.set(getTileKey(tileX, tileY), tileType);
    }
  }

  getTileAt(tileX: number, tileY: number): TileType {
    return this.tiles.get(getTileKey(tileX, tileY)) ?? TileType.GRASS;
  }

  isWalkableAt(pixelX: number, pixelY: number): boolean {
    return TILE_PROPERTIES[
      this.getTileAt(Math.floor(pixelX / TILE_SIZE), Math.floor(pixelY / TILE_SIZE))
    ].walkable;
  }
}

/** A player-shaped entity standing in the centre of a tile. */
function createTalker(
  tileX: number,
  tileY: number,
  facing: "left" | "right" = "right",
) {
  const interaction = new InteractionComponent(facing);
  const dialogue = new DialogueComponent();
  const entity = new Entity("player")
    .addComponent(
      new PositionComponent(
        tileX * TILE_SIZE + TILE_SIZE / 2,
        tileY * TILE_SIZE + TILE_SIZE / 2,
      ),
    )
    .addComponent(interaction)
    .addComponent(dialogue);

  return { entity, interaction, dialogue };
}

describe("NPC_DEFINITIONS", () => {
  it("should give every NPC a dialogue tree that exists", () => {
    expect(NPC_DEFINITIONS.length).toBe(3);

    for (const definition of NPC_DEFINITIONS) {
      expect(DIALOGUE_DEFINITIONS[definition.dialogueId], definition.id).toBeDefined();
    }
  });

  it("should use unique ids, dialogue trees and textures", () => {
    const ids = NPC_DEFINITIONS.map((definition) => definition.id);
    const dialogueIds = NPC_DEFINITIONS.map((definition) => definition.dialogueId);
    const textures = NPC_DEFINITIONS.map((definition) => definition.textureKey);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(dialogueIds).size).toBe(dialogueIds.length);
    expect(new Set(textures).size).toBe(textures.length);
  });

  it("should name every NPC with an i18n key (decision D8)", () => {
    for (const definition of NPC_DEFINITIONS) {
      expect(definition.nameKey).toMatch(/^npc\.[\w.]+$/);
      expect(definition.nameKey).not.toContain(" ");
    }
  });

  it("should cover the shopkeeper and quest-giver roles", () => {
    expect(NPC_ROLES).toContain("shopkeeper");
    expect(NPC_ROLES).toContain("questgiver");
    expect(NPC_ROLES).toContain("villager");
  });

  it("should look a definition up by id", () => {
    expect(getNpcDefinition("villager_pip")?.dialogueId).toBe("pip_welcome");
    expect(getNpcDefinition("nobody")).toBeUndefined();
  });
});

describe("resolveNpcTile", () => {
  it("should keep an anchor that is already open ground", () => {
    const tileQuery = new FakeTileQuery();

    expect(resolveNpcTile(tileQuery, 4, 4)).toEqual({ tileX: 4, tileY: 4 });
  });

  it("should reject water, caves and unbuildable terrain", () => {
    const tileQuery = new FakeTileQuery([
      [0, 0, TileType.WATER],
      [1, 0, TileType.FOREST],
      [2, 0, TileType.CAVE_FLOOR],
      [3, 0, TileType.ORE],
      [4, 0, TileType.SNOW],
    ]);

    expect(isNpcPlaceableTile(tileQuery, 0, 0)).toBe(false);
    // Walkable but not buildable: a tree stands there
    expect(isNpcPlaceableTile(tileQuery, 1, 0)).toBe(false);
    // Walkable and buildable, but underground
    expect(isNpcPlaceableTile(tileQuery, 2, 0)).toBe(false);
    expect(isNpcPlaceableTile(tileQuery, 3, 0)).toBe(false);
    expect(isNpcPlaceableTile(tileQuery, 4, 0)).toBe(true);
  });

  it("should step to the nearest open tile when the anchor is drowned", () => {
    const tileQuery = new FakeTileQuery([[4, 4, TileType.WATER]]);

    const tile = resolveNpcTile(tileQuery, 4, 4)!;

    expect(tile).not.toEqual({ tileX: 4, tileY: 4 });
    expect(Math.max(Math.abs(tile.tileX - 4), Math.abs(tile.tileY - 4))).toBe(1);
  });

  it("should skip tiles the caller has already taken", () => {
    const tileQuery = new FakeTileQuery();
    const taken = new Set([getTileKey(4, 4)]);

    const tile = resolveNpcTile(tileQuery, 4, 4, undefined, (tileX, tileY) =>
      taken.has(getTileKey(tileX, tileY)),
    )!;

    expect(tile).not.toEqual({ tileX: 4, tileY: 4 });
  });

  it("should give up rather than place an NPC far from its anchor", () => {
    const water = new FakeTileQuery();
    water.getTileAt = () => TileType.WATER;

    expect(resolveNpcTile(water, 0, 0, 3)).toBeNull();
  });

  it("should be deterministic for the real seed", () => {
    const first = resolveNpcTile(new WorldManager(WORLD_SEED, 1), 13, 11);
    const second = resolveNpcTile(new WorldManager(WORLD_SEED, 1), 13, 11);

    expect(first).toEqual(second);
  });
});

describe("NpcSystem placement", () => {
  it("should place every catalogue NPC on a walkable tile for the world seed", () => {
    const worldManager = new WorldManager(WORLD_SEED, 1);
    const spawned: Entity[] = [];
    const system = new NpcSystem(worldManager, (entity) => spawned.push(entity));

    system.update([], 1 / 60);

    expect(spawned).toHaveLength(NPC_DEFINITIONS.length);
    for (const entity of spawned) {
      const npc = entity.getComponent<NpcComponent>("npc")!;
      expect(entity.id, npc.npcId).toBe(npcEntityId(npc.npcId));
      expect(isNpcPlaceableTile(worldManager, npc.tileX, npc.tileY), npc.npcId).toBe(
        true,
      );
      expect(system.getNpcAt(npc.tileX, npc.tileY)).toBe(entity);
    }
  });

  it("should give each NPC its own tile", () => {
    const system = new NpcSystem(new WorldManager(WORLD_SEED, 1), () => undefined);

    system.update([], 1 / 60);

    expect(system.getNpcs().size).toBe(NPC_DEFINITIONS.length);
  });

  it("should place the sprite in the centre of its tile", () => {
    const spawned: Entity[] = [];
    const system = new NpcSystem(new FakeTileQuery(), (entity) => spawned.push(entity));

    system.update([], 1 / 60);

    const npc = spawned[0].getComponent<NpcComponent>("npc")!;
    const position = spawned[0].getComponent<PositionComponent>("position")!;
    expect(position.x).toBe(npc.tileX * TILE_SIZE + TILE_SIZE / 2);
    expect(position.y).toBe(npc.tileY * TILE_SIZE + TILE_SIZE / 2);
    expect(spawned[0].hasComponent("sprite")).toBe(true);
  });

  it("should not spawn the same NPCs twice", () => {
    const spawned: Entity[] = [];
    const system = new NpcSystem(new FakeTileQuery(), (entity) => spawned.push(entity));

    system.update([], 1 / 60);
    system.update([], 1 / 60);
    system.update([], 1 / 60);

    expect(spawned).toHaveLength(NPC_DEFINITIONS.length);
    expect(system.getNpcs().size).toBe(NPC_DEFINITIONS.length);
  });

  it("should skip an NPC with nowhere to stand instead of drowning it", () => {
    const water = new FakeTileQuery();
    water.getTileAt = () => TileType.WATER;
    const spawned: Entity[] = [];
    const system = new NpcSystem(water, (entity) => spawned.push(entity));

    system.update([], 1 / 60);

    expect(spawned).toHaveLength(0);
  });

  it("should require position, interaction and dialogue of a talker", () => {
    const system = new NpcSystem(new FakeTileQuery(), () => undefined);
    const { entity } = createTalker(0, 0);
    const partial = new Entity("prop").addComponent(new PositionComponent(0, 0));

    expect(system.matches(entity)).toBe(true);
    expect(system.matches(partial)).toBe(false);
  });
});

describe("NpcSystem conversations", () => {
  /** Put one NPC on a known tile with a player facing it. */
  function createHarness() {
    const tileQuery = new FakeTileQuery();
    const system = new NpcSystem(tileQuery, () => undefined, [
      {
        id: "villager_pip",
        nameKey: "npc.pip.name",
        dialogueId: "pip_welcome",
        anchorTileX: 5,
        anchorTileY: 4,
        textureKey: "npc_villager",
        role: "villager",
      },
    ]);
    const talker = createTalker(4, 4, "right");

    return { ...talker, system, tileQuery };
  }

  it("should open the faced NPC's dialogue at its root", () => {
    const { entity, interaction, dialogue, system } = createHarness();

    interaction.interactRequested = true;
    system.update([entity], 1 / 60);

    expect(dialogue.activeNpcId).toBe("villager_pip");
    expect(dialogue.dialogueId).toBe("pip_welcome");
    expect(dialogue.nodeId).toBe(DIALOGUE_DEFINITIONS.pip_welcome.rootNodeId);
    expect(dialogue.version).toBe(1);
    // The NPC absorbed the interact, so planting never sees it
    expect(interaction.interactRequested).toBe(false);
  });

  it("should leave an interact aimed at empty ground for the other systems", () => {
    const { entity, interaction, dialogue, system } = createHarness();
    interaction.facing = "left";

    interaction.interactRequested = true;
    system.update([entity], 1 / 60);

    expect(dialogue.activeNpcId).toBeNull();
    expect(interaction.interactRequested).toBe(true);
  });

  it("should advance an open conversation on a second interact", () => {
    const { entity, interaction, dialogue, system } = createHarness();

    interaction.interactRequested = true;
    system.update([entity], 1 / 60);
    interaction.interactRequested = true;
    system.update([entity], 1 / 60);

    expect(dialogue.nodeId).toBe("tips");
    expect(dialogue.version).toBe(2);
  });

  it("should consume the option the HUD requested", () => {
    const { entity, interaction, dialogue, system } = createHarness();
    interaction.interactRequested = true;
    system.update([entity], 1 / 60);

    dialogue.requestedOption = 0;
    system.update([entity], 1 / 60);

    expect(dialogue.nodeId).toBe("tips");
    expect(dialogue.requestedOption).toBeNull();
  });

  it("should end the conversation the HUD asked to close", () => {
    const { entity, interaction, dialogue, system } = createHarness();
    interaction.interactRequested = true;
    system.update([entity], 1 / 60);

    dialogue.closeRequested = true;
    system.update([entity], 1 / 60);

    expect(dialogue.activeNpcId).toBeNull();
    expect(dialogue.nodeId).toBeNull();
    expect(dialogue.closeRequested).toBe(false);
  });

  it("should end the conversation through the goodbye option", () => {
    const { entity, interaction, dialogue, system } = createHarness();
    interaction.interactRequested = true;
    system.update([entity], 1 / 60);

    dialogue.requestedOption = 1; // the goodbye
    system.update([entity], 1 / 60);

    expect(dialogue.activeNpcId).toBeNull();
  });

  it("should do nothing at all without an interaction request", () => {
    const { entity, dialogue, system } = createHarness();

    system.update([entity], 1 / 60);

    expect(dialogue.version).toBe(0);
  });
});

describe("composeBlockers", () => {
  const emptyQuery: StructureQuery = {
    hasStructureAt: () => false,
    isBlockedByStructure: () => false,
  };

  it("should report blocked when either source does", () => {
    const npcSystem = new NpcSystem(new FakeTileQuery(), () => undefined);
    npcSystem.update([], 1 / 60);
    const [key] = npcSystem.getNpcs().keys();
    const [tileX, tileY] = key.split(",").map(Number);

    const composed = composeBlockers(emptyQuery, npcSystem);

    expect(composed.hasStructureAt(tileX, tileY)).toBe(true);
    expect(composed.isBlockedByStructure(tileX, tileY)).toBe(true);
    expect(composed.hasStructureAt(tileX + 100, tileY)).toBe(false);
    expect(composed.isBlockedByStructure(tileX + 100, tileY)).toBe(false);
  });

  it("should block nothing when composed of nothing", () => {
    const composed = composeBlockers();

    expect(composed.hasStructureAt(0, 0)).toBe(false);
    expect(composed.isBlockedByStructure(0, 0)).toBe(false);
  });
});

describe("CollisionSystem with NPCs", () => {
  it("should veto movement into an NPC", () => {
    const tileQuery = new FakeTileQuery();
    const npcSystem = new NpcSystem(tileQuery, () => undefined, [
      {
        id: "villager_pip",
        nameKey: "npc.pip.name",
        dialogueId: "pip_welcome",
        anchorTileX: 5,
        anchorTileY: 4,
        textureKey: "npc_villager",
        role: "villager",
      },
    ]);
    npcSystem.update([], 1 / 60);

    const collision = new CollisionSystem(tileQuery, composeBlockers(npcSystem));
    const velocity = new VelocityComponent(600, 0);
    const walker = new Entity("walker")
      .addComponent(
        new PositionComponent(
          4 * TILE_SIZE + TILE_SIZE / 2,
          4 * TILE_SIZE + TILE_SIZE / 2,
        ),
      )
      .addComponent(velocity)
      .addComponent(new ColliderComponent(24, 24));

    collision.update([walker], 1 / 60);

    expect(velocity.vx).toBe(0);
  });
});
