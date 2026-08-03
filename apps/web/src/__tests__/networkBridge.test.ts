import { describe, it, expect, beforeEach } from "vitest";
import type {
  NetworkComponent,
  PositionComponent,
  RemoteInterpolationComponent,
} from "@worldnest/game-engine";
import type { PlayerPosition } from "@worldnest/database";
import {
  NetworkBridge,
  type NetworkTransport,
  type PlayersEventEmitter,
} from "../game/NetworkBridge";
import {
  createGameWorld,
  remotePlayerEntityId,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
  type GameWorldContext,
} from "../game/createGameWorld";
import { PLAYERS_CHANGED_EVENT, type PlayersChangedEvent } from "../game/events";

const BOOTSTRAP = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
};

/** Records what the bridge published to `game.events`. */
class FakeEmitter implements PlayersEventEmitter {
  public events: PlayersChangedEvent[] = [];

  emit(event: string, payload: unknown): unknown {
    if (event === PLAYERS_CHANGED_EVENT) {
      this.events.push(payload as PlayersChangedEvent);
    }
    return true;
  }
}

/** Stands in for `RealtimeManager` so no Supabase client is needed. */
class FakeTransport implements NetworkTransport {
  public broadcasts: PlayerPosition[] = [];
  public presence: PlayerPosition[] = [];
  public onJoined?: (player: {
    playerId: string;
    username: string;
    position: PlayerPosition;
    online_at: string;
  }) => void;
  public onLeft?: (playerId: string) => void;
  public onMoved?: (playerId: string, position: PlayerPosition) => void;

  setCallbacks(
    onJoined: NonNullable<FakeTransport["onJoined"]>,
    onLeft: NonNullable<FakeTransport["onLeft"]>,
    onMoved: NonNullable<FakeTransport["onMoved"]>,
  ): void {
    this.onJoined = onJoined;
    this.onLeft = onLeft;
    this.onMoved = onMoved;
  }

  broadcastPosition(position: PlayerPosition): void {
    this.broadcasts.push(position);
  }

  updatePresence(position: PlayerPosition): void {
    this.presence.push(position);
  }
}

function at(x: number, y: number): PlayerPosition {
  return { x, y, chunkX: 0, chunkY: 0 };
}

let context: GameWorldContext;
let emitter: FakeEmitter;
let bridge: NetworkBridge;

beforeEach(() => {
  context = createGameWorld(BOOTSTRAP);
  emitter = new FakeEmitter();
  bridge = new NetworkBridge(
    context.world,
    context.playerEntity,
    context.systems.networkSync,
    emitter,
  );
});

describe("NetworkBridge remote players", () => {
  it("should create a real ECS entity when a remote player joins", () => {
    bridge.addRemotePlayer("remote-1", "Friend", 100, 200);

    const entity = context.world.getEntity(remotePlayerEntityId("remote-1"));
    expect(entity).toBeDefined();
    const position = entity!.getComponent<PositionComponent>("position")!;
    expect([position.x, position.y]).toEqual([100, 200]);
    expect(emitter.events).toEqual([
      { type: "join", playerId: "remote-1", username: "Friend", x: 100, y: 200 },
    ]);
  });

  it("should ignore a duplicate join for the same player", () => {
    bridge.addRemotePlayer("remote-1", "Friend", 100, 200);
    bridge.addRemotePlayer("remote-1", "Friend", 500, 500);

    const position = context.world
      .getEntity(remotePlayerEntityId("remote-1"))!
      .getComponent<PositionComponent>("position")!;
    expect(position.x).toBe(100);
    expect(emitter.events).toHaveLength(1);
  });

  it("should write a move onto the interpolation target, not the position", () => {
    bridge.addRemotePlayer("remote-1", "Friend", 100, 200);
    bridge.updateRemotePlayer("remote-1", 160, 260);

    const entity = context.world.getEntity(remotePlayerEntityId("remote-1"))!;
    const interpolation =
      entity.getComponent<RemoteInterpolationComponent>("remoteInterpolation")!;
    const position = entity.getComponent<PositionComponent>("position")!;

    expect([interpolation.targetX, interpolation.targetY]).toEqual([160, 260]);
    // The InterpolationSystem is what closes the gap, so the sprite glides
    expect([position.x, position.y]).toEqual([100, 200]);
    expect(emitter.events[1]).toEqual({
      type: "move",
      playerId: "remote-1",
      x: 160,
      y: 260,
    });
  });

  it("should create the entity when a move arrives before the join", () => {
    // Broadcast can beat presence, and the id is all that is known by then
    bridge.updateRemotePlayer("remote-2", 40, 60);

    const entity = context.world.getEntity(remotePlayerEntityId("remote-2"));
    expect(entity).toBeDefined();
    expect(emitter.events).toEqual([
      { type: "join", playerId: "remote-2", username: "remote-2", x: 40, y: 60 },
    ]);
  });

  it("should remove the entity when a remote player leaves", () => {
    bridge.addRemotePlayer("remote-1", "Friend", 100, 200);
    bridge.removeRemotePlayer("remote-1");

    expect(context.world.getEntity(remotePlayerEntityId("remote-1"))).toBeUndefined();
    expect(emitter.events[1]).toEqual({ type: "leave", playerId: "remote-1" });
  });

  it("should ignore a leave for a player it never saw", () => {
    bridge.removeRemotePlayer("ghost");

    expect(emitter.events).toHaveLength(0);
  });
});

describe("NetworkBridge transport", () => {
  it("should seed presence with the real spawn point on attach", () => {
    const transport = new FakeTransport();

    bridge.setTransport(transport);

    expect(transport.presence).toEqual([
      { x: DEFAULT_SPAWN_X, y: DEFAULT_SPAWN_Y, chunkX: 0, chunkY: 0 },
    ]);
  });

  it("should turn transport callbacks into entity changes", () => {
    const transport = new FakeTransport();
    bridge.setTransport(transport);

    transport.onJoined!({
      playerId: "remote-3",
      username: "Neighbour",
      position: at(10, 20),
      online_at: "now",
    });
    transport.onMoved!("remote-3", at(30, 40));
    transport.onLeft!("remote-3");

    expect(context.world.getEntity(remotePlayerEntityId("remote-3"))).toBeUndefined();
    expect(emitter.events.map((event) => event.type)).toEqual([
      "join",
      "move",
      "leave",
    ]);
  });

  it("should broadcast pending sync payloads and refresh presence", () => {
    const transport = new FakeTransport();
    bridge.setTransport(transport);

    const network = context.playerEntity.getComponent<NetworkComponent>("network")!;
    network.dirty = true;
    context.world.update(1 / 60);

    bridge.flushNetworkPayloads();

    expect(transport.broadcasts).toEqual([
      { x: DEFAULT_SPAWN_X, y: DEFAULT_SPAWN_Y, chunkX: 0, chunkY: 0 },
    ]);
    // Presence: once on attach, once per broadcast
    expect(transport.presence).toHaveLength(2);
  });

  it("should drop payloads instead of throwing without a transport", () => {
    const network = context.playerEntity.getComponent<NetworkComponent>("network")!;
    network.dirty = true;
    context.world.update(1 / 60);

    expect(() => bridge.flushNetworkPayloads()).not.toThrow();
  });
});
