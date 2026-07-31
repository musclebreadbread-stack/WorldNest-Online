/**
 * Animal behavior state machine types.
 *
 * Animals cycle through behaviors: idle, wander, flee (when a player is
 * within range), follow (when tamed and near their owner), or tamed_idle
 * (tamed but owner is far away).
 */
export type AnimalBehavior = "idle" | "wander" | "flee" | "follow" | "tamed_idle";
