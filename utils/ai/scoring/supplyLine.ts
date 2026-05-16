import { ActionCandidate, AIContext } from '../core/types';
import { offsetDistance } from '@/utils/hexMath';
import { OffsetCoord } from '@/types/map';

/**
 * 最短経路上の遮断判定。
 * hexDistance(unit, base) == hexDistance(unit, interposer) + hexDistance(interposer, base)
 * のとき interposer は経路上にある。
 */
function isOnPath(
  unit: OffsetCoord,
  base: OffsetCoord,
  interposer: OffsetCoord,
): boolean {
  const totalDist = offsetDistance(unit, base);
  if (totalDist === 0) return false;
  const dToUnit = offsetDistance(interposer, unit);
  const dToBase = offsetDistance(interposer, base);
  return dToUnit + dToBase === totalDist;
}

/**
 * 補給線切断判定: 対象ユニットと基地を結ぶ最短経路上に遮断ユニットがいれば true。
 */
function isSupplyLineCut(
  unit: OffsetCoord,
  base: OffsetCoord,
  blockers: ReadonlyArray<{ position: OffsetCoord }>,
): boolean {
  return blockers.some(b => isOnPath(unit, base, b.position));
}

export function supplyLineEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  const { actingUnit, allyUnits, visibleEnemyUnits, weights, missionMetadata } = context;

  // 基地座標が設定されていない場合は評価スキップ
  const baseLocations = missionMetadata?.baseLocations;
  if (!baseLocations || baseLocations.length === 0) return 0;

  const base = baseLocations[0]!;
  let bonus = 0;

  if (
    (candidate.type === 'move' || candidate.type === 'moveAndAttack') &&
    candidate.targetTile
  ) {
    const dest = candidate.targetTile;

    // 移動先が敵の補給線を遮断する位置か (= 敵と敵基地の経路上に入る)
    // 簡略化: 可視敵のうち移動先が経路上に入るケースを検出
    const cutCount = visibleEnemyUnits.filter(enemy =>
      isOnPath(enemy.position, base, dest),
    ).length;
    if (cutCount > 0) bonus += weights.supplyCutPositionBonus; // +55

    // 自軍補給線が切断中の状態でさらに前進するペナルティ
    const selfLineCut = isSupplyLineCut(
      actingUnit.position,
      base,
      visibleEnemyUnits,
    );
    if (selfLineCut) {
      const destLineCut = isSupplyLineCut(dest, base, visibleEnemyUnits);
      if (destLineCut) bonus += weights.supplyCutSelfPenalty; // -40
    }
  }

  if (
    (candidate.type === 'attack' || candidate.type === 'moveAndAttack') &&
    candidate.targetUnit
  ) {
    // 補給線が切断されている敵を追撃 +supplyCutTargetBonus
    const allyPositions = allyUnits.map(a => ({ position: a.position }));
    if (isSupplyLineCut(candidate.targetUnit.position, base, allyPositions)) {
      bonus += weights.supplyCutTargetBonus; // +25
    }
  }

  return bonus;
}
