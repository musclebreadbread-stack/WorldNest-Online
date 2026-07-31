"use client";

import { ROOM_DEFINITIONS, ROOM_TYPES, type RoomType } from "@worldnest/game-engine";
import type { MessageKey } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import { useHousingStore } from "../stores/housingStore";

/**
 * HousingPanel displays the player's house interior: room selector, placed
 * furniture grid, happiness meter, and unlock controls.
 *
 * Opened with the 'H' key, wired from GameUI.
 */
export function HousingPanel() {
  const { housingState, panelOpen, selectedRoom, setSelectedRoom } = useHousingStore();
  const { t } = useTranslation();

  if (!panelOpen) return null;

  const room = housingState.rooms.find((r) => r.type === selectedRoom);

  return (
    <div className="w-72 rounded bg-black/80 p-4 text-white">
      <h2 className="mb-2 text-center text-lg font-bold">{t("housing.title")}</h2>

      {/* Room tabs */}
      <div className="mb-3 flex flex-wrap gap-1">
        {ROOM_TYPES.map((rt) => (
          <button
            key={rt}
            type="button"
            onClick={() => setSelectedRoom(rt as RoomType)}
            className={`rounded px-2 py-1 text-xs ${
              selectedRoom === rt
                ? "bg-white/20 text-white"
                : "bg-white/5 text-gray-400"
            }`}
          >
            {t(ROOM_DEFINITIONS[rt as RoomType].titleKey as MessageKey)}
          </button>
        ))}
      </div>

      {/* Room content */}
      {room && !room.unlocked && (
        <p className="text-center text-sm text-yellow-300">{t("housing.locked")}</p>
      )}

      {room && room.unlocked && (
        <>
          <div className="mb-2 text-sm">
            {t("housing.happiness", {
              score: housingState.happiness,
            })}
          </div>
          <div className="mb-2 text-xs text-gray-300">
            {room.furniture.length} / {ROOM_DEFINITIONS[selectedRoom].maxFurniture}
          </div>
          <ul className="max-h-32 overflow-y-auto text-xs">
            {room.furniture.map((f, i) => (
              <li key={i} className="flex items-center justify-between py-0.5">
                <span>{f.itemId}</span>
                <span className="text-gray-400">
                  ({f.x}, {f.y})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
