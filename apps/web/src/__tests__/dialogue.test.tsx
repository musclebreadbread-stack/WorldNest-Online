import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DIALOGUE_DEFINITIONS, NPC_DEFINITIONS } from "@worldnest/game-engine";
import type { DialogueComponent, InteractionComponent } from "@worldnest/game-engine";
import { DialoguePanel } from "../components/DialoguePanel";
import { wireDialogue } from "../game/DialogueBridge";
import { HudBridge, type HudEventEmitter } from "../game/HudBridge";
import {
  DIALOGUE_CHANGED_EVENT,
  type DialogueChangedEvent,
} from "../game/events";
import {
  createGameWorld,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
} from "../game/createGameWorld";
import { DEFAULT_LOCALE, isMessageKey } from "../i18n";
import { en } from "../i18n/messages/en";
import { ko } from "../i18n/messages/ko";
import { useDialogueStore, isDialogueOpen } from "../stores/dialogueStore";
import { useLocaleStore } from "../stores/localeStore";

const BOOTSTRAP = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
};

const PIP = DIALOGUE_DEFINITIONS.pip_welcome;
const PIP_ROOT = PIP.nodes[PIP.rootNodeId];

/** The snapshot `HudBridge` would publish for Pip's opening line. */
const PIP_SNAPSHOT: DialogueChangedEvent = {
  npcId: "villager_pip",
  nameKey: "npc.pip.name",
  textKey: PIP_ROOT.textKey,
  options: PIP_ROOT.options,
};

const CLOSED_SNAPSHOT: DialogueChangedEvent = {
  npcId: null,
  nameKey: null,
  textKey: null,
  options: [],
};

class RecordingEmitter implements HudEventEmitter {
  public events: Array<{ event: string; payload: unknown }> = [];

  emit(event: string, payload: unknown): unknown {
    this.events.push({ event, payload });
    return true;
  }

  dialogueEvents(): DialogueChangedEvent[] {
    return this.events
      .filter((entry) => entry.event === DIALOGUE_CHANGED_EVENT)
      .map((entry) => entry.payload as DialogueChangedEvent);
  }
}

function resetDialogueStore(): void {
  useDialogueStore.setState({
    ...CLOSED_SNAPSHOT,
    responder: null,
    closer: null,
  });
}

describe("dialogueStore", () => {
  beforeEach(resetDialogueStore);

  it("should start closed", () => {
    expect(useDialogueStore.getState().npcId).toBeNull();
    expect(isDialogueOpen()).toBe(false);
  });

  it("should mirror a snapshot and report the conversation open", () => {
    useDialogueStore.getState().setSnapshot(PIP_SNAPSHOT);

    expect(useDialogueStore.getState().textKey).toBe(PIP_ROOT.textKey);
    expect(useDialogueStore.getState().options).toHaveLength(
      PIP_ROOT.options.length,
    );
    expect(isDialogueOpen()).toBe(true);

    useDialogueStore.getState().setSnapshot(CLOSED_SNAPSHOT);
    expect(isDialogueOpen()).toBe(false);
  });

  it("should ignore answers before the game has injected its callbacks", () => {
    useDialogueStore.getState().setSnapshot(PIP_SNAPSHOT);

    // No throw, no state change: the game is simply not there yet
    useDialogueStore.getState().respond(0);
    useDialogueStore.getState().close();

    expect(useDialogueStore.getState().npcId).toBe("villager_pip");
  });
});

describe("DialogueBridge", () => {
  beforeEach(resetDialogueStore);

  it("should write the requested option onto the player's component", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue")!;
    wireDialogue(playerEntity);

    useDialogueStore.getState().respond(2);

    // React only ever raises a request; NpcSystem applies it (decision D13)
    expect(dialogue.requestedOption).toBe(2);
    expect(dialogue.nodeId).toBeNull();
  });

  it("should write the close request onto the player's component", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue")!;
    wireDialogue(playerEntity);

    useDialogueStore.getState().close();

    expect(dialogue.closeRequested).toBe(true);
  });

  it("should stop writing once torn down", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue")!;

    wireDialogue(playerEntity)();
    useDialogueStore.getState().respond(1);

    expect(dialogue.requestedOption).toBeNull();
    expect(useDialogueStore.getState().responder).toBeNull();
  });
});

