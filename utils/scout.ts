import { Unit } from '@/types/unit';
import { MapCell } from '@/types/map';
import { offsetDistance } from './hexMath';
import { SCOUT_CONFIG, COMBAT_CONFIG } from '@/constants/gameConfig';
import { TERRAIN_CONFIG } from '@/constants/terrain';

/**
 * Computes which enemy unit IDs are visible to any living player unit.
 * Applies terrain hide chance (forest) and assassin special detection rules.
 */
export function computeVisibleEnemyIds(
  playerUnits: Unit[],
  enemyUnits: Unit[],
  grid: MapCell[][],
): Set<string> {
  const visible = new Set<string>();

  for (const player of playerUnits.filter(u => !u.isDead)) {
    const playerCell = grid[player.position.row]?.[player.position.col];
    const terrainBonus = playerCell
      ? TERRAIN_CONFIG[playerCell.terrain].sightBonus
      : 0;
    const range =
      Math.floor(player.stats.scout / SCOUT_CONFIG.STAT_PER_RANGE) +
      SCOUT_CONFIG.BASE_RANGE +
      terrainBonus;

    for (const enemy of enemyUnits.filter(u => !u.isDead)) {
      if (visible.has(enemy.id)) continue;
      if (offsetDistance(player.position, enemy.position) > range) continue;

      const enemyCell = grid[enemy.position.row]?.[enemy.position.col];
      if (enemyCell && TERRAIN_CONFIG[enemyCell.terrain].reducesDetection) {
        if (Math.random() < COMBAT_CONFIG.FOREST_HIDE_CHANCE) continue;
      }

      if (enemy.type === 'assassin') {
        const dist = offsetDistance(player.position, enemy.position);
        const detectChance = Math.min(0.9, dist / Math.max(range, 1));
        if (Math.random() > detectChance) continue;
      }

      visible.add(enemy.id);
    }
  }

  return visible;
}
