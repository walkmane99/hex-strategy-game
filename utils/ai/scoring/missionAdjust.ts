import { ActionCandidate, AIContext } from '../core/types';
import { offsetDistance } from '@/utils/hexMath';
import { safetyScoreEvaluator } from './safetyScore';

export function missionAdjustEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  const {
    mission,
    missionMetadata,
    actingUnit,
    allyUnits,
    visibleEnemyUnits,
    remainingTurns,
    weights,
  } = context;
  let bonus = 0;

  switch (mission) {
    case 'elimination': {
      // タンカー前衛ボーナス 1.5倍 (groupTactics の vanguardBonus=20 に +10 加算)
      if (actingUnit.type === 'tanker' && candidate.type === 'move' && candidate.targetTile) {
        const dest = candidate.targetTile;
        const others = allyUnits.filter(a => a.id !== actingUnit.id);
        if (others.length > 0 && visibleEnemyUnits.length > 0) {
          const minEnemyDistFromDest = visibleEnemyUnits.reduce(
            (min, e) => Math.min(min, offsetDistance(dest, e.position)),
            Infinity,
          );
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
          if (minEnemyDistFromDest <= allOthersMinDist) {
            bonus += weights.vanguardBonus * 0.5; // +10 (合計 30 = 1.5×20)
          }
        }
      }
      break;
    }

    case 'survival': {
      if (candidate.type === 'attack' && candidate.targetUnit) {
        const t = candidate.targetUnit;
        // HP50%未満 or 防御力5未満の敵 → 撃破優先 +lowHpEnemyBonus
        const isWeak = t.currentHP / t.stats.maxHP < 0.5 || t.stats.defense < 5;
        if (isWeak) bonus += weights.lowHpEnemyBonus;
        // キーユニット攻撃 +keyUnitAttackBonus
        if (missionMetadata?.keyUnitIds?.includes(t.id)) {
          bonus += weights.keyUnitAttackBonus;
        }
      }
      break;
    }

    case 'escape': {
      if (candidate.type === 'attack' && candidate.targetUnit) {
        // 脱出担当キーユニットへの攻撃 +escapeKeyUnitAttackBonus
        if (missionMetadata?.keyUnitIds?.includes(candidate.targetUnit.id)) {
          bonus += weights.escapeKeyUnitAttackBonus;
        }
      }
      if (
        (candidate.type === 'move' || candidate.type === 'moveAndAttack') &&
        candidate.targetTile &&
        missionMetadata?.escapeTiles &&
        missionMetadata.escapeTiles.length > 0
      ) {
        const dest = candidate.targetTile;
        const minDistToEscape = missionMetadata.escapeTiles.reduce(
          (min, tile) => Math.min(min, offsetDistance(dest, tile)),
          Infinity,
        );
        // 脱出地点接近ボーナス: +30 から距離に応じた減衰
        if (isFinite(minDistToEscape)) {
          const approachBonus = Math.max(0, weights.escapeApproachBonus - Math.max(0, minDistToEscape - 1) * 10);
          bonus += approachBonus;
        }
        // タンカー: 脱出地点周辺2マス以内に +escapeTankerHoldBonus
        if (actingUnit.type === 'tanker' && isFinite(minDistToEscape) && minDistToEscape <= 2) {
          bonus += weights.escapeTankerHoldBonus;
        }
      }
      break;
    }

    case 'time_limit': {
      if (remainingTurns > 3) {
        // 守勢モード: safetyScore を 1.5倍化 (0.5× を加算)
        bonus += 0.5 * safetyScoreEvaluator(candidate, context);

        // アタッカーの前進ペナルティ
        if (
          actingUnit.type === 'attacker' &&
          (candidate.type === 'move' || candidate.type === 'moveAndAttack') &&
          candidate.targetTile &&
          visibleEnemyUnits.length > 0
        ) {
          const minDistDest = visibleEnemyUnits.reduce(
            (min, e) => Math.min(min, offsetDistance(candidate.targetTile!, e.position)),
            Infinity,
          );
          const minDistCurrent = visibleEnemyUnits.reduce(
            (min, e) => Math.min(min, offsetDistance(actingUnit.position, e.position)),
            Infinity,
          );
          if (minDistDest < minDistCurrent) bonus += weights.attackerAdvancePenalty; // 負値
        }

        // ヒーラー後退ボーナス: 前線の味方から3マス以上離れる移動に +healerRearBonus
        if (
          actingUnit.type === 'healer' &&
          (candidate.type === 'move' || candidate.type === 'moveAndAttack') &&
          candidate.targetTile
        ) {
          const others = allyUnits.filter(a => a.id !== actingUnit.id);
          if (others.length > 0 && visibleEnemyUnits.length > 0) {
            const frontlineAlly = others.reduce((closest, a) => {
              const dA = visibleEnemyUnits.reduce(
                (m, e) => Math.min(m, offsetDistance(a.position, e.position)),
                Infinity,
              );
              const dC = visibleEnemyUnits.reduce(
                (m, e) => Math.min(m, offsetDistance(closest.position, e.position)),
                Infinity,
              );
              return dA < dC ? a : closest;
            });
            if (offsetDistance(candidate.targetTile, frontlineAlly.position) >= 3) {
              bonus += weights.healerRearBonus;
            }
          }
        }
      }
      // remainingTurns <= 3: 通常モード (守勢解除 — 追加補正なし)
      break;
    }

    case 'protect_hq': {
      if (!missionMetadata?.hqLocation) break;
      const hq = missionMetadata.hqLocation;
      if (
        (candidate.type === 'move' || candidate.type === 'moveAndAttack') &&
        candidate.targetTile
      ) {
        if (offsetDistance(candidate.targetTile, hq) <= 3) {
          bonus += weights.hqProximityBonus; // +40
        }
      }
      if (
        (candidate.type === 'attack' || candidate.type === 'moveAndAttack') &&
        candidate.targetUnit
      ) {
        // 拠点に向かう敵への迎撃 +hqInterceptBonus
        if (offsetDistance(candidate.targetUnit.position, hq) <= 4) {
          bonus += weights.hqInterceptBonus; // +60
        }
      }
      break;
    }
  }

  return bonus;
}
