import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QUEST_DEFINITIONS, addItem } from "@worldnest/game-engine";
import type {
  DialogueComponent,
  InventoryComponent,
  QuestComponent,
} from "@worldnest/game-engine";
import { QuestLog } from "../components/QuestLog";
import { QuestTracker } from "../components/QuestTracker";
import { wireDialogue } from "../game/DialogueBridge";
import { wireQuests } from "../game/QuestBridge";
import { HudBridge, type HudEventEmitter } from "../game/HudBridge";
import { closeTopmostPanel } from "../game/panelStack";
import { QUESTS_CHANGED_EVENT, type QuestsChangedEvent } from "../game/events";
import {
  createGameWorld,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
} from "../game/createGameWorld";
import { DEFAULT_LOCALE } from "../i18n";
import { en } from "../i18n/messages/en";
import { ko } from "../i18n/messages/ko";
import { useDialogueStore } from "../stores/dialogueStore";
import { useLocaleStore } from "../stores/localeStore";
import { orderedQuests, trackedQuest, useQuestStore } from "../stores/questStore";
import { useUIStore } from "../stores/uiStore";

const BOOTSTRAP = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
};

const WOOD_QUEST = QUEST_DEFINITIONS.collect_wood;

class RecordingEmitter implements HudEventEmitter {
  public events: Array<{ event: string; payload: unknown }> = [];

  emit(event: string, payload: unknown): unknown {
    this.events.push({ event, payload });
    return true;
  }

  questEvents(): QuestsChangedEvent[] {
    return this.events
      .filter((entry) => entry.event === QUESTS_CHANGED_EVENT)
      .map((entry) => entry.payload as QuestsChangedEvent);
  }
}

function resetQuestStore(): void {
  useQuestStore.setState({ entries: {}, accepter: null, turnerIn: null });
}

function resetDialogueStore(): void {
  useDialogueStore.setState({
    npcId: null,
    nameKey: null,
    textKey: null,
    options: [],
    responder: null,
    closer: null,
  });
}

describe("questStore", () => {
  beforeEach(resetQuestStore);

  it("should start empty and ignore requests before the game booted", () => {
    useQuestStore.getState().accept("collect_wood");
    useQuestStore.getState().turnIn("collect_wood");

    expect(useQuestStore.getState().entries).toEqual({});
  });

  it("should list known quests in catalogue order, whatever order they arrived", () => {
    useQuestStore.getState().setSnapshot({
      entries: {
        greet_pip: { state: "completed", progress: 1 },
        collect_wood: { state: "active", progress: 2 },
      },
    });

    expect(
      orderedQuests(useQuestStore.getState().entries).map((q) => q.questId),
    ).toEqual(["collect_wood", "greet_pip"]);
  });

  it("should track the first active quest and nothing else", () => {
    expect(trackedQuest({})).toBeNull();
    expect(
      trackedQuest({ collect_wood: { state: "available", progress: 0 } }),
    ).toBeNull();
    expect(
      trackedQuest({
        greet_pip: { state: "completed", progress: 1 },
        build_fence: { state: "active", progress: 1 },
      })?.questId,
    ).toBe("build_fence");
  });
});

describe("QuestBridge", () => {
  beforeEach(resetQuestStore);

  it("should write the offer and turn-in requests onto the player's component", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const quest = playerEntity.getComponent<QuestComponent>("quest")!;
    wireQuests(playerEntity);

    useQuestStore.getState().accept("collect_wood");
    expect(quest.requestedOffer).toBe("collect_wood");

    useQuestStore.getState().turnIn("collect_wood");
    expect(quest.requestedTurnIn).toBe("collect_wood");
    // React never writes the entry itself (decision D13)
    expect(quest.entries).toEqual({});
  });

  it("should stop writing once torn down", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const quest = playerEntity.getComponent<QuestComponent>("quest")!;

    wireQuests(playerEntity)();
    useQuestStore.getState().accept("collect_wood");

    expect(quest.requestedOffer).toBeNull();
  });
});

