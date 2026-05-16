import { Unit } from '@/types/unit';
import { MapCell, OffsetCoord } from '@/types/map';
import { VisibilityMap, VisibilityState } from '../core/types';
import {
  offsetToCube,
  hexRange,
  cubeToOffset,
  isInBounds,
  offsetDistance,
} from '@/utils/hexMath';
import { SCOUT_CONFIG, COMBAT_CONFIG } from '@/constants/gameConfig';

export function posKey(pos: OffsetCoord): string {
  const c = offsetToCube(pos);
  return `${c.q},${c.r}`;
}

export function getSightRange(unit: Unit, grid: MapCell[][]): number {
  const cell = grid[unit.position.row]?.[unit.position.col];
  const highlandBonus = cell?.terrain === 'highland' ? SCOUT_CONFIG.HIGHLAND_BONUS : 0;
  const statBonus = Math.floor(unit.stats.scout / SCOUT_CONFIG.STAT_PER_RANGE);
  return SCOUT_CONFIG.BASE_RANGE + highlandBonus + statBonus;
}

/**
 * Build a visibility map from the perspective of `units` (AI team).
 * Only marks cells as 'visible'; everything else is absent (= 'unknown').
 */
export function buildVisibilityMap(
  units: Unit[],
  grid: MapCell[][],
): VisibilityMap {
  const map: VisibilityMap = new Map();

  for (const unit of units) {
    const range = getSightRange(unit, grid);
    const cube = offsetToCube(unit.position);

    for (const tileCube of hexRange(cube, range)) {
      const offset = cubeToOffset(tileCube);
      if (!isInBounds(offset)) continue;
      const key = `${tileCube.q},${tileCube.r}`;
      map.set(key, 'visible');
    }
  }

  return map;
}

/**
 * Transition previously-visible cells that are no longer visible to 'fog'.
 * Newly visible cells are set to 'visible'.
 */
export function updateVisibilityMap(
  prev: VisibilityMap,
  units: Unit[],
  grid: MapCell[][],
): VisibilityMap {
  const current = buildVisibilityMap(units, grid);
  const updated: VisibilityMap = new Map(prev);

  // Demote 'visible' → 'fog' for cells no longer in sight
  for (const [key, state] of prev) {
    if (state === 'visible' && !current.has(key)) {
      updated.set(key, 'fog');
    }
  }

  // Promote (or add) cells now in sight
  for (const [key] of current) {
    updated.set(key, 'visible');
  }

  return updated;
}

/**
 * Whether a target unit is currently detectable by any observer.
 * Accepts an optional RNG for deterministic testing.
 */
export function isUnitVisible(
  target: Unit,
  observers: Unit[],
  grid: MapCell[][],
  rng: () => number = Math.random,
): boolean {
  const targetCell = grid[target.position.row]?.[target.position.col];
  const inForest = targetCell?.terrain === 'forest';

  for (const observer of observers) {
    const range = getSightRange(observer, grid);
    if (offsetDistance(observer.position, target.position) > range) continue;

    // Forest reduces detection chance (FOREST_HIDE_CHANCE = 0.4 → 60% detection)
    if (inForest && rng() < COMBAT_CONFIG.FOREST_HIDE_CHANCE) continue;

    return true;
  }
  return false;
}
