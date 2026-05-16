import { ActionCandidate, AIContext } from '../core/types';
import { offsetDistance, offsetToCube } from '@/utils/hexMath';

export function groupTacticsEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  const { actingUnit, allyUnits, visibleEnemyUnits, weights, tentativePlan } = context;
  const others = allyUnits.filter(a => a.id !== actingUnit.id);
  let score = 0;

  // =====================
  // 攻撃候補に対する評価
  // =====================
  if (candidate.type === 'attack' && candidate.targetUnit) {
    const target = candidate.targetUnit;

    // 挟み撃ち: 敵から見て味方が反対側 (+pincerBonus)
    // ベクトルの内積が負 = 逆方向 → 挟み撃ち成立
    const actorCube = offsetToCube(actingUnit.position);
    const targetCube = offsetToCube(target.position);
    const va = { q: actorCube.q - targetCube.q, r: actorCube.r - targetCube.r };

    const hasPincerAlly = others.some(ally => {
      if (offsetDistance(ally.position, target.position) > 2) return false;
      const allyCube = offsetToCube(ally.position);
      const vb = { q: allyCube.q - targetCube.q, r: allyCube.r - targetCube.r };
      return va.q * vb.q + va.r * vb.r < 0;
    });
    if (hasPincerAlly) score += weights.pincerBonus;

    // 集中攻撃: tentativePlan で他ユニットが同じ敵を攻撃する (+concentratedAttackBonus)
    // Layer 1 では tentativePlan が undefined なので常に 0
    if (tentativePlan) {
      const alsoAttacking = [...tentativePlan.values()].some(
        c => c.type === 'attack' &&
             c.unit.id !== actingUnit.id &&
             c.targetUnit?.id === target.id,
      );
      if (alsoAttacking) score += weights.concentratedAttackBonus;
    }
  }

  // =====================
  // 移動候補に対する評価
  // =====================
  if (candidate.type === 'move' && candidate.targetTile) {
    const dest = candidate.targetTile;

    // 陣形維持 / 単独突出
    if (others.length > 0) {
      const minAllyDist = others.reduce(
        (min, a) => Math.min(min, offsetDistance(dest, a.position)),
        Infinity,
      );
      if (minAllyDist >= 2 && minAllyDist <= 3) score += weights.formationBonus;
      if (minAllyDist >= 4) score += weights.isolationPenalty;
    }

    if (visibleEnemyUnits.length > 0) {
      const minEnemyDistFromDest = visibleEnemyUnits.reduce(
        (min, e) => Math.min(min, offsetDistance(dest, e.position)),
        Infinity,
      );

      // 前衛・後衛配置 (簡略化版)
      // タンカー: 全非タンカー味方より敵に近い位置で +vanguardBonus
      if (actingUnit.type === 'tanker' && others.length > 0) {
        const allOthersMinDist = others.reduce(
          (min, a) =>
            Math.min(
              min,
              visibleEnemyUnits.reduce(
                (m, e) => Math.min(m, offsetDistance(a.position, e.position)),
                Infinity,
              ),
            ),
          Infinity,
        );
        if (minEnemyDistFromDest <= allOthersMinDist) score += weights.vanguardBonus;
      }

      // アタッカー/バーサーカー: 任意のタンカーが移動先より敵に近い → +vanguardBonus
      if (actingUnit.type === 'attacker' || actingUnit.type === 'berserker') {
        const tankerAlly = others.find(a => a.type === 'tanker');
        if (tankerAlly) {
          const tankerMinDist = visibleEnemyUnits.reduce(
            (min, e) => Math.min(min, offsetDistance(tankerAlly.position, e.position)),
            Infinity,
          );
          if (tankerMinDist <= minEnemyDistFromDest) score += weights.vanguardBonus;
        }
      }

      // 低HP味方の守護: HP<40% の味方と敵の間に立つ (+lowHpProtectionBonus)
      const lowHPAlly = others.find(a => a.currentHP / a.stats.maxHP < 0.4);
      if (lowHPAlly) {
        const allyMinEnemyDist = visibleEnemyUnits.reduce(
          (min, e) => Math.min(min, offsetDistance(lowHPAlly.position, e.position)),
          Infinity,
        );
        const isProtecting =
          minEnemyDistFromDest < allyMinEnemyDist &&
          offsetDistance(dest, lowHPAlly.position) <= 2;
        if (isProtecting) score += weights.lowHpProtectionBonus;
      }
    }
  }

  return score;
}
