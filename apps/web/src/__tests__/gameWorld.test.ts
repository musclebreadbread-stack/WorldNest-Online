import { describe, it, expect } from "vitest";
import {
  ColliderComponent,
  CROP_DEFINITIONS,
  InputComponent,
  PositionComponent,
  QUEST_DEFINITIONS,
  TILE_PROPERTIES,
  TileType,
  WorldLayer,
  WorldManager,
  sampleMinimap,
  addItem,
  countItem,
  cropEntityId,
  npcEntityId,
  selectSlot,
  structureEntityId,
} from "@worldnest/game-engine";
import type {
  AnimationComponent,
  CropComponent,
  DialogueComponent,
  Entity,
  Facing,
  InteractionComponent,
  InventoryComponent,
  NpcComponent,
  QuestComponent,
  RemoteInterpolationComponent,
  StatsComponent,
  WalletComponent,
} from "@worldnest/game-engine";
import { STARTING_COINS, TILE_SIZE, WORLD_SEED } from "@worldnest/shared";
import {
  createGameWorld,
  createRemotePlayerEntity,
  remotePlayerEntityId,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
  LOCAL_PLAYER_ENTITY_ID,
  STARTING_WHEAT_SEEDS,
} from "../game/createGameWorld";
import {
  findAnyWalkableNeighbourOf,
  findFacingPair,
  findWalkableNeighbourOf,
} from "./helpers/terrain";
import { filterRenderDataForLayer, isActiveLayerChange } from "../game/layerVisibility";

const BOOTSTRAP = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
};

/**
 * The registration order documented in `docs/ARCHITECTURE.md`, "System Execution
 * Order". Insertion order is execution order and several positions are
 * load-bearing, so the guide and the code are pinned to each other here: change
 * one without the other and this test fails.
 */
const DOCUMENTED_SYSTEM_ORDER = [
  "time",
  "environment",
  "input",
  "collision",
  "movement",
  "chunk",
  "interpolation",
  "stats",
  "npc",
  "shop",
  "quest",
  "layer",
  "plant",
  "cropGrowth",
  "build",
  "harvest",
  "networkSync",
  "animation",
  "render",
  "accessibility",
];

describe("createGameWorld", () => {
  it("should register its systems in the order the architecture guide documents", () => {
    const context = createGameWorld(BOOTSTRAP);

    expect(Object.keys(context.systems)).toEqual(DOCUMENTED_SYSTEM_ORDER);
  });

  it("should build a local player entity from the bootstrap identity", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const position = playerEntity.getComponent<PositionComponent>("position")!;

    expect(playerEntity.id).toBe(LOCAL_PLAYER_ENTITY_ID);
    expect(position.x).toBe(DEFAULT_SPAWN_X);
    expect(position.y).toBe(DEFAULT_SPAWN_Y);
    expect(playerEntity.hasComponent("collider")).toBe(true);
  });

  it("should spawn the player on a walkable surface tile, never in a cave", () => {
    const worldManager = new WorldManager(WORLD_SEED, 1);
    const tileType = worldManager.getTileAt(
      Math.floor(DEFAULT_SPAWN_X / TILE_SIZE),
      Math.floor(DEFAULT_SPAWN_Y / TILE_SIZE),
    );

    expect(TILE_PROPERTIES[tileType].walkable).toBe(true);
    // Biomes and caves moved the terrain; the spawn constant has to survive it
    expect([TileType.CAVE_FLOOR, TileType.CAVE_WALL, TileType.ORE]).not.toContain(
      tileType,
    );
  });

  it("should stop the player at the water's edge instead of walking through", () => {
    // A walkable shore tile with water immediately to its west, found rather
    // than hard-coded so generator changes cannot invalidate the test
    const shore = findWalkableNeighbourOf(
      new WorldManager(WORLD_SEED, 1),
      TileType.WATER,
    );
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: shore.spawnX,
      spawnY: shore.spawnY,
    });
    const position = context.playerEntity.getComponent<PositionComponent>("position")!;
    const input = context.playerEntity.getComponent<InputComponent>("input")!;
    const collider = context.playerEntity.getComponent<ColliderComponent>("collider")!;

    expect(
      context.worldManager.isWalkableAt(
        shore.targetTileX * TILE_SIZE + 1,
        shore.targetTileY * TILE_SIZE + 1,
      ),
    ).toBe(false);

    input.keys.left = true;
    for (let frame = 0; frame < 120; frame++) {
      context.world.update(1 / 60);
    }

    // The collider's left edge never crosses into the water tile
    expect(position.x - collider.width / 2).toBeGreaterThanOrEqual(
      shore.standTileX * TILE_SIZE,
    );
  });
});

