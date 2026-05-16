import { ActionCandidate, AIContext } from './types';
import { offsetDistance, offsetToCube } from '@/utils/hexMath';
import { getThreatAt } from '../perception/threatMap';

/** Deterministic pseudo-random in [0, 1) — avoids Math.random() for replay safety. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function hasDestination(candidate: ActionCandidate): candidate is ActionCandidate & { targetTile: NonNullable<ActionCandidate['targetTile']> } {
  return (candidate.type === 'move' || candidate.type === 'moveAndAttack') && candidate.targetTile != null;
}

function avgAllyDistance(candidate: ActionCandidate, context: AIContext): number {
  const { allyUnits, actingUnit } = context;
  const ref = hasDestination(candidate) ? candidate.targetTile : actingUnit.position;
  const others = allyUnits.filter(u => u.id !== actingUnit.id);
  if (others.length === 0) return 0;
  let total = 0;
  for (const ally of others) total += offsetDistance(ref, ally.position);
  return total / others.length;
}

function movementCost(candidate: ActionCandidate, context: AIContext): number {
  if (!hasDestination(candidate)) return 0;
  return offsetDistance(context.actingUnit.position, candidate.targetTile);
}

function threatAt(candidate: ActionCandidate, context: AIContext): number {
  const pos = hasDestination(candidate) ? candidate.targetTile : context.actingUnit.position;
  return getThreatAt(context.threat, pos);
}

/**
 * Compare two equal-scored candidates.
 * Returns negative if `a` is preferred, positive if `b` is preferred.
 */
export function tieBreakerCompare(
  a: ActionCandidate,
  b: ActionCandidate,
  context: AIContext,
): number {
  // 1. Lower threat is better
  const threatDiff = threatAt(a, context) - threatAt(b, context);
  if (threatDiff !== 0) return threatDiff;

  // 2. Lower movement cost is better
  const costDiff = movementCost(a, context) - movementCost(b, context);
  if (costDiff !== 0) return costDiff;

  // 3. Closer to average ally position is better
  const allyDiff = avgAllyDistance(a, context) - avgAllyDistance(b, context);
  if (allyDiff !== 0) return allyDiff;

  // 4. Deterministic tiebreak via seed derived from turn + unit id hash
  const idSum = context.actingUnit.id
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = context.currentTurn * 1000 + idSum;
  return seededRandom(seed + a.score) - seededRandom(seed + b.score);
}
