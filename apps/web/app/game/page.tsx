"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GameUI } from "../../src/components/GameUI";
import { useTranslation } from "../../src/i18n/useTranslation";
import { useAuthStore } from "../../src/stores/authStore";

/** Shown while the Phaser bundle is still downloading. */
function GameLoading() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full items-center justify-center text-white">
      {t("game.loading")}
    </div>
  );
}

// Dynamically import GameCanvas to avoid SSR issues with Phaser (requires window)
const GameCanvas = dynamic(
  () =>
    import("../../src/components/GameCanvas").then((mod) => ({
      default: mod.GameCanvas,
    })),
  { ssr: false, loading: GameLoading },
);

export default function GamePage() {
  const { user, loading } = useAuthStore();
  const { t } = useTranslation();
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
        {t("common.loading")}
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
