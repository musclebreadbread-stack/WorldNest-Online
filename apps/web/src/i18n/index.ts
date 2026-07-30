import type { DayPhase } from "@worldnest/game-engine";
import type { ItemId } from "@worldnest/shared";
import { ar } from "./messages/ar";
import { de } from "./messages/de";
import { en } from "./messages/en";
import { es } from "./messages/es";
import { fr } from "./messages/fr";
import { hi } from "./messages/hi";
import { ja } from "./messages/ja";
import { ko } from "./messages/ko";
import { pt } from "./messages/pt";
import { th } from "./messages/th";
import { vi } from "./messages/vi";
import { zh } from "./messages/zh";

/**
 * Hand-rolled i18n instead of `next-intl`.
 *
 * Every route under `app/` is already `"use client"` and `middleware.ts` is doing
 * auth cookie work, so locale-prefixed routing would fight both. A typed message
 * record plus a `translate()` with English fallback adds no dependency and turns
 * "all 12 locales have the same keys" into a unit test.
 */
export const LOCALES = [
  "en",
  "ko",
  "ja",
  "zh",
  "es",
  "fr",
  "de",
  "pt",
  "ar",
  "hi",
  "th",
  "vi",
] as const;

export type Locale = (typeof LOCALES)[number];

/** Every string the UI can show. Derived from `en`, which is the source of truth. */
export type MessageKey = keyof typeof en;

/** A complete catalogue. Translations are typed with this so gaps fail the build. */
export type LocaleMessages = Record<MessageKey, string>;

/** Locales written right to left. Drives `<html dir>` and the RTL HUD rules. */
export const RTL_LOCALES: readonly Locale[] = ["ar"];

/** Language names in their own language, for the settings picker. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ar: "العربية",
  hi: "हिन्दी",
  th: "ไทย",
  vi: "Tiếng Việt",
};

/**
 * Catalogues by locale. The value type stays partial so a future locale can be
 * registered before it is fully translated and fall back to English key by key
 * rather than rendering blank; all twelve are complete today, which is what the
 * parity test enforces.
 */
export const MESSAGES: Record<Locale, Partial<LocaleMessages>> = {
  en,
  ko,
  ja,
  zh,
  es,
  fr,
  de,
  pt,
  ar,
  hi,
  th,
  vi,
};

/** The default, and the fallback for every untranslated key. */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Display-name key for every catalogue item.
 *
 * A `Record` rather than a `` `item.${id}` `` template so both directions are
 * checked: adding an item to `@worldnest/shared` fails to compile until it has a
 * translation key, and a typo in a key fails against `MessageKey`.
 */
export const ITEM_NAME_KEYS: Record<ItemId, MessageKey> = {
  wood: "item.wood",
  stone: "item.stone",
  ore: "item.ore",
  fiber: "item.fiber",
  flower: "item.flower",
  wheat_seed: "item.wheat_seed",
  wheat: "item.wheat",
  fence: "item.fence",
  chest: "item.chest",
};

/**
 * Name key for each phase of the world clock. The engine reports the phase as a
 * `DayPhase`; the translation of it lives here, not in the engine.
 */
export const CLOCK_PHASE_KEYS: Record<DayPhase, MessageKey> = {
  dawn: "clock.phase.dawn",
  day: "clock.phase.day",
  dusk: "clock.phase.dusk",
  night: "clock.phase.night",
};

export type TranslateParams = Record<string, string | number>;

/** Whether a string names a supported locale. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Best supported locale for a browser language tag.
 * Matches the full tag first, then the primary subtag, so `ko-KR` → `ko` and
 * `pt-BR` → `pt`; anything unknown falls back to English.
 */
export function resolveLocale(navigatorLanguage: string): Locale {
  const tag = navigatorLanguage.trim().toLowerCase();
  if (isLocale(tag)) return tag;

  const primary = tag.split(/[-_]/)[0];
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
}

/** Writing direction for a locale. */
export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

/**
 * Look up a message, falling back to English and then to the key itself, and
 * interpolate `{name}` placeholders. Returning the key rather than an empty
 * string means a missing translation is visible instead of silent.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: TranslateParams,
): string {
  const message = MESSAGES[locale]?.[key] ?? en[key] ?? key;
  return params ? interpolate(message, params) : message;
}

/** Replace `{name}` with `params.name`; unknown placeholders are left in place. */
function interpolate(message: string, params: TranslateParams): string {
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
