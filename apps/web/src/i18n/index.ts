import type { DayPhase, NpcActivity, Season, WeatherKind } from "@worldnest/game-engine";
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
 * The default locale presented to users who have not made a choice yet.
 * Drives `resolveLocale` fallback and the initial UI language for unknown
 * browsers. Settings UI lets users switch to any of the 12 locales.
 */
export const DEFAULT_USER_LOCALE: Locale = "ko";

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
  carrot_seed: "item.carrot_seed",
  carrot: "item.carrot",
  melon_seed: "item.melon_seed",
  melon: "item.melon",
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

/**
 * Name key for each NPC activity. The engine reports the activity as an
 * `NpcActivity`; the translation of it lives here, not in the engine.
 */
export const NPC_ACTIVITY_KEYS: Record<NpcActivity, MessageKey> = {
  home: "npc.activity.home",
  work: "npc.activity.work",
  market: "npc.activity.market",
  rest: "npc.activity.rest",
};

/**
 * Name key for each weather kind. The engine reports the weather as a
 * `WeatherKind`; the translation of it lives here.
 */
export const WEATHER_KEYS: Record<WeatherKind, MessageKey> = {
  clear: "weather.clear",
  rain: "weather.rain",
  snow: "weather.snow",
  fog: "weather.fog",
  storm: "weather.storm",
  rainbow: "weather.rainbow",
  aurora: "weather.aurora",
  wind: "weather.wind",
};

/**
 * Name key for each season.
 */
export const SEASON_KEYS: Record<Season, MessageKey> = {
  0: "season.spring",
  1: "season.summer",
  2: "season.autumn",
  3: "season.winter",
};

export type TranslateParams = Record<string, string | number>;

/** Whether a string names a supported locale. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Whether a string is a key the catalogue knows.
 *
 * The engine stores translatable content as bare strings — dialogue `textKey`s,
 * option `labelKey`s and NPC `nameKey`s (decision D8) — because it must not
 * depend on the web app's `MessageKey` type. This is the narrowing that lets a
 * component translate one, and `i18n.test.ts` uses it to assert that *every* key
 * in the engine catalogues resolves here, which is the automated guard for D8.
 */
export function isMessageKey(value: string): value is MessageKey {
  return value in en;
}

/**
 * Best supported locale for a browser language tag.
 * Matches the full tag first, then the primary subtag, so `ko-KR` -> `ko` and
 * `pt-BR` -> `pt`; anything unknown falls back to Korean (the default user
 * locale).
 */
export function resolveLocale(navigatorLanguage: string): Locale {
  const tag = navigatorLanguage.trim().toLowerCase();
  if (isLocale(tag)) return tag;

  const primary = tag.split(/[-_]/)[0];
  return isLocale(primary) ? primary : DEFAULT_USER_LOCALE;
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
