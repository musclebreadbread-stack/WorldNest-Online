import Phaser from "phaser";

/**
 * UIScene provides a HUD overlay scene for player info displayed over the game.
 * Renders on top of the GameScene.
 */
export class UIScene extends Phaser.Scene {
  private positionText!: Phaser.GameObjects.Text;
  private chunkText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "UIScene" });
  }

  create(): void {
    // Position display
    this.positionText = this.add.text(10, 10, "Position: 0, 0", {
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#000000aa",
      padding: { x: 6, y: 4 },
    });
    this.positionText.setScrollFactor(0);
    this.positionText.setDepth(1000);

    // Chunk display
    this.chunkText = this.add.text(10, 34, "Chunk: 0, 0", {
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#000000aa",
      padding: { x: 6, y: 4 },
    });
    this.chunkText.setScrollFactor(0);
    this.chunkText.setDepth(1000);

    // Listen for position updates from GameScene
    this.game.events.on(
      "player-position",
      (data: { x: number; y: number; chunkX: number; chunkY: number }) => {
        this.positionText.setText(
          `Position: ${Math.round(data.x)}, ${Math.round(data.y)}`,
        );
        this.chunkText.setText(`Chunk: ${data.chunkX}, ${data.chunkY}`);
      },
    );
  }
}
