import { Unit } from '@/types/unit';
import { MapCell, OffsetCoord } from '@/types/map';
import { ThreatMap } from '../core/types';
import { offsetToCube, hexRange, cubeToOffset, isInBounds } from '@/utils/hexMath';
import { ATTACK_RANGE_BY_TYPE } from '../data/scoreWeights';

function posKey(pos: OffsetCoord): string {
  const c = offsetToCube(pos);
  return `${c.q},${c.r}`;
}

/**
 * Build a threat map: for each tile, count how many visible enemy units
 * can attack it (i.e., tile is within that enemy's attack range).
 */
export function buildThreatMap(
  visibleEnemies: Unit[],
  grid: MapCell[][],
): ThreatMap {
  const map: ThreatMap = new Map();

  for (const enemy of visibleEnemies) {
    const range = ATTACK_RANGE_BY_TYPE[enemy.type] ?? 1;
    const cube = offsetToCube(enemy.position);

    for (const tileCube of hexRange(cube, range)) {
      const offset = cubeToOffset(tileCube);
      if (!isInBounds(offset)) continue;
      const cell = grid[offset.row]?.[offset.col];
      if (!cell) continue;

      const key = `${tileCube.q},${tileCube.r}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }

  return map;
}

/** Convenience: threat level at a given offset position (0 if not in map). */
export function getThreatAt(map: ThreatMap, pos: OffsetCoord): number {
  return map.get(posKey(pos)) ?? 0;
}
