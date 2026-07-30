import { Component } from "../ecs/Component";

export class ChunkComponent extends Component {
  public chunkX: number;
  public chunkY: number;
  public tiles: number[][];

  constructor(chunkX: number, chunkY: number, tiles: number[][]) {
    super("chunk");
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.tiles = tiles;
  }
}
