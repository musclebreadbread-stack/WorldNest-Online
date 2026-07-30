"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@worldnest/ui";
import { LOCALES, LOCALE_LABELS, isLocale } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import { useUIStore } from "../stores/uiStore";

/**
 * Settings panel, toggled with `P` or the gear button.
 *
 * Language is the only setting so far; the picker lists every locale by its own
 * endonym, because a player who has landed in the wrong language cannot read the
 * English name of their own.
 */
export function SettingsPanel() {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const { t, locale, setLocale } = useTranslation();

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          {/* Card's own title is styled for light backgrounds, so the heading
              is rendered as a child instead. */}
          <Card className="w-64 border-white/10 bg-gray-900/95">
            <h3 className="mb-4 text-lg font-semibold text-white">
              {t("settings.title")}
            </h3>

            <label
              htmlFor="settings-language"
              className="block text-xs font-medium text-gray-300"
            >
              {t("settings.language")}
            </label>
            <select
              id="settings-language"
              value={locale}
              onChange={(event) => {
                if (isLocale(event.target.value)) setLocale(event.target.value);
              }}
              className="mt-1 w-full rounded border border-white/20 bg-gray-800 px-2 py-1 text-sm text-white focus:border-worldnest-primary focus:outline-none"
            >
              {LOCALES.map((option) => (
                <option key={option} value={option}>
                  {LOCALE_LABELS[option]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-gray-400">
              {t("settings.languageHint")}
            </p>

            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="mt-4 w-full rounded bg-white/10 py-1 text-xs text-white hover:bg-white/20"
            >
              {t("settings.close")}
            </button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
