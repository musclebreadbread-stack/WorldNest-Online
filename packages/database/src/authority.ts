import { createSupabaseClient } from "./client";
import type { DbResult, Tables } from "./types";

export type CoinLedgerEntry = Tables<"coin_ledger">;

/**
 * The answer one of the authoritative coin operations gave.
 *
 * Both functions in migration 004 return jsonb and never raise, so a refusal is
 * an ordinary answer: `ok` is false and `reason` carries the function's own
 * diagnostic string (`insufficient_coins`, `already_completed`, `rate_limited`,
 * …). Those strings are deliberately **not** translated — only
 * `insufficient_coins` and `already_completed` are states a player can reach in
 * normal play, and the rest mean the client asked for something the UI cannot
 * actually offer.
 *
 * `coins` is the authoritative balance whenever the server sent one. It also
 * arrives with an `insufficient_coins` refusal, where it is the _unchanged_
 * balance — which is still worth reconciling against, because a client showing a
 * different number is a client that has drifted.
 */
export interface AuthorityResult {
  ok: boolean;
  coins: number | null;
  reason: string | null;
}

/** What a caller gets when the call itself never reached the function. */
const UNREACHABLE: AuthorityResult = { ok: false, coins: null, reason: "unreachable" };

/**
 * Ask the server to make a shop trade.
 *
 * The client has already made the trade optimistically (decision D4); this is
 * what decides whether it stands. Nothing about the request identifies the
 * player: the function reads `auth.uid()` itself, so a signed-out caller cannot
 * spend anybody's coins and a signed-in one cannot spend somebody else's.
 */
export async function shopTrade(
  kind: string,
  itemId: string,
  quantity: number,
): Promise<DbResult<AuthorityResult>> {
  const client = createSupabaseClient();
  const { data, error } = await client.rpc("worldnest_shop_trade", {
    p_kind: kind,
    p_item_id: itemId,
    p_quantity: quantity,
  });

  return toAuthorityResult(data, error);
}

/**
 * Ask the server to pay a quest reward.
 *
 * The function is the record of payment, so calling it twice for the same quest
 * is refused with `already_completed` rather than paid — which is the whole
 * guarantee this layer exists to deliver.
 */
export async function claimQuestReward(
  questId: string,
): Promise<DbResult<AuthorityResult>> {
  const client = createSupabaseClient();
  const { data, error } = await client.rpc("worldnest_claim_quest_reward", {
    p_quest_id: questId,
  });

  return toAuthorityResult(data, error);
}

/**
 * Read a player's coin movements, newest first.
 *
 * The ledger is append-only and only the two definer functions write it, so this
 * is the audit trail for one account (decision D7). The select policy is scoped
 * to `auth.uid()`, so a signed-in player can only ever read their own.
 */
export async function loadCoinLedger(
  playerId: string,
  limit = 50,
): Promise<DbResult<CoinLedgerEntry[]>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("coin_ledger")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data: data ?? [], error: error ? new Error(error.message) : null };
}

/**
 * Fold an rpc call's two halves into the package's uniform result shape.
 *
 * A transport error still produces an `AuthorityResult`, so a caller that only
 * looks at `data` reads "not ok" rather than a success it never got.
 */
function toAuthorityResult(
  data: unknown,
  error: { message: string } | null,
): DbResult<AuthorityResult> {
  if (error) {
    return {
      data: { ...UNREACHABLE, reason: error.message },
      error: new Error(error.message),
    };
  }

  return { data: parseAuthorityResult(data), error: null };
}

/**
 * Turn the function's jsonb return into an `AuthorityResult`.
 *
 * Exported for the same reason the inventory and quest parsers are: the shape
 * comes from outside the type system, so an unexpected one has to become a
 * refusal rather than a throw. A client that crashes on a malformed answer is
 * worse than one that keeps playing on its own numbers.
 */
export function parseAuthorityResult(value: unknown): AuthorityResult {
  if (typeof value !== "object" || value === null) {
    return { ok: false, coins: null, reason: "bad_response" };
  }

  const record = value as Record<string, unknown>;
  const coins =
    typeof record.coins === "number" && Number.isFinite(record.coins)
      ? Math.max(0, Math.floor(record.coins))
      : null;

  if (record.ok === true) {
    // A success with no balance is not a success this layer can reconcile from.
    return coins === null
      ? { ok: false, coins: null, reason: "bad_response" }
      : { ok: true, coins, reason: null };
  }

  return {
    ok: false,
    coins,
    reason: typeof record.reason === "string" ? record.reason : "bad_response",
  };
}
