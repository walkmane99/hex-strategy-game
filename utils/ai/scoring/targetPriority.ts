import { ActionCandidate, AIContext } from '../core/types';
import { checkAffinity } from '@/utils/combat';
import { offsetDistance } from '@/utils/hexMath';
import { ATTACK_RANGE_BY_TYPE } from '../data/scoreWeights';

// Scores move candidates that bring the unit into attack range of priority targets.
// For attack candidates, applies the decoying penalty for illusionist targets.
export function targetPriorityEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  const { actingUnit, visibleEnemyUnits, weights } = context;

  if (candidate.type === 'attack' || candidate.type === 'moveAndAttack') {
    if (!candidate.targetUnit) return 0;
    // Illusionist may be a decoy — discourage attacking
    if (candidate.targetUnit.type === 'illusionist') return -30;
    // attackScore already accounts for healerPriority/rangedPriority; no double-count here
    return 0;
  }

  if (candidate.type !== 'move' || !candidate.targetTile) return 0;
  if (visibleEnemyUnits.length === 0) return 0;

  const dest = candidate.targetTile;
  const range = ATTACK_RANGE_BY_TYPE[actingUnit.type] ?? 1;
  let score = 0;

  for (const enemy of visibleEnemyUnits) {
    if (offsetDistance(dest, enemy.position) > range) continue;

    // Priority bonuses for enemies reachable from destination
    if (enemy.type === 'healer') {
      score += weights.healerPriority;
    } else if (enemy.type === 'archer' || enemy.type === 'sniper') {
      score += weights.rangedPriority;
    }

    const affinity = checkAffinity(actingUnit.type, enemy.type);
    if (affinity === 'advantage') score += weights.affinityAdvantageBonus;
  }

  return score;
}