describe("quest dialogue actions", () => {
  beforeEach(() => {
    resetQuestStore();
    resetDialogueStore();
  });

  function openAdaQuestNode() {
    useDialogueStore.getState().setSnapshot({
      npcId: "questgiver_ada",
      nameKey: "npc.ada.name",
      textKey: "dialogue.ada.quests",
      options: [
        {
          labelKey: "dialogue.ada.option.wood",
          action: { kind: "offerQuest", questId: "collect_wood" },
        },
        {
          labelKey: "dialogue.ada.option.wood",
          action: { kind: "turnInQuest", questId: "collect_wood" },
        },
      ],
    });
  }

  it("should take the quest on and end the conversation", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue")!;
    const quest = playerEntity.getComponent<QuestComponent>("quest")!;
    wireDialogue(playerEntity);
    wireQuests(playerEntity);
    openAdaQuestNode();

    useDialogueStore.getState().respond(0);

    expect(quest.requestedOffer).toBe("collect_wood");
    expect(dialogue.closeRequested).toBe(true);
    expect(dialogue.requestedOption).toBeNull();
  });

  it("should hand the quest in and end the conversation", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const quest = playerEntity.getComponent<QuestComponent>("quest")!;
    wireDialogue(playerEntity);
    wireQuests(playerEntity);
    openAdaQuestNode();

    useDialogueStore.getState().respond(1);

    expect(quest.requestedTurnIn).toBe("collect_wood");
  });
});

describe("HudBridge quest events", () => {
  it("should publish nothing for an untouched quest log", () => {
    const context = createGameWorld(BOOTSTRAP);
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, context.playerEntity, context.clockEntity);

    bridge.flush();
    bridge.flush();

    expect(emitter.questEvents()).toHaveLength(0);
  });

  it("should publish a copy of the entries once per accepted change", () => {
    const context = createGameWorld(BOOTSTRAP);
    const quest = context.playerEntity.getComponent<QuestComponent>("quest")!;
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, context.playerEntity, context.clockEntity);

    quest.requestedOffer = "collect_wood";
    context.world.update(1 / 60);
    bridge.flush();
    bridge.flush();

    expect(emitter.questEvents()).toEqual([
      { entries: { collect_wood: { state: "active", progress: 0 } } },
    ]);

    // The published snapshot is a copy, so the next frame cannot mutate React's
    quest.entries.collect_wood.progress = 4;
    expect(emitter.questEvents()[0].entries.collect_wood.progress).toBe(0);
  });
});

describe("Escape and the quest log", () => {
  beforeEach(() => {
    resetQuestStore();
    resetDialogueStore();
    useUIStore.setState({
      inventoryOpen: false,
      settingsOpen: false,
      questLogOpen: false,
      buildMode: false,
    });
  });

  it("should close the quest log before the inventory", () => {
    useUIStore.setState({ questLogOpen: true, inventoryOpen: true });

    expect(closeTopmostPanel()).toBe(true);
    expect(useUIStore.getState().questLogOpen).toBe(false);
    expect(useUIStore.getState().inventoryOpen).toBe(true);
  });

  it("should toggle from the store the J key writes to", () => {
    useUIStore.getState().toggleQuestLog();
    expect(useUIStore.getState().questLogOpen).toBe(true);

    useUIStore.getState().toggleQuestLog();
    expect(useUIStore.getState().questLogOpen).toBe(false);
  });
});

