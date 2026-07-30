import { describe, it, expect } from "vitest";
import { DialogueComponent } from "../components/DialogueComponent";
import {
  DIALOGUE_DEFINITIONS,
  MAX_DIALOGUE_OPTIONS,
} from "../dialogue/dialogueDefinitions";
import {
  activeNode,
  advanceDialogue,
  closeDialogue,
  dialogueQuestIds,
  getDialogue,
  getNode,
  openDialogue,
  resolveOption,
} from "../dialogue/dialogueOps";

const DIALOGUE_IDS = Object.keys(DIALOGUE_DEFINITIONS);

/** A component fresh out of `createGameWorld`, used as the dialogue state. */
function createState(): DialogueComponent {
  return new DialogueComponent();
}

describe("DIALOGUE_DEFINITIONS", () => {
  it("should provide a tree per NPC with a reachable root", () => {
    expect(DIALOGUE_IDS.length).toBeGreaterThanOrEqual(3);

    for (const dialogueId of DIALOGUE_IDS) {
      const definition = DIALOGUE_DEFINITIONS[dialogueId];
      expect(getNode(definition, definition.rootNodeId), dialogueId).toBeDefined();
    }
  });

  it("should give every option either an existing next node or an action", () => {
    for (const dialogueId of DIALOGUE_IDS) {
      const definition = DIALOGUE_DEFINITIONS[dialogueId];

      for (const [nodeId, node] of Object.entries(definition.nodes)) {
        expect(node.options.length, `${dialogueId}.${nodeId}`).toBeGreaterThan(0);
        // The UI binds number keys 1-4, so a fifth option is unreachable
        expect(node.options.length, `${dialogueId}.${nodeId}`).toBeLessThanOrEqual(
          MAX_DIALOGUE_OPTIONS,
        );

        for (const option of node.options) {
          const label = `${dialogueId}.${nodeId} ${option.labelKey}`;
          expect(option.next !== undefined || option.action !== undefined, label).toBe(
            true,
          );
          if (option.next) {
            expect(getNode(definition, option.next), label).toBeDefined();
          }
        }
      }
    }
  });

  it("should let every node be left, so no conversation traps the player", () => {
    for (const dialogueId of DIALOGUE_IDS) {
      const definition = DIALOGUE_DEFINITIONS[dialogueId];

      for (const [nodeId, node] of Object.entries(definition.nodes)) {
        const canLeave = node.options.some(
          (option) => option.next !== undefined || option.action?.kind === "close",
        );
        expect(canLeave, `${dialogueId}.${nodeId}`).toBe(true);
      }
    }
  });

  it("should hold i18n keys rather than sentences (decision D8)", () => {
    for (const dialogueId of DIALOGUE_IDS) {
      const definition = DIALOGUE_DEFINITIONS[dialogueId];

      for (const node of Object.values(definition.nodes)) {
        expect(node.textKey).toMatch(/^dialogue\.[\w.]+$/);
        expect(node.textKey).not.toContain(" ");

        for (const option of node.options) {
          expect(option.labelKey).toMatch(/^dialogue\.[\w.]+$/);
          expect(option.labelKey).not.toContain(" ");
        }
      }
    }
  });

  it("should reach the shop and every starter quest from a dialogue option", () => {
    const actions = DIALOGUE_IDS.flatMap((dialogueId) =>
      Object.values(DIALOGUE_DEFINITIONS[dialogueId].nodes).flatMap((node) =>
        node.options.map((option) => option.action?.kind),
      ),
    );

    expect(actions).toContain("openShop");
    expect(actions).toContain("offerQuest");
    expect(actions).toContain("turnInQuest");
    // Every offered quest can also be handed in
    expect(dialogueQuestIds().sort()).toEqual(
      ["build_fence", "collect_wood", "greet_pip"].sort(),
    );
  });
});

describe("dialogue lookups", () => {
  it("should return undefined for an unknown tree, node or option index", () => {
    expect(getDialogue("not_a_dialogue")).toBeUndefined();

    const definition = DIALOGUE_DEFINITIONS.pip_welcome;
    expect(getNode(definition, "not_a_node")).toBeUndefined();
    expect(resolveOption(definition, definition.rootNodeId, 99)).toBeUndefined();
    expect(resolveOption(definition, definition.rootNodeId, -1)).toBeUndefined();
    expect(resolveOption(definition, definition.rootNodeId, 0.5)).toBeUndefined();
  });

  it("should report the node the state sits on", () => {
    const state = createState();
    expect(activeNode(state)).toBeUndefined();

    openDialogue(state, "villager_pip", "pip_welcome");

    expect(activeNode(state)).toBe(
      DIALOGUE_DEFINITIONS.pip_welcome.nodes[
        DIALOGUE_DEFINITIONS.pip_welcome.rootNodeId
      ],
    );
  });
});

