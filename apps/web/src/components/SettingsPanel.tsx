"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@worldnest/ui";
import { LOCALES, LOCALE_LABELS, isLocale } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import { useAudioStore } from "../stores/audioStore";
import { useUIStore } from "../stores/uiStore";

/**
 * Settings panel, toggled with `P` or the gear button.
 *
 * The language picker lists every locale by its own endonym, because a player who
 * has landed in the wrong language cannot read the English name of their own. The
 * sound rows write straight to `audioStore`, which `SoundManager` reads every
 * frame — there is no apply button and nothing to save.
 */
export function SettingsPanel() {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const masterVolume = useAudioStore((s) => s.masterVolume);
  const musicVolume = useAudioStore((s) => s.musicVolume);
  const muted = useAudioStore((s) => s.muted);
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume);
  const setMusicVolume = useAudioStore((s) => s.setMusicVolume);
  const setMuted = useAudioStore((s) => s.setMuted);
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

            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("settings.sound")}
            </h4>

            {/* Sliders are disabled rather than hidden while muted, so it stays
                obvious that the levels were kept. */}
            <VolumeRow
              id="settings-master-volume"
              label={t("settings.masterVolume")}
              value={masterVolume}
              disabled={muted}
              onChange={setMasterVolume}
            />
            <VolumeRow
              id="settings-music-volume"
              label={t("settings.musicVolume")}
              value={musicVolume}
              disabled={muted}
              onChange={setMusicVolume}
            />

            <label
              htmlFor="settings-mute"
              className="mt-3 flex items-center gap-2 text-xs text-gray-300"
            >
              <input
                id="settings-mute"
                type="checkbox"
                checked={muted}
                onChange={(event) => setMuted(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-gray-800"
              />
              {t("settings.mute")}
            </label>
            <p className="mt-1 text-[10px] text-gray-400">{t("settings.soundHint")}</p>

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

interface VolumeRowProps {
  id: string;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

/**
 * One labelled 0-100 slider that stores a 0-1 fraction.
 *
 * The percentage readout carries `hud-numeric` for the same reason the
 * coordinates do: in Arabic the bidi algorithm would otherwise move the `%`.
 */
function VolumeRow({ id, label, value, disabled, onChange }: VolumeRowProps) {
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="block text-xs font-medium text-gray-300">
          {label}
        </label>
        <span className="hud-numeric text-[10px] text-gray-400">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="mt-1 w-full accent-worldnest-primary disabled:opacity-40"
      />
    </div>
  );
}
