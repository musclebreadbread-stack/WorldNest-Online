"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useGameStore } from "../stores/gameStore";
import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";
import { useDialogueStore } from "../stores/dialogueStore";
import { useQuestStore } from "../stores/questStore";
import { useShopStore } from "../stores/shopStore";
import { RealtimeManager } from "@worldnest/database";
import type { GameScene } from "../game/scenes/GameScene";
import { wireChat } from "../game/ChatBridge";
import {
  CLOCK_CHANGED_EVENT,
  DIALOGUE_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  PLAYERS_CHANGED_EVENT,
  PLAYER_POSITION_EVENT,
  QUESTS_CHANGED_EVENT,
  SHOP_CHANGED_EVENT,
  STATS_CHANGED_EVENT,
  WALLET_CHANGED_EVENT,
  type ClockChangedEvent,
  type DialogueChangedEvent,
  type InventoryChangedEvent,
  type PlayerPositionEvent,
  type PlayersChangedEvent,
  type QuestsChangedEvent,
  type ShopChangedEvent,
  type StatsChangedEvent,
  type WalletChangedEvent,
} from "../game/events";

/**
 * GameCanvas mounts/unmounts the Phaser game instance.
 * Handles resize and communicates with React state via Phaser events.
 * Creates and wires a RealtimeManager for multiplayer once the user is authenticated.
 */
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const realtimeRef = useRef<RealtimeManager | null>(null);
  const unwireChatRef = useRef<(() => void) | null>(null);
  /** World the session persists to, or `null` without a database. */
  const worldIdRef = useRef<string | null>(null);
  const [gameReady, setGameReady] = useState(false);
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition);
  const addOnlinePlayer = useGameStore((s) => s.addOnlinePlayer);
  const removeOnlinePlayer = useGameStore((s) => s.removeOnlinePlayer);
  const updateOnlinePlayer = useGameStore((s) => s.updateOnlinePlayer);
  const setInventory = useGameStore((s) => s.setInventory);
  const setStats = useGameStore((s) => s.setStats);
  const setCoins = useGameStore((s) => s.setCoins);
  const setClock = useUIStore((s) => s.setClock);
  const setDialogue = useDialogueStore((s) => s.setSnapshot);
  const setShop = useShopStore((s) => s.setSnapshot);
  const setQuests = useQuestStore((s) => s.setSnapshot);
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);

  const initGame = useCallback(async () => {
    if (gameRef.current || !containerRef.current) return;

    // Dynamic import to avoid SSR issues (Phaser requires window)
    const { createPhaserGame } = await import("../game/PhaserGame");
    const { DEFAULT_SPAWN_X, DEFAULT_SPAWN_Y } = await import(
      "../game/createGameWorld"
    );
    const { loadSession } = await import("../game/loadSession");

    // Saved world and player state, or null when Supabase is unconfigured
    const session = await loadSession(user?.id ?? null);
    worldIdRef.current = session?.worldId ?? null;

    const game = createPhaserGame(containerRef.current, {
      playerId: user?.id ?? "local",
      username: user?.username ?? "Player",
      spawnX: session?.spawnX ?? DEFAULT_SPAWN_X,
      spawnY: session?.spawnY ?? DEFAULT_SPAWN_Y,
      worldId: session?.worldId ?? null,
      inventory: session?.inventory ?? null,
      savedWorld: session?.savedWorld ?? null,
    });
    gameRef.current = game;

    // Listen for player position updates
    game.events.on(PLAYER_POSITION_EVENT, (data: PlayerPositionEvent) => {
      setPlayerPosition(data.x, data.y, data.chunkX, data.chunkY);
    });

    // Mirror the world clock into the HUD store
    game.events.on(CLOCK_CHANGED_EVENT, (snapshot: ClockChangedEvent) => {
      setClock(snapshot);
    });

    // Mirror the local player's inventory into the HUD store
    game.events.on(INVENTORY_CHANGED_EVENT, (event: InventoryChangedEvent) => {
      setInventory(event.slots, event.selectedSlot);
    });

    // Mirror the local player's health/energy into the HUD store
    game.events.on(STATS_CHANGED_EVENT, (event: StatsChangedEvent) => {
      setStats(event);
    });

    // Mirror the active NPC conversation into the dialogue store
    game.events.on(DIALOGUE_CHANGED_EVENT, (event: DialogueChangedEvent) => {
      setDialogue(event);
    });

    // Mirror the coin purse and the open shop into their stores
    game.events.on(WALLET_CHANGED_EVENT, (event: WalletChangedEvent) => {
      setCoins(event.coins);
    });

    game.events.on(SHOP_CHANGED_EVENT, (event: ShopChangedEvent) => {
      setShop(event);
    });

    // Mirror the quest log into its store
    game.events.on(QUESTS_CHANGED_EVENT, (event: QuestsChangedEvent) => {
      setQuests(event);
    });

    // Mirror remote player joins/leaves/moves into the React store
    game.events.on(PLAYERS_CHANGED_EVENT, (event: PlayersChangedEvent) => {
      switch (event.type) {
        case "join":
          addOnlinePlayer({
            playerId: event.playerId,
            username: event.username,
            x: event.x,
            y: event.y,
          });
          break;
        case "leave":
          removeOnlinePlayer(event.playerId);
          break;
        case "move":
          updateOnlinePlayer(event.playerId, event.x, event.y);
          break;
      }
    });

    // Track when the game scene is ready so the realtime wiring effect can fire
    game.events.once("game-ready", () => {
      setGameReady(true);
    });
  }, [
    setPlayerPosition,
    addOnlinePlayer,
    removeOnlinePlayer,
    updateOnlinePlayer,
    setInventory,
    setStats,
    setCoins,
    setClock,
    setDialogue,
    setShop,
    setQuests,
    user,
  ]);

  useEffect(() => {
    // Wait until the session has resolved so the player entity gets the real
    // user id/username rather than the anonymous fallback.
    if (authLoading) return;

    initGame();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [initGame, authLoading]);

  // Wire RealtimeManager to the GameScene once user is authenticated and game is ready
  useEffect(() => {
    if (!user || !gameRef.current || !gameReady) return;

    const game = gameRef.current;

    const wireRealtime = () => {
      const scene = game.scene.getScene("GameScene") as GameScene | null;
      if (!scene) return;

      const manager = new RealtimeManager(user.id, user.username);
      realtimeRef.current = manager;

      scene.setRealtimeManager(manager);
      // Chat is wired from React rather than the scene: the composer lives in
      // the HUD, and history has to be loaded before the first message arrives.
      unwireChatRef.current = wireChat(manager, worldIdRef.current);
      manager.joinRoom("default");
    };

    // If the scene is already active, wire immediately; otherwise wait for game-ready
    const scene = game.scene.getScene("GameScene");
    if (scene && scene.scene.isActive()) {
      wireRealtime();
    } else {
      game.events.once("game-ready", wireRealtime);
    }

    return () => {
      game.events.off("game-ready", wireRealtime);
      unwireChatRef.current?.();
      unwireChatRef.current = null;
      if (realtimeRef.current) {
        realtimeRef.current.leaveRoom();
        realtimeRef.current = null;
      }
    };
  }, [user, gameReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
