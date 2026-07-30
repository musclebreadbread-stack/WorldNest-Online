import type { RealtimeChannel } from "@supabase/supabase-js";
import { PRESENCE_INTERVAL_MS } from "@worldnest/shared";
import { createSupabaseClient } from "./client";
import { CHAT_MESSAGE_MAX_LENGTH, type ChatMessage } from "./chat";

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
export type ChatMessageCallback = (message: ChatMessage) => void;

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
  private onChatMessage?: ChatMessageCallback;
  private chatSequence = 0;

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
   * Register the incoming chat handler.
   *
   * Deliberately separate from `setCallbacks`: the player callbacks are wired by
   * the Phaser scene while chat is wired by React, and a single setter taking
   * all four would let whichever ran last clear the other's handlers.
   */
  setChatCallback(onChat: ChatMessageCallback): void {
    this.onChatMessage = onChat;
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

    // Listen for chat broadcasts
    this.channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      const message = payload as ChatMessage;
      if (message.playerId !== this.playerId) {
        this.onChatMessage?.(message);
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
   * Broadcast a chat message to everyone else in the room and return the
   * message that was sent, so the sender can show it immediately — broadcast is
   * configured with `self: false`, so it never echoes back.
   *
   * The id is local: the durable row written by `sendMessage` gets its own, and
   * these ids only ever serve as React keys within this session.
   */
  sendChat(body: string): ChatMessage {
    const message: ChatMessage = {
      id: `local-${this.playerId}-${++this.chatSequence}`,
      playerId: this.playerId,
      username: this.username,
      body: body.slice(0, CHAT_MESSAGE_MAX_LENGTH),
      createdAt: new Date().toISOString(),
    };

    this.channel?.send({ type: "broadcast", event: "chat", payload: message });

    return message;
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
