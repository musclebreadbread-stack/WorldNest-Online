import { Component } from "../ecs/Component";
import type { QuizQuestion } from "../quiz/quizDefinitions";
import type { QuizState } from "../quiz/quizState";

/**
 * Pure data component for the daily quiz mini-game.
 *
 * Tracks the current quiz session state, questions, answers, streak, and
 * cooldown. All logic lives in `quiz/quizOps.ts` and `systems/QuizSystem.ts`.
 */
export class QuizComponent extends Component {
  public state: QuizState;
  public currentQuestions: QuizQuestion[];
  public currentIndex: number;
  public answers: boolean[];
  public lastQuizDay: number;
  public streak: number;
  public version: number;

  constructor() {
    super("quiz");
    this.state = "idle";
    this.currentQuestions = [];
    this.currentIndex = 0;
    this.answers = [];
    this.lastQuizDay = 0;
    this.streak = 0;
    this.version = 0;
  }
}
