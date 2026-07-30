"use client";

import { useEffect, useState } from "react";

/** Phones, tablets and anything else driven by a finger rather than a mouse. */
export const COARSE_POINTER_QUERY = "(pointer: coarse)";

/**
 * Whether the primary pointing device is a finger.
 *
 * Returns `false` on the first render and corrects itself in an effect, for the
 * same reason `localeStore` starts on English: every route is a client component
 * but Next still prerenders it, so reading `matchMedia` any earlier would make
 * the first client render disagree with the server markup.
 *
 * It keeps listening, because a tablet with a detachable keyboard and trackpad
 * changes its answer without a reload.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia(COARSE_POINTER_QUERY);
    setCoarse(query.matches);

    if (typeof query.addEventListener !== "function") return;

    const onChange = (event: MediaQueryListEvent) => setCoarse(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return coarse;
}
