import { Component } from "../ecs/Component";
import type { AnimalBehavior } from "../animals/animalState";
import type { AnimalSpecies } from "../animals/animalDefinitions";

/**
 * Pure data component for an animal entity.
 *
 * Tracks species, behavior state machine, taming progress, and wander
 * targets. All logic lives in `animals/animalOps.ts` and
 * `systems/AnimalSystem.ts`.
 */
export class AnimalComponent extends Component {
  public speciesId: AnimalSpecies;
  public behavior: AnimalBehavior;
  public ownerId: string | null;
  public feedCount: number;
  public wanderTarget: { x: number; y: number } | null;
  public wanderTimer: number;
  public fleeTimer: number;
  public version: number;

  constructor(speciesId: AnimalSpecies) {
    super("animal");
    this.speciesId = speciesId;
    this.behavior = "idle";
    this.ownerId = null;
    this.feedCount = 0;
    this.wanderTarget = null;
    this.wanderTimer = 0;
    this.fleeTimer = 0;
    this.version = 0;
  }
}