describe("QuestLog", () => {
  beforeEach(() => {
    resetQuestStore();
    useLocaleStore.setState({ locale: DEFAULT_LOCALE, hydrated: true });
    useUIStore.setState({ questLogOpen: true });
  });

  afterEach(() => {
    cleanup();
    useUIStore.setState({ questLogOpen: false });
  });

  it("should render nothing while closed", () => {
    useUIStore.setState({ questLogOpen: false });

    const { container } = render(<QuestLog />);

    expect(container.textContent).toBe("");
  });

  it("should say so when no quest has been taken on", () => {
    render(<QuestLog />);

    expect(screen.getByText(en["quest.empty"])).toBeDefined();
  });

  it("should render a quest's title, description, state and progress", () => {
    useQuestStore
      .getState()
      .setSnapshot({ entries: { collect_wood: { state: "active", progress: 2 } } });

    render(<QuestLog />);

    expect(screen.getByText(en["quest.collect_wood.title"])).toBeDefined();
    expect(screen.getByText(en["quest.collect_wood.description"])).toBeDefined();
    expect(screen.getByText(en["quest.state.active"])).toBeDefined();
    expect(screen.getByText("2 / 5")).toBeDefined();
  });

  it("should only offer the hand-in button once the objective is met", () => {
    useQuestStore
      .getState()
      .setSnapshot({ entries: { collect_wood: { state: "active", progress: 4 } } });

    const { rerender } = render(<QuestLog />);
    expect(screen.queryByText(en["quest.turnIn"])).toBeNull();

    useQuestStore
      .getState()
      .setSnapshot({ entries: { collect_wood: { state: "active", progress: 5 } } });
    rerender(<QuestLog />);

    expect(screen.getByText(en["quest.turnIn"])).toBeDefined();
  });

  it("should call the injected turn-in with the quest id", () => {
    const handedIn: string[] = [];
    useQuestStore
      .getState()
      .setSnapshot({ entries: { collect_wood: { state: "active", progress: 5 } } });
    useQuestStore.getState().setCallbacks(null, (questId) => handedIn.push(questId));

    render(<QuestLog />);
    fireEvent.click(screen.getByText(en["quest.turnIn"]));

    expect(handedIn).toEqual(["collect_wood"]);
  });

  it("should translate the whole log with the interface", () => {
    useQuestStore
      .getState()
      .setSnapshot({ entries: { greet_pip: { state: "completed", progress: 1 } } });
    useLocaleStore.setState({ locale: "ko", hydrated: true });

    render(<QuestLog />);

    expect(screen.getByText(ko["quest.greet_pip.title"])).toBeDefined();
    expect(screen.getByText(ko["quest.state.completed"])).toBeDefined();
  });
});

describe("QuestTracker", () => {
  beforeEach(() => {
    resetQuestStore();
    useLocaleStore.setState({ locale: DEFAULT_LOCALE, hydrated: true });
  });

  afterEach(cleanup);

  it("should render nothing without an active quest", () => {
    useQuestStore
      .getState()
      .setSnapshot({ entries: { collect_wood: { state: "completed", progress: 5 } } });

    const { container } = render(<QuestTracker />);

    expect(container.textContent).toBe("");
  });

  it("should show the active quest's title and progress", () => {
    useQuestStore
      .getState()
      .setSnapshot({ entries: { collect_wood: { state: "active", progress: 1 } } });

    render(<QuestTracker />);

    expect(screen.getByText(en["quest.collect_wood.title"])).toBeDefined();
    expect(
      screen.getByText(`1 / ${WOOD_QUEST.objective.kind === "collect" ? 5 : 1}`),
    ).toBeDefined();
    expect(screen.getByText(en["quest.tracking"])).toBeDefined();
  });
});

describe("quest rewards through the whole loop", () => {
  it("should pay out coins and items once the objective is met", () => {
    const context = createGameWorld(BOOTSTRAP);
    const quest = context.playerEntity.getComponent<QuestComponent>("quest")!;
    const inventory =
      context.playerEntity.getComponent<InventoryComponent>("inventory")!;
    wireQuests(context.playerEntity);

    useQuestStore.getState().accept("collect_wood");
    context.world.update(1 / 60);
    expect(quest.entries.collect_wood.state).toBe("active");

    addItem(inventory, "wood", 5);
    context.world.update(1 / 60);
    expect(quest.entries.collect_wood.progress).toBe(5);

    useQuestStore.getState().turnIn("collect_wood");
    context.world.update(1 / 60);

    expect(quest.entries.collect_wood.state).toBe("completed");
    expect(quest.refusals).toBe(0);
  });
});
