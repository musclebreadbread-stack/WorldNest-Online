import type { ItemId } from "@worldnest/shared";
import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { InventoryComponent } from "../components/InventoryComponent";
import { QuestComponent } from "../components/QuestComponent";
import { WalletComponent } from "../components/WalletComponent";
import { countItem } from "../inventory/inventoryOps";
import {
  activateQuest,
  completeQuest,
  offerQuest,
  pollProgress,
  recordTalk,
  type QuestProgressSource,
} from "../quests/questOps";

/** How many structures of a kind stand in the world. Backed by `BuildSystem`. */
export type StructureCounter = (itemId: ItemId) => number;

/**
 * QuestSystem is the only writer of quest state.
 *
 * Progress is **polled**, not evented: collecting counts the inventory and
 * building counts the structure index, both cheap and both already owned by
 * somebody else. The one objective that cannot be polled is `talk`, so
 * `NpcSystem` reports a greeting through the injected `recordTalk` and this
 * system applies it on its next update — the same "raise a flag, consume it next
 * frame" shape every other request in the engine uses.
 *
 * Registered after `NpcSystem` and `ShopSystem`, so a conversation that hands out
 * a quest and a greeting that finishes one both land in the frame they happened.
 */
export class QuestSystem extends System {
  private structureCount: StructureCounter;
  /** NPCs greeted since the last update, reported by `NpcSystem`. */
  private pendingTalks: Set<string> = new Set();

  constructor(structureCount: StructureCounter = () => 0) {
    super(["quest", "inventory", "wallet"]);
    this.structureCount = structureCount;
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const quest = entity.getComponent<QuestComponent>("quest")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;
      const source = this.progressSource(inventory);

      for (const npcId of this.pendingTalks) {
        recordTalk(quest, npcId);
      }

      if (quest.requestedOffer !== null) {
        this.accept(quest, quest.requestedOffer, source);
        quest.requestedOffer = null;
      }

      // Polled before the turn-in so handing in on the very frame the last item
      // arrived works, rather than needing one more frame
      pollProgress(quest, source);

      if (quest.requestedTurnIn !== null) {
        const questId = quest.requestedTurnIn;
        quest.requestedTurnIn = null;
        if (!completeQuest(quest, questId, inventory, wallet, source)) {
          quest.refusals++;
        }
      }
    }

    // Cleared unconditionally: a greeting nobody was there to hear is dropped
    // rather than queued forever.
    this.pendingTalks.clear();
  }

  /**
   * Note that the player said hello to an NPC. Injected into `NpcSystem`, which
   * is where a conversation actually starts.
   */
  recordTalk(npcId: string): void {
    this.pendingTalks.add(npcId);
  }

  /** Where `collect` and `build` objectives read their progress from. */
  private progressSource(inventory: InventoryComponent): QuestProgressSource {
    return {
      itemCount: (itemId) => countItem(inventory, itemId),
      structureCount: (itemId) => this.structureCount(itemId),
    };
  }

  /**
   * Take a quest on. Ada offers and accepts in one option, so this does both;
   * asking again for a quest already taken is a refusal, not a silent no-op.
   */
  private accept(
    quest: QuestComponent,
    questId: string,
    source: QuestProgressSource,
  ): void {
    offerQuest(quest, questId);
    if (!activateQuest(quest, questId, source)) quest.refusals++;
  }
}