describe("active world layer", () => {
  it("should descend through an entrance and sample underground cave tiles", () => {
    const entrance = findAnyWalkableNeighbourOf(
      new WorldManager(WORLD_SEED, 1),
      TileType.CAVE_ENTRANCE,
    );
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: entrance.spawnX,
      spawnY: entrance.spawnY,
    });
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;
    const surface = sampleMinimap(
      context.worldManager,
      entrance.standTileX,
      entrance.standTileY,
      2,
    );

    interaction.facing = entrance.facing;
    interaction.interactRequested = true;
    context.world.update(0);

    expect(context.worldManager.getLayer()).toBe(WorldLayer.UNDERGROUND);
    const underground = sampleMinimap(
      context.worldManager,
      entrance.standTileX,
      entrance.standTileY,
      2,
    );
    expect(underground.tiles).not.toEqual(surface.tiles);
    expect(
      underground.tiles.every((tile) =>
        [
          TileType.CAVE_FLOOR,
          TileType.CAVE_WALL,
          TileType.ORE,
          TileType.CAVE_ENTRANCE,
        ].includes(tile),
      ),
    ).toBe(true);
  });

  it("should filter sprites and name-tag data down to the local player", () => {
    const context = createGameWorld(BOOTSTRAP);
    context.world.addEntity(
      createRemotePlayerEntity("remote", "Remote", DEFAULT_SPAWN_X, DEFAULT_SPAWN_Y),
    );
    context.world.update(0);

    const surface = filterRenderDataForLayer(
      context.systems.render.renderData,
      context.world,
      WorldLayer.SURFACE,
    );
    const underground = filterRenderDataForLayer(
      context.systems.render.renderData,
      context.world,
      WorldLayer.UNDERGROUND,
    );

    expect(surface.length).toBeGreaterThan(underground.length);
    expect(underground.map((data) => data.entityId)).toEqual([LOCAL_PLAYER_ENTITY_ID]);
  });

  it("should accept repaint callbacks only for the active layer", () => {
    expect(isActiveLayerChange(WorldLayer.SURFACE, WorldLayer.SURFACE)).toBe(true);
    expect(isActiveLayerChange(WorldLayer.SURFACE, WorldLayer.UNDERGROUND)).toBe(false);
  });
});

describe("harvest wiring", () => {
  // A grass tile with stone immediately to its east, searched for by seed
  const STONE_PAIR = findFacingPair(
    new WorldManager(WORLD_SEED, 1),
    TileType.GRASS,
    TileType.STONE,
    "right",
  );
  const STAND_TILE_Y = STONE_PAIR.standTileY;
  const TARGET_TILE_X = STONE_PAIR.targetTileX;

  function createWorldFacingStone() {
    return createGameWorld({
      ...BOOTSTRAP,
      spawnX: STONE_PAIR.spawnX,
      spawnY: STONE_PAIR.spawnY,
    });
  }

  it("should harvest the faced tile into the inventory and grass it over", () => {
    const context = createWorldFacingStone();
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;
    const stats = context.playerEntity.getComponent<StatsComponent>("stats")!;
    const repainted: Array<[number, number, TileType]> = [];
    context.worldManager.setTileChangeCallback((_layer, tileX, tileY, tileType) =>
      repainted.push([tileX, tileY, tileType]),
    );

    expect(context.worldManager.getTileAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      TileType.STONE,
    );

    interaction.facing = "right";
    interaction.interactRequested = true;
    context.world.update(1 / 60);

    // Slot 0 holds the starting seeds, so the yield lands in the next free slot
    expect(inventory.slots[1]).toEqual({ itemId: "stone", quantity: 1 });
    expect(context.worldManager.getTileAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      TileType.GRASS,
    );
    expect(stats.energy).toBeLessThan(stats.maxEnergy);
    // The change is announced so ChunkRenderer can repaint just that tile
    expect(repainted).toEqual([[TARGET_TILE_X, STAND_TILE_Y, TileType.GRASS]]);
    expect(interaction.interactRequested).toBe(false);
  });

  it("should leave the world untouched without an interaction request", () => {
    const context = createWorldFacingStone();
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;

    context.world.update(1 / 60);

    expect(inventory.slots.slice(1).every((slot) => slot === null)).toBe(true);
    expect(context.worldManager.getTileOverrides().size).toBe(0);
  });
});

