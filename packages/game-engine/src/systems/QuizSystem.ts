import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { QuizComponent } from "../components/QuizComponent";
import { StatsComponent } from "../components/StatsComponent";
import { WalletComponent } from "../components/WalletComponent";
import {
  answerQuestion,
  calculateEnergyReward,
  calculateReward,
  canTakeQuiz,
  getDailyQuiz,
} from "../quiz/quizOps";

/** Injected day getter so the system stays decoupled from WorldClock. */
export type QuizDayGetter = () => number;

/** Optional listener invoked when a quiz streak reaches a threshold. */
export type QuizStreakListener = (streak: number) => void;

/**
 * QuizSystem manages the daily quiz mini-game lifecycle.
 *
 * It does NOT auto-advance on update; instead it exposes action methods that
 * the interaction layer calls when the player interacts with Professor Owl.
 * This keeps the system frame-update cheap (no-op) while quiz state changes
 * are driven by player input.
 *
 * Requires: quiz, inventory, stats. Also reads wallet for coin rewards.
 */
export class QuizSystem extends System {
  private readonly getDay: QuizDayGetter;
  private readonly onStreak: QuizStreakListener | undefined;

  constructor(getDay: QuizDayGetter, onStreak?: QuizStreakListener) {
    super(["quiz", "inventory", "stats"]);
    this.getDay = getDay;
    this.onStreak = onStreak;
  }

  /**
   * Frame update. Currently a no-op because quiz progression is driven by
   * player actions, not time. Kept for System interface compliance.
   */
  update(_entities: Entity[], _deltaTime: number): void {
    // Intentionally empty: quiz advances via action methods below.
  }

  /**
   * Start a new quiz session for the given entity. Returns false if the
   * entity cannot take the quiz today (cooldown not elapsed).
   */
  startQuiz(entity: Entity): boolean {
    const quiz = entity.getComponent<QuizComponent>("quiz");
    if (!quiz) return false;

    const currentDay = this.getDay();
    if (!canTakeQuiz(quiz.lastQuizDay, currentDay)) return false;

    quiz.currentQuestions = getDailyQuiz(currentDay);
    quiz.currentIndex = 0;
    quiz.answers = [];
    quiz.state = "active";
    quiz.version++;
    return true;
  }

  /**
   * Submit an answer for the current question. Returns true if the answer
   * was correct, false otherwise. Advances the question index.
   */
  submitAnswer(entity: Entity, answerIndex: number): boolean | null {
    const quiz = entity.getComponent<QuizComponent>("quiz");
    if (!quiz || quiz.state !== "active") return null;
    if (quiz.currentIndex >= quiz.currentQuestions.length) return null;

    const question = quiz.currentQuestions[quiz.currentIndex];
    const correct = answerQuestion(question, answerIndex);
    quiz.answers.push(correct);
    quiz.currentIndex++;
    quiz.version++;

    if (quiz.currentIndex >= quiz.currentQuestions.length) {
      quiz.state = "reviewing";
    }

    return correct;
  }

  /**
   * Finalize the quiz: pay out rewards, update streak, and set cooldown.
   * Must be called after the quiz reaches the "reviewing" state.
   */
  completeQuiz(entity: Entity): number {
    const quiz = entity.getComponent<QuizComponent>("quiz");
    const stats = entity.getComponent<StatsComponent>("stats");
    const wallet = entity.getComponent<WalletComponent>("wallet");
    if (!quiz || quiz.state !== "reviewing") return 0;

    const correctCount = quiz.answers.filter(Boolean).length;
    const currentDay = this.getDay();

    // Update streak: consecutive if last quiz was the previous day
    if (quiz.lastQuizDay === currentDay - 1) {
      quiz.streak++;
    } else {
      quiz.streak = 1;
    }

    const coins = calculateReward(correctCount, quiz.streak);

    if (wallet) {
      wallet.coins += coins;
    }

    if (stats) {
      stats.energy = Math.min(stats.energy + calculateEnergyReward(), stats.maxEnergy);
    }

    quiz.lastQuizDay = currentDay;
    quiz.state = "completed";
    quiz.version++;

    this.onStreak?.(quiz.streak);

    return coins;
  }
}
