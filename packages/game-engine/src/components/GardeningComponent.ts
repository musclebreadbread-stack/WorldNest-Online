import { Component } from "../ecs/Component";
import type {
  Arrangement,
  CompetitionEntry,
  FlowerVariety,
  GardenPlot,
} from "../gardening";

/**
 * Tracks a player's gardening state: plots, arrangements, competitions.
 *
 * Pure data. The logic lives in `gardening/gardeningOps.ts` and the
 * system in `GardeningSystem`.
 */
export class GardeningComponent extends Component {
  /** Active garden plots with planted flowers. */
  public gardenPlots: GardenPlot[];
  /** Created flower arrangements. */
  public arrangements: Arrangement[];
  /** Past competition entries. */
  public competitionHistory: CompetitionEntry[];
  /** Current water level (0-100). */
  public waterLevel: number;
  /** Timestamp of last watering action. */
  public lastWateredTime: number;
  /** Monotonically increasing version for change detection. */
  public version: number;

  /** Pending plant request (set externally, consumed by system). */
  public pendingPlant: FlowerVariety | null;
  /** Pending water request (set externally, consumed by system). */
  public pendingWater: boolean;
  /** Pending arrange request: array of flower varieties. */
  public pendingArrange: FlowerVariety[] | null;
  /** Pending competition entry: arrangement index. */
  public pendingCompete: number | null;

  constructor() {
    super("gardening");
    this.gardenPlots = [];
    this.arrangements = [];
    this.competitionHistory = [];
    this.waterLevel = 0;
    this.lastWateredTime = 0;
    this.version = 0;
    this.pendingPlant = null;
    this.pendingWater = false;
    this.pendingArrange = null;
    this.pendingCompete = null;
  }
}
