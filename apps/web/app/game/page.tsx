"use client";

export default function GamePage() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Phaser canvas will be mounted here */}
      <div id="game-container" className="h-full w-full" />
      <div className="absolute left-4 top-4 rounded bg-black/50 px-3 py-1 text-sm text-white">
        WorldNest Online - Game View
      </div>
    </main>
  );
}