describe("farming wiring", () => {
  // A grass tile with grass to its west, searched for by seed
  const GRASS_PAIR = findFacingPair(
    new WorldManager(WORLD_SEED, 1),
    TileType.GRASS,
    TileType.GRASS,
    "left",
  );
  const STAND_TILE_Y = GRASS_PAIR.standTileY;
  const TARGET_TILE_X = GRASS_PAIR.targetTileX;

  function createWorldFacingGrass() {
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: GRASS_PAIR.spawnX,
      spawnY: GRASS_PAIR.spawnY,
    });
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;
    interaction.facing = "left";
    return { context, interaction };
  }

  it("should start the player with wheat seeds selected", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const inventory = playerEntity.getComponent<InventoryComponent>("inventory")!;

    expect(inventory.slots[0]).toEqual({
      itemId: "wheat_seed",
      quantity: STARTING_WHEAT_SEEDS,
    });
    expect(inventory.selectedSlot).toBe(0);
  });

  it("should till grass, then sow a crop entity on the farmland", () => {
    const { context, interaction } = createWorldFacingGrass();
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;

    expect(context.worldManager.getTileAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      TileType.GRASS,
    );

    // First interact tills the faced tile without spending a seed
    interaction.interactRequested = true;
    context.world.update(1 / 60);

    expect(context.worldManager.getTileAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      TileType.FARMLAND,
    );
    expect(inventory.slots[0]).toEqual({
      itemId: "wheat_seed",
      quantity: STARTING_WHEAT_SEEDS,
    });

    // The second one sows it
    interaction.interactRequested = true;
    context.world.update(1 / 60);

    const cropEntity = context.world.getEntity(
      cropEntityId(TARGET_TILE_X, STAND_TILE_Y),
    );
    expect(cropEntity).toBeDefined();
    expect(inventory.slots[0]).toEqual({
      itemId: "wheat_seed",
      quantity: STARTING_WHEAT_SEEDS - 1,
    });
    expect(context.systems.plant.getCropAt(TARGET_TILE_X, STAND_TILE_Y)).toBe(
      cropEntity,
    );
  });

  it("should grow the crop off the world clock and yield produce when mature", () => {
    const { context, interaction } = createWorldFacingGrass();
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;

    interaction.interactRequested = true;
    context.world.update(1 / 60);
    interaction.interactRequested = true;
    context.world.update(1 / 60);

    const cropEntity = context.world.getEntity(
      cropEntityId(TARGET_TILE_X, STAND_TILE_Y),
    )!;
    const crop = cropEntity.getComponent<CropComponent>("crop")!;

    // The clock is derived from wall time, so maturity is faked by back-dating
    crop.plantedAtMinute -= crop.minutesPerStage * crop.stageCount;
    context.world.update(1 / 60);
    expect(crop.stage).toBe(crop.stageCount - 1);

    interaction.interactRequested = true;
    context.world.update(1 / 60);

    expect(
      context.world.getEntity(cropEntityId(TARGET_TILE_X, STAND_TILE_Y)),
    ).toBeUndefined();
    expect(countItem(inventory, "wheat")).toBe(
      CROP_DEFINITIONS.wheat_seed!.produceQuantity,
    );
  });
});

