import type {
  Entity,
  NetworkSyncSystem,
  PositionComponent,
  RemoteInterpolationComponent,
  World,
} from "@worldnest/game-engine";
import type {
  PlayerJoinedCallback,
  PlayerLeftCallback,
  PlayerMovedCallback,
  PlayerPosition,
} from "@worldnest/database";
import { createRemotePlayerEntity, remotePlayerEntityId } from "./createGameWorld";
import { PLAYERS_CHANGED_EVENT, type PlayersChangedEvent } from "./events";

/** The slice of Phaser's event emitter the bridge needs, so it stays Phaser-free. */
export interface PlayersEventEmitter {
  emit(event: string, payload: unknown): unknown;
}

/**
 * The slice of `RealtimeManager` the bridge drives. Narrowed to an interface so
 * the wiring can be tested without a Supabase client.
 */
export interface NetworkTransport {
  setCallbacks(
    onJoined: PlayerJoinedCallback,
    onLeft: PlayerLeftCallback,
    onMoved: PlayerMovedCallback,
  ): void;
  broadcastPosition(position: PlayerPosition): void;
  updatePresence(position: PlayerPosition): Promise<void> | void;
}

/**
 * NetworkBridge is the whole multiplayer seam: it turns `NetworkSyncSystem`
 * payloads into realtime broadcasts, and remote presence events into real ECS
 * entities so remote players share the local render and smoothing path.
 *
 * Deliberately free of Phaser imports. It lives outside `GameScene` because the
 * scene is at the file-size cap, and because this wiring is the part of the
 * scene most worth testing — remote joins, moves out of order and leaves.
 */
export class NetworkBridge {
  private world: World;
  private playerEntity: Entity;
  private networkSync: NetworkSyncSystem;
  private emitter: PlayersEventEmitter;
  private transport: NetworkTransport | null = null;

  constructor(
    world: World,
    playerEntity: Entity,
    networkSync: NetworkSyncSystem,
    emitter: PlayersEventEmitter,
  ) {
    this.world = world;
    this.playerEntity = playerEntity;
    this.networkSync = networkSync;
    this.emitter = emitter;
  }

  /**
   * Attach the realtime transport and subscribe to remote player events.
   * Seeds presence with the real spawn point so `joinRoom` does not track (0, 0).
   */
  setTransport(transport: NetworkTransport): void {
    this.transport = transport;

    transport.setCallbacks(
      (player) =>
        this.addRemotePlayer(
          player.playerId,
          player.username,
          player.position.x,
          player.position.y,
        ),
      (playerId) => this.removeRemotePlayer(playerId),
      (playerId, position) => this.updateRemotePlayer(playerId, position.x, position.y),
    );

    void transport.updatePresence(this.getLocalPlayerPosition());
  }

  /**
   * Push pending network sync payloads to the transport. Call once per frame,
   * after the ECS update. A no-op until a transport is attached, so the game
   * still runs single-player with Supabase unconfigured.
   */
  flushNetworkPayloads(): void {
    if (!this.transport) return;

    for (const payload of this.networkSync.getPendingPayloads()) {
      const position = this.playerEntity.getComponent<PositionComponent>("position")!;
      const broadcastPosition: PlayerPosition = {
        x: payload.x,
        y: payload.y,
        chunkX: position.chunkX,
        chunkY: position.chunkY,
      };
      this.transport.broadcastPosition(broadcastPosition);
      // Presence is throttled inside the manager; late joiners need it current
      void this.transport.updatePresence(broadcastPosition);
    }
  }

  /** Current local player position in the shape the realtime layer expects. */
  getLocalPlayerPosition(): PlayerPosition {
    const position = this.playerEntity.getComponent<PositionComponent>("position")!;
    return {
      x: position.x,
      y: position.y,
      chunkX: position.chunkX,
      chunkY: position.chunkY,
    };
  }

  /**
   * Add a remote player as a real ECS entity so it shares the render path
   * and gets network smoothing from the InterpolationSystem.
   */
  addRemotePlayer(playerId: string, username: string, x: number, y: number): void {
    if (this.world.getEntity(remotePlayerEntityId(playerId))) return;

    this.world.addEntity(createRemotePlayerEntity(playerId, username, x, y));
    this.emitPlayersChanged({ type: "join", playerId, username, x, y });
  }

  /**
   * Write a remote player's latest network position as the interpolation target.
   */
  updateRemotePlayer(playerId: string, x: number, y: number): void {
    const entity = this.world.getEntity(remotePlayerEntityId(playerId));
    if (!entity) {
      // A position broadcast can arrive before the presence join event
      this.addRemotePlayer(playerId, playerId, x, y);
      return;
    }

    const interpolation = entity.getComponent<RemoteInterpolationComponent>(
      "remoteInterpolation",
    )!;
    interpolation.targetX = x;
    interpolation.targetY = y;

    this.emitPlayersChanged({ type: "move", playerId, x, y });
  }

  /**
   * Remove a remote player entity; its sprite is cleaned up by the sprite sync.
   */
  removeRemotePlayer(playerId: string): void {
    const entityId = remotePlayerEntityId(playerId);
    if (!this.world.getEntity(entityId)) return;

    this.world.removeEntity(entityId);
    this.emitPlayersChanged({ type: "leave", playerId });
  }

  private emitPlayersChanged(event: PlayersChangedEvent): void {
    this.emitter.emit(PLAYERS_CHANGED_EVENT, event);
  }
}
