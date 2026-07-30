"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MAX_DIALOGUE_OPTIONS } from "@worldnest/game-engine";
import { Card } from "@worldnest/ui";
import { isMessageKey } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import type { TranslateFn } from "../i18n/useTranslation";
import { useDialogueStore } from "../stores/dialogueStore";

/**
 * The conversation box, shown whenever the engine says a conversation is open.
 *
 * Every string here arrives as an i18n key from the engine (decision D8), so the
 * same dialogue graph reads naturally in twelve languages. Answering goes through
 * the store's injected `respond` (decision D13) — the click never touches the
 * ECS, it raises a request flag that `NpcSystem` consumes on the next frame.
 */
export function DialoguePanel() {
  const npcId = useDialogueStore((s) => s.npcId);
  const nameKey = useDialogueStore((s) => s.nameKey);
  const textKey = useDialogueStore((s) => s.textKey);
  const options = useDialogueStore((s) => s.options);
  const respond = useDialogueStore((s) => s.respond);
  const close = useDialogueStore((s) => s.close);
  const { t } = useTranslation();

  const open = npcId !== null && textKey !== null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.15 }}
        >
          <Card className="w-[28rem] max-w-[90vw] border-white/10 bg-gray-900/95">
            {nameKey && (
              <h3 className="mb-2 text-sm font-semibold text-worldnest-primary">
                {resolve(t, nameKey)}
              </h3>
            )}
            <p className="text-sm leading-relaxed text-white">
              {resolve(t, textKey!)}
            </p>

            <ul className="mt-3 space-y-1">
              {options.map((option, index) => (
                <li key={`${option.labelKey}-${index}`}>
                  <button
                    type="button"
                    onClick={() => respond(index)}
                    className="w-full rounded bg-white/10 px-2 py-1 text-start text-xs text-white transition-colors hover:bg-white/20"
                  >
                    {/* The number matches the key that picks this option */}
                    {index < MAX_DIALOGUE_OPTIONS && (
                      <span className="hud-numeric me-2 text-gray-400">
                        {index + 1}
                      </span>
                    )}
                    {resolve(t, option.labelKey)}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[10px] text-gray-400">{t("dialogue.hint")}</p>
              <button
                type="button"
                onClick={close}
                className="rounded bg-white/10 px-2 py-1 text-[10px] text-white hover:bg-white/20"
              >
                {t("dialogue.close")}
              </button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Translate a key that came from the engine.
 *
 * The engine types these as plain strings — it must not depend on the web app's
 * `MessageKey` — so they are narrowed here and shown verbatim if the catalogue
 * has never heard of them. `i18n.test.ts` asserts that never happens.
 */
function resolve(t: TranslateFn, key: string): string {
  return isMessageKey(key) ? t(key) : key;
}
