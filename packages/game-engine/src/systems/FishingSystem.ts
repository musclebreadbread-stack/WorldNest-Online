import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { PositionComponent } from "../components/PositionComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { StatsComponent } from "../components/StatsComponent";
import { FishingComponent } from "../components/FishingComponent";
import { addItem, hasSpaceFor } from "../inventory/inventoryOps";
import { getFacedTile } from "../interaction/facing";
import {
  canFish,
  FISHING_ENERGY_COST,
  randomBiteTime,
  reelIn,
  rollCatch,
  tickFishing,
} from "../fishing";
import type { TileQuery } from "../world/TileQuery";
import { TileType } from "../world/Tilemap";
import type { Biome } from "../world/Biomes";

/** Returns the biome at the given tile coordinates. */
export type BiomeAtTile = (tileX: number, tileY: number) => Biome;

/** Returns a random number in [0, 1). */
export type RngFn = () => number;

/**
 * FishingSystem processes the fishing state machine for entities.
 *
 * On an interact request while holding a fishing rod and facing water:
 * - Deducts energy and starts casting
 * - Advances timer through waiting -> biting states
 * - On a second interact during the biting window: rolls the catch, checks
 *   inventory space, and awards the fish item
 * - On timeout: marks as missed and resets
 *
 * The catch is rolled at reel-time (not cast-time) so the specific item is
 * determined only when the player successfully acts, and the inventory space
 * check is precise for the actual catch type.
 */
export class FishingSystem extends System {
  private tileQuery: TileQuery;
  private biomeAtTile: BiomeAtTile;
  private rng: RngFn;

  constructor(tileQuery: TileQuery, biomeAtTile: BiomeAtTile, rng?: RngFn) {
    super(["position", "interaction", "inventory", "stats", "fishing"]);
    this.tileQuery = tileQuery;
    this.biomeAtTile = biomeAtTile;
    this.rng = rng ?? Math.random;
  }

  update(entities: Entity[], deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    for (const entity of entities) {
      const fishing = entity.getComponent<FishingComponent>("fishing")!;
      const interaction = entity.getComponent<InteractionComponent>("interaction")!;

      if (interaction.interactRequested) {
        this.handleInteraction(entity, fishing, interaction);
      }

      // Advance timer for active fishing states
      if (fishing.state === "waiting" || fishing.state === "biting") {
        const result = tickFishing(
          fishing.state,
          fishing.timer,
          deltaMs,
          fishing.biteTime,
        );
        if (result.state !== fishing.state) {
          fishing.version++;
        }
        fishing.state = result.state;
        fishing.timer = result.timer;
      }

      // Reset terminal states back to idle after one frame
      if (fishing.state === "caught" || fishing.state === "missed") {
        fishing.state = "idle";
        fishing.timer = 0;
        fishing.catchItemId = null;
        fishing.version++;
      }
    }
  }

  private handleInteraction(
    entity: Entity,
    fishing: FishingComponent,
    interaction: InteractionComponent,
  ): void {
    const position = entity.getComponent<PositionComponent>("position")!;
    const inventory = entity.getComponent<InventoryComponent>("inventory")!;
    const stats = entity.getComponent<StatsComponent>("stats")!;
    const { tileX, tileY } = getFacedTile(position.x, position.y, interaction.facing);
    const facedTile = this.tileQuery.getTileAt(tileX, tileY);

    // If not facing water, this system does not consume the interaction
    if (facedTile !== TileType.WATER) return;

    // Consume the interaction request since we are facing water
    interaction.interactRequested = false;

    if (fishing.state === "idle" || fishing.state === "casting") {
      // Attempt to start fishing
      if (!canFish(inventory, stats, facedTile)) return;

      // Deduct energy and begin casting
      stats.energy -= FISHING_ENERGY_COST;

      const biome = this.biomeAtTile(tileX, tileY);
      fishing.state = "waiting";
      fishing.timer = 0;
      fishing.biteTime = randomBiteTime(this.rng());
      // Store biome for catch roll at reel-time
      fishing.catchBiome = biome;
      fishing.catchItemId = null;
      fishing.version++;
    } else if (fishing.state === "waiting" || fishing.state === "biting") {
      // Attempt to reel in
      const result = reelIn(fishing.state, fishing.timer);

      if (result === "success" && fishing.catchBiome !== null) {
        // Roll the catch at reel-time so the outcome is determined only when
        // the player acts and the space check is precise for the actual item.
        const catchItemId = rollCatch(fishing.catchBiome, this.rng());

        if (hasSpaceFor(inventory, catchItemId, 1)) {
          addItem(inventory, catchItemId, 1);
          fishing.catchItemId = catchItemId;
          fishing.state = "caught";
        } else {
          // Inventory is full for this specific catch type
          fishing.state = "missed";
        }
      } else {
        fishing.state = "missed";
      }
      fishing.timer = 0;
      fishing.version++;
    }
  }
}
