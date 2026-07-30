"use client";

import { useCallback } from "react";
import { useLocaleStore } from "../stores/localeStore";
import {
  localeDirection,
  translate,
  type Locale,
  type MessageKey,
  type TranslateParams,
} from "./index";

export type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

export interface Translation {
  t: TranslateFn;
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
}

/**
 * The one hook components use for text. Re-renders on a language change because
 * it subscribes to `localeStore`, so switching language needs no page reload.
 */
export function useTranslation(): Translation {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  const t = useCallback<TranslateFn>(
    (key, params) => translate(locale, key, params),
    [locale],
  );

  return { t, locale, dir: localeDirection(locale), setLocale };
}
