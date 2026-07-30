import { create } from "zustand";

/** Where the volume and mute choices are remembered between sessions. */
export const AUDIO_STORAGE_KEY = "worldnest.audio";

/** Deliberately not 1: the game should never be the loudest tab. */
export const DEFAULT_MASTER_VOLUME = 0.6;
export const DEFAULT_MUSIC_VOLUME = 0.35;

/** The shape persisted to `localStorage`. */
interface PersistedAudio {
  masterVolume: number;
  musicVolume: number;
  muted: boolean;
}

interface AudioState extends PersistedAudio {
  /** Whether `hydrate()` has run; until then the defaults are in force. */
  hydrated: boolean;

  setMasterVolume: (masterVolume: number) => void;
  setMusicVolume: (musicVolume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  hydrate: () => void;
}

/**
 * Volume and mute, read every frame by `SoundManager` and edited by
 * `SettingsPanel`.
 *
 * Initial state is the defaults rather than the stored values, following
 * `localeStore`: every route is a client component but Next still prerenders
 * them, so touching `localStorage` at module scope would be a hydration
 * mismatch. `SoundManager` calls `hydrate()` once when the scene boots, which is
 * the first moment the browser's answer is safe to use and also the first moment
 * anything needs it.
 */
export const useAudioStore = create<AudioState>((set, get) => ({
  masterVolume: DEFAULT_MASTER_VOLUME,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  muted: false,
  hydrated: false,

  setMasterVolume: (masterVolume) => {
    set({ masterVolume: clampVolume(masterVolume) });
    persist(get());
  },

  setMusicVolume: (musicVolume) => {
    set({ musicVolume: clampVolume(musicVolume) });
    persist(get());
  },

  setMuted: (muted) => {
    set({ muted });
    persist(get());
  },

  toggleMuted: () => {
    set((state) => ({ muted: !state.muted }));
    persist(get());
  },

  hydrate: () => set({ ...readStoredAudio(), hydrated: true }),
}));

/** Volumes are fractions; anything else (including `NaN`) becomes silence. */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Stored settings if there are usable ones, otherwise the defaults. */
export function readStoredAudio(): PersistedAudio {
  const defaults: PersistedAudio = {
    masterVolume: DEFAULT_MASTER_VOLUME,
    musicVolume: DEFAULT_MUSIC_VOLUME,
    muted: false,
  };
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<PersistedAudio> | null;
    if (!parsed || typeof parsed !== "object") return defaults;

    return {
      masterVolume: readVolume(parsed.masterVolume, defaults.masterVolume),
      musicVolume: readVolume(parsed.musicVolume, defaults.musicVolume),
      muted: typeof parsed.muted === "boolean" ? parsed.muted : defaults.muted,
    };
  } catch {
    // Corrupt JSON or a private-browsing throw must not stop the game booting
    return defaults;
  }
}

function readVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clampVolume(value)
    : fallback;
}

function persist(state: PersistedAudio): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({
        masterVolume: state.masterVolume,
        musicVolume: state.musicVolume,
        muted: state.muted,
      }),
    );
  } catch {
    // Storage being unavailable must not stop the volume from changing
  }
}
