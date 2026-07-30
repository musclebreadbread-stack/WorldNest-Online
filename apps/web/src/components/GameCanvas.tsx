"use client";

import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "../stores/gameStore";
import { useAuthStore } from "../stores/authStore";
import { RealtimeManager } from "@worldnest/database";
import type { GameScene } from "../game/scenes/GameScene";

/**
 * GameCanvas mounts/unmounts the Phaser game instance.
 * Handles resize and communicates with React state via Phaser events.
 * Creates and wires a RealtimeManager for multiplayer once the user is authenticated.
 */
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const realtimeRef = useRef<RealtimeManager | null>(null);
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition);
  const user = useAuthStore((s) => s.user);

  const initGame = useCallback(async () => {
    if (gameRef.current || !containerRef.current) return;

    // Dynamic import to avoid SSR issues (Phaser requires window)
    const { createPhaserGame } = await import("../game/PhaserGame");

    const game = createPhaserGame(containerRef.current);
    gameRef.current = game;

    // Listen for player position updates
    game.events.on(
      "player-position",
      (data: { x: number; y: number; chunkX: number; chunkY: number }) => {
        setPlayerPosition(data.x, data.y, data.chunkX, data.chunkY);
      },
    );
  }, [setPlayerPosition]);

  useEffect(() => {
    initGame();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [initGame]);

  // Wire RealtimeManager to the GameScene once user is authenticated and game is ready
  useEffect(() => {
    if (!user || !gameRef.current) return;

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
  }, [user]);

  return <div ref={containerRef} className="h-full w-full" />;
}
