"use client";

import dynamic from "next/dynamic";
import { GameUI } from "../../src/components/GameUI";

// Dynamically import GameCanvas to avoid SSR issues with Phaser (requires window)
const GameCanvas = dynamic(
  () => import("../../src/components/GameCanvas").then((mod) => ({ default: mod.GameCanvas })),
  { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center text-white">Loading game...</div> },
);

export default function GamePage() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <GameCanvas />
      <GameUI />
    </main>
  );
}
