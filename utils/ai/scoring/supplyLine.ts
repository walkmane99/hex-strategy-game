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
  if (!baseLocations) return 0;

  const playerBase = baseLocations.player;
  const enemyBase = baseLocations.enemy;
  let bonus = 0;

  if (
    (candidate.type === 'move' || candidate.type === 'moveAndAttack') &&
    candidate.targetTile
  ) {
    const dest = candidate.targetTile;

    // 移動先が敵(player)の補給線を遮断する位置か (= player ユニットと player 基地の経路上に入る)
    const cutCount = visibleEnemyUnits.filter(enemy =>
      isOnPath(enemy.position, playerBase, dest),
    ).length;
    if (cutCount > 0) bonus += weights.supplyCutPositionBonus; // +55

    // 自軍(enemy AI)補給線が切断中の状態でさらに前進するペナルティ
    const selfLineCut = isSupplyLineCut(
      actingUnit.position,
      enemyBase,
      visibleEnemyUnits,
    );
    if (selfLineCut) {
      const destLineCut = isSupplyLineCut(dest, enemyBase, visibleEnemyUnits);
      if (destLineCut) bonus += weights.supplyCutSelfPenalty; // -40
    }
  }

  if (
    (candidate.type === 'attack' || candidate.type === 'moveAndAttack') &&
    candidate.targetUnit
  ) {
    // 補給線が切断されている敵(player)を追撃 +supplyCutTargetBonus
    const allyPositions = allyUnits.map(a => ({ position: a.position }));
    if (isSupplyLineCut(candidate.targetUnit.position, playerBase, allyPositions)) {
      bonus += weights.supplyCutTargetBonus; // +25
    }
  }

  return bonus;
}
