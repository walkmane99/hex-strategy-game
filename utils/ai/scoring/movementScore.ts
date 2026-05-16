import { ActionCandidate, AIContext } from '../core/types';
import { offsetDistance } from '@/utils/hexMath';
import { ATTACK_RANGE_BY_TYPE } from '../data/scoreWeights';

// Max hex distance across a 10×10 grid (diagonal) ≈ 14
const MAX_GRID_DIST = 14;

export function movementScoreEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  if (candidate.type !== 'move' || !candidate.targetTile) return 0;

  const { actingUnit, visibleEnemyUnits } = context;
  if (visibleEnemyUnits.length === 0) return 0;

  const dest = candidate.targetTile;
  const range = ATTACK_RANGE_BY_TYPE[actingUnit.type] ?? 1;

  // If unit is already in attack range, attack candidates should win — don't score movement.
  const alreadyInRange = visibleEnemyUnits.some(
    p => offsetDistance(actingUnit.position, p.position) <= range,
  );
  if (alreadyInRange) return 0;

  let minDist = Infinity;
  for (const p of visibleEnemyUnits) {
    const d = offsetDistance(dest, p.position);
    if (d < minDist) minDist = d;
  }

  const approachScore = Math.max(0, MAX_GRID_DIST - minDist) * 10;
  const inRangeBonus = visibleEnemyUnits.some(
    p => offsetDistance(dest, p.position) <= range,
  ) ? 20 : 0;

  return approachScore + inRangeBonus;
}
