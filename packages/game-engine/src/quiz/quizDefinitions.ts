/**
 * Quiz question bank.
 *
 * Every player-visible string is an i18n key (decision D8). Questions cover
 * four educational categories: nature, science, culture, geography. The bank
 * contains 16 questions so the daily deterministic selection stays varied.
 *
 * Audience: ages 10-18 worldwide.
 */

export interface QuizAnswerOption {
  key: string;
  correct: boolean;
}

export type QuizCategory = "nature" | "science" | "culture" | "geography";
export type QuizDifficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  questionKey: string;
  answerOptions: readonly QuizAnswerOption[];
  category: QuizCategory;
  difficulty: QuizDifficulty;
}

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  // --- Nature (4 questions) ---
  {
    id: "nature_1",
    questionKey: "quiz.question.nature_1",
    answerOptions: [
      { key: "quiz.answer.nature_1_a", correct: false },
      { key: "quiz.answer.nature_1_b", correct: true },
      { key: "quiz.answer.nature_1_c", correct: false },
    ],
    category: "nature",
    difficulty: "easy",
  },
  {
    id: "nature_2",
    questionKey: "quiz.question.nature_2",
    answerOptions: [
      { key: "quiz.answer.nature_2_a", correct: true },
      { key: "quiz.answer.nature_2_b", correct: false },
      { key: "quiz.answer.nature_2_c", correct: false },
    ],
    category: "nature",
    difficulty: "medium",
  },
  {
    id: "nature_3",
    questionKey: "quiz.question.nature_3",
    answerOptions: [
      { key: "quiz.answer.nature_3_a", correct: false },
      { key: "quiz.answer.nature_3_b", correct: false },
      { key: "quiz.answer.nature_3_c", correct: true },
    ],
    category: "nature",
    difficulty: "medium",
  },
  {
    id: "nature_4",
    questionKey: "quiz.question.nature_4",
    answerOptions: [
      { key: "quiz.answer.nature_4_a", correct: true },
      { key: "quiz.answer.nature_4_b", correct: false },
      { key: "quiz.answer.nature_4_c", correct: false },
    ],
    category: "nature",
    difficulty: "hard",
  },
  // --- Science (4 questions) ---
  {
    id: "science_1",
    questionKey: "quiz.question.science_1",
    answerOptions: [
      { key: "quiz.answer.science_1_a", correct: false },
      { key: "quiz.answer.science_1_b", correct: true },
      { key: "quiz.answer.science_1_c", correct: false },
    ],
    category: "science",
    difficulty: "easy",
  },
  {
    id: "science_2",
    questionKey: "quiz.question.science_2",
    answerOptions: [
      { key: "quiz.answer.science_2_a", correct: false },
      { key: "quiz.answer.science_2_b", correct: false },
      { key: "quiz.answer.science_2_c", correct: true },
    ],
    category: "science",
    difficulty: "medium",
  },
  {
    id: "science_3",
    questionKey: "quiz.question.science_3",
    answerOptions: [
      { key: "quiz.answer.science_3_a", correct: true },
      { key: "quiz.answer.science_3_b", correct: false },
      { key: "quiz.answer.science_3_c", correct: false },
    ],
    category: "science",
    difficulty: "medium",
  },
  {
    id: "science_4",
    questionKey: "quiz.question.science_4",
    answerOptions: [
      { key: "quiz.answer.science_4_a", correct: false },
      { key: "quiz.answer.science_4_b", correct: true },
      { key: "quiz.answer.science_4_c", correct: false },
    ],
    category: "science",
    difficulty: "hard",
  },
  // --- Culture (4 questions) ---
  {
    id: "culture_1",
    questionKey: "quiz.question.culture_1",
    answerOptions: [
      { key: "quiz.answer.culture_1_a", correct: true },
      { key: "quiz.answer.culture_1_b", correct: false },
      { key: "quiz.answer.culture_1_c", correct: false },
    ],
    category: "culture",
    difficulty: "easy",
  },
  {
    id: "culture_2",
    questionKey: "quiz.question.culture_2",
    answerOptions: [
      { key: "quiz.answer.culture_2_a", correct: false },
      { key: "quiz.answer.culture_2_b", correct: true },
      { key: "quiz.answer.culture_2_c", correct: false },
    ],
    category: "culture",
    difficulty: "medium",
  },
  {
    id: "culture_3",
    questionKey: "quiz.question.culture_3",
    answerOptions: [
      { key: "quiz.answer.culture_3_a", correct: false },
      { key: "quiz.answer.culture_3_b", correct: false },
      { key: "quiz.answer.culture_3_c", correct: true },
    ],
    category: "culture",
    difficulty: "medium",
  },
  {
    id: "culture_4",
    questionKey: "quiz.question.culture_4",
    answerOptions: [
      { key: "quiz.answer.culture_4_a", correct: true },
      { key: "quiz.answer.culture_4_b", correct: false },
      { key: "quiz.answer.culture_4_c", correct: false },
    ],
    category: "culture",
    difficulty: "hard",
  },
  // --- Geography (4 questions) ---
  {
    id: "geography_1",
    questionKey: "quiz.question.geography_1",
    answerOptions: [
      { key: "quiz.answer.geography_1_a", correct: false },
      { key: "quiz.answer.geography_1_b", correct: true },
      { key: "quiz.answer.geography_1_c", correct: false },
    ],
    category: "geography",
    difficulty: "easy",
  },
  {
    id: "geography_2",
    questionKey: "quiz.question.geography_2",
    answerOptions: [
      { key: "quiz.answer.geography_2_a", correct: true },
      { key: "quiz.answer.geography_2_b", correct: false },
      { key: "quiz.answer.geography_2_c", correct: false },
    ],
    category: "geography",
    difficulty: "medium",
  },
  {
    id: "geography_3",
    questionKey: "quiz.question.geography_3",
    answerOptions: [
      { key: "quiz.answer.geography_3_a", correct: false },
      { key: "quiz.answer.geography_3_b", correct: false },
      { key: "quiz.answer.geography_3_c", correct: true },
    ],
    category: "geography",
    difficulty: "medium",
  },
  {
    id: "geography_4",
    questionKey: "quiz.question.geography_4",
    answerOptions: [
      { key: "quiz.answer.geography_4_a", correct: false },
      { key: "quiz.answer.geography_4_b", correct: true },
      { key: "quiz.answer.geography_4_c", correct: false },
    ],
    category: "geography",
    difficulty: "hard",
  },
];

/** Number of questions selected for a daily quiz session. */
export const DAILY_QUIZ_COUNT = 3;

/** Base coin reward per correct answer. */
export const QUIZ_REWARD_COINS = 5;

/** Bonus coins added per streak day (streak * bonus). */
export const QUIZ_STREAK_BONUS_COINS = 3;

/** Energy restored on quiz completion. */
export const QUIZ_ENERGY_REWARD = 10;
