import { ActionCandidate, AIContext } from '../core/types';
import { checkAffinity, getAffinityMultiplier } from '@/utils/combat';

export function attackScoreEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  if (candidate.type !== 'attack' && candidate.type !== 'moveAndAttack') return 0;
  if (!candidate.targetUnit) return 0;

  const { actingUnit, weights } = context;
  const target = candidate.targetUnit;
  const affinity = checkAffinity(actingUnit.type, target.type);
  const expectedDamage = actingUnit.stats.attack * getAffinityMultiplier(affinity);

  let score = expectedDamage;

  if (expectedDamage >= target.currentHP) score += weights.finishingBlowBonus;
  if (affinity === 'advantage') score += weights.affinityAdvantageBonus;
  if (target.type === 'healer') score += weights.healerPriority;
  if (target.type === 'archer' || target.type === 'sniper') score += weights.rangedPriority;

  return score;
}
