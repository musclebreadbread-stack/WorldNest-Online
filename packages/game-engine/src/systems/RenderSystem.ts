import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { PositionComponent } from "../components/PositionComponent";
import { SpriteComponent } from "../components/SpriteComponent";

export interface RenderData {
  entityId: string;
  x: number;
  y: number;
  textureKey: string;
  frame: number;
  visible: boolean;
}

/**
 * RenderSystem collects entity rendering data for the renderer to consume.
 * Acts as an interface between ECS and the actual rendering engine (Phaser).
 */
export class RenderSystem extends System {
  public renderData: RenderData[] = [];

  constructor() {
    super(["position", "sprite"]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    this.renderData = [];

    for (const entity of entities) {
      const position = entity.getComponent<PositionComponent>("position")!;
      const sprite = entity.getComponent<SpriteComponent>("sprite")!;

      this.renderData.push({
        entityId: entity.id,
        x: position.x,
        y: position.y,
        textureKey: sprite.textureKey,
        frame: sprite.frame,
        visible: sprite.visible,
      });
    }
  }
}
