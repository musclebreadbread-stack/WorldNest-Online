import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { TransportComponent } from "../components/TransportComponent";
import type { InventoryComponent } from "../components/InventoryComponent";
import { countItem, removeItem } from "../inventory/inventoryOps";
import type { ItemId } from "@worldnest/shared";
import {
  canBoard,
  canMount,
  dismount,
  feedMount,
  isMountExhausted,
  mount,
  tickMountStamina,
} from "../transport";

/** Called when a mount is first ridden (for achievements). */
export type MountRideListener = () => void;

/**
 * TransportSystem manages mounting, dismounting, boating, and stamina.
 *
 * - Checks for mount/dismount requests via interaction
 * - Drains stamina while mounted
 * - Forces dismount on exhaustion
 * - Tracks water tiles traversed for the sea_explorer achievement
 */
export class TransportSystem extends System {
  private onFirstRide?: MountRideListener;

  constructor(onFirstRide?: MountRideListener) {
    super(["position", "interaction", "inventory", "stats", "transport"]);
    this.onFirstRide = onFirstRide;
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const transport = entity.getComponent<TransportComponent>("transport")!;

      if (transport.mode === "mounted" && transport.mountState) {
        this.updateMounted(transport, deltaTime);
      }
    }
  }

  private updateMounted(transport: TransportComponent, deltaTime: number): void {
    if (!transport.mountState) return;

    // Drain stamina
    transport.mountState.stamina = tickMountStamina(
      transport.mountState.stamina,
      deltaTime,
    );

    // Force dismount on exhaustion
    if (isMountExhausted(transport.mountState)) {
      transport.mode = dismount();
      transport.mountState = null;
      transport.version++;
    }
  }

  /** Request to mount. Called by interaction handler. */
  requestMount(transport: TransportComponent, inventory: InventoryComponent): boolean {
    if (transport.mode !== "walking") return false;
    const species = canMount(inventory);
    if (!species) return false;

    transport.mode = "mounted";
    transport.mountState = mount(species);
    transport.version++;
    this.onFirstRide?.();
    return true;
  }

  /** Request to dismount. */
  requestDismount(transport: TransportComponent): boolean {
    if (transport.mode !== "mounted") return false;
    transport.mode = dismount();
    transport.mountState = null;
    transport.version++;
    return true;
  }

  /** Request to board a boat. */
  requestBoard(
    transport: TransportComponent,
    inventory: InventoryComponent,
    facingWater: boolean,
  ): boolean {
    if (transport.mode !== "walking") return false;
    if (!canBoard(inventory, facingWater)) return false;

    transport.mode = "boating";
    transport.boatActive = true;
    transport.version++;
    return true;
  }

  /** Request to disembark from a boat. */
  requestDisembark(transport: TransportComponent): boolean {
    if (transport.mode !== "boating") return false;
    transport.mode = "walking";
    transport.boatActive = false;
    transport.version++;
    return true;
  }

  /** Feed the current mount. */
  requestFeed(transport: TransportComponent, inventory: InventoryComponent): boolean {
    if (transport.mode !== "mounted" || !transport.mountState) return false;
    if (countItem(inventory, "animal_feed" as ItemId) < 1) return false;
    if (!removeItem(inventory, "animal_feed" as ItemId, 1)) return false;
    transport.mountState = feedMount(transport.mountState);
    transport.version++;
    return true;
  }

  /** Record a water tile traversed while boating (called by movement system). */
  recordWaterTile(transport: TransportComponent): void {
    if (transport.mode !== "boating") return;
    transport.waterTilesTraversed++;
  }
}
