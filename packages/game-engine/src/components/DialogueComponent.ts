import { Component } from "../ecs/Component";

/**
 * The conversation an entity is currently having, plus the two request flags
 * React writes through its injected callbacks (decision D13).
 *
 * `NpcSystem` is the only thing that changes the conversation itself: the HUD
 * raises `requestedOption` or `closeRequested` and the system consumes them on
 * the next frame, exactly as `interactRequested` works. `version` is bumped by
 * every accepted change so `HudBridge` can publish the panel without diffing the
 * whole node.
 */
export class DialogueComponent extends Component {
  public activeNpcId: string | null;
  public dialogueId: string | null;
  public nodeId: string | null;
  /** Option the HUD asked for, or `null` when nothing is pending. */
  public requestedOption: number | null;
  /** Whether the HUD asked to end the conversation. */
  public closeRequested: boolean;
  public version: number;

  constructor() {
    super("dialogue");
    this.activeNpcId = null;
    this.dialogueId = null;
    this.nodeId = null;
    this.requestedOption = null;
    this.closeRequested = false;
    this.version = 0;
  }
}
