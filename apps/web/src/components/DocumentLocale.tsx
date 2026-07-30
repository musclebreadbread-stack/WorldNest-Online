"use client";

import { useEffect } from "react";
import { localeDirection } from "../i18n";
import { useLocaleStore } from "../stores/localeStore";

/**
 * Keeps `<html lang>` and `<html dir>` in step with the chosen language, and
 * performs the one-time detection of the browser's preferred locale.
 *
 * Detection happens here, in an effect, rather than in the store's initial state:
 * `app/layout.tsx` renders `lang="en"` on the server, so reading `navigator` any
 * earlier would make the first client render disagree with the markup.
 *
 * Renders nothing.
 */
export function DocumentLocale() {
  const locale = useLocaleStore((state) => state.locale);
  const hydrated = useLocaleStore((state) => state.hydrated);
  const hydrate = useLocaleStore((state) => state.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = localeDirection(locale);
  }, [locale]);

  return null;
}
