import type { ItemId } from "@worldnest/shared";
import { InventoryComponent } from "../components/InventoryComponent";
import type { QuestEntry } from "../components/QuestComponent";
import { addItem } from "../inventory/inventoryOps";
import type { Wallet } from "../shop/shopOps";
import {
  getQuest,
  objectiveTarget,
  type QuestDefinition,
  type QuestObjective,
} from "./questDefinitions";

/**
 * The quest rules, as pure functions over plain data.
 *
 * `QuestComponent` satisfies `QuestLog` structurally, so every rule is testable
 * without an ECS world — the same split `inventoryOps`, `dialogueOps` and
 * `shopOps` use. Each function returns whether it changed anything and bumps
 * `version` when it did, which is what the HUD publishes off.
 */
export interface QuestLog {
  entries: Record<string, QuestEntry>;
  version: number;
}

/**
 * Where progress is measured from.
 *
 * `collect` counts the inventory and `build` counts placed structures, both by
 * polling. A `talk` objective cannot be polled — a visit is a moment, not a state
 * — so it is recorded by `recordTalk` and read back off the entry.
 */
export interface QuestProgressSource {
  itemCount(itemId: ItemId): number;
  structureCount(itemId: ItemId): number;
}

/** An entity's state for one quest, or `undefined` when it never heard of it. */
export function getEntry(log: QuestLog, questId: string): QuestEntry | undefined {
  return log.entries[questId];
}

/**
 * Record a quest as offered but not yet taken on. Unknown ids and quests already
 * known are left alone, so an option cannot reset progress.
 */
export function offerQuest(log: QuestLog, questId: string): boolean {
  if (!getQuest(questId)) return false;
  if (log.entries[questId]) return false;

  log.entries[questId] = { state: "available", progress: 0 };
  log.version++;
  return true;
}

/**
 * Take a quest on. Accepts one that was merely offered and one that was never
 * seen before, because Ada's tree offers and accepts in a single option — there
 * is no separate "yes please" node to walk to.
 */
export function activateQuest(log: QuestLog, questId: string): boolean {
  if (!getQuest(questId)) return false;

  const entry = log.entries[questId];
  if (entry && entry.state !== "available") return false;

  log.entries[questId] = { state: "active", progress: entry?.progress ?? 0 };
  log.version++;
  return true;
}

/** Progress an objective is at right now, clamped into `0..target`. */
export function objectiveProgress(
  objective: QuestObjective,
  entry: QuestEntry,
  source: QuestProgressSource,
): number {
  const target = objectiveTarget(objective);
  const raw =
    objective.kind === "collect"
      ? source.itemCount(objective.itemId)
      : objective.kind === "build"
        ? source.structureCount(objective.itemId)
        : entry.progress;

  return Math.max(0, Math.min(target, raw));
}

/** Whether a quest's objective is finished. */
export function isObjectiveMet(definition: QuestDefinition, progress: number): boolean {
  return progress >= objectiveTarget(definition.objective);
}

/**
 * Refresh every active quest's polled progress. Returns whether anything moved,
 * so the caller only publishes a real change.
 */
export function pollProgress(log: QuestLog, source: QuestProgressSource): boolean {
  let changed = false;

  for (const [questId, entry] of Object.entries(log.entries)) {
    if (entry.state !== "active") continue;

    const definition = getQuest(questId);
    if (!definition) continue;

    const progress = objectiveProgress(definition.objective, entry, source);
    if (progress === entry.progress) continue;

    entry.progress = progress;
    changed = true;
  }

  if (changed) log.version++;
  return changed;
}

/**
 * Note that the entity said hello to an NPC, completing any active `talk`
 * objective aimed at them. Called from `NpcSystem` through an injected callback.
 */
export function recordTalk(log: QuestLog, npcId: string): boolean {
  let changed = false;

  for (const [questId, entry] of Object.entries(log.entries)) {
    if (entry.state !== "active") continue;

    const definition = getQuest(questId);
    if (definition?.objective.kind !== "talk") continue;
    if (definition.objective.npcId !== npcId) continue;
    if (entry.progress >= 1) continue;

    entry.progress = 1;
    changed = true;
  }

  if (changed) log.version++;
  return changed;
}

/**
 * Hand a quest in: check it, pay it out, and mark it done.
 *
 * Refused — changing nothing at all — when the quest is not active, the objective
 * is not met, or the rewards would not fit. That last one matters: a reward the
 * backpack cannot hold would otherwise be destroyed while the quest was still
 * marked complete, which is the one failure `HarvestSystem` also refuses to make.
 */
export function completeQuest(
  log: QuestLog,
  questId: string,
  inventory: InventoryComponent,
  wallet: Wallet,
  source: QuestProgressSource,
): boolean {
  const definition = getQuest(questId);
  if (!definition) return false;

  const entry = log.entries[questId];
  if (!entry || entry.state !== "active") return false;

  const progress = objectiveProgress(definition.objective, entry, source);
  if (!isObjectiveMet(definition, progress)) return false;
  if (!rewardsFit(inventory, definition)) return false;

  for (const reward of definition.rewards.items) {
    addItem(inventory, reward.itemId, reward.quantity);
  }
  wallet.coins += definition.rewards.coins;

  entry.state = "completed";
  entry.progress = objectiveTarget(definition.objective);
  log.version++;
  return true;
}

/**
 * Whether every reward stack would fit, checked together rather than one at a
 * time: two rewards can each fit on their own and still not fit side by side.
 * Done by replaying the additions on a copy, so the answer cannot drift from what
 * `addItem` would actually do.
 */
function rewardsFit(
  inventory: InventoryComponent,
  definition: QuestDefinition,
): boolean {
  const probe = new InventoryComponent(inventory.slots.length);
  probe.slots = inventory.slots.map((slot) => (slot ? { ...slot } : null));

  for (const reward of definition.rewards.items) {
    if (addItem(probe, reward.itemId, reward.quantity) > 0) return false;
  }

  return true;
}