describe("dialogue round trip", () => {
  beforeEach(resetDialogueStore);

  /** Stand the player next to an NPC, facing it, with the HUD wired both ways. */
  function createTalkingSession() {
    const probe = createGameWorld(BOOTSTRAP);
    probe.world.update(1 / 60);
    const npcEntity = [...probe.systems.npc.getNpcs().values()][0];
    const npcTile = npcEntity.getComponent<{ tileX: number; tileY: number }>("npc")!;

    const context = createGameWorld({
      ...BOOTSTRAP,
      spawnX: (npcTile.tileX - 1) * 32 + 16,
      spawnY: npcTile.tileY * 32 + 16,
    });
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, context.playerEntity, context.clockEntity);
    const unwire = wireDialogue(context.playerEntity);
    const interaction =
      context.playerEntity.getComponent<InteractionComponent>("interaction")!;
    interaction.facing = "right";

    /** One frame of the real loop: simulate, then publish. */
    const frame = () => {
      context.world.update(1 / 60);
      bridge.flush();
      useDialogueStore
        .getState()
        .setSnapshot(
          emitter.dialogueEvents().at(-1) ?? CLOSED_SNAPSHOT,
        );
    };

    return { context, emitter, interaction, frame, unwire };
  }

  it("should carry a conversation from an interact to the panel and back", () => {
    const { context, interaction, frame } = createTalkingSession();
    const dialogue =
      context.playerEntity.getComponent<DialogueComponent>("dialogue")!;

    // The player walks up and presses E
    interaction.interactRequested = true;
    frame();

    expect(isDialogueOpen()).toBe(true);
    const opened = useDialogueStore.getState();
    expect(opened.textKey).not.toBeNull();
    expect(opened.options.length).toBeGreaterThan(0);

    // The HUD picks the first option; the engine applies it next frame
    useDialogueStore.getState().respond(0);
    const nodeBefore = dialogue.nodeId;
    frame();

    expect(dialogue.nodeId).not.toBe(nodeBefore);
    expect(useDialogueStore.getState().textKey).not.toBe(opened.textKey);

    // Leaving closes it on both sides
    useDialogueStore.getState().close();
    frame();

    expect(dialogue.activeNpcId).toBeNull();
    expect(isDialogueOpen()).toBe(false);
  });
});

describe("HudBridge dialogue events", () => {
  it("should publish nothing while no conversation is open", () => {
    const { playerEntity, clockEntity } = createGameWorld(BOOTSTRAP);
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, playerEntity, clockEntity);

    bridge.flush();
    bridge.flush();

    expect(emitter.dialogueEvents()).toHaveLength(0);
  });

  it("should publish once per version change and not otherwise", () => {
    const { playerEntity, clockEntity } = createGameWorld(BOOTSTRAP);
    const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue")!;
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, playerEntity, clockEntity);

    // Stand in for NpcSystem: only a version bump is a publishable change
    dialogue.activeNpcId = "villager_pip";
    dialogue.dialogueId = "pip_welcome";
    dialogue.nodeId = PIP.rootNodeId;
    dialogue.version = 1;

    bridge.flush();
    bridge.flush();
    expect(emitter.dialogueEvents()).toHaveLength(1);

    const published = emitter.dialogueEvents()[0];
    expect(published.npcId).toBe("villager_pip");
    expect(published.nameKey).toBe("npc.pip.name");
    expect(published.textKey).toBe(PIP_ROOT.textKey);
    expect(published.options).toEqual(PIP_ROOT.options);

    dialogue.nodeId = "tips";
    dialogue.version = 2;
    bridge.flush();

    expect(emitter.dialogueEvents()).toHaveLength(2);
    expect(emitter.dialogueEvents()[1].textKey).toBe(PIP.nodes.tips.textKey);
  });

  it("should publish an empty payload when the conversation ends", () => {
    const { playerEntity, clockEntity } = createGameWorld(BOOTSTRAP);
    const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue")!;
    const emitter = new RecordingEmitter();
    const bridge = new HudBridge(emitter, playerEntity, clockEntity);

    dialogue.version = 3;
    bridge.flush();

    expect(emitter.dialogueEvents()).toEqual([
      { npcId: null, nameKey: null, textKey: null, options: [] },
    ]);
  });
});