describe("building wiring", () => {
  // A grass tile with grass to its west, searched for by seed
  const BUILD_PAIR = findFacingPair(
    new WorldManager(WORLD_SEED, 1),
    TileType.GRASS,
    TileType.GRASS,
    "left",
  );
  const STAND_TILE_X = BUILD_PAIR.standTileX;
  const STAND_TILE_Y = BUILD_PAIR.standTileY;
  const TARGET_TILE_X = BUILD_PAIR.targetTileX;

  function createWorldWithFences() {
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: BUILD_PAIR.spawnX,
      spawnY: BUILD_PAIR.spawnY,
    });
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;

    addItem(inventory, "fence", 2);
    selectSlot(inventory, 1);
    interaction.facing = "left";

    return { context, inventory, interaction };
  }

  it("should place a fence on the faced tile and consume one item", () => {
    const { context, inventory, interaction } = createWorldWithFences();

    interaction.buildRequested = true;
    context.world.update(1 / 60);

    expect(
      context.world.getEntity(structureEntityId(TARGET_TILE_X, STAND_TILE_Y)),
    ).toBeDefined();
    expect(countItem(inventory, "fence")).toBe(1);
    expect(interaction.buildRequested).toBe(false);
  });

  it("should stop the player from walking through a placed fence", () => {
    const { context, interaction } = createWorldWithFences();
    const position = context.playerEntity.getComponent<PositionComponent>("position")!;
    const input = context.playerEntity.getComponent<InputComponent>("input")!;
    const collider = context.playerEntity.getComponent<ColliderComponent>("collider")!;

    interaction.buildRequested = true;
    context.world.update(1 / 60);

    input.keys.left = true;
    for (let frame = 0; frame < 120; frame++) {
      context.world.update(1 / 60);
    }

    expect(position.x - collider.width / 2).toBeGreaterThanOrEqual(
      STAND_TILE_X * TILE_SIZE,
    );
  });
});

describe("NPC wiring", () => {
  /**
   * An NPC with open ground immediately to its west, so a player standing there
   * faces it by looking right. Searched rather than hard-coded: NPC tiles come
   * from a spiral search over generated terrain, so they move when it does.
   */
  function findApproachableNpc() {
    const probe = createGameWorld(BOOTSTRAP);
    probe.world.update(1 / 60);

    for (const npcEntity of probe.systems.npc.getNpcs().values()) {
      const npc = (npcEntity as Entity).getComponent<NpcComponent>("npc")!;
      const standTileX = npc.tileX - 1;
      if (probe.systems.npc.getNpcAt(standTileX, npc.tileY)) continue;
      const standTile = probe.worldManager.getTileAt(standTileX, npc.tileY);
      if (!TILE_PROPERTIES[standTile].walkable) continue;

      return {
        npcId: npc.npcId,
        dialogueId: npc.dialogueId,
        npcTileX: npc.tileX,
        npcTileY: npc.tileY,
        standTileX,
        spawnX: standTileX * TILE_SIZE + TILE_SIZE / 2,
        spawnY: npc.tileY * TILE_SIZE + TILE_SIZE / 2,
      };
    }

    throw new Error("no NPC with a walkable tile to its west");
  }

  const NPC = findApproachableNpc();

  function createWorldFacingNpc() {
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: NPC.spawnX,
      spawnY: NPC.spawnY,
    });
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;
    interaction.facing = "right";

    return { context, interaction };
  }

  it("should place every NPC on the tile the engine resolved for it", () => {
    const context = createGameWorld(BOOTSTRAP);

    context.world.update(1 / 60);

    expect(context.systems.npc.getNpcs().size).toBeGreaterThan(0);
    expect(context.world.getEntity(npcEntityId(NPC.npcId))).toBeDefined();
  });

  it("should open dialogue on an interact aimed at an NPC, and till nothing", () => {
    const { context, interaction } = createWorldFacingNpc();
    const dialogue = context.playerEntity.getComponent<DialogueComponent>("dialogue")!;

    interaction.interactRequested = true;
    context.world.update(1 / 60);

    expect(dialogue.activeNpcId).toBe(NPC.npcId);
    expect(dialogue.dialogueId).toBe(NPC.dialogueId);
    expect(dialogue.nodeId).not.toBeNull();
    // NpcSystem runs before PlantSystem and consumed the request, so the tile
    // the NPC is standing on was never ploughed
    expect(context.worldManager.getTileOverrides().size).toBe(0);
    expect(context.worldManager.getTileAt(NPC.npcTileX, NPC.npcTileY)).not.toBe(
      TileType.FARMLAND,
    );
    expect(interaction.interactRequested).toBe(false);
  });

  it("should advance the conversation from the option the HUD requests", () => {
    const { context, interaction } = createWorldFacingNpc();
    const dialogue = context.playerEntity.getComponent<DialogueComponent>("dialogue")!;

    interaction.interactRequested = true;
    context.world.update(1 / 60);
    const rootNodeId = dialogue.nodeId;

    dialogue.requestedOption = 0;
    context.world.update(1 / 60);

    expect(dialogue.nodeId).not.toBe(rootNodeId);
    expect(dialogue.requestedOption).toBeNull();
    expect(dialogue.version).toBe(2);
  });

  it("should refuse to place a structure on an NPC's tile", () => {
    const { context, interaction } = createWorldFacingNpc();
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;
    addItem(inventory, "fence", 1);
    selectSlot(inventory, 1);

    interaction.buildRequested = true;
    context.world.update(1 / 60);

    // BuildSystem takes the NPC index as a second occupancy source, so the
    // fence is refused and the item is not spent
    expect(
      context.world.getEntity(structureEntityId(NPC.npcTileX, NPC.npcTileY)),
    ).toBeUndefined();
    expect(countItem(inventory, "fence")).toBe(1);
  });

  it("should stop the player from walking onto an NPC's tile", () => {
    const { context } = createWorldFacingNpc();
    const position = context.playerEntity.getComponent<PositionComponent>("position")!;
    const input = context.playerEntity.getComponent<InputComponent>("input")!;
    const collider = context.playerEntity.getComponent<ColliderComponent>("collider")!;

    input.keys.right = true;
    for (let frame = 0; frame < 120; frame++) {
      context.world.update(1 / 60);
    }

    expect(position.x + collider.width / 2).toBeLessThanOrEqual(
      NPC.npcTileX * TILE_SIZE,
    );
  });
});