describe("openDialogue", () => {
  it("should start at the root node and bump the version", () => {
    const state = createState();

    expect(openDialogue(state, "villager_pip", "pip_welcome")).toBe(true);

    expect(state.activeNpcId).toBe("villager_pip");
    expect(state.dialogueId).toBe("pip_welcome");
    expect(state.nodeId).toBe(DIALOGUE_DEFINITIONS.pip_welcome.rootNodeId);
    expect(state.version).toBe(1);
  });

  it("should refuse an unknown dialogue id without touching the state", () => {
    const state = createState();

    expect(openDialogue(state, "ghost", "not_a_dialogue")).toBe(false);

    expect(state.activeNpcId).toBeNull();
    expect(state.version).toBe(0);
  });
});

describe("advanceDialogue", () => {
  it("should follow next and bump the version", () => {
    const state = createState();
    openDialogue(state, "villager_pip", "pip_welcome");

    // Option 0 on Pip's root leads to the tips node
    expect(advanceDialogue(state, 0)).toBeNull();

    expect(state.nodeId).toBe("tips");
    expect(state.version).toBe(2);
  });

  it("should ignore an out-of-range option index", () => {
    const state = createState();
    openDialogue(state, "villager_pip", "pip_welcome");
    const nodeId = state.nodeId;

    expect(advanceDialogue(state, 7)).toBeNull();
    expect(advanceDialogue(state, -1)).toBeNull();

    expect(state.nodeId).toBe(nodeId);
    expect(state.version).toBe(1);
  });

  it("should do nothing when no conversation is open", () => {
    const state = createState();

    expect(advanceDialogue(state, 0)).toBeNull();

    expect(state.version).toBe(0);
  });

  it("should end the conversation on a close action", () => {
    const state = createState();
    openDialogue(state, "villager_pip", "pip_welcome");

    // Option 1 on Pip's root is the goodbye
    expect(advanceDialogue(state, 1)).toEqual({ kind: "close" });

    expect(state.activeNpcId).toBeNull();
    expect(state.dialogueId).toBeNull();
    expect(state.nodeId).toBeNull();
    expect(state.version).toBe(2);
  });

  it("should return a non-close action and leave the node in place", () => {
    const state = createState();
    openDialogue(state, "shopkeeper_juno", "juno_shop");
    const nodeId = state.nodeId;

    expect(advanceDialogue(state, 0)).toEqual({ kind: "openShop" });

    // The shop layer decides whether to close; the graph does not move itself
    expect(state.nodeId).toBe(nodeId);
    expect(state.activeNpcId).toBe("shopkeeper_juno");
    expect(state.version).toBe(1);
  });

  it("should return a quest action carrying its quest id", () => {
    const state = createState();
    openDialogue(state, "questgiver_ada", "ada_quests");
    advanceDialogue(state, 0); // to the quest board

    expect(advanceDialogue(state, 0)).toEqual({
      kind: "offerQuest",
      questId: "collect_wood",
    });
  });

  it("should walk back to the root through a back option", () => {
    const state = createState();
    openDialogue(state, "questgiver_ada", "ada_quests");
    const root = state.nodeId;

    advanceDialogue(state, 1); // report
    expect(state.nodeId).toBe("report");

    advanceDialogue(state, 3); // back
    expect(state.nodeId).toBe(root);
  });
});

describe("closeDialogue", () => {
  it("should clear the conversation and bump the version once", () => {
    const state = createState();
    openDialogue(state, "villager_pip", "pip_welcome");

    closeDialogue(state);
    expect(state.activeNpcId).toBeNull();
    expect(state.version).toBe(2);

    // Closing a closed conversation is a no-op, so React cannot spam versions
    closeDialogue(state);
    expect(state.version).toBe(2);
  });
});

describe("DialogueComponent", () => {
  it("should be data only, with both request flags clear", () => {
    const component = createState();

    expect(component.type).toBe("dialogue");
    expect(component.requestedOption).toBeNull();
    expect(component.closeRequested).toBe(false);
    expect(component.version).toBe(0);
  });
});
