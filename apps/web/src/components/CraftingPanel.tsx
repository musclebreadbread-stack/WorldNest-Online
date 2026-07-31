"use client";

import { getAvailableRecipes, getCraftingRecipe } from "@worldnest/game-engine";
import type { MessageKey } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import { useCraftingStore } from "../stores/craftingStore";

/**
 * CraftingPanel shows available recipes filtered by the current station,
 * ingredient lists, and a craft button with progress feedback.
 *
 * Opened with the 'C' key, wired from GameUI.
 */
export function CraftingPanel() {
  const { craftingState, station, panelOpen } = useCraftingStore();
  const { t } = useTranslation();

  if (!panelOpen) return null;

  const available = getAvailableRecipes(station);

  return (
    <div className="w-72 rounded bg-black/80 p-4 text-white">
      <h2 className="mb-2 text-center text-lg font-bold">{t("crafting.title")}</h2>
      <p className="mb-2 text-center text-xs text-gray-300">
        {t(
          station === "workbench"
            ? "crafting.station.workbench"
            : "crafting.station.hand",
        )}
      </p>

      {craftingState === "crafting" && (
        <p className="mb-2 text-center text-sm text-yellow-300">
          {t("crafting.inProgress")}
        </p>
      )}
      {craftingState === "done" && (
        <p className="mb-2 text-center text-sm text-green-300">{t("crafting.done")}</p>
      )}
      {craftingState === "failed" && (
        <p className="mb-2 text-center text-sm text-red-300">{t("crafting.failed")}</p>
      )}

      <ul className="max-h-48 overflow-y-auto text-xs">
        {available.map((recipeId) => {
          const recipe = getCraftingRecipe(recipeId);
          if (!recipe) return null;
          return (
            <li key={recipeId} className="mb-1 rounded bg-white/5 px-2 py-1">
              <span className="font-medium">{t(recipe.titleKey as MessageKey)}</span>
              <span className="ml-2 text-gray-400">
                {recipe.ingredients
                  .map((ing) => `${ing.quantity}x ${ing.itemId}`)
                  .join(", ")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
