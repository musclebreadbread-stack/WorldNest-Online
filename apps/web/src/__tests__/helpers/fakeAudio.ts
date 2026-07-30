/**
 * A WebAudio test double.
 *
 * There is no audio device in the sandbox or in CI, and jsdom has no
 * `AudioContext` at all, so `SoundSynth` and `MusicLoop` take an
 * `AudioContextFactory` and the tests hand them this. It records what was
 * scheduled instead of making a sound, which is what lets "connects the
 * oscillator to a gain to the destination" be an assertion rather than a
 * listening session.
 *
 * Not a suite: Vitest's `include` is `src/__tests__/**\/*.test.ts?(x)`, so this
 * file is only ever imported.
 */

/** Records every scheduled value on one `AudioParam`. */
export class FakeAudioParam {
  value = 0;
  setValues: Array<{ value: number; time: number }> = [];
  ramps: Array<{ value: number; time: number; kind: "linear" | "exponential" }> = [];

  setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.setValues.push({ value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.ramps.push({ value, time, kind: "linear" });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.ramps.push({ value, time, kind: "exponential" });
    return this;
  }
}

export class FakeOscillatorNode {
  type: OscillatorType = "sine";
  frequency = new FakeAudioParam();
  connectedTo: unknown = null;
  disconnected = 0;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;

  connect(destination: unknown): unknown {
    this.connectedTo = destination;
    return destination;
  }

  disconnect(): void {
    this.disconnected += 1;
  }

  start(when: number): void {
    this.startedAt = when;
  }

  stop(when: number): void {
    this.stoppedAt = when;
  }
}

export class FakeGainNode {
  gain = new FakeAudioParam();
  connectedTo: unknown = null;
  disconnected = 0;

  connect(destination: unknown): unknown {
    this.connectedTo = destination;
    return destination;
  }

  disconnect(): void {
    this.disconnected += 1;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  state: "suspended" | "running" | "closed" = "running";
  destination = { name: "destination" };
  oscillators: FakeOscillatorNode[] = [];
  gains: FakeGainNode[] = [];
  resumed = 0;
  closed = 0;

  createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  resume(): Promise<void> {
    this.resumed += 1;
    this.state = "running";
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closed += 1;
    this.state = "closed";
    return Promise.resolve();
  }
}

/** A factory plus the context it produced, so a test can inspect both. */
export interface FakeContextFactory {
  create: () => AudioContext;
  /** How many times a context was constructed. */
  readonly created: number;
  /** The context, or `null` while nothing has asked for one. */
  readonly context: FakeAudioContext | null;
  /**
   * Move the fake clock, as if time had passed. Applies to the context that
   * already exists and to the next one, so it can be called before the first
   * `play` creates one.
   */
  startAt: (currentTime: number) => void;
  /** Make the next (or current) context start suspended, as a browser would. */
  suspend: () => void;
}

export function fakeContextFactory(): FakeContextFactory {
  let created = 0;
  let context: FakeAudioContext | null = null;
  let suspended = false;
  let clock = 0;

  return {
    create: () => {
      created += 1;
      context = new FakeAudioContext();
      context.currentTime = clock;
      if (suspended) context.state = "suspended";
      return context as unknown as AudioContext;
    },
    get created() {
      return created;
    },
    get context() {
      return context;
    },
    startAt: (currentTime: number) => {
      clock = currentTime;
      if (context) context.currentTime = currentTime;
    },
    suspend: () => {
      suspended = true;
      if (context) context.state = "suspended";
    },
  };
}
