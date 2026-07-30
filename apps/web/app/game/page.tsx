"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GameUI } from "../../src/components/GameUI";
import { useAuthStore } from "../../src/stores/authStore";

// Dynamically import GameCanvas to avoid SSR issues with Phaser (requires window)
const GameCanvas = dynamic(
  () => import("../../src/components/GameCanvas").then((mod) => ({ default: mod.GameCanvas })),
  { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center text-white">Loading game...</div> },
);

export default function GamePage() {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-black text-white">
        Loading...
      </main>
    );
  }

  // Don't render game if not authenticated
  if (!user) {
    return null;
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <GameCanvas />
      <GameUI />
    </main>
  );
}
