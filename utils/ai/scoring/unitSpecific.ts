import { UnitType } from '@/types/unit';
import { ActionCandidate, AIContext } from '../core/types';
import { ScoreEvaluator } from './types';
import { offsetDistance, offsetToCube, offsetNeighbors } from '@/utils/hexMath';
import { ATTACK_RANGE_BY_TYPE } from '../data/scoreWeights';
import { AURA_CONFIG } from '@/constants/gameConfig';

// =====================
// Per-unit evaluators
// =====================

function evaluateTanker(candidate: ActionCandidate, context: AIContext): number {
  if (candidate.type !== 'move' || !candidate.targetTile) return 0;
  const { allyUnits, weights } = context;
  const dest = candidate.targetTile;
  const hasWoundedNearby = allyUnits.some(
    ally => ally.currentHP / ally.stats.maxHP < 0.7 && offsetDistance(dest, ally.position) <= 2,
  );
  return hasWoundedNearby ? weights.tankerAllyProximityBonus : 0;
}

function evaluateAttacker(candidate: ActionCandidate, context: AIContext): number {
  if (candidate.type !== 'move' || !candidate.targetTile) return 0;
  const { allyUnits, weights } = context;
  const dest = candidate.targetTile;
  const hasAllyNearby = allyUnits.some(
    ally => ally.id !== context.actingUnit.id && offsetDistance(dest, ally.position) <= AURA_CONFIG.AURA_RANGE,
  );
  return hasAllyNearby ? weights.attackerAuraBonus : 0;
}

function evaluateHealer(candidate: ActionCandidate, context: AIContext): number {
  if (candidate.type !== 'move' || !candidate.targetTile) return 0;
  const { allyUnits, visibleEnemyUnits, actingUnit, weights } = context;
  const dest = candidate.targetTile;

  const inHealRange = allyUnits.some(
    ally => ally.id !== actingUnit.id && offsetDistance(dest, ally.position) <= AURA_CONFIG.HEALER_RANGE,
  );
  let score = inHealRange ? weights.healerSupportBonus : -weights.healerSupportBonus;

  if (visibleEnemyUnits.length > 0) {
    let minDistFromDest = Infinity;
    let minDistFromCurrent = Infinity;
    for (const enemy of visibleEnemyUnits) {
      const dDest = offsetDistance(dest, enemy.position);
      const dCurrent = offsetDistance(actingUnit.position, enemy.position);
      if (dDest < minDistFromDest) minDistFromDest = dDest;
      if (dCurrent < minDistFromCurrent) minDistFromCurrent = dCurrent;
    }
    if (minDistFromDest > minDistFromCurrent) score += weights.healerRetreatBonus;
  }

  return score;
}

function evaluateSeeker(candidate: ActionCandidate, context: AIContext): number {
  if (candidate.type !== 'move' || !candidate.targetTile) return 0;
  const { weights, visibility } = context;
  const dest = candidate.targetTile;

  // When a visibility map exists, use explicit fog/unknown tiles only
  if (visibility.size > 0) {
    const neighbors = offsetNeighbors(dest);
    const hasFogNeighbor = neighbors.some(n => {
      const c = offsetToCube(n);
      const key = `${c.q},${c.r}`;
      const state = visibility.get(key);
      return state === 'fog' || state === 'unknown';
    });
    return hasFogNeighbor ? weights.seekerExploreBonus : 0;
  }

  // Fallback: reward moving further from all known enemies
  const { actingUnit, visibleEnemyUnits } = context;
  if (visibleEnemyUnits.length === 0) return weights.seekerExploreBonus;
  let minDistFromDest = Infinity;
  let minDistFromCurrent = Infinity;
  for (const enemy of visibleEnemyUnits) {
    const dDest = offsetDistance(dest, enemy.position);
    const dCurrent = offsetDistance(actingUnit.position, enemy.position);
    if (dDest < minDistFromDest) minDistFromDest = dDest;
    if (dCurrent < minDistFromCurrent) minDistFromCurrent = dCurrent;
  }
  return minDistFromDest > minDistFromCurrent ? weights.seekerExploreBonus : 0;
}

function evaluateAssassin(candidate: ActionCandidate, context: AIContext): number {
  const { actingUnit, visibleEnemyUnits, weights } = context;
  const range = ATTACK_RANGE_BY_TYPE[actingUnit.type] ?? 1;

  if (candidate.type === 'attack' && candidate.targetUnit) {
    const t = candidate.targetUnit.type;
    return t === 'healer' || t === 'tanker' ? weights.assassinPriorityBonus : 0;
  }

  if (candidate.type === 'move' && candidate.targetTile) {
    const dest = candidate.targetTile;
    const highValueInRange = visibleEnemyUnits.some(
      e => (e.type === 'healer' || e.type === 'tanker') && offsetDistance(dest, e.position) <= range,
    );
    return highValueInRange ? weights.assassinApproachBonus : 0;
  }

  return 0;
}

