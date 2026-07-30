import { describe, it, expect, beforeEach } from "vitest";
import { ITEM_IDS } from "@worldnest/shared";
import { DIALOGUE_DEFINITIONS, NPC_DEFINITIONS } from "@worldnest/game-engine";
import {
  ITEM_NAME_KEYS,
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_LABELS,
  MESSAGES,
  RTL_LOCALES,
  isLocale,
  isMessageKey,
  localeDirection,
  resolveLocale,
  translate,
  type Locale,
  type MessageKey,
} from "../i18n";
import { en } from "../i18n/messages/en";
import { ko } from "../i18n/messages/ko";
import { LOCALE_STORAGE_KEY, detectLocale, useLocaleStore } from "../stores/localeStore";

const EN_KEYS = Object.keys(en) as MessageKey[];

/**
 * Keys whose value is legitimately the same in every language: an example email
 * address and the Cartesian axis labels. Everything else must differ from
 * English, which is what catches a copy-pasted catalogue.
 */
const LOCALE_AGNOSTIC_KEYS: MessageKey[] = ["auth.emailPlaceholder", "hud.coordinates"];

describe("message catalogue", () => {
  it("should list twelve locales with English first", () => {
    expect(LOCALES).toHaveLength(12);
    expect(LOCALES[0]).toBe("en");
    expect(new Set(LOCALES).size).toBe(12);
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("should have a catalogue and an endonym for every locale", () => {
    for (const locale of LOCALES) {
      expect(MESSAGES[locale]).toBeDefined();
      expect(LOCALE_LABELS[locale].length).toBeGreaterThan(0);
    }
  });

  it("should give English one key per user-visible string", () => {
    expect(EN_KEYS.length).toBeGreaterThan(50);
    for (const key of EN_KEYS) {
      expect(en[key].length, key).toBeGreaterThan(0);
    }
  });

  it("should keep the exact strings the smoke suite asserts", () => {
    expect(en["auth.signIn"]).toBe("Sign In");
    expect(en["auth.signUp"]).toBe("Sign Up");
    expect(en["auth.signInSubtitle"]).toBe("Sign in to your account");
    expect(en["auth.signUpSubtitle"]).toBe("Create a new account");
    expect(en["auth.usernamePlaceholder"]).toBe("Choose a username");
    expect(en["landing.play"]).toBe("Play Now");
  });

  it("should name every catalogue item in every locale", () => {
    for (const itemId of ITEM_IDS) {
      const key = ITEM_NAME_KEYS[itemId];
      expect(EN_KEYS, itemId).toContain(key);

      for (const locale of LOCALES) {
        expect(translate(locale, key), `${locale} ${itemId}`).not.toBe(key);
      }
    }
  });

  // The automated guard for decision D8: translatable content in the engine is
  // stored as keys, so every one of those keys has to exist here.
  it("should resolve every engine dialogue key in every locale", () => {
    for (const [dialogueId, definition] of Object.entries(DIALOGUE_DEFINITIONS)) {
      for (const [nodeId, node] of Object.entries(definition.nodes)) {
        const keys = [node.textKey, ...node.options.map((o) => o.labelKey)];

        for (const key of keys) {
          expect(isMessageKey(key), `${dialogueId}.${nodeId} ${key}`).toBe(true);
          if (!isMessageKey(key)) continue;

          for (const locale of LOCALES) {
            expect(translate(locale, key), `${locale} ${key}`).not.toBe(key);
          }
        }
      }
    }
  });

  it("should resolve every engine NPC name key in every locale", () => {
    for (const definition of NPC_DEFINITIONS) {
      expect(isMessageKey(definition.nameKey), definition.id).toBe(true);
      if (!isMessageKey(definition.nameKey)) continue;

      for (const locale of LOCALES) {
        expect(
          translate(locale, definition.nameKey),
          `${locale} ${definition.id}`,
        ).not.toBe(definition.nameKey);
      }
    }
  });

  it("should reject a key the catalogue has never heard of", () => {
    expect(isMessageKey("dialogue.nobody.line")).toBe(false);
    expect(isMessageKey("inventory.title")).toBe(true);
  });

  it("should give Korean exactly the English key set with no empty values", () => {
    expect(Object.keys(ko).sort()).toEqual([...EN_KEYS].sort());
    for (const key of EN_KEYS) {
      expect(ko[key].trim().length, key).toBeGreaterThan(0);
    }
  });

  it("should give every locale exactly the English key set with no empty values", () => {
    for (const locale of LOCALES) {
      const messages = MESSAGES[locale];
      expect(Object.keys(messages).sort(), locale).toEqual([...EN_KEYS].sort());

      for (const key of EN_KEYS) {
        expect(messages[key]?.trim().length, `${locale} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("should actually translate every key, not copy the English one", () => {
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      for (const key of EN_KEYS) {
        if (LOCALE_AGNOSTIC_KEYS.includes(key)) continue;

        expect(MESSAGES[locale][key], `${locale} ${key}`).not.toBe(en[key]);
      }
    }
  });

  it("should keep every placeholder the English string uses", () => {
    for (const locale of LOCALES) {
      for (const key of EN_KEYS) {
        const expected = (en[key].match(/\{\w+\}/g) ?? []).sort();
        const actual = (MESSAGES[locale][key]?.match(/\{\w+\}/g) ?? []).sort();

        expect(actual, `${locale} ${key}`).toEqual(expected);
      }
    }
  });
});

describe("translate", () => {
  it("should return the locale's own string when it has one", () => {
    expect(translate("ko", "settings.title")).toBe(ko["settings.title"]);
  });

  it("should fall back to English for an untranslated key", () => {
    const sparse: Partial<typeof en> = {};
    const original = MESSAGES.vi;
    MESSAGES.vi = sparse;

    try {
      expect(translate("vi", "inventory.title")).toBe(en["inventory.title"]);
    } finally {
      MESSAGES.vi = original;
    }
  });

  it("should return the key itself when nothing knows it", () => {
    expect(translate("en", "not.a.real.key" as MessageKey)).toBe("not.a.real.key");
  });

  it("should interpolate named parameters", () => {
    expect(translate("en", "hud.playersOnline", { count: 3 })).toBe(
      "Players online: 3",
    );
    expect(translate("en", "hud.chunk", { chunkX: -1, chunkY: 2 })).toBe(
      "Chunk: -1, 2",
    );
  });

  it("should leave placeholders in place when no value is given", () => {
    expect(translate("en", "hud.playersOnline")).toContain("{count}");
    expect(translate("en", "hud.playersOnline", { other: 1 })).toContain("{count}");
  });

  it("should interpolate into the translated string, not the English one", () => {
    expect(translate("ko", "clock.format", { day: 4, time: "07:20", phase: "새벽" })).toBe(
      "4일차 · 07:20 · 새벽",
    );
  });
});

describe("resolveLocale", () => {
  it("should match a plain tag", () => {
    expect(resolveLocale("ko")).toBe("ko");
    expect(resolveLocale("EN")).toBe("en");
  });

  it("should match the primary subtag of a regional tag", () => {
    expect(resolveLocale("ko-KR")).toBe("ko");
    expect(resolveLocale("pt-BR")).toBe("pt");
    expect(resolveLocale("zh-Hans-CN")).toBe("zh");
    expect(resolveLocale("es_MX")).toBe("es");
  });

  it("should fall back to English for anything unsupported", () => {
    expect(resolveLocale("xx")).toBe("en");
    expect(resolveLocale("")).toBe("en");
    expect(resolveLocale("sv-SE")).toBe("en");
  });

  it("should recognise supported locales only", () => {
    expect(isLocale("vi")).toBe(true);
    expect(isLocale("vi-VN")).toBe(false);
  });
});

describe("localeDirection", () => {
  it("should be rtl only for Arabic", () => {
    expect(RTL_LOCALES).toEqual(["ar"]);
    expect(localeDirection("ar")).toBe("rtl");

    for (const locale of LOCALES.filter((l) => l !== "ar")) {
      expect(localeDirection(locale), locale).toBe("ltr");
    }
  });
});

describe("localeStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLocaleStore.setState({ locale: DEFAULT_LOCALE, hydrated: false });
  });

  function setNavigatorLanguage(language: string): void {
    Object.defineProperty(window.navigator, "language", {
      value: language,
      configurable: true,
    });
  }

  it("should start on English so the server markup and first render agree", () => {
    setNavigatorLanguage("ko-KR");

    expect(useLocaleStore.getState().locale).toBe("en");
    expect(useLocaleStore.getState().hydrated).toBe(false);
  });

  it("should adopt the browser language on hydrate", () => {
    setNavigatorLanguage("ja-JP");

    useLocaleStore.getState().hydrate();

    expect(useLocaleStore.getState().locale).toBe("ja");
    expect(useLocaleStore.getState().hydrated).toBe(true);
  });

  it("should prefer a stored choice over the browser language", () => {
    setNavigatorLanguage("ja-JP");
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "th");

    expect(detectLocale()).toBe("th");
  });

  it("should ignore a stored value that is not a locale", () => {
    setNavigatorLanguage("de-DE");
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "klingon");

    expect(detectLocale()).toBe("de");
  });

  it("should persist an explicit choice", () => {
    useLocaleStore.getState().setLocale("ar" as Locale);

    expect(useLocaleStore.getState().locale).toBe("ar");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ar");
  });
});
