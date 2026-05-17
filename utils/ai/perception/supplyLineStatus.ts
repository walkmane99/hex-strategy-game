import { offsetDistance } from '@/utils/hexMath';
import type { OffsetCoord } from '@/types/map';
import type { Unit } from '@/types/unit';

/**
 * 補給線切断判定（ヘックス最短経路定理ベース）
 * dist(unit, base) === dist(unit, interposer) + dist(interposer, base)
 * を成立させる敵 interposer が1体でも存在すれば切断中。
 * ロジスティクス兵は本ロジックの影響を受けない（常に false）。
 */
export function isSupplyLineCut(
  unit: Unit,
  baseLocation: OffsetCoord,
  hostileUnits: Unit[],
): boolean {
  if (unit.type === 'logistics') return false;
  if (unit.isDead) return false;

  const distToBase = offsetDistance(unit.position, baseLocation);
  if (distToBase === 0) return false;

  return hostileUnits.some(hostile => {
    if (hostile.isDead) return false;
    const a = offsetDistance(unit.position, hostile.position);
    const b = offsetDistance(hostile.position, baseLocation);
    return distToBase === a + b;
  });
}

/**
 * 全ユニットの補給線状態を一括計算。
 * Redux の updateSupplyStatuses に直接渡せる形を返す。
 */
export function computeSupplyStatuses(
  playerUnits: Unit[],
  enemyUnits: Unit[],
  baseLocations: { player: OffsetCoord; enemy: OffsetCoord },
): {
  player: Array<{ id: string; isSupplyCut: boolean }>;
  enemy: Array<{ id: string; isSupplyCut: boolean }>;
} {
  return {
    player: playerUnits.map(u => ({
      id: u.id,
      isSupplyCut: isSupplyLineCut(u, baseLocations.player, enemyUnits),
    })),
    enemy: enemyUnits.map(u => ({
      id: u.id,
      isSupplyCut: isSupplyLineCut(u, baseLocations.enemy, playerUnits),
    })),
  };
}
