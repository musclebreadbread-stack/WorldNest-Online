import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS } from "../i18n";
import { en } from "../i18n/messages/en";
import { ko } from "../i18n/messages/ko";
import { SettingsPanel } from "../components/SettingsPanel";
import { LOCALE_STORAGE_KEY, useLocaleStore } from "../stores/localeStore";
import { useUIStore } from "../stores/uiStore";

describe("SettingsPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLocaleStore.setState({ locale: DEFAULT_LOCALE, hydrated: true });
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
});
