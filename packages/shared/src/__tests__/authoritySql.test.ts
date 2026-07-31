import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { ITEM_PRICES, STARTING_COINS } from "../economy";
import { isItemId } from "../items";

/**
 * Migration `004_authority_schema.sql` carries the server's own copy of the price
 * list, because a client that could name its own price would not be a client the
 * server has authority over. Two copies of a catalogue is a drift bug waiting to
 * happen, so this suite reads the SQL and compares it to `ITEM_PRICES` in both
 * directions: a price changed here without the migration fails, and a row left in
 * the migration for an item that no longer exists fails too.
 *
 * The SQL is read rather than parsed by a database, because `@worldnest/database`
 * has no Vitest harness by design (every module there needs a live client) and
 * because the thing at risk is the *text a maintainer pastes*, which is exactly
 * what this reads. Whether the SQL is valid is `pnpm db:verify`'s job.
 */
const MIGRATION = readFileSync(
  new URL(
    "../../../database/supabase/migrations/004_authority_schema.sql",
    import.meta.url,
  ),
  "utf8",
);

/** The `values` list of one `insert into public.<table>`, up to its semicolon. */
function insertBlock(table: string): string {
  const start = MIGRATION.indexOf(`insert into public.${table} `);
  expect(start, `no insert into public.${table}`).toBeGreaterThan(-1);

  const end = MIGRATION.indexOf(";", start);
  expect(end, `unterminated insert into public.${table}`).toBeGreaterThan(start);

  return MIGRATION.slice(start, end);
}

/** `('<item>', <buy>, <sell>)` rows from the `shop_prices` seed. */
function sqlPrices(): Map<string, { buy: number; sell: number }> {
  const rows = new Map<string, { buy: number; sell: number }>();

  for (const match of insertBlock("shop_prices").matchAll(
    /\('([a-z_]+)',\s*(\d+),\s*(\d+)\)/g,
  )) {
    const [, itemId, buy, sell] = match;
    expect(rows.has(itemId!), `${itemId} is seeded twice`).toBe(false);
    rows.set(itemId!, { buy: Number(buy), sell: Number(sell) });
  }

  return rows;
}

describe("004_authority_schema.sql shop_prices", () => {
  it("should seed a row for every priced item, with the same numbers", () => {
    const rows = sqlPrices();

    for (const [itemId, price] of Object.entries(ITEM_PRICES)) {
      expect(rows.get(itemId), `shop_prices is missing ${itemId}`).toEqual(price);
    }
  });

  it("should seed no row the price table does not have", () => {
    const priced = new Set<string>(Object.keys(ITEM_PRICES));

    for (const itemId of sqlPrices().keys()) {
      expect(isItemId(itemId), `${itemId} is not an item id`).toBe(true);
      expect(priced.has(itemId), `${itemId} is not priced`).toBe(true);
    }
  });

  it("should seed exactly as many rows as there are prices", () => {
    expect(sqlPrices().size).toBe(Object.keys(ITEM_PRICES).length);
  });
});

describe("004_authority_schema.sql player_state.coins", () => {
  it("should default the starting purse to STARTING_COINS", () => {
    const match = /alter column coins set default (\d+)/.exec(MIGRATION);

    expect(match, "no coins default in the migration").not.toBeNull();
    expect(Number(match![1])).toBe(STARTING_COINS);
  });

  it("should backfill pre-authority rows with the same amount", () => {
    const match = /set coins = (\d+) where coins = 0/.exec(MIGRATION);

    expect(match, "no coins backfill in the migration").not.toBeNull();
    expect(Number(match![1])).toBe(STARTING_COINS);
  });
});
