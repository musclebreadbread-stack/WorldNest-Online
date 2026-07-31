import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLayerTileKey, TileType, WorldLayer } from "@worldnest/game-engine";

const database = vi.hoisted(() => ({
  getDefaultWorld: vi.fn(),
  loadPlayerState: vi.fn(),
  loadQuests: vi.fn(),
  loadWorldModifications: vi.fn(),
  loadStructures: vi.fn(),
  loadCrops: vi.fn(),
}));

vi.mock("@worldnest/database", () => database);

import { loadSession } from "../game/loadSession";

describe("loadSession layered terrain", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    database.getDefaultWorld.mockResolvedValue({
      data: { id: "world-1", name: "Default World", seed: 42 },
      error: null,
    });
    database.loadPlayerState.mockResolvedValue({ data: null, error: null });
    database.loadQuests.mockResolvedValue({ data: [], error: null });
    database.loadStructures.mockResolvedValue({ data: [], error: null });
    database.loadCrops.mockResolvedValue({ data: [], error: null });
  });

  it("should restore the same coordinates independently on both layers", async () => {
    database.loadWorldModifications.mockResolvedValue({
      data: [
        {
          world_id: "world-1",
          layer: WorldLayer.SURFACE,
          tile_x: 17,
          tile_y: 23,
          tile_type: TileType.FARMLAND,
          modified_by: null,
          updated_at: "2025-01-01T00:00:00.000Z",
        },
        {
          world_id: "world-1",
          layer: WorldLayer.UNDERGROUND,
          tile_x: 17,
          tile_y: 23,
          tile_type: TileType.CAVE_FLOOR,
          modified_by: null,
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const snapshot = await loadSession("user-1");

    expect(snapshot?.savedWorld.tileOverrides).toEqual([
      [
        getLayerTileKey(WorldLayer.SURFACE, 17, 23),
        TileType.FARMLAND,
      ],
      [
        getLayerTileKey(WorldLayer.UNDERGROUND, 17, 23),
        TileType.CAVE_FLOOR,
      ],
    ]);
    expect(snapshot).not.toHaveProperty("layer");
  });
});