describe("quest wiring", () => {
  /**
   * Stand next to a named NPC, facing them. Their tile comes from a spiral search
   * over generated terrain, so it is searched for rather than written down, and
   * any of the four neighbours will do.
   */
  function approachTo(npcId: string) {
    const probe = createGameWorld(BOOTSTRAP);
    probe.world.update(1 / 60);

    const npcEntity = probe.world.getEntity(npcEntityId(npcId));
    if (!npcEntity) throw new Error(`${npcId} was never placed`);
    const npc = npcEntity.getComponent<NpcComponent>("npc")!;

    const neighbours: Array<[number, number, Facing]> = [
      [-1, 0, "right"],
      [1, 0, "left"],
      [0, -1, "down"],
      [0, 1, "up"],
    ];

    for (const [dx, dy, facing] of neighbours) {
      const tileX = npc.tileX + dx;
      const tileY = npc.tileY + dy;
      if (probe.systems.npc.getNpcAt(tileX, tileY)) continue;
      if (!TILE_PROPERTIES[probe.worldManager.getTileAt(tileX, tileY)].walkable)
        continue;

      return {
        facing,
        spawnX: tileX * TILE_SIZE + TILE_SIZE / 2,
        spawnY: tileY * TILE_SIZE + TILE_SIZE / 2,
      };
    }

    throw new Error(`no walkable tile beside ${npcId}`);
  }

  it("should run a whole quest from the giver's dialogue to the reward", () => {
    const approach = approachTo("questgiver_ada");
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: approach.spawnX,
      spawnY: approach.spawnY,
    });
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;
    const dialogue = context.playerEntity.getComponent<DialogueComponent>("dialogue")!;
    const quest = context.playerEntity.getComponent<QuestComponent>("quest")!;
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;
    const wallet = context.playerEntity.getComponent<WalletComponent>("wallet")!;
    interaction.facing = approach.facing;

    // Walk up and press E: Ada starts talking
    interaction.interactRequested = true;
    context.world.update(1 / 60);
    expect(dialogue.activeNpcId).toBe("questgiver_ada");

    // Taking the quest on is a request, exactly as the dialogue action raises it
    quest.requestedOffer = "collect_wood";
    context.world.update(1 / 60);
    expect(quest.entries.collect_wood).toEqual({
      state: "active",
      progress: 0,
      baseline: 0,
    });

    // Progress is polled off the inventory, so gathering is all it takes
    addItem(inventory, "wood", 5);
    context.world.update(1 / 60);
    expect(quest.entries.collect_wood.progress).toBe(5);

    const rewards = QUEST_DEFINITIONS.collect_wood.rewards;
    const seedReward = rewards.items[0];
    quest.requestedTurnIn = "collect_wood";
    context.world.update(1 / 60);

    expect(quest.entries.collect_wood.state).toBe("completed");
    expect(wallet.coins).toBe(STARTING_COINS + rewards.coins);
    expect(countItem(inventory, seedReward.itemId)).toBe(
      STARTING_WHEAT_SEEDS + seedReward.quantity,
    );
    expect(quest.refusals).toBe(0);
  });

  it("should finish a talk objective by actually going and talking", () => {
    const approach = approachTo("villager_pip");
    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: approach.spawnX,
      spawnY: approach.spawnY,
    });
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;
    const quest = context.playerEntity.getComponent<QuestComponent>("quest")!;
    interaction.facing = approach.facing;

    quest.requestedOffer = "greet_pip";
    context.world.update(1 / 60);
    expect(quest.entries.greet_pip.progress).toBe(0);

    // NpcSystem reports the greeting and QuestSystem, one system later, records it
    interaction.interactRequested = true;
    context.world.update(1 / 60);

    expect(quest.entries.greet_pip.progress).toBe(1);
  });

  it("should refuse a hand-in whose objective is not met, and keep the quest", () => {
    const context = createGameWorld(BOOTSTRAP);
    const quest = context.playerEntity.getComponent<QuestComponent>("quest")!;
    const wallet = context.playerEntity.getComponent<WalletComponent>("wallet")!;

    quest.requestedOffer = "collect_wood";
    quest.requestedTurnIn = "collect_wood";
    context.world.update(1 / 60);

    expect(quest.entries.collect_wood.state).toBe("active");
    expect(wallet.coins).toBe(STARTING_COINS);
    expect(quest.refusals).toBe(1);
  });
});

