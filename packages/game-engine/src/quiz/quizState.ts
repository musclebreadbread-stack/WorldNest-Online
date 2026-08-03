/**
 * Quiz state machine type.
 *
 * - idle: No quiz active, player can start one.
 * - active: Quiz in progress, awaiting answers.
 * - reviewing: All questions answered, showing results.
 * - completed: Results acknowledged, rewards paid out.
 */
export type QuizState = "idle" | "active" | "reviewing" | "completed";
