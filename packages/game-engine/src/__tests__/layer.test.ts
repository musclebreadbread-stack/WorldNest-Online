import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "@worldnest/shared";
import { InteractionComponent } from "../components/InteractionComponent";
import { PositionComponent } from "../components/PositionComponent";
import { Entity } from "../ecs/Entity";
import { LayerSystem } from "../systems/LayerSystem";
import { layerGuardedBlockers, type StructureQuery } from "../world/StructureQuery";
import { TileType } from "../world/Tilemap";
import type { TileQuery } from "../world/TileQuery";
import { WorldLayer } from "../world/WorldLayer";

function createHarness(target: TileType) {
  let layer = WorldLayer.SURFACE;
  const tileQuery: TileQuery = {
    getTileAt: () => target,
    isWalkableAt: () => true,
  };
  const interaction = new InteractionComponent("right");
  const entity = new Entity("player")
    .addComponent(new PositionComponent(TILE_SIZE / 2, TILE_SIZE / 2))
    .addComponent(interaction);
  const system = new LayerSystem(
    tileQuery,
    () => layer,
    (nextLayer) => {
      layer = nextLayer;
    },
  );

  return { entity, interaction, system, getLayer: () => layer };
}

describe("LayerSystem", () => {
  it("toggles down and back up through a cave entrance", () => {
    const harness = createHarness(TileType.CAVE_ENTRANCE);

    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 0);
    expect(harness.getLayer()).toBe(WorldLayer.UNDERGROUND);
    expect(harness.interaction.interactRequested).toBe(false);

    harness.interaction.interactRequested = true;
    harness.system.update([harness.entity], 0);
    expect(harness.getLayer()).toBe(WorldLayer.SURFACE);
    expect(harness.interaction.interactRequested).toBe(false);
  });

  it("preserves an ignored request for later interaction systems", () => {
    const harness = createHarness(TileType.GRASS);
    harness.interaction.interactRequested = true;

    harness.system.update([harness.entity], 0);

    expect(harness.getLayer()).toBe(WorldLayer.SURFACE);
    expect(harness.interaction.interactRequested).toBe(true);
  });
});

describe("layerGuardedBlockers", () => {
  it("reports surface occupancy only on the surface", () => {
    let layer = WorldLayer.SURFACE;
    const occupied: StructureQuery = {
      hasStructureAt: () => true,
      isBlockedByStructure: () => true,
    };
    const guarded = layerGuardedBlockers(() => layer, occupied);

    expect(guarded.hasStructureAt(1, 2)).toBe(true);
    expect(guarded.isBlockedByStructure(1, 2)).toBe(true);

    layer = WorldLayer.UNDERGROUND;
    expect(guarded.hasStructureAt(1, 2)).toBe(false);
    expect(guarded.isBlockedByStructure(1, 2)).toBe(false);
  });
});