describe("animation wiring", () => {
  it("should walk the player animation in the direction it is moving", () => {
    const context = createGameWorld(BOOTSTRAP);
    const input = context.playerEntity.getComponent<InputComponent>("input")!;
    const animation =
      context.playerEntity.getComponent<AnimationComponent>("animation")!;

    expect(animation.state).toBe("idle");

    input.keys.left = true;
    context.world.update(1 / 60);

    expect(animation.state).toBe("walk");
    expect(animation.direction).toBe("left");

    input.keys.left = false;
    context.world.update(1 / 60);

    expect(animation.state).toBe("idle");
    expect(animation.direction).toBe("left");
  });

  it("should animate remote players without a velocity component", () => {
    const context = createGameWorld(BOOTSTRAP);
    const entity = createRemotePlayerEntity("remote-1", "Friend", 0, 0);
    context.world.addEntity(entity);

    const interpolation =
      entity.getComponent<RemoteInterpolationComponent>("remoteInterpolation")!;
    interpolation.targetX = 1000;

    // A velocity component would let MovementSystem fight the interpolation
    expect(entity.hasComponent("velocity")).toBe(false);

    context.world.update(1 / 60);

    const animation = entity.getComponent<AnimationComponent>("animation")!;
    expect(animation.state).toBe("walk");
    expect(animation.direction).toBe("right");
  });
});

describe("createRemotePlayerEntity", () => {
  it("should create a smoothed, non-local player entity", () => {
    const entity = createRemotePlayerEntity("remote-1", "Friend", 10, 20);

    expect(entity.id).toBe(remotePlayerEntityId("remote-1"));
    expect(entity.hasComponent("remoteInterpolation")).toBe(true);
    expect(entity.hasComponent("animation")).toBe(true);
    expect(entity.hasComponent("input")).toBe(false);
  });
});
