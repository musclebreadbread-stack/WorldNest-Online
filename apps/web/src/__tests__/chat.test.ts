import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ChatMessage } from "@worldnest/database";
import { CHAT_HISTORY_LIMIT, useChatStore } from "../stores/chatStore";
import { CHAT_RATE_LIMIT_MS, RateLimiter } from "../lib/rateLimit";

function message(id: number, body = `message ${id}`): ChatMessage {
  return {
    id: `m${id}`,
    playerId: "u1",
    username: "Tester",
    body,
    createdAt: new Date(id).toISOString(),
  };
}

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      unread: 0,
      inputFocused: false,
      sender: null,
    });
  });

  it("should append messages and count them as unread", () => {
    useChatStore.getState().addMessage(message(1));
    useChatStore.getState().addMessage(message(2));

    const state = useChatStore.getState();
    expect(state.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(state.unread).toBe(2);
  });

  it("should cap the log at the history limit, keeping the newest", () => {
    for (let index = 0; index < CHAT_HISTORY_LIMIT + 10; index++) {
      useChatStore.getState().addMessage(message(index));
    }

    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(messages[0].id).toBe("m10");
    expect(messages[messages.length - 1].id).toBe(`m${CHAT_HISTORY_LIMIT + 9}`);
  });

  it("should not count messages as unread while the composer has focus", () => {
    useChatStore.getState().setInputFocused(true);
    useChatStore.getState().addMessage(message(1));

    expect(useChatStore.getState().unread).toBe(0);
  });

  it("should clear unread when the composer takes focus", () => {
    useChatStore.getState().addMessage(message(1));
    expect(useChatStore.getState().unread).toBe(1);

    useChatStore.getState().setInputFocused(true);
    expect(useChatStore.getState().unread).toBe(0);

    useChatStore.getState().setInputFocused(false);
    expect(useChatStore.getState().unread).toBe(0);
  });

  it("should merge history in front of messages already received live", () => {
    useChatStore.getState().addMessage(message(3));
    useChatStore.getState().prependHistory([message(1), message(2)]);

    const state = useChatStore.getState();
    expect(state.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    // History is not new to the player, so it does not raise the badge
    expect(state.unread).toBe(1);
  });

  it("should hold the injected sender and release it on teardown", () => {
    const sender = vi.fn();
    useChatStore.getState().setSender(sender);
    expect(useChatStore.getState().sender).toBe(sender);

    useChatStore.getState().setSender(null);
    expect(useChatStore.getState().sender).toBeNull();
  });
});

describe("RateLimiter", () => {
  it("should allow the first action immediately", () => {
    const limiter = new RateLimiter(CHAT_RATE_LIMIT_MS, () => 0);

    expect(limiter.tryConsume()).toBe(true);
  });

  it("should reject a second action inside the interval", () => {
    let now = 0;
    const limiter = new RateLimiter(500, () => now);

    expect(limiter.tryConsume()).toBe(true);
    now = 499;
    expect(limiter.canConsume()).toBe(false);
    expect(limiter.tryConsume()).toBe(false);
  });

  it("should allow the next action once the interval has elapsed", () => {
    let now = 0;
    const limiter = new RateLimiter(500, () => now);

    limiter.tryConsume();
    now = 500;

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });
});
