"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CHAT_MESSAGE_MAX_LENGTH } from "@worldnest/database";
import { useChatStore } from "../stores/chatStore";
import { RateLimiter } from "../lib/rateLimit";

/** How many messages the collapsed log shows at once. */
const VISIBLE_MESSAGES = 8;

/**
 * Chat log and composer, bottom-left.
 *
 * `Enter` focuses the input and `Esc` blurs it; while it has focus the store
 * flag `inputFocused` is set, which is what stops the player from walking around
 * as the message is typed.
 */
export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const unread = useChatStore((s) => s.unread);
  const inputFocused = useChatStore((s) => s.inputFocused);
  const setInputFocused = useChatStore((s) => s.setInputFocused);
  const sender = useChatStore((s) => s.sender);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const limiter = useRef(new RateLimiter());

  // Enter focuses the composer from anywhere; the input's own key handler
  // takes over once it has focus.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || inputFocused) return;

      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputFocused]);

  const submit = () => {
    const body = draft.trim();
    if (!body || !sender) return;
    if (!limiter.current.tryConsume()) return;

    sender(body);
    setDraft("");
  };

  const visible = messages.slice(-VISIBLE_MESSAGES);

  return (
    <div className="w-72 text-xs">
      <div className="mb-1 flex flex-col gap-0.5">
        <AnimatePresence initial={false}>
          {visible.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-fit max-w-full rounded bg-black/70 px-2 py-1 text-white"
            >
              <span className="font-semibold text-emerald-300">
                {message.username}
              </span>
              <span className="ml-1 break-words">{message.body}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={draft}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          placeholder={sender ? "Press Enter to chat" : "Chat unavailable"}
          disabled={!sender}
          aria-label="Chat message"
          className="w-full rounded bg-black/70 px-2 py-1 text-white outline-none
            ring-emerald-400/60 placeholder:text-gray-400 focus:ring-1
            disabled:placeholder:text-gray-500"
        />
        {unread > 0 && !inputFocused && (
          <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] text-black">
            {unread}
          </span>
        )}
      </div>
    </div>
  );
}
