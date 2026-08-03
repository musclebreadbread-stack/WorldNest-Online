import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { QuizComponent } from "../components/QuizComponent";
import { StatsComponent } from "../components/StatsComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import { QuizSystem } from "../systems/QuizSystem";
import {
  QUIZ_QUESTIONS,
  DAILY_QUIZ_COUNT,
  QUIZ_REWARD_COINS,
  QUIZ_STREAK_BONUS_COINS,
  QUIZ_ENERGY_REWARD,
} from "../quiz/quizDefinitions";
import {
  getDailyQuiz,
  answerQuestion,
  calculateReward,
  calculateEnergyReward,
  canTakeQuiz,
} from "../quiz/quizOps";

describe("quizDefinitions", () => {
  it("should have exactly 16 questions", () => {
    expect(QUIZ_QUESTIONS.length).toBe(16);
  });

  it("should cover 4 categories: nature, science, culture, geography", () => {
    const categories = new Set(QUIZ_QUESTIONS.map((q) => q.category));
    expect(categories.size).toBe(4);
    expect(categories.has("nature")).toBe(true);
    expect(categories.has("science")).toBe(true);
    expect(categories.has("culture")).toBe(true);
    expect(categories.has("geography")).toBe(true);
  });

  it("should have exactly one correct answer per question", () => {
    for (const question of QUIZ_QUESTIONS) {
      const correctCount = question.answerOptions.filter((opt) => opt.correct).length;
      expect(correctCount).toBe(1);
    }
  });

  it("should have unique question ids", () => {
    const ids = QUIZ_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have at least 3 answer options per question", () => {
    for (const question of QUIZ_QUESTIONS) {
      expect(question.answerOptions.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("getDailyQuiz", () => {
  it("should return DAILY_QUIZ_COUNT questions", () => {
    expect(getDailyQuiz(1).length).toBe(DAILY_QUIZ_COUNT);
  });

  it("should be deterministic: same day returns same questions", () => {
    const a = getDailyQuiz(42).map((q) => q.id);
    const b = getDailyQuiz(42).map((q) => q.id);
    expect(a).toEqual(b);
  });

  it("should produce different results for different days", () => {
    const a = getDailyQuiz(1)
      .map((q) => q.id)
      .join(",");
    const b = getDailyQuiz(2)
      .map((q) => q.id)
      .join(",");
    expect(a).not.toBe(b);
  });

  it("should only contain questions from the bank", () => {
    const allIds = new Set(QUIZ_QUESTIONS.map((q) => q.id));
    for (const question of getDailyQuiz(100)) {
      expect(allIds.has(question.id)).toBe(true);
    }
  });

  it("should remain deterministic at high day numbers (> 3500)", () => {
    const a = getDailyQuiz(5000).map((q) => q.id);
    const b = getDailyQuiz(5000).map((q) => q.id);
    expect(a).toEqual(b);
  });

  it("should produce different results for high day numbers", () => {
    const a = getDailyQuiz(5000)
      .map((q) => q.id)
      .join(",");
    const b = getDailyQuiz(5001)
      .map((q) => q.id)
      .join(",");
    expect(a).not.toBe(b);
  });
});

describe("answerQuestion", () => {
  it("should return true for the correct answer", () => {
    const q = QUIZ_QUESTIONS[0];
    const idx = q.answerOptions.findIndex((o) => o.correct);
    expect(answerQuestion(q, idx)).toBe(true);
  });

  it("should return false for an incorrect answer", () => {
    const q = QUIZ_QUESTIONS[0];
    const idx = q.answerOptions.findIndex((o) => !o.correct);
    expect(answerQuestion(q, idx)).toBe(false);
  });

  it("should return false for out-of-bounds index", () => {
    expect(answerQuestion(QUIZ_QUESTIONS[0], 99)).toBe(false);
  });
});

describe("calculateReward", () => {
  it("should give base coins per correct answer", () => {
    expect(calculateReward(3, 0)).toBe(3 * QUIZ_REWARD_COINS);
  });

  it("should add streak bonus", () => {
    expect(calculateReward(2, 3)).toBe(
      2 * QUIZ_REWARD_COINS + 3 * QUIZ_STREAK_BONUS_COINS,
    );
  });

  it("should return 0 for 0 correct and 0 streak", () => {
    expect(calculateReward(0, 0)).toBe(0);
  });
});

describe("calculateEnergyReward", () => {
  it("should return fixed energy amount", () => {
    expect(calculateEnergyReward()).toBe(QUIZ_ENERGY_REWARD);
  });
});

describe("canTakeQuiz", () => {
  it("should allow quiz on a new day", () => {
    expect(canTakeQuiz(5, 6)).toBe(true);
  });

  it("should block quiz on the same day", () => {
    expect(canTakeQuiz(5, 5)).toBe(false);
  });

  it("should allow quiz when lastQuizDay is 0", () => {
    expect(canTakeQuiz(0, 1)).toBe(true);
  });
});

describe("QuizSystem", () => {
  function createEntity() {
    const entity = new Entity("player_1");
    entity.addComponent(new QuizComponent());
    entity.addComponent(new InventoryComponent());
    entity.addComponent(new StatsComponent(100, 100));
    entity.addComponent(new WalletComponent());
    return entity;
  }

  function answerAll(system: QuizSystem, entity: Entity) {
    for (let i = 0; i < DAILY_QUIZ_COUNT; i++) system.submitAnswer(entity, 0);
  }

  it("should start a quiz successfully", () => {
    const entity = createEntity();
    const system = new QuizSystem(() => 5);
    expect(system.startQuiz(entity)).toBe(true);
    const quiz = entity.getComponent<QuizComponent>("quiz")!;
    expect(quiz.state).toBe("active");
    expect(quiz.currentQuestions.length).toBe(DAILY_QUIZ_COUNT);
  });

  it("should enforce cooldown (cannot start twice same day)", () => {
    const entity = createEntity();
    const system = new QuizSystem(() => 5);
    system.startQuiz(entity);
    answerAll(system, entity);
    system.completeQuiz(entity);
    expect(system.startQuiz(entity)).toBe(false);
  });

  it("should record answers correctly", () => {
    const entity = createEntity();
    const system = new QuizSystem(() => 5);
    system.startQuiz(entity);
    const quiz = entity.getComponent<QuizComponent>("quiz")!;
    const idx = quiz.currentQuestions[0].answerOptions.findIndex((o) => o.correct);
    expect(system.submitAnswer(entity, idx)).toBe(true);
    expect(quiz.answers[0]).toBe(true);
    expect(quiz.currentIndex).toBe(1);
  });

  it("should transition to reviewing after all answers", () => {
    const entity = createEntity();
    const system = new QuizSystem(() => 5);
    system.startQuiz(entity);
    answerAll(system, entity);
    expect(entity.getComponent<QuizComponent>("quiz")!.state).toBe("reviewing");
  });

  it("should pay out coins on completion", () => {
    const entity = createEntity();
    const system = new QuizSystem(() => 5);
    system.startQuiz(entity);
    const quiz = entity.getComponent<QuizComponent>("quiz")!;
    for (let i = 0; i < DAILY_QUIZ_COUNT; i++) {
      const idx = quiz.currentQuestions[i].answerOptions.findIndex((o) => o.correct);
      system.submitAnswer(entity, idx);
    }
    const coins = system.completeQuiz(entity);
    expect(coins).toBeGreaterThan(0);
    expect(entity.getComponent<WalletComponent>("wallet")!.coins).toBe(coins);
  });

  it("should restore energy on completion", () => {
    const entity = createEntity();
    const stats = entity.getComponent<StatsComponent>("stats")!;
    stats.energy = 50;
    const system = new QuizSystem(() => 5);
    system.startQuiz(entity);
    answerAll(system, entity);
    system.completeQuiz(entity);
    expect(stats.energy).toBe(50 + QUIZ_ENERGY_REWARD);
  });

  it("should not exceed max energy on restore", () => {
    const entity = createEntity();
    entity.getComponent<StatsComponent>("stats")!.energy = 95;
    const system = new QuizSystem(() => 5);
    system.startQuiz(entity);
    answerAll(system, entity);
    system.completeQuiz(entity);
    expect(entity.getComponent<StatsComponent>("stats")!.energy).toBe(100);
  });

  it("should track streak for consecutive days and reset on skip", () => {
    const entity = createEntity();
    let currentDay = 5;
    const system = new QuizSystem(() => currentDay);
    const quiz = entity.getComponent<QuizComponent>("quiz")!;

    // Day 5 -> streak 1
    system.startQuiz(entity);
    answerAll(system, entity);
    system.completeQuiz(entity);
    expect(quiz.streak).toBe(1);

    // Day 6 -> streak 2
    currentDay = 6;
    system.startQuiz(entity);
    answerAll(system, entity);
    system.completeQuiz(entity);
    expect(quiz.streak).toBe(2);

    // Day 7 -> streak 3
    currentDay = 7;
    system.startQuiz(entity);
    answerAll(system, entity);
    system.completeQuiz(entity);
    expect(quiz.streak).toBe(3);

    // Skip day 8, go to day 9 -> streak resets to 1
    currentDay = 9;
    system.startQuiz(entity);
    answerAll(system, entity);
    system.completeQuiz(entity);
    expect(quiz.streak).toBe(1);
  });

  it("should invoke streak listener on completion", () => {
    const entity = createEntity();
    let reportedStreak = 0;
    const system = new QuizSystem(
      () => 5,
      (s) => {
        reportedStreak = s;
      },
    );
    system.startQuiz(entity);
    answerAll(system, entity);
    system.completeQuiz(entity);
    expect(reportedStreak).toBe(1);
  });

  it("update method should be a no-op without errors", () => {
    const entity = createEntity();
    const system = new QuizSystem(() => 5);
    expect(() => system.update([entity], 0.016)).not.toThrow();
  });
});
