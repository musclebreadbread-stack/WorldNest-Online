import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the client module before importing the module under test.
vi.mock("../client", () => ({
  createSupabaseClient: vi.fn(),
}));

import { createSupabaseClient } from "../client";
import {
  sendMessageViaRpc,
  mutePlayer,
  unmutePlayer,
  getMuteList,
} from "../chatModeration";

const mockCreateSupabaseClient = vi.mocked(createSupabaseClient);

function mockRpc(data: unknown, error: { message: string } | null = null) {
  const client = { rpc: vi.fn().mockResolvedValue({ data, error }) } as never;
  mockCreateSupabaseClient.mockReturnValue(client);
  return client;
}

function mockAuthenticatedClient(userId: string) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const deleteChain = {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
  const insertChain = {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            muter_id: userId,
            muted_id: "target-id",
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      }),
    }),
  };

  const fromFn = vi.fn().mockImplementation(() => ({
    ...selectChain,
    ...deleteChain,
    ...insertChain,
  }));

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
      }),
    },
    from: fromFn,
  } as never;
  mockCreateSupabaseClient.mockReturnValue(client);
  return client;
}

function mockUnauthenticatedClient() {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
      }),
    },
    from: vi.fn(),
  } as never;
  mockCreateSupabaseClient.mockReturnValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendMessageViaRpc", () => {
  it("should return ok and sanitized_body on success", async () => {
    mockRpc({
      ok: true,
      message_id: "msg-123",
      sanitized_body: "hello world",
    });

    const result = await sendMessageViaRpc("world-1", "hello world");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: true,
      message_id: "msg-123",
      sanitized_body: "hello world",
      reason: null,
    });
  });

  it("should return reason on rate_limited", async () => {
    mockRpc({ ok: false, reason: "rate_limited" });

    const result = await sendMessageViaRpc("world-1", "hi");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      ok: false,
      message_id: null,
      sanitized_body: null,
      reason: "rate_limited",
    });
  });

  it("should return reason on empty_message", async () => {
    mockRpc({ ok: false, reason: "empty_message" });

    const result = await sendMessageViaRpc("world-1", "");

    expect(result.error).toBeNull();
    expect(result.data.ok).toBe(false);
    expect(result.data.reason).toBe("empty_message");
  });

  it("should handle transport errors", async () => {
    mockRpc(null, { message: "network error" });

    const result = await sendMessageViaRpc("world-1", "hi");

    expect(result.error).toBeInstanceOf(Error);
    expect(result.data.ok).toBe(false);
    expect(result.data.reason).toBe("network error");
  });

  it("should handle malformed response", async () => {
    mockRpc(null);

    const result = await sendMessageViaRpc("world-1", "hi");

    expect(result.data.ok).toBe(false);
    expect(result.data.reason).toBe("bad_response");
  });

  it("should call the RPC with correct arguments", async () => {
    const client = mockRpc({ ok: true, message_id: "m1", sanitized_body: "hi" });

    await sendMessageViaRpc("world-abc", "hi there");

    expect((client as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "worldnest_send_chat",
      { p_world_id: "world-abc", p_body: "hi there" },
    );
  });
});

describe("mutePlayer", () => {
  it("should insert a mute entry for the authenticated user", async () => {
    mockAuthenticatedClient("user-1");

    const result = await mutePlayer("target-id");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      muter_id: "user-1",
      muted_id: "target-id",
      created_at: "2024-01-01T00:00:00Z",
    });
  });

  it("should return error when unauthenticated", async () => {
    mockUnauthenticatedClient();

    const result = await mutePlayer("target-id");

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe("unauthenticated");
    expect(result.data).toBeNull();
  });
});

describe("unmutePlayer", () => {
  it("should delete a mute entry for the authenticated user", async () => {
    mockAuthenticatedClient("user-1");

    const result = await unmutePlayer("target-id");

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it("should return error when unauthenticated", async () => {
    mockUnauthenticatedClient();

    const result = await unmutePlayer("target-id");

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe("unauthenticated");
  });
});

describe("getMuteList", () => {
  it("should return empty array when unauthenticated", async () => {
    mockUnauthenticatedClient();

    const result = await getMuteList();

    expect(result.error).toBeInstanceOf(Error);
    expect(result.data).toEqual([]);
  });

  it("should query the mute_list table", async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            muter_id: "user-1",
            muted_id: "p2",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
        error: null,
      }),
    };
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn().mockReturnValue(selectChain),
    } as never;
    mockCreateSupabaseClient.mockReturnValue(client);

    const result = await getMuteList();

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].muted_id).toBe("p2");
  });
});
