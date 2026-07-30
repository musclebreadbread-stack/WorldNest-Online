import type { ItemId } from "@worldnest/shared";
import { Component } from "../ecs/Component";

/**
 * A player-placed structure occupying exactly one tile.
 *
 * `collidable` is copied from the item definition at placement time so collision
 * never has to reach back into the catalogue.
 */
export class StructureComponent extends Component {
  public itemId: ItemId;
  public tileX: number;
  public tileY: number;
  public collidable: boolean;

  constructor(itemId: ItemId, tileX: number, tileY: number, collidable: boolean) {
    super("structure");
    this.itemId = itemId;
    this.tileX = tileX;
    this.tileY = tileY;
    this.collidable = collidable;
  }
}