describe("DialoguePanel", () => {
  beforeEach(() => {
    resetDialogueStore();
    useLocaleStore.setState({ locale: DEFAULT_LOCALE, hydrated: true });
  });

  afterEach(() => {
    cleanup();
    resetDialogueStore();
  });

  it("should render nothing while no conversation is open", () => {
    const { container } = render(<DialoguePanel />);

    expect(container.textContent).toBe("");
  });

  it("should render the NPC name, the line and every option", () => {
    useDialogueStore.getState().setSnapshot(PIP_SNAPSHOT);

    render(<DialoguePanel />);

    expect(screen.getByText(en["npc.pip.name"])).toBeDefined();
    expect(screen.getByText(en[PIP_ROOT.textKey as keyof typeof en])).toBeDefined();
    for (const option of PIP_ROOT.options) {
      expect(
        screen.getByText(en[option.labelKey as keyof typeof en], { exact: false }),
      ).toBeDefined();
    }
  });

  it("should call the injected responder with the option index", () => {
    const picked: number[] = [];
    useDialogueStore.getState().setSnapshot(PIP_SNAPSHOT);
    useDialogueStore
      .getState()
      .setCallbacks((optionIndex) => picked.push(optionIndex), () => undefined);

    render(<DialoguePanel />);
    const label = en[PIP_ROOT.options[1].labelKey as keyof typeof en];
    fireEvent.click(screen.getByText(label, { exact: false }));

    expect(picked).toEqual([1]);
  });

  it("should call the injected closer from the leave button", () => {
    let closed = 0;
    useDialogueStore.getState().setSnapshot(PIP_SNAPSHOT);
    useDialogueStore
      .getState()
      .setCallbacks(() => undefined, () => {
        closed++;
      });

    render(<DialoguePanel />);
    fireEvent.click(screen.getByText(en["dialogue.close"]));

    expect(closed).toBe(1);
  });

  it("should translate the whole conversation with the interface", () => {
    useDialogueStore.getState().setSnapshot(PIP_SNAPSHOT);
    useLocaleStore.setState({ locale: "ko", hydrated: true });

    render(<DialoguePanel />);

    expect(screen.getByText(ko["npc.pip.name"])).toBeDefined();
    expect(screen.getByText(ko[PIP_ROOT.textKey as keyof typeof ko])).toBeDefined();
    expect(screen.getByText(ko["dialogue.close"])).toBeDefined();
  });

  it("should show an unknown key verbatim rather than blank", () => {
    useDialogueStore.getState().setSnapshot({
      npcId: "mystery",
      nameKey: "npc.nobody.name",
      textKey: "dialogue.nobody.line",
      options: [{ labelKey: "dialogue.nobody.option", action: { kind: "close" } }],
    });

    render(<DialoguePanel />);

    expect(isMessageKey("dialogue.nobody.line")).toBe(false);
    expect(screen.getByText("dialogue.nobody.line")).toBeDefined();
  });
});

describe("engine catalogues against the message catalogue", () => {
  it("should resolve every NPC name key", () => {
    for (const definition of NPC_DEFINITIONS) {
      expect(isMessageKey(definition.nameKey), definition.id).toBe(true);
    }
  });
});
