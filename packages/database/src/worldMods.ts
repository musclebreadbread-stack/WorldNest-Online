import { createSupabaseClient } from "./client";
import type { DbResult, Tables } from "./types";

export type WorldModification = Tables<"world_modifications">;
export type Structure = Tables<"structures">;
export type Crop = Tables<"crops">;

/** A tile the player base has changed, in the shape the engine overlay wants. */
export interface WorldModificationSave {
  layer: number;
  tileX: number;
  tileY: number;
  tileType: number;
  modifiedBy: string;
}

/** A placed structure. `itemId` is the item that was consumed to build it. */
export interface StructureSave {
  ownerId: string;
  itemId: string;
  tileX: number;
  tileY: number;
}

/** A sown crop. `itemId` is the *seed*; `plantedAtMinute` is world-clock time. */
export interface CropSave extends StructureSave {
  plantedAtMinute: number;
}

function toError(error: { message: string } | null): Error | null {
  return error ? new Error(error.message) : null;
}

/** Every terrain change in a world; applied as the engine's override layer. */
export async function loadWorldModifications(
  worldId: string,
): Promise<DbResult<WorldModification[]>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("world_modifications")
    .select("*")
    .eq("world_id", worldId);

  return { data: data ?? [], error: toError(error) };
}

/** Upsert one changed tile; the primary key includes its world layer. */
export async function saveWorldModification(
  worldId: string,
  modification: WorldModificationSave,
): Promise<DbResult<null>> {
  const client = createSupabaseClient();
  const { error } = await client.from("world_modifications").upsert(
    {
      world_id: worldId,
      layer: modification.layer,
      tile_x: modification.tileX,
      tile_y: modification.tileY,
      tile_type: modification.tileType,
      modified_by: modification.modifiedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "world_id,layer,tile_x,tile_y" },
  );

  return { data: null, error: toError(error) };
}

export async function loadStructures(worldId: string): Promise<DbResult<Structure[]>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("structures")
    .select("*")
    .eq("world_id", worldId);

  return { data: data ?? [], error: toError(error) };
}

/** Upsert a structure; one structure per tile is enforced by a unique index. */
export async function saveStructure(
  worldId: string,
  structure: StructureSave,
): Promise<DbResult<null>> {
  const client = createSupabaseClient();
  const { error } = await client.from("structures").upsert(
    {
      world_id: worldId,
      owner_id: structure.ownerId,
      item_id: structure.itemId,
      tile_x: structure.tileX,
      tile_y: structure.tileY,
    },
    { onConflict: "world_id,tile_x,tile_y" },
  );

  return { data: null, error: toError(error) };
}

export async function deleteStructure(
  worldId: string,
  tileX: number,
  tileY: number,
): Promise<DbResult<null>> {
  const client = createSupabaseClient();
  const { error } = await client
    .from("structures")
    .delete()
    .eq("world_id", worldId)
    .eq("tile_x", tileX)
    .eq("tile_y", tileY);

  return { data: null, error: toError(error) };
}

export async function loadCrops(worldId: string): Promise<DbResult<Crop[]>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("crops")
    .select("*")
    .eq("world_id", worldId);

  return { data: data ?? [], error: toError(error) };
}

/** Upsert a crop; one crop per tile is enforced by a unique index. */
export async function saveCrop(
  worldId: string,
  crop: CropSave,
): Promise<DbResult<null>> {
  const client = createSupabaseClient();
  const { error } = await client.from("crops").upsert(
    {
      world_id: worldId,
      owner_id: crop.ownerId,
      item_id: crop.itemId,
      tile_x: crop.tileX,
      tile_y: crop.tileY,
      planted_at_minute: crop.plantedAtMinute,
    },
    { onConflict: "world_id,tile_x,tile_y" },
  );

  return { data: null, error: toError(error) };
}

export async function deleteCrop(
  worldId: string,
  tileX: number,
  tileY: number,
): Promise<DbResult<null>> {
  const client = createSupabaseClient();
  const { error } = await client
    .from("crops")
    .delete()
    .eq("world_id", worldId)
    .eq("tile_x", tileX)
    .eq("tile_y", tileY);

  return { data: null, error: toError(error) };
}
