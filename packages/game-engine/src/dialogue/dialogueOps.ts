import {
  DIALOGUE_DEFINITIONS,
  type DialogueAction,
  type DialogueDefinition,
  type DialogueNode,
  type DialogueOption,
} from "./dialogueDefinitions";

/**
 * The mutable part of a conversation. `DialogueComponent` satisfies this
 * structurally, so every rule below is a pure function over plain data and is
 * testable without an ECS world — the same split `inventoryOps` and
 * `animationOps` use.
 */
export interface DialogueState {
  activeNpcId: string | null;
  dialogueId: string | null;
  nodeId: string | null;
  version: number;
}

/** Tree for a dialogue id, or `undefined` when nothing is registered under it. */
export function getDialogue(dialogueId: string): DialogueDefinition | undefined {
  return DIALOGUE_DEFINITIONS[dialogueId];
}

/** Node inside a tree, or `undefined` when the id is unknown. */
export function getNode(
  definition: DialogueDefinition,
  nodeId: string,
): DialogueNode | undefined {
  return definition.nodes[nodeId];
}

/** Option at an index on a node, or `undefined` when either is out of range. */
export function resolveOption(
  definition: DialogueDefinition,
  nodeId: string,
  optionIndex: number,
): DialogueOption | undefined {
  const node = getNode(definition, nodeId);
  if (!node) return undefined;
  if (!Number.isInteger(optionIndex)) return undefined;

  return node.options[optionIndex];
}

/** Node a state is currently sitting on, or `undefined` when nothing is open. */
export function activeNode(state: DialogueState): DialogueNode | undefined {
  if (!state.dialogueId || !state.nodeId) return undefined;

  const definition = getDialogue(state.dialogueId);
  return definition ? getNode(definition, state.nodeId) : undefined;
}

/**
 * Start a conversation at its root node. Returns `false` and changes nothing
 * when the dialogue id or its root is unknown, so a bad catalogue entry cannot
 * strand the player in an empty box.
 */
export function openDialogue(
  state: DialogueState,
  npcId: string,
  dialogueId: string,
): boolean {
  const definition = getDialogue(dialogueId);
  if (!definition) return false;
  if (!getNode(definition, definition.rootNodeId)) return false;

  state.activeNpcId = npcId;
  state.dialogueId = dialogueId;
  state.nodeId = definition.rootNodeId;
  state.version++;
  return true;
}

/**
 * Choose an option on the current node.
 *
 * `next` moves the conversation, a `close` action ends it, and any other action
 * is returned untouched for the caller to act on — the shop and quest layers
 * decide for themselves whether to close afterwards. An unknown index is
 * ignored: nothing moves and the version does not change, so a stale click from
 * React cannot desync the panel.
 */
export function advanceDialogue(
  state: DialogueState,
  optionIndex: number,
): DialogueAction | null {
  if (!state.dialogueId || !state.nodeId) return null;

  const definition = getDialogue(state.dialogueId);
  if (!definition) return null;

  const option = resolveOption(definition, state.nodeId, optionIndex);
  if (!option) return null;

  if (option.action?.kind === "close") {
    closeDialogue(state);
    return option.action;
  }

  if (option.next && getNode(definition, option.next)) {
    state.nodeId = option.next;
    state.version++;
  }

  return option.action ?? null;
}

/** End the conversation. Bumps the version only when one was actually open. */
export function closeDialogue(state: DialogueState): void {
  if (!state.activeNpcId && !state.nodeId) return;

  state.activeNpcId = null;
  state.dialogueId = null;
  state.nodeId = null;
  state.version++;
}

/**
 * Every quest id any dialogue option refers to, de-duplicated.
 *
 * The quest catalogue does not exist yet (item 22), so this is the seam that
 * lets it assert the two agree instead of discovering a typo in play.
 */
export function dialogueQuestIds(): string[] {
  const ids = new Set<string>();

  for (const definition of Object.values(DIALOGUE_DEFINITIONS)) {
    for (const node of Object.values(definition.nodes)) {
      for (const option of node.options) {
        const action = option.action;
        if (action?.kind === "offerQuest" || action?.kind === "turnInQuest") {
          ids.add(action.questId);
        }
      }
    }
  }

  return [...ids];
}
