import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import { MusicComponent } from "../components/MusicComponent";
import { MusicSystem } from "../systems/MusicSystem";
import { addItem } from "../inventory/inventoryOps";
import {
  canStartRhythm,
  startSong,
  tickRhythm,
  hitNote,
  completeSong,
  composeMelody,
  getComboMultiplier,
  NOTE_TIMING_PERFECT_MS,
  NOTE_TIMING_GOOD_MS,
  SONG_DEFINITIONS,
  COMPOSE_MIN_NOTES,
  COMPOSE_MAX_NOTES,
} from "../music";

function createHarness(onComplete?: (perfects: number, score: number) => void) {
  const inventory = new InventoryComponent();
  const wallet = new WalletComponent();
  const music = new MusicComponent();
  const entity = new Entity("player")
    .addComponent(inventory)
    .addComponent(wallet)
    .addComponent(music);
  addItem(inventory, "rhythm_drum", 1);
  const system = new MusicSystem(onComplete);
  return { entity, music, inventory, wallet, system };
}

describe("canStartRhythm", () => {
  it("returns false with no instrument", () => {
    expect(canStartRhythm(new InventoryComponent())).toBe(false);
  });

  it("returns true with any instrument", () => {
    const inv = new InventoryComponent();
    addItem(inv, "rhythm_harp", 1);
    expect(canStartRhythm(inv)).toBe(true);
  });
});

describe("startSong", () => {
  it("returns playing state with song info", () => {
    const song = SONG_DEFINITIONS[0];
    const result = startSong(song);
    expect(result.state).toBe("playing");
    expect(result.songId).toBe(song.id);
    expect(result.totalNotes).toBe(song.notes.length);
  });
});

describe("tickRhythm", () => {
  it("emits notes between lastTime and currentTime", () => {
    const notes = [
      { timing: 500, lane: 0 },
      { timing: 1000, lane: 1 },
      { timing: 1500, lane: 2 },
    ];
    const result = tickRhythm(notes, 400, 1100);
    expect(result.pendingNotes).toHaveLength(2);
    expect(result.pendingNotes[0].timing).toBe(500);
  });

  it("reports songEnded when past last note + good window", () => {
    expect(tickRhythm([{ timing: 500, lane: 0 }], 600, 700).songEnded).toBe(true);
  });

  it("does not report songEnded while notes remain reachable", () => {
    expect(tickRhythm([{ timing: 500, lane: 0 }], 0, 400).songEnded).toBe(false);
  });
});

describe("hitNote", () => {
  it("returns perfect when within perfect window", () => {
    expect(hitNote(1000, 1000 + NOTE_TIMING_PERFECT_MS)).toBe("perfect");
    expect(hitNote(1000, 1000)).toBe("perfect");
  });

  it("returns good when outside perfect but within good window", () => {
    expect(hitNote(1000, 1000 + NOTE_TIMING_PERFECT_MS + 10)).toBe("good");
  });

  it("returns miss when outside good window", () => {
    expect(hitNote(1000, 1000 + NOTE_TIMING_GOOD_MS + 10)).toBe("miss");
  });
});

describe("completeSong", () => {
  it("calculates total score from perfect and good counts", () => {
    const { score, coins } = completeSong(5, 3, 2, 5);
    expect(score.totalScore).toBe(5 * 100 + 3 * 50);
    expect(score.perfectCount).toBe(5);
    expect(score.goodCount).toBe(3);
    expect(score.missCount).toBe(2);
    expect(score.maxCombo).toBe(5);
    expect(coins).toBeGreaterThan(0);
  });

  it("adds combo bonus coins", () => {
    const { coins: low } = completeSong(3, 3, 0, 3);
    const { coins: high } = completeSong(3, 3, 0, 9);
    expect(high).toBeGreaterThan(low);
  });
});

