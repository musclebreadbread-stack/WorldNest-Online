import type { RealtimeChannel } from "@supabase/supabase-js";
import { PRESENCE_INTERVAL_MS } from "@worldnest/shared";
import { createSupabaseClient } from "./client";

export interface PlayerPosition {
  x: number;
  y: number;
  chunkX: number;
  chunkY: number;
}

export interface PlayerPresence {
  playerId: string;
  username: string;
  position: PlayerPosition;
  online_at: string;
}

export type PlayerJoinedCallback = (player: PlayerPresence) => void;
export type PlayerLeftCallback = (playerId: string) => void;
export type PlayerMovedCallback = (playerId: string, position: PlayerPosition) => void;

/**
 * Realtime multiplayer module using Supabase Realtime Presence and Broadcast.
 */
export class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private playerId: string;
  private username: string;
  private lastPosition: PlayerPosition = { x: 0, y: 0, chunkX: 0, chunkY: 0 };
  private lastPresenceAt = 0;

  private onPlayerJoined?: PlayerJoinedCallback;
  private onPlayerLeft?: PlayerLeftCallback;
  private onPlayerMoved?: PlayerMovedCallback;

  constructor(playerId: string, username: string) {
    this.playerId = playerId;
    this.username = username;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  setCallbacks(
    onJoined: PlayerJoinedCallback,
    onLeft: PlayerLeftCallback,
    onMoved: PlayerMovedCallback,
  ): void {
    this.onPlayerJoined = onJoined;
    this.onPlayerLeft = onLeft;
    this.onPlayerMoved = onMoved;
  }

  /**
   * Join a realtime room. Sets up presence tracking and broadcast listeners.
   */
  async joinRoom(roomId: string): Promise<void> {
    const client = createSupabaseClient();

    this.channel = client.channel(`room:${roomId}`, {
      config: {
        presence: { key: this.playerId },
        broadcast: { self: false },
      },
    });

    // Listen for presence sync
    this.channel.on("presence", { event: "join" }, ({ newPresences }) => {
      for (const presence of newPresences) {
        const playerPresence = presence as unknown as PlayerPresence;
        if (playerPresence.playerId !== this.playerId) {
          this.onPlayerJoined?.(playerPresence);
        }
      }
    });

    this.channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
      for (const presence of leftPresences) {
        const playerPresence = presence as unknown as PlayerPresence;
        this.onPlayerLeft?.(playerPresence.playerId);
      }
    });

    // Listen for position broadcasts
    this.channel.on("broadcast", { event: "position" }, ({ payload }) => {
      const { playerId, position } = payload as {
        playerId: string;
        position: PlayerPosition;
      };
      if (playerId !== this.playerId) {
        this.onPlayerMoved?.(playerId, position);
      }
    });

    await this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await this.trackPresence();
      }
    });
  }

  /**
   * Re-publish this player's presence with its current position.
   * Presence is the only thing late joiners see, so it has to keep up with
   * movement — but it is throttled to one update per PRESENCE_INTERVAL_MS
   * because broadcast already carries high-frequency movement.
   */
  async updatePresence(position: PlayerPosition): Promise<void> {
    this.lastPosition = { ...position };

    if (!this.channel) return;
    if (Date.now() - this.lastPresenceAt < PRESENCE_INTERVAL_MS) return;

    await this.trackPresence();
  }

  private async trackPresence(): Promise<void> {
    if (!this.channel) return;

    this.lastPresenceAt = Date.now();
    await this.channel.track({
      playerId: this.playerId,
      username: this.username,
      position: this.lastPosition,
      online_at: new Date().toISOString(),
    });
  }

  /**
   * Broadcast position to all other players in the room.
   */
  broadcastPosition(position: PlayerPosition): void {
    if (!this.channel) return;

    this.channel.send({
      type: "broadcast",
      event: "position",
      payload: {
        playerId: this.playerId,
        position,
      },
    });
  }

  /**
   * Leave the current room and clean up subscriptions.
   */
  async leaveRoom(): Promise<void> {
    if (this.channel) {
      await this.channel.untrack();
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

/**
 * Convenience function to join a room.
 */
export function joinRoom(
  roomId: string,
  playerId: string,
  username: string,
): RealtimeManager {
  const manager = new RealtimeManager(playerId, username);
  manager.joinRoom(roomId);
  return manager;
}

/**
 * Convenience function to broadcast position.
 */
export function broadcastPosition(
  manager: RealtimeManager,
  position: PlayerPosition,
): void {
  manager.broadcastPosition(position);
}
