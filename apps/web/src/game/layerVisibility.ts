import { WorldLayer } from "@worldnest/game-engine";
import type { PlayerComponent, RenderData, World } from "@worldnest/game-engine";

/** Underground presentation contains only the local player. */
export function isRenderDataVisibleOnLayer(
  data: RenderData,
  world: World,
  layer: WorldLayer,
): boolean {
  if (layer === WorldLayer.SURFACE) return true;

  const player = world
    .getEntity(data.entityId)
    ?.getComponent<PlayerComponent>("player");
  return player?.isLocal === true;
}

/** Filter the data source itself so hidden entities cannot retain name tags. */
export function filterRenderDataForLayer(
  renderData: RenderData[],
  world: World,
  layer: WorldLayer,
): RenderData[] {
  return renderData.filter((data) => isRenderDataVisibleOnLayer(data, world, layer));
}

/** Whether a layer-tagged tile change belongs to the currently drawn terrain. */
export function isActiveLayerChange(
  activeLayer: WorldLayer,
  changedLayer: WorldLayer,
): boolean {
  return activeLayer === changedLayer;
}
