export { DIALOGUE_DEFINITIONS, MAX_DIALOGUE_OPTIONS } from "./dialogueDefinitions";
export type {
  DialogueAction,
  DialogueDefinition,
  DialogueNode,
  DialogueOption,
} from "./dialogueDefinitions";
export {
  activeNode,
  advanceDialogue,
  closeDialogue,
  dialogueQuestIds,
  getDialogue,
  getNode,
  openDialogue,
  resolveOption,
} from "./dialogueOps";
export type { DialogueState } from "./dialogueOps";
