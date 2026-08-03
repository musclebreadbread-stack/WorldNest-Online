"use client";

import type { HighContrastMode, ReducedMotionMode } from "@worldnest/game-engine";
import { HIGH_CONTRAST_MODES, REDUCED_MOTION_MODES } from "@worldnest/game-engine";
import { useTranslation } from "../i18n/useTranslation";
import { useAccessibilityStore } from "../stores/accessibilityStore";

/**
 * Accessibility section rendered inside the SettingsPanel.
 * Provides controls for contrast mode, motion reduction, and keyboard nav.
 */
export function AccessibilitySettings() {
  const { t } = useTranslation();
  const highContrastMode = useAccessibilityStore((s) => s.highContrastMode);
  const reducedMotionMode = useAccessibilityStore((s) => s.reducedMotionMode);
  const keyboardNav = useAccessibilityStore((s) => s.keyboardNavigationEnabled);
  const setHighContrast = useAccessibilityStore((s) => s.setHighContrastMode);
  const setReducedMotion = useAccessibilityStore((s) => s.setReducedMotionMode);
  const setKeyboardNav = useAccessibilityStore((s) => s.setKeyboardNavigationEnabled);

  return (
    <section aria-labelledby="a11y-heading">
      <h4
        id="a11y-heading"
        className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400"
      >
        {t("settings.accessibility")}
      </h4>

      <label
        htmlFor="settings-contrast"
        className="mt-3 block text-xs font-medium text-gray-300"
      >
        {t("settings.highContrast")}
      </label>
      <select
        id="settings-contrast"
        value={highContrastMode}
        onChange={(e) => setHighContrast(e.target.value as HighContrastMode)}
        className="mt-1 w-full rounded border border-white/20 bg-gray-800 px-2 py-1 text-sm text-white focus:border-worldnest-primary focus:outline-none"
      >
        {HIGH_CONTRAST_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {t(`settings.contrast.${mode}` as never)}
          </option>
        ))}
      </select>

      <label
        htmlFor="settings-motion"
        className="mt-3 block text-xs font-medium text-gray-300"
      >
        {t("settings.reducedMotion")}
      </label>
      <select
        id="settings-motion"
        value={reducedMotionMode}
        onChange={(e) => setReducedMotion(e.target.value as ReducedMotionMode)}
        className="mt-1 w-full rounded border border-white/20 bg-gray-800 px-2 py-1 text-sm text-white focus:border-worldnest-primary focus:outline-none"
      >
        {REDUCED_MOTION_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {t(`settings.motion.${mode}` as never)}
          </option>
        ))}
      </select>

      <label
        htmlFor="settings-keyboard-nav"
        className="mt-3 flex items-center gap-2 text-xs text-gray-300"
      >
        <input
          id="settings-keyboard-nav"
          type="checkbox"
          checked={keyboardNav}
          onChange={(e) => setKeyboardNav(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-gray-800"
        />
        {t("settings.keyboardNav")}
      </label>
    </section>
  );
}
