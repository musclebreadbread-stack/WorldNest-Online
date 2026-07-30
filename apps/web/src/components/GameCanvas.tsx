"use client";

import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "../stores/gameStore";

/**
 * GameCanvas mounts/unmounts the Phaser game instance.
 * Handles resize and communicates with React state via Phaser events.
 */
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition);

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

  return <div ref={containerRef} className="h-full w-full" />;
}
