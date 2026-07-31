import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  QUEST_DEFINITIONS,
  objectiveTarget,
  type QuestRewardItem,
} from "../quests/questDefinitions";

/**
 * The mirror of `packages/shared/src/__tests__/authoritySql.test.ts`, for the
 * other half of migration `004_authority_schema.sql`: `quest_rewards` is the
 * server's own copy of what a quest pays, and `worldnest_claim_quest_reward` is
 * the only thing in the system that can mark a quest completed. If the SQL and
 * `QUEST_DEFINITIONS` disagree, a player is paid the wrong amount or a finished
 * objective is refused, so the two are pinned to each other here.
 *
 * This suite lives in the engine because `QUEST_DEFINITIONS` does, and the price
 * half lives in `@worldnest/shared` because `ITEM_PRICES` does: each test is in
 * the package that owns the catalogue it is checking. Neither can live in
 * `@worldnest/database`, which has no Vitest harness by design.
 */
const MIGRATION = readFileSync(
  new URL(
    "../../../database/supabase/migrations/004_authority_schema.sql",
    import.meta.url,
  ),
  "utf8",
);

interface SqlReward {
  target: number;
  rewardCoins: number;
  rewardItems: QuestRewardItem[];
}

/** `('<quest>', <target>, <coins>, '<items>'::jsonb)` rows from the seed. */
function sqlRewards(): Map<string, SqlReward> {
  const start = MIGRATION.indexOf("insert into public.quest_rewards ");
  expect(start, "no insert into public.quest_rewards").toBeGreaterThan(-1);

  const block = MIGRATION.slice(start, MIGRATION.indexOf(";", start));
  const rows = new Map<string, SqlReward>();

  for (const match of block.matchAll(
    /\('([a-z_]+)',\s*(\d+),\s*(\d+),\s*'(\[.*?\])'::jsonb\)/g,
  )) {
    const [, questId, target, coins, items] = match;
    expect(rows.has(questId!), `${questId} is seeded twice`).toBe(false);
    rows.set(questId!, {
      target: Number(target),
      rewardCoins: Number(coins),
      rewardItems: JSON.parse(items!) as QuestRewardItem[],
    });
  }

  return rows;
}

describe("004_authority_schema.sql quest_rewards", () => {
  it("should seed a row for every quest, with the same target and rewards", () => {
    const rows = sqlRewards();

    for (const definition of Object.values(QUEST_DEFINITIONS)) {
      expect(rows.get(definition.id), `missing ${definition.id}`).toEqual({
        target: objectiveTarget(definition.objective),
        rewardCoins: definition.rewards.coins,
        rewardItems: definition.rewards.items,
      });
    }
  });

  it("should seed no row the catalogue does not have", () => {
    for (const questId of sqlRewards().keys()) {
      expect(QUEST_DEFINITIONS[questId], `${questId} is not a quest`).toBeDefined();
    }
  });

  it("should seed exactly as many rows as there are quests", () => {
    expect(sqlRewards().size).toBe(Object.keys(QUEST_DEFINITIONS).length);
  });
});
