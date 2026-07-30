import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { NetworkComponent } from "../components/NetworkComponent";
import { PositionComponent } from "../components/PositionComponent";
import { PlayerComponent } from "../components/PlayerComponent";

export interface SyncPayload {
  playerId: string;
  x: number;
  y: number;
  timestamp: number;
}

/**
 * NetworkSyncSystem marks dirty entities and prepares sync payloads.
 * Syncs position data for local player entities at a fixed interval.
 */
export class NetworkSyncSystem extends System {
  private syncInterval: number;
  private pendingPayloads: SyncPayload[] = [];

  constructor(syncInterval: number = 50) {
    super(["network", "position", "player"]);
    this.syncInterval = syncInterval;
  }

  getPendingPayloads(): SyncPayload[] {
    const payloads = [...this.pendingPayloads];
    this.pendingPayloads = [];
    return payloads;
  }

  update(entities: Entity[], _deltaTime: number): void {
    const now = Date.now();

    for (const entity of entities) {
      const network = entity.getComponent<NetworkComponent>("network")!;
      const player = entity.getComponent<PlayerComponent>("player")!;

      if (!player.isLocal) continue;

      if (network.dirty && now - network.lastSync >= this.syncInterval) {
        const position = entity.getComponent<PositionComponent>("position")!;

        this.pendingPayloads.push({
          playerId: player.playerId,
          x: position.x,
          y: position.y,
          timestamp: now,
        });

        network.lastSync = now;
        network.dirty = false;
      }
    }
  }
}
