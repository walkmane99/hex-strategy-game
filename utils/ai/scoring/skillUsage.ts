import { ActionCandidate, AIContext } from '../core/types';
import { SpecialSkillType } from '@/types/unit';
import { offsetDistance } from '@/utils/hexMath';
import { ATTACK_RANGE_BY_TYPE } from '../data/scoreWeights';
import { DEFENSE_PIERCE_THRESHOLD } from '@/constants/aiThresholds';

export function skillUsageEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  if (candidate.type !== 'useSkill' || !candidate.skillId) return 0;

  const skillId = candidate.skillId as SpecialSkillType;
  const { actingUnit, allyUnits, visibleEnemyUnits } = context;

  // クールダウン・残使用回数の確認 (generateCandidates でも弾くが二重防衛)
  const slot = actingUnit.skills?.find(s => s.skillId === skillId);
  if (!slot) return 0;
  if (slot.cooldown > 0) return 0;
  if (slot.remainingUses !== undefined && slot.remainingUses <= 0) return 0;

  switch (skillId) {
    case 'battlefield_inspiration': {
      // 3マス内味方3体以上 & 戦闘中で +85
      const nearbyAllies = allyUnits.filter(
        a => a.id !== actingUnit.id && offsetDistance(actingUnit.position, a.position) <= 3,
      );
      const inCombat = visibleEnemyUnits.length > 0;
      return nearbyAllies.length >= 3 && inCombat ? 85 : 0;
    }

    case 'emergency_repair': {
      // 自身HP<40% で +75
      return actingUnit.currentHP / actingUnit.stats.maxHP < 0.4 ? 75 : 0;
    }

    case 'defense_pierce': {
      // 高防御の敵を攻撃直前で +90
      // targetUnit が指定されており、防御力 15 以上かつ射程内を条件とする
      if (!candidate.targetUnit) return 0;
      const isHighDefense = candidate.targetUnit.stats.defense >= DEFENSE_PIERCE_THRESHOLD;
      const range = ATTACK_RANGE_BY_TYPE[actingUnit.type] ?? 1;
      const inRange = offsetDistance(actingUnit.position, candidate.targetUnit.position) <= range;
      return isHighDefense && inRange ? 90 : 0;
    }

    case 'swift_thunder': {
      // とどめ届く距離 or 撤退必要で +95
      const range = ATTACK_RANGE_BY_TYPE[actingUnit.type] ?? 1;
      const canFinish = visibleEnemyUnits.some(e => {
        const dist = offsetDistance(actingUnit.position, e.position);
        // 攻撃力の 1.5 倍以内の HP なら撃破圏内と見なす
        return dist <= range && e.currentHP <= actingUnit.stats.attack * 1.5;
      });
      const needsRetreat = actingUnit.currentHP / actingUnit.stats.maxHP < 0.25;
      return canFinish || needsRetreat ? 95 : 0;
    }

    case 'scout_jamming': {
      // 敵スナイパー存在で +70
      return visibleEnemyUnits.some(e => e.type === 'sniper') ? 70 : 0;
    }

    // scout_marker / decoy の加点は unitSpecific.ts に委譲
    case 'scout_marker':
    case 'decoy':
      return 0;

    default:
      return 0;
  }
}
