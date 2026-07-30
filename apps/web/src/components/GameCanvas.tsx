"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useGameStore } from "../stores/gameStore";
import { useAuthStore } from "../stores/authStore";
import { RealtimeManager } from "@worldnest/database";
import type { GameScene } from "../game/scenes/GameScene";
import { PLAYERS_CHANGED_EVENT, type PlayersChangedEvent } from "../game/events";

/**
 * GameCanvas mounts/unmounts the Phaser game instance.
 * Handles resize and communicates with React state via Phaser events.
 * Creates and wires a RealtimeManager for multiplayer once the user is authenticated.
 */
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const realtimeRef = useRef<RealtimeManager | null>(null);
  const [gameReady, setGameReady] = useState(false);
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition);
  const addOnlinePlayer = useGameStore((s) => s.addOnlinePlayer);
  const removeOnlinePlayer = useGameStore((s) => s.removeOnlinePlayer);
  const updateOnlinePlayer = useGameStore((s) => s.updateOnlinePlayer);
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);

  const initGame = useCallback(async () => {
    if (gameRef.current || !containerRef.current) return;

    // Dynamic import to avoid SSR issues (Phaser requires window)
    const { createPhaserGame } = await import("../game/PhaserGame");
    const { DEFAULT_SPAWN_X, DEFAULT_SPAWN_Y } = await import(
      "../game/createGameWorld"
    );

    const game = createPhaserGame(containerRef.current, {
      playerId: user?.id ?? "local",
      username: user?.username ?? "Player",
      spawnX: DEFAULT_SPAWN_X,
      spawnY: DEFAULT_SPAWN_Y,
    });
    gameRef.current = game;

    // Listen for player position updates
    game.events.on(
      "player-position",
      (data: { x: number; y: number; chunkX: number; chunkY: number }) => {
        setPlayerPosition(data.x, data.y, data.chunkX, data.chunkY);
      },
    );

    // Mirror remote player joins/leaves/moves into the React store
    game.events.on(PLAYERS_CHANGED_EVENT, (event: PlayersChangedEvent) => {
      switch (event.type) {
        case "join":
          addOnlinePlayer({
            playerId: event.playerId,
            username: event.username,
            x: event.x,
            y: event.y,
          });
          break;
        case "leave":
          removeOnlinePlayer(event.playerId);
          break;
        case "move":
          updateOnlinePlayer(event.playerId, event.x, event.y);
          break;
      }
    });

    // Track when the game scene is ready so the realtime wiring effect can fire
    game.events.once("game-ready", () => {
      setGameReady(true);
    });
  }, [
    setPlayerPosition,
    addOnlinePlayer,
    removeOnlinePlayer,
    updateOnlinePlayer,
    user,
  ]);

  useEffect(() => {
    // Wait until the session has resolved so the player entity gets the real
    // user id/username rather than the anonymous fallback.
    if (authLoading) return;

    initGame();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [initGame, authLoading]);

  // Wire RealtimeManager to the GameScene once user is authenticated and game is ready
  useEffect(() => {
    if (!user || !gameRef.current || !gameReady) return;

    const game = gameRef.current;

    const wireRealtime = () => {
      const scene = game.scene.getScene("GameScene") as GameScene | null;
      if (!scene) return;

      const manager = new RealtimeManager(user.id, user.username);
      realtimeRef.current = manager;

      scene.setRealtimeManager(manager);
      manager.joinRoom("default");
    };

    // If the scene is already active, wire immediately; otherwise wait for game-ready
    const scene = game.scene.getScene("GameScene");
    if (scene && scene.scene.isActive()) {
      wireRealtime();
    } else {
      game.events.once("game-ready", wireRealtime);
    }

    return () => {
      game.events.off("game-ready", wireRealtime);
      if (realtimeRef.current) {
        realtimeRef.current.leaveRoom();
        realtimeRef.current = null;
      }
    };
  }, [user, gameReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
