"use client";

import type { MessageKey } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import { useGameStore } from "../stores/gameStore";
import type { ConnectionStatus } from "../stores/gameStore";
import { useUIStore } from "../stores/uiStore";
import { BuildMenu } from "./BuildMenu";
import { ChatPanel } from "./ChatPanel";
import { ClockHud } from "./ClockHud";
import { CoinCounter } from "./CoinCounter";
import { DialoguePanel } from "./DialoguePanel";
import { HotBar } from "./HotBar";
import { InventoryPanel } from "./InventoryPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ShopPanel } from "./ShopPanel";
import { SignOutButton } from "./SignOutButton";
import { StatusBars } from "./StatusBars";
import { TouchControls } from "./TouchControls";

const CONNECTION_KEYS: Record<ConnectionStatus, MessageKey> = {
  connected: "hud.connected",
  connecting: "hud.connecting",
  disconnected: "hud.disconnected",
};

/**
 * GameUI provides a React overlay UI for chat, inventory button, and player info.
 * Renders on top of the Phaser canvas using absolute positioning.
 *
 * Corner-anchored panels are positioned with the logical `start-*` / `end-*`
 * utilities rather than `left-*` / `right-*`, so an Arabic layout mirrors instead
 * of stacking two panels in the same corner. The centre-anchored ones need
 * nothing: their anchor is the midpoint.
 */
export function GameUI() {
  const { playerX, playerY, chunkX, chunkY, connectionStatus, onlinePlayers } =
    useGameStore();
  const toggleSettings = useUIStore((s) => s.toggleSettings);
  const { t } = useTranslation();

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Top-centre: world clock */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 pointer-events-auto">
        <ClockHud />
      </div>

      {/* Top-right: connection status, player count and settings */}
      <div className="absolute end-4 top-4 flex flex-col items-stretch gap-2 pointer-events-auto">
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
            <span>{t(CONNECTION_KEYS[connectionStatus])}</span>
          </div>
          <div className="mt-1 text-xs text-gray-300">
            {t("hud.playersOnline", { count: onlinePlayers.size })}
          </div>
        </div>
        <CoinCounter />
        <button
          type="button"
          onClick={toggleSettings}
          aria-label={t("settings.open")}
          title={t("settings.title")}
          className="rounded bg-black/70 px-3 py-2 text-xs text-gray-200 transition-colors hover:bg-black/90 hover:text-white"
        >
          {t("settings.title")}
        </button>
        <SignOutButton />
      </div>

      {/* Bottom-left: chat log and composer, above the coordinates */}
      <div className="absolute bottom-20 start-4 pointer-events-auto">
        <ChatPanel />
      </div>

      {/* Bottom-left: coordinates */}
      <div className="absolute bottom-4 start-4 pointer-events-auto">
        <div className="hud-numeric rounded bg-black/70 px-3 py-2 text-xs text-white font-mono">
          <div>
            {t("hud.coordinates", {
              x: Math.round(playerX),
              y: Math.round(playerY),
            })}
          </div>
          <div>{t("hud.chunk", { chunkX, chunkY })}</div>
        </div>
      </div>

      {/* Bottom-right: controls hint */}
      <div className="absolute bottom-4 end-4 pointer-events-auto">
        <div className="max-w-xs rounded bg-black/70 px-3 py-2 text-xs text-gray-300">
          {t("hud.controls")}
        </div>
      </div>

      {/* Bottom-centre: the conversation box, clear of the bars and hotbar */}
      <div className="absolute bottom-40 left-1/2 -translate-x-1/2 pointer-events-auto">
        <DialoguePanel />
      </div>

      {/* Bottom-centre: health/energy bars above the hotbar */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto">
        <StatusBars />
      </div>

      {/* Bottom-centre: hotbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <HotBar />
      </div>

      {/* Right-centre: build mode helper */}
      <div className="absolute end-4 top-1/2 -translate-y-1/2 pointer-events-auto">
        <BuildMenu />
      </div>

      {/* Centre: inventory, shop and settings panels, side by side */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-start gap-4 pointer-events-auto">
        <InventoryPanel />
        <ShopPanel />
        <SettingsPanel />
      </div>

      {/* Thumb-stick and action buttons, on touch devices only */}
      <TouchControls />
    </div>
  );
}
