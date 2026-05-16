import { Unit } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
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

// Terrain that conceals assassins (10% base discovery rate)
const ASSASSIN_CONCEAL_TERRAIN: ReadonlySet<TerrainType> = new Set([
  'forest', 'building', 'highland', 'rubble',
]);
const ASSASSIN_DISCOVERY_MIN = 0.05;
const ASSASSIN_DISCOVERY_MAX = 0.65;

/**
 * Assassin-specific visibility check using the 3-factor discovery formula.
 * discoveryProb = terrainBase + scoutUnitBonus + distanceBonus (clamped 5%–65%)
 * Exported for testing.
 */
export function isAssassinVisible(
  target: Unit,
  observers: Unit[],
  grid: MapCell[][],
  rng: () => number = Math.random,
): boolean {
  const targetCell = grid[target.position.row]?.[target.position.col];
  const terrain = targetCell?.terrain ?? 'plain';
  const terrainBase = ASSASSIN_CONCEAL_TERRAIN.has(terrain) ? 0.10 : 0.40;

  for (const observer of observers) {
    const range = getSightRange(observer, grid);
    const dist = offsetDistance(observer.position, target.position);
    if (dist > range) continue;

    const scoutBonus =
      observer.type === 'tanker' || observer.type === 'healer' ? -0.05
      : observer.type === 'seeker' ? 0.10
      : observer.type === 'assassin' ? 0.15
      : 0;

    const distBonus = dist === 1 ? 0.10 : dist === 2 ? 0.05 : 0;

    const prob = Math.min(
      ASSASSIN_DISCOVERY_MAX,
      Math.max(ASSASSIN_DISCOVERY_MIN, terrainBase + scoutBonus + distBonus),
    );

    if (rng() < prob) return true;
  }
  return false;
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
  if (target.type === 'assassin') {
    return isAssassinVisible(target, observers, grid, rng);
  }

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
