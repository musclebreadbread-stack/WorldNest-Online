import { create } from "zustand";
import { DEFAULT_USER_LOCALE, isLocale, resolveLocale, type Locale } from "../i18n";

/** Where the chosen language is remembered between sessions. */
export const LOCALE_STORAGE_KEY = "worldnest.locale";

interface LocaleState {
  locale: Locale;
  /**
   * Whether `hydrate()` has run. Until it has, the UI is deliberately English so
   * the server-rendered markup and the first client render agree.
   */
  hydrated: boolean;

  setLocale: (locale: Locale) => void;
  hydrate: () => void;
}

/**
 * The active UI language.
 *
 * Initial state is always `en`: the routes are client components but Next still
 * prerenders them, so reading `localStorage` or `navigator` at module scope would
 * produce a hydration mismatch. `DocumentLocale` calls `hydrate()` in an effect
 * instead, which is the first point at which the browser's answer is safe to use.
 */
export const useLocaleStore = create<LocaleState>((set) => ({
  locale: DEFAULT_USER_LOCALE,
  hydrated: false,

  setLocale: (locale) => {
    persistLocale(locale);
    set({ locale, hydrated: true });
  },

  hydrate: () => set({ locale: detectLocale(), hydrated: true }),
}));

/** Stored choice if there is one, otherwise the browser's preference. */
export function detectLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_USER_LOCALE;

  const stored = readStoredLocale();
  if (stored) return stored;

  return resolveLocale(window.navigator.language ?? DEFAULT_USER_LOCALE);
}

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored && isLocale(stored) ? stored : null;
  } catch {
    // Private browsing modes can throw on access; fall back to the browser
    return null;
  }
}

function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage being unavailable must not stop the language from changing
  }
}