describe("composeMelody", () => {
  it("rejects too short or too long sequences", () => {
    const short = Array.from({ length: COMPOSE_MIN_NOTES - 1 }, (_, i) => ({
      timing: i * 100,
      lane: 0,
    }));
    const long = Array.from({ length: COMPOSE_MAX_NOTES + 1 }, (_, i) => ({
      timing: i * 100,
      lane: 0,
    }));
    expect(composeMelody(short)).toBe(false);
    expect(composeMelody(long)).toBe(false);
  });

  it("accepts valid sequences", () => {
    const notes = Array.from({ length: 8 }, (_, i) => ({
      timing: i * 200,
      lane: i % 4,
    }));
    expect(composeMelody(notes)).toBe(true);
  });

  it("rejects invalid lanes or negative timing", () => {
    const badLane = [
      { timing: 0, lane: 0 },
      { timing: 100, lane: 5 },
      { timing: 200, lane: 1 },
      { timing: 300, lane: 2 },
    ];
    const badTiming = [
      { timing: -100, lane: 0 },
      { timing: 100, lane: 1 },
      { timing: 200, lane: 2 },
      { timing: 300, lane: 3 },
    ];
    expect(composeMelody(badLane)).toBe(false);
    expect(composeMelody(badTiming)).toBe(false);
  });
});

describe("getComboMultiplier", () => {
  it("returns 1x for combo below 5", () => {
    expect(getComboMultiplier(0)).toBe(1);
    expect(getComboMultiplier(4)).toBe(1);
  });

  it("returns 1.5x for combo 5-9 and caps at 3x", () => {
    expect(getComboMultiplier(5)).toBe(1.5);
    expect(getComboMultiplier(9)).toBe(1.5);
    expect(getComboMultiplier(100)).toBe(3);
  });
});

describe("MusicSystem", () => {
  it("requires inventory, music, and wallet components", () => {
    const { system, entity } = createHarness();
    expect(system.matches(entity)).toBe(true);
    const partial = new Entity("npc").addComponent(new InventoryComponent());
    expect(system.matches(partial)).toBe(false);
  });

  it("processes idle state without errors", () => {
    const { system, entity, music } = createHarness();
    system.update([entity], 1 / 60);
    expect(music.state).toBe("idle");
  });

  it("advances timer and detects song end", () => {
    const { system, entity, music } = createHarness();
    const song = SONG_DEFINITIONS[0];
    music.state = "playing";
    music.currentSongId = song.id;
    music.noteIndex = song.notes.length;
    system.update([entity], 5);
    expect(music.state).toBe("idle");
  });

  it("processes hit requests and tracks combo", () => {
    const { system, entity, music } = createHarness();
    const song = SONG_DEFINITIONS[0];
    music.state = "playing";
    music.currentSongId = song.id;
    music.songTimer = song.notes[0].timing;
    music.noteIndex = 0;
    music.requestHit = true;
    music.requestHitLane = song.notes[0].lane;
    system.update([entity], 0.001);
    expect(music.perfectCount).toBe(1);
    expect(music.combo).toBe(1);
  });

  it("resets combo on miss", () => {
    const { system, entity, music } = createHarness();
    const song = SONG_DEFINITIONS[0];
    music.state = "playing";
    music.currentSongId = song.id;
    music.songTimer = song.notes[0].timing;
    music.noteIndex = 0;
    music.combo = 5;
    music.maxCombo = 5;
    music.requestHit = true;
    music.requestHitLane = 3; // wrong lane
    system.update([entity], 0.001);
    expect(music.combo).toBe(0);
    expect(music.missCount).toBe(1);
  });

  it("awards coins on song completion", () => {
    let calls = 0;
    const { system, entity, music, wallet } = createHarness(() => calls++);
    const song = SONG_DEFINITIONS[0];
    music.state = "playing";
    music.currentSongId = song.id;
    music.noteIndex = song.notes.length;
    music.perfectCount = 3;
    music.goodCount = 2;
    music.maxCombo = 3;
    const before = wallet.coins;
    system.update([entity], 5);
    expect(wallet.coins).toBeGreaterThan(before);
    expect(calls).toBe(1);
  });

  it("resets to idle when instrument removed mid-song", () => {
    const { system, entity, music, inventory } = createHarness();
    music.state = "playing";
    music.currentSongId = SONG_DEFINITIONS[0].id;
    inventory.slots.fill(null);
    system.update([entity], 1);
    expect(music.state).toBe("idle");
  });

  it("misses notes that pass the grace window", () => {
    const { system, entity, music } = createHarness();
    const song = SONG_DEFINITIONS[0];
    music.state = "playing";
    music.currentSongId = song.id;
    music.noteIndex = 0;
    system.update([entity], 1); // 1000ms past first note at 667ms
    expect(music.missCount).toBeGreaterThanOrEqual(1);
  });
});