function evaluateSniper(candidate: ActionCandidate, context: AIContext): number {
  const { actingUnit, grid, weights } = context;

  if (candidate.type === 'attack' && candidate.targetUnit) {
    const currentCell = grid[actingUnit.position.row]?.[actingUnit.position.col];
    return currentCell?.terrain === 'highland' ? weights.sniperHighlandBonus : 0;
  }

  if (candidate.type === 'move' && candidate.targetTile) {
    const dest = candidate.targetTile;
    const destCell = grid[dest.row]?.[dest.col];
    const terrainBonus = destCell?.terrain === 'highland' ? weights.sniperHighlandBonus : 0;
    const movePenalty = offsetDistance(actingUnit.position, dest) * weights.sniperMovePenaltyPerCell;
    return terrainBonus - movePenalty;
  }

  return 0;
}

function evaluateArcher(candidate: ActionCandidate, context: AIContext): number {
  if (candidate.type !== 'move' || !candidate.targetTile) return 0;
  const { visibleEnemyUnits, weights } = context;
  if (visibleEnemyUnits.length === 0) return 0;

  const dest = candidate.targetTile;
  let minDist = Infinity;
  for (const enemy of visibleEnemyUnits) {
    const d = offsetDistance(dest, enemy.position);
    if (d < minDist) minDist = d;
  }

  if (minDist === 2 || minDist === 3) return weights.archerIdealDistanceBonus;
  if (minDist === 1) return weights.archerTooClosePenalty;
  if (minDist >= 5) return weights.archerTooFarPenalty;
  return 0;
}

function evaluateEngineer(candidate: ActionCandidate, context: AIContext): number {
  // useSkill scout_marker: highland タイルへの設置に +25 (近似の「高地移動 +15」から正式実装へ)
  if (candidate.type === 'useSkill' && candidate.skillId === 'scout_marker') {
    const { grid } = context;
    if (!candidate.targetTile) return context.weights.engineerScoutPositionBonus;
    const destCell = grid[candidate.targetTile.row]?.[candidate.targetTile.col];
    return destCell?.terrain === 'highland' ? 25 : 10;
  }
  return 0;
}

function evaluateBerserker(candidate: ActionCandidate, context: AIContext): number {
  if (candidate.type !== 'move' || !candidate.targetTile) return 0;
  const { actingUnit, visibleEnemyUnits, weights } = context;
  if (visibleEnemyUnits.length === 0) return 0;

  const dest = candidate.targetTile;
  const hpRatio = actingUnit.currentHP / actingUnit.stats.maxHP;
  const berserkerBonus = (1 - hpRatio) * weights.berserkerRageBonus;

  let minDistFromDest = Infinity;
  let minDistFromCurrent = Infinity;
  for (const enemy of visibleEnemyUnits) {
    const dDest = offsetDistance(dest, enemy.position);
    const dCurrent = offsetDistance(actingUnit.position, enemy.position);
    if (dDest < minDistFromDest) minDistFromDest = dDest;
    if (dCurrent < minDistFromCurrent) minDistFromCurrent = dCurrent;
  }

  return minDistFromDest < minDistFromCurrent ? berserkerBonus : 0;
}

function evaluateIllusionist(candidate: ActionCandidate, context: AIContext): number {
  // useSkill decoy: 敵索敵範囲内への設置ほど高スコア (近似の「森林移動 +20」から正式実装へ)
  if (candidate.type === 'useSkill' && candidate.skillId === 'decoy') {
    const { visibleEnemyUnits, weights } = context;
    if (!candidate.targetTile) return weights.illusionistConcealmentBonus;
    // 可視敵の索敵範囲 (3マス) 内に設置するほど囮効果が高い
    const overlapCount = visibleEnemyUnits.filter(
      e => offsetDistance(candidate.targetTile!, e.position) <= 3,
    ).length;
    return overlapCount > 0 ? weights.illusionistConcealmentBonus + (overlapCount - 1) * 5 : 0;
  }
  return 0;
}

// =====================
// Dispatch map
// =====================

const UNIT_EVALUATORS: Record<UnitType, ScoreEvaluator> = {
  tanker:      evaluateTanker,
  attacker:    evaluateAttacker,
  healer:      evaluateHealer,
  seeker:      evaluateSeeker,
  assassin:    evaluateAssassin,
  sniper:      evaluateSniper,
  archer:      evaluateArcher,
  engineer:    evaluateEngineer,
  berserker:   evaluateBerserker,
  illusionist: evaluateIllusionist,
  logistics:   () => 0,
};

export function unitSpecificEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  const evaluator = UNIT_EVALUATORS[context.actingUnit.type];
  return evaluator ? evaluator(candidate, context) : 0;
}
