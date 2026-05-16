import { ActionCandidate, AIContext } from '../core/types';
import { offsetDistance, offsetToCube } from '@/utils/hexMath';
import { ATTACK_RANGE_BY_TYPE } from '../data/scoreWeights';
import { getSightRange } from '../perception/visibilityMap';

export function safetyScoreEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  if (candidate.type !== 'move' && candidate.type !== 'moveAndAttack') return 0;
  if (!candidate.targetTile) return 0;

  const { actingUnit, visibleEnemyUnits, weights, grid } = context;
  if (visibleEnemyUnits.length === 0) return 0;

  const dest = candidate.targetTile;
  const hpRatio = actingUnit.currentHP / actingUnit.stats.maxHP;
  let enemiesInRange = 0;
  let assassinThreat = false;

  for (const enemy of visibleEnemyUnits) {
    const enemyRange = ATTACK_RANGE_BY_TYPE[enemy.type] ?? 1;
    if (offsetDistance(dest, enemy.position) <= enemyRange) {
      enemiesInRange++;
      if (enemy.type === 'assassin') assassinThreat = true;
    }
  }

  let score = 0;

  // Out-of-range bonuses scale with injury severity.
  // A fully healthy unit has no incentive to hide; a wounded unit values safety heavily.
  const injuryScale = 1 - hpRatio;

  const enemiesOutOfRange = visibleEnemyUnits.length - enemiesInRange;
  score += enemiesOutOfRange * weights.multipleRangeBonus * injuryScale;
  if (enemiesInRange === 0) score += weights.outOfRangeBonus * injuryScale;

  // HP-based penalty for advancing when wounded
  let minDistFromDest = Infinity;
  let minDistFromCurrent = Infinity;
  for (const enemy of visibleEnemyUnits) {
    const dDest = offsetDistance(dest, enemy.position);
    const dCurrent = offsetDistance(actingUnit.position, enemy.position);
    if (dDest < minDistFromDest) minDistFromDest = dDest;
    if (dCurrent < minDistFromCurrent) minDistFromCurrent = dCurrent;
  }

  const isAdvancing = minDistFromDest < minDistFromCurrent;
  if (isAdvancing) {
    if (hpRatio < 0.3) {
      score -= 50;
    } else if (hpRatio < 0.7) {
      score -= 20;
    }
  }

  // Assassin in range penalty
  if (assassinThreat) score -= 25;

  // Sniper non-detected bonus: reward moving to tiles outside all player snipers' sight
  const snipers = visibleEnemyUnits.filter(e => e.type === 'sniper');
  if (snipers.length > 0) {
    const detectedBySniper = snipers.some(sniper => {
      const sniperRange = getSightRange(sniper, grid);
      return offsetDistance(dest, sniper.position) <= sniperRange;
    });
    if (!detectedBySniper) score += weights.sniperNonDetectedBonus;
  }

  return score;
}
