import type { ItemId } from "@worldnest/shared";
import type { RoomType } from "./housingDefinitions";

/** A single piece of furniture placed in a room. */
export interface PlacedFurniture {
  itemId: ItemId;
  x: number;
  y: number;
}

/** Runtime state of a single room. */
export interface RoomState {
  type: RoomType;
  furniture: PlacedFurniture[];
  unlocked: boolean;
}

/** The full housing state stored on the entity. */
export interface HousingState {
  /** All rooms the player owns (locked ones exist but `unlocked` is false). */
  rooms: RoomState[];
  /** Currently active room type, or null when not inside the house. */
  activeRoom: RoomType | null;
  /** Overall happiness score derived from room contents (0-100). */
  happiness: number;
}
