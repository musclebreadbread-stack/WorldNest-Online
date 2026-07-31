/**
 * Pure functions for the quiz mini-game.
 *
 * No side effects, no imports from the ECS layer. All logic is deterministic
 * given the inputs, making it trivial to test without an entity world.
 */
import type { QuizQuestion } from "./quizDefinitions";
import {
  DAILY_QUIZ_COUNT,
  QUIZ_ENERGY_REWARD,
  QUIZ_QUESTIONS,
  QUIZ_REWARD_COINS,
  QUIZ_STREAK_BONUS_COINS,
} from "./quizDefinitions";

/**
 * Deterministically select daily quiz questions from the bank.
 *
 * Uses a simple seeded shuffle based on the day number so that every player
 * on the same in-game day gets the same questions but the set changes daily.
 */
export function getDailyQuiz(dayNumber: number): QuizQuestion[] {
  const shuffled = [...QUIZ_QUESTIONS];
  // Simple deterministic shuffle using day number as seed
  let seed = dayNumber * 2654435761;
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed ^ (seed >>> 13)) * 1597334677;
    seed = seed ^ (seed >>> 16);
    const j = Math.abs(seed) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, DAILY_QUIZ_COUNT);
}

/**
 * Check whether a selected answer index is correct for a given question.
 * Returns true when the option at `answerIndex` has `correct === true`.
 */
export function answerQuestion(question: QuizQuestion, answerIndex: number): boolean {
  const option = question.answerOptions[answerIndex];
  return option !== undefined && option.correct;
}

/**
 * Calculate coin reward for a quiz session.
 *
 * @param correctCount - Number of correctly answered questions.
 * @param streak - Current consecutive-day streak (before this session).
 * @returns Total coins earned for this quiz session.
 */
export function calculateReward(correctCount: number, streak: number): number {
  const base = correctCount * QUIZ_REWARD_COINS;
  const bonus = streak * QUIZ_STREAK_BONUS_COINS;
  return base + bonus;
}

/**
 * Calculate energy restored on quiz completion.
 * Always returns the fixed reward regardless of score.
 */
export function calculateEnergyReward(): number {
  return QUIZ_ENERGY_REWARD;
}

/**
 * Whether the player can take the quiz today.
 *
 * @param lastQuizDay - The last in-game day the player completed a quiz.
 * @param currentDay - The current in-game day number.
 * @returns true if the player has not yet taken the quiz today.
 */
export function canTakeQuiz(lastQuizDay: number, currentDay: number): boolean {
  return currentDay > lastQuizDay;
}
