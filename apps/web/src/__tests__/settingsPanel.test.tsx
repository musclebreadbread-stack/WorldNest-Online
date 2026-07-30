import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS } from "../i18n";
import { en } from "../i18n/messages/en";
import { ko } from "../i18n/messages/ko";
import { SettingsPanel } from "../components/SettingsPanel";
import { LOCALE_STORAGE_KEY, useLocaleStore } from "../stores/localeStore";
import { AUDIO_STORAGE_KEY, useAudioStore } from "../stores/audioStore";
import { useUIStore } from "../stores/uiStore";

describe("SettingsPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLocaleStore.setState({ locale: DEFAULT_LOCALE, hydrated: true });
    useAudioStore.setState({
      masterVolume: 0.6,
      musicVolume: 0.4,
      muted: false,
      hydrated: true,
    });
    useUIStore.setState({ settingsOpen: true });
  });

  afterEach(() => {
    cleanup();
    useUIStore.setState({ settingsOpen: false });
  });

  it("should render nothing while closed", () => {
    useUIStore.setState({ settingsOpen: false });

    const { container } = render(<SettingsPanel />);

    expect(container.textContent).toBe("");
  });

  it("should list every locale by its own endonym", () => {
    render(<SettingsPanel />);

    const select = screen.getByLabelText(en["settings.language"]) as HTMLSelectElement;
    expect(select.value).toBe("en");
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      ...LOCALES,
    ]);
    expect(Array.from(select.options).map((option) => option.text)).toEqual(
      LOCALES.map((locale) => LOCALE_LABELS[locale]),
    );
  });

  it("should update the locale store and persist the choice", () => {
    render(<SettingsPanel />);

    fireEvent.change(screen.getByLabelText(en["settings.language"]), {
      target: { value: "ko" },
    });

    expect(useLocaleStore.getState().locale).toBe("ko");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ko");
  });

  it("should re-render its own text in the newly chosen language", () => {
    render(<SettingsPanel />);
    expect(screen.getByText(en["settings.title"])).toBeDefined();

    fireEvent.change(screen.getByLabelText(en["settings.language"]), {
      target: { value: "ko" },
    });

    expect(screen.getByText(ko["settings.title"])).toBeDefined();
    expect(screen.getByText(ko["settings.close"])).toBeDefined();
    expect(screen.queryByText(en["settings.languageHint"])).toBeNull();
  });

  it("should close itself through the store", () => {
    render(<SettingsPanel />);

    fireEvent.click(screen.getByText(en["settings.close"]));

    expect(useUIStore.getState().settingsOpen).toBe(false);
  });

  it("should show each volume as a percentage of the stored fraction", () => {
    render(<SettingsPanel />);

    const master = screen.getByLabelText(en["settings.masterVolume"]);
    const music = screen.getByLabelText(en["settings.musicVolume"]);
    expect((master as HTMLInputElement).value).toBe("60");
    expect((music as HTMLInputElement).value).toBe("40");
    expect(screen.getByText("60%")).toBeDefined();
  });

  it("should write each slider back as a 0-1 fraction and persist it", () => {
    render(<SettingsPanel />);

    fireEvent.change(screen.getByLabelText(en["settings.masterVolume"]), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText(en["settings.musicVolume"]), {
      target: { value: "0" },
    });

    const state = useAudioStore.getState();
    expect(state.masterVolume).toBe(0.25);
    expect(state.musicVolume).toBe(0);
    expect(JSON.parse(window.localStorage.getItem(AUDIO_STORAGE_KEY)!)).toEqual({
      masterVolume: 0.25,
      musicVolume: 0,
      muted: false,
    });
  });

  it("should mute through the checkbox and disable the sliders", () => {
    render(<SettingsPanel />);

    fireEvent.click(screen.getByLabelText(en["settings.mute"]));

    expect(useAudioStore.getState().muted).toBe(true);
    // The levels are kept, just unreachable, so unmuting restores them
    expect(useAudioStore.getState().masterVolume).toBe(0.6);
    expect(
      (screen.getByLabelText(en["settings.masterVolume"]) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("should translate the sound rows with the rest of the panel", () => {
    render(<SettingsPanel />);

    fireEvent.change(screen.getByLabelText(en["settings.language"]), {
      target: { value: "ko" },
    });

    expect(screen.getByText(ko["settings.sound"])).toBeDefined();
    expect(screen.getByLabelText(ko["settings.masterVolume"])).toBeDefined();
    expect(screen.getByText(ko["settings.soundHint"])).toBeDefined();
  });
});
