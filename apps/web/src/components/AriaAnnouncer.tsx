"use client";

import { useAccessibilityStore } from "../stores/accessibilityStore";
import { useTranslation } from "../i18n/useTranslation";
import type { MessageKey } from "../i18n";
import { isMessageKey } from "../i18n";

/**
 * A visually-hidden aria-live region that reads announcements from the
 * accessibility store. Screen readers will pick up changes to the polite
 * region and announce them without interrupting the current reading.
 */
export function AriaAnnouncer() {
  const announcements = useAccessibilityStore((s) => s.announcements);
  const { t } = useTranslation();

  const latest = announcements[announcements.length - 1];
  const text = latest
    ? isMessageKey(latest.key)
      ? t(latest.key as MessageKey, latest.params)
      : latest.key
    : "";

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  );
}
