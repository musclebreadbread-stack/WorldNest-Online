/**
 * Dialogue trees, one per NPC.
 *
 * Every player-visible string here is an **i18n key**, never a literal
 * (decision D8): the React panel resolves `textKey` and `labelKey` through the
 * message catalogue, which is what lets twelve languages share one graph. The
 * engine therefore never holds a sentence, and a missing translation is caught
 * by the web suite's "every engine key resolves in `en`" test.
 *
 * Tone is deliberately warm and low-stakes: the audience is 10-18 worldwide.
 */

/** What choosing an option does beyond moving to another node. */
export type DialogueAction =
  | { kind: "close" }
  | { kind: "openShop" }
  | { kind: "offerQuest"; questId: string }
  | { kind: "turnInQuest"; questId: string };

/**
 * One choice on a node. `next` moves to another node in the same tree; `action`
 * is handled by whoever consumed the option. An option may carry both, and an
 * option with neither is a dead end, which `dialogue.test.ts` forbids.
 */
export interface DialogueOption {
  labelKey: string;
  next?: string;
  action?: DialogueAction;
}

export interface DialogueNode {
  textKey: string;
  options: DialogueOption[];
}

export interface DialogueDefinition {
  rootNodeId: string;
  nodes: Record<string, DialogueNode>;
}

/**
 * Options a node may carry. The dialogue UI binds number keys `1`-`4` to the
 * options, so a fifth would be unreachable from the keyboard.
 */
export const MAX_DIALOGUE_OPTIONS = 4;

/**
 * Every dialogue tree, keyed by the `dialogueId` an NPC definition points at.
 *
 * `openShop`, `offerQuest` and `turnInQuest` are consumed by the shop and quest
 * layers (items 19-23); until those exist the actions are inert data, which is
 * why they are safe to author now.
 */
export const DIALOGUE_DEFINITIONS: Record<string, DialogueDefinition> = {
  // Pip the gardener: pure flavour and a nudge towards the farming loop.
  pip_welcome: {
    rootNodeId: "greeting",
    nodes: {
      greeting: {
        textKey: "dialogue.pip.greeting",
        options: [
          { labelKey: "dialogue.pip.option.tips", next: "tips" },
          { labelKey: "dialogue.option.bye", action: { kind: "close" } },
        ],
      },
      tips: {
        textKey: "dialogue.pip.tips",
        options: [
          { labelKey: "dialogue.option.back", next: "greeting" },
          { labelKey: "dialogue.option.bye", action: { kind: "close" } },
        ],
      },
    },
  },

  // Juno the shopkeeper: the only route into the shop panel.
  juno_shop: {
    rootNodeId: "greeting",
    nodes: {
      greeting: {
        textKey: "dialogue.juno.greeting",
        options: [
          { labelKey: "dialogue.juno.option.shop", action: { kind: "openShop" } },
          { labelKey: "dialogue.juno.option.prices", next: "prices" },
          { labelKey: "dialogue.option.bye", action: { kind: "close" } },
        ],
      },
      prices: {
        textKey: "dialogue.juno.prices",
        options: [
          { labelKey: "dialogue.juno.option.shop", action: { kind: "openShop" } },
          { labelKey: "dialogue.option.back", next: "greeting" },
          { labelKey: "dialogue.option.bye", action: { kind: "close" } },
        ],
      },
    },
  },

  // Ada the explorer: the quest board. One offer node and one report node, so
  // every starter quest is both taken and handed in through her.
  ada_quests: {
    rootNodeId: "greeting",
    nodes: {
      greeting: {
        textKey: "dialogue.ada.greeting",
        options: [
          { labelKey: "dialogue.ada.option.quests", next: "quests" },
          { labelKey: "dialogue.ada.option.report", next: "report" },
          { labelKey: "dialogue.option.bye", action: { kind: "close" } },
        ],
      },
      quests: {
        textKey: "dialogue.ada.quests",
        options: [
          {
            labelKey: "dialogue.ada.option.wood",
            action: { kind: "offerQuest", questId: "collect_wood" },
          },
          {
            labelKey: "dialogue.ada.option.fence",
            action: { kind: "offerQuest", questId: "build_fence" },
          },
          {
            labelKey: "dialogue.ada.option.greet",
            action: { kind: "offerQuest", questId: "greet_pip" },
          },
          { labelKey: "dialogue.option.back", next: "greeting" },
        ],
      },
      report: {
        textKey: "dialogue.ada.report",
        options: [
          {
            labelKey: "dialogue.ada.option.wood",
            action: { kind: "turnInQuest", questId: "collect_wood" },
          },
          {
            labelKey: "dialogue.ada.option.fence",
            action: { kind: "turnInQuest", questId: "build_fence" },
          },
          {
            labelKey: "dialogue.ada.option.greet",
            action: { kind: "turnInQuest", questId: "greet_pip" },
          },
          { labelKey: "dialogue.option.back", next: "greeting" },
        ],
      },
    },
  },
};
