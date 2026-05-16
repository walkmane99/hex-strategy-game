import { Unit } from '@/types/unit';
import { OffsetCoord, MapCell, VictoryCondition } from '@/types/map';
import { ItemSlot } from '@/types/item';
import { MissionMetadata } from '@/types/mission';

export type AIActionType =
  | 'move'
  | 'attack'
  | 'moveAndAttack'
  | 'useItem'
  | 'useSkill'
  | 'wait'
  | 'substitute';

export type AIDifficulty = 'normal' | 'hard' | 'expert';

export type MissionType = VictoryCondition;

export interface ScoreBreakdown {
  [evaluatorName: string]: number;
}

// =====================
// Perception types
// =====================

export type VisibilityState = 'visible' | 'fog' | 'unknown';
/** Key format: "q,r" (cube coordinates) */
export type VisibilityMap = Map<string, VisibilityState>;
/** Key format: "q,r" — probability (0–1) that an enemy is on that tile */
export type ProbabilityMap = Map<string, number>;
/** Key format: "q,r" — number of visible enemies that can attack this tile */
export type ThreatMap = Map<string, number>;

export type GameEvent =
  | { type: 'enemy_spotted'; position: OffsetCoord }
  | { type: 'enemy_lost'; lastKnown: OffsetCoord; unitId: string }
  | { type: 'enemy_moved'; from: OffsetCoord; to: OffsetCoord; unitId: string };

// =====================
// Score weights
// =====================

export interface ScoreWeights {
  // Target priority
  healerPriority: number;
  rangedPriority: number;
  finishingBlowBonus: number;
  affinityAdvantageBonus: number;
  // Terrain
  buildingBonus: number;
  highGroundBonus: number;
  forestBonus: number;
  rubbleBonus: number;
  waterPenalty: number;
  // Safety
  outOfRangeBonus: number;
  multipleRangeBonus: number;
  lowHpRetreatBonus: number;
  sniperNonDetectedBonus: number;
  // Group tactics (Phase 6)
  pincerBonus: number;
  formationBonus: number;
  isolationPenalty: number;
  concentratedAttackBonus: number;
  vanguardBonus: number;
  lowHpProtectionBonus: number;
  // Substitution (Phase 7)
  affinitySwapBonus: number;
  lowHpSubstituteBonus: number;
  healerSupplementBonus: number;
  supplyCutBonus: number;
  substitutionActionLossPenalty: number;
  // Unit-specific
  tankerAllyProximityBonus: number;
  attackerAuraBonus: number;
  healerSupportBonus: number;
  healerRetreatBonus: number;
  seekerExploreBonus: number;
  assassinPriorityBonus: number;
  assassinApproachBonus: number;
  sniperHighlandBonus: number;
  sniperMovePenaltyPerCell: number;
  archerIdealDistanceBonus: number;
  archerTooClosePenalty: number;
  archerTooFarPenalty: number;
  engineerScoutPositionBonus: number;
  berserkerRageBonus: number;
  illusionistConcealmentBonus: number;
  // Mission adjust (Phase 8a)
  lowHpEnemyBonus: number;
  keyUnitAttackBonus: number;
  escapeKeyUnitAttackBonus: number;
  escapeApproachBonus: number;
  escapeBlockBonus: number;
  escapeTankerHoldBonus: number;
  defensiveSafetyMultiplier: number;
  attackerAdvancePenalty: number;
  healerRearBonus: number;
  hqProximityBonus: number;
  hqInterceptBonus: number;
  // Supply line (Phase 8a)
  supplyCutPositionBonus: number;
  supplyCutTargetBonus: number;
  supplyCutSelfPenalty: number;
}

// =====================
// Candidates & context
// =====================

export interface ActionCandidate {
  type: AIActionType;
  unit: Unit;
  targetTile?: OffsetCoord;
  targetUnit?: Unit;
  itemId?: string;
  skillId?: string;
  score: number;
  scoreBreakdown?: ScoreBreakdown;
}

export interface AIContext {
  actingUnit: Unit;
  allyUnits: Unit[];          // living AI-team units (enemy side)
  enemyUnits: Unit[];         // all living player units
  visibleEnemyUnits: Unit[];  // player units that are visible to AI
  grid: MapCell[][];
  currentTurn: number;
  remainingTurns: number;
  mission: MissionType;
  weights: ScoreWeights;
  difficulty: AIDifficulty;
  visibility: VisibilityMap;
  probability?: ProbabilityMap;
  threat: ThreatMap;
  teamInventory?: ItemSlot[]; // AI チームが保有するアイテム
  tentativePlan?: Map<string, ActionCandidate>; // unitId → 暫定アクション (Layer 2 のみ設定)
  reserves?: Unit[];       // 控えユニット
  canSubstitute?: boolean; // 今ターン交代可能か
  missionMetadata?: MissionMetadata;
}

export interface UnitAction {
  unitId: string;
  type: AIActionType;
  destination?: OffsetCoord;
  targetUnit?: Unit;
  itemId?: string;
  skillId?: string;
}

export interface TurnPlan {
  actions: UnitAction[];
}

export interface GameStateSnapshot {
  enemyUnits: Unit[];   // the AI team
  playerUnits: Unit[];  // the human team
  grid: MapCell[][];
  currentTurn: number;
  maxTurns?: number;
  mission: MissionType;
  teamInventory?: {
    player: ItemSlot[];
    enemy: ItemSlot[];
  };
  reserves?: {
    player: Unit[];
    enemy: Unit[];
  };
  substitutionUsedThisTurn?: {
    player: boolean;
    enemy: boolean;
  };
  missionMetadata?: MissionMetadata;
}
