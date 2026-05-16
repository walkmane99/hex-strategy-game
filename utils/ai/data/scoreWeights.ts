import { ScoreWeights } from '../core/types';

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  // Target priority
  healerPriority: 80,
  rangedPriority: 50,
  finishingBlowBonus: 60,
  affinityAdvantageBonus: 30,
  // Terrain
  buildingBonus: 30,
  highGroundBonus: 25,
  forestBonus: 20,
  rubbleBonus: 10,
  waterPenalty: -15,
  // Safety
  outOfRangeBonus: 30,
  multipleRangeBonus: 15,
  lowHpRetreatBonus: 50,
  sniperNonDetectedBonus: 20,
  // Group tactics (Phase 6)
  pincerBonus: 50,
  formationBonus: 15,
  isolationPenalty: -30,
  concentratedAttackBonus: 25,
  vanguardBonus: 20,
  lowHpProtectionBonus: 35,
  // Substitution (Phase 7)
  affinitySwapBonus: 70,
  lowHpSubstituteBonus: 50,
  healerSupplementBonus: 40,
  supplyCutBonus: 30,
  substitutionActionLossPenalty: -30,
  // Unit-specific
  tankerAllyProximityBonus: 20,
  attackerAuraBonus: 15,
  healerSupportBonus: 25,
  healerRetreatBonus: 15,
  seekerExploreBonus: 20,
  assassinPriorityBonus: 25,
  assassinApproachBonus: 15,
  sniperHighlandBonus: 30,
  sniperMovePenaltyPerCell: 5,
  archerIdealDistanceBonus: 20,
  archerTooClosePenalty: -15,
  archerTooFarPenalty: -10,
  engineerScoutPositionBonus: 15,
  berserkerRageBonus: 60,
  illusionistConcealmentBonus: 20,
  // Mission adjust (Phase 8a)
  lowHpEnemyBonus: 20,
  keyUnitAttackBonus: 100,
  escapeKeyUnitAttackBonus: 120,
  escapeApproachBonus: 30,
  escapeBlockBonus: 50,
  escapeTankerHoldBonus: 40,
  defensiveSafetyMultiplier: 1.5,
  attackerAdvancePenalty: -30,
  healerRearBonus: 25,
  hqProximityBonus: 40,
  hqInterceptBonus: 60,
  // Supply line (Phase 8a)
  supplyCutPositionBonus: 55,
  supplyCutTargetBonus: 25,
  supplyCutSelfPenalty: -40,
};

export const ATTACK_RANGE_BY_TYPE: Record<string, number> = {
  tanker: 1, attacker: 1, healer: 1, seeker: 1, assassin: 1,
  berserker: 1, engineer: 1, illusionist: 1, archer: 2, sniper: 3,
};
