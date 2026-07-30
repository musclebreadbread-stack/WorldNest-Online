import { AUTOSAVE_INTERVAL_MS } from "@worldnest/shared";

export type SaveHandler = () => void;
export type Clock = () => number;

/**
 * Dirty-flag debouncer for autosaving.
 *
 * The game loop marks state dirty far more often than it is worth writing, so
 * the scheduler collapses those marks into at most one save per interval, while
 * `flush()` bypasses the interval for page unload and unmount. Kept free of any
 * Supabase or Phaser reference so the timing rules can be unit-tested.
 */
export class SaveScheduler {
  private save: SaveHandler;
  private intervalMs: number;
  private now: Clock;
  private dirty = false;
  private lastSaveAt: number;

  constructor(
    save: SaveHandler,
    intervalMs: number = AUTOSAVE_INTERVAL_MS,
    now: Clock = Date.now,
  ) {
    this.save = save;
    this.intervalMs = intervalMs;
    this.now = now;
    this.lastSaveAt = now();
  }

  /** Whether there is state waiting to be written. */
  get isDirty(): boolean {
    return this.dirty;
  }

  /** Record that the persisted state is out of date. */
  markDirty(): void {
    this.dirty = true;
  }

  /** Save if dirty and the interval has elapsed. Call once per frame. */
  tick(): void {
    if (!this.dirty) return;
    if (this.now() - this.lastSaveAt < this.intervalMs) return;

    this.run();
  }

  /** Save immediately if dirty, ignoring the interval. */
  flush(): void {
    if (!this.dirty) return;

    this.run();
  }

  private run(): void {
    this.dirty = false;
    this.lastSaveAt = this.now();
    this.save();
  }
}
