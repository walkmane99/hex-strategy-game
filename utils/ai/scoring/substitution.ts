import { ActionCandidate, AIContext } from '../core/types';
import { checkAffinity } from '@/utils/combat';

export function substitutionEvaluator(candidate: ActionCandidate, context: AIContext): number {
  if (candidate.type !== 'substitute') return 0;

  const { actingUnit, allyUnits, visibleEnemyUnits, teamInventory, weights } = context;
  const reserveUnit = candidate.targetUnit;
  if (!reserveUnit) return 0;

  let score = 0;

  // Rule 1: 相性交代 — reserve unit has affinity advantage against any visible enemy
  const hasAffinityAdvantage = visibleEnemyUnits.some(
    e => checkAffinity(reserveUnit.type, e.type) === 'advantage',
  );
  if (hasAffinityAdvantage) score += weights.affinitySwapBonus;

  // Rule 2: 低HP交代 — acting unit HP < 20%
  if (actingUnit.currentHP / actingUnit.stats.maxHP < 0.2) {
    score += weights.lowHpSubstituteBonus;
  }

  // Rule 3: ヒーラー補充 — reserve is healer and no other healer is active
  if (reserveUnit.type === 'healer') {
    const hasActiveHealer = allyUnits.some(
      u => u.type === 'healer' && u.id !== actingUnit.id && !u.isDead,
    );
    if (!hasActiveHealer) score += weights.healerSupplementBonus;
  }

  // Rule 4: 補給切れ — acting unit has no usable skills AND team inventory is tracked but empty
  // undefined は未設定扱いで発動しない（空配列のみ「尽きた」と見なす）
  const noSkillsLeft = actingUnit.skills !== undefined &&
    actingUnit.skills.length > 0 &&
    actingUnit.skills.every(
      s => s.cooldown > 0 || (s.remainingUses !== undefined && s.remainingUses <= 0),
    );
  const noItemsLeft = teamInventory !== undefined && teamInventory.length === 0;
  if (noSkillsLeft && noItemsLeft) score += weights.supplyCutBonus;

  // Rule 5: 行動消費ペナルティ — always applied (substituting costs this unit's action)
  score += weights.substitutionActionLossPenalty;

  return score;
}
