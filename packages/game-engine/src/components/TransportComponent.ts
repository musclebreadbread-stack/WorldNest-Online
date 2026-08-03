import { Component } from "../ecs/Component";
import type { MountState, TransportMode } from "../transport/transportState";

/**
 * Transport state for an entity.
 *
 * Tracks the current transport mode (walking, mounted, boating),
 * mount state when riding, and boat status. Pure data by design:
 * all transitions live in `transportOps.ts` and `TransportSystem.ts`.
 */
export class TransportComponent extends Component {
  /** Current mode of transport. */
  public mode: TransportMode;
  /** Active mount state when mode is "mounted", null otherwise. */
  public mountState: MountState | null;
  /** Whether the boat is currently active (mode is "boating"). */
  public boatActive: boolean;
  /** Total water tiles traversed (for achievement tracking). */
  public waterTilesTraversed: number;
  /** Bumped on every state change. */
  public version: number;

  constructor() {
    super("transport");
    this.mode = "walking";
    this.mountState = null;
    this.boatActive = false;
    this.waterTilesTraversed = 0;
    this.version = 0;
  }
}
