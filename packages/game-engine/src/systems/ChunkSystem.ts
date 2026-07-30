import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { PositionComponent } from "../components/PositionComponent";
import { PlayerComponent } from "../components/PlayerComponent";
import { WorldManager } from "../world/WorldManager";

/**
 * ChunkSystem manages chunk loading/unloading based on local player position.
 * Maintains a 3x3 grid of chunks around the player.
 */
export class ChunkSystem extends System {
  private worldManager: WorldManager;

  constructor(worldManager: WorldManager) {
    super(["position", "player"]);
    this.worldManager = worldManager;
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const player = entity.getComponent<PlayerComponent>("player")!;
      if (!player.isLocal) continue;

      const position = entity.getComponent<PositionComponent>("position")!;
      this.worldManager.updateLoadedChunks(position.chunkX, position.chunkY);
    }
  }
}
