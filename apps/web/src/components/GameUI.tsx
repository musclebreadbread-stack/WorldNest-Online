"use client";

import { useGameStore } from "../stores/gameStore";
import { ClockHud } from "./ClockHud";
import { HotBar } from "./HotBar";
import { InventoryPanel } from "./InventoryPanel";

/**
 * GameUI provides a React overlay UI for chat, inventory button, and player info.
 * Renders on top of the Phaser canvas using absolute positioning.
 */
export function GameUI() {
  const { playerX, playerY, chunkX, chunkY, connectionStatus, onlinePlayers } =
    useGameStore();

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Top-centre: world clock */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 pointer-events-auto">
        <ClockHud />
      </div>

      {/* Top-right: connection status and player count */}
      <div className="absolute right-4 top-4 flex flex-col gap-2 pointer-events-auto">
        <div className="rounded bg-black/70 px-3 py-2 text-sm text-white">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-400"
                  : connectionStatus === "connecting"
                    ? "bg-yellow-400"
                    : "bg-red-400"
              }`}
            />
            <span className="capitalize">{connectionStatus}</span>
          </div>
          <div className="mt-1 text-xs text-gray-300">
            Players online: {onlinePlayers.size}
          </div>
        </div>
      </div>

      {/* Bottom-left: coordinates */}
      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="rounded bg-black/70 px-3 py-2 text-xs text-white font-mono">
          <div>X: {Math.round(playerX)} Y: {Math.round(playerY)}</div>
          <div>Chunk: {chunkX}, {chunkY}</div>
        </div>
      </div>

      {/* Bottom-right: controls hint */}
      <div className="absolute bottom-4 right-4 pointer-events-auto">
        <div className="rounded bg-black/70 px-3 py-2 text-xs text-gray-300">
          WASD / Arrows to move · 1-8 hotbar · I inventory
        </div>
      </div>

      {/* Bottom-centre: hotbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <HotBar />
      </div>

      {/* Centre: inventory panel */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
        <InventoryPanel />
      </div>
    </div>
  );
}
