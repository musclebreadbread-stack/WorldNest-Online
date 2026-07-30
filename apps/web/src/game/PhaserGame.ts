import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";
import { BOOTSTRAP_REGISTRY_KEY, type GameBootstrap } from "./createGameWorld";

/**
 * Create and return a Phaser game instance with the WorldNest configuration.
 * The bootstrap payload (player identity and spawn point) is published to the
 * game registry in `preBoot` so scenes can read it in `create()`.
 */
export function createPhaserGame(
  parent: string | HTMLElement,
  bootstrap: GameBootstrap,
): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    callbacks: {
      preBoot: (game) => {
        game.registry.set(BOOTSTRAP_REGISTRY_KEY, bootstrap);
      },
    },
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#1a1a2e",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, GameScene, UIScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    pixelArt: true,
    antialias: false,
  };

  return new Phaser.Game(config);
}
