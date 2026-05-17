import { Unit, UnitType } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { AIAction } from '@/types/battle';
import { offsetDistance } from './hexMath';
import { reachableCells } from './pathfinding';
import { checkAffinity, getAffinityMultiplier, getEffectiveMovement } from './combat';

const ATTACK_RANGE: Record<UnitType, number> = {
  tanker: 1, attacker: 1, healer: 1, seeker: 1, assassin: 1,
  berserker: 1, engineer: 1, illusionist: 1, archer: 2, sniper: 3,
  logistics: 1,
};

const TERRAIN_DEFENSE: Record<TerrainType, number> = {
  plain: 0, highland: 3, forest: 2, water: -1, building: 4, rubble: 1,
};

const SURVIVAL_HP_RATIO = 0.35;
const HEAL_HP_RATIO = 0.75;

export type AIDecision = AIAction & { targetUnit?: Unit; healTarget?: Unit };

function sameCell(a: OffsetCoord, b: OffsetCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

/** Returns living, visible player units within the attacker's attack range. */
export function getPlayersInAttackRange(attacker: Unit, players: Unit[]): Unit[] {
  const range = ATTACK_RANGE[attacker.type];
  return players.filter(
    p => !p.isDead && p.isVisible && offsetDistance(attacker.position, p.position) <= range,
  );
}

/**
 * Returns the best player to attack from a list of in-range candidates.
 * Ranks by expected damage (attack × affinity multiplier) descending.
 */
export function findBestAttackTarget(attacker: Unit, candidates: Unit[]): Unit | null {
  const living = candidates.filter(c => !c.isDead);
  if (living.length === 0) return null;
  return living.sort((a, b) => {
    const scoreA = attacker.stats.attack * getAffinityMultiplier(checkAffinity(attacker.type, a.type));
    const scoreB = attacker.stats.attack * getAffinityMultiplier(checkAffinity(attacker.type, b.type));
    return scoreB - scoreA;
  })[0];
}

/** Returns the living visible player closest to the enemy unit. */
export function findNearestPlayer(enemy: Unit, players: Unit[]): Unit | null {
  const living = players.filter(p => !p.isDead && p.isVisible);
  if (living.length === 0) return null;
  return living.reduce((nearest, p) =>
    offsetDistance(enemy.position, p.position) < offsetDistance(enemy.position, nearest.position)
      ? p : nearest,
  );
}

/**
 * Returns a retreat destination: the reachable cell that maximizes total
 * distance from all living players, with a terrain defense bonus.
 */
export function findRetreatCell(
  unit: Unit,
  players: Unit[],
  grid: MapCell[][],
): OffsetCoord | null {
  const cells = reachableCells(unit.position, grid, unit, getEffectiveMovement(unit));
  if (cells.length === 0) return null;

  const livingPlayers = players.filter(p => !p.isDead);

  const scored = cells.map(c => {
    const distSum = livingPlayers.reduce((sum, p) => sum + offsetDistance(c, p.position), 0);
    const terrainBonus = TERRAIN_DEFENSE[grid[c.row]?.[c.col]?.terrain ?? 'plain'];
    return { cell: c, score: distSum + terrainBonus };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best && !sameCell(best.cell, unit.position) ? best.cell : null;
}

/**
 * Returns the reachable cell closest to the target — used for approaching
 * enemies. Returns null if no movement is possible.
 */
export function findApproachCell(
  unit: Unit,
  target: Unit,
  grid: MapCell[][],
): OffsetCoord | null {
  const cells = reachableCells(unit.position, grid, unit, getEffectiveMovement(unit));
  if (cells.length === 0) return null;

  const candidates = cells.filter(
    c => !(c.col === target.position.col && c.row === target.position.row),
  );
  if (candidates.length === 0) return null;

  return candidates.sort((a, b) =>
    offsetDistance(a, target.position) - offsetDistance(b, target.position),
  )[0] ?? null;
}

/**
 * Returns the most-wounded ally below the heal threshold, or null if no
 * ally needs healing.
 */
export function findHealerTarget(healer: Unit, allies: Unit[]): Unit | null {
  const wounded = allies.filter(
    a => !a.isDead && a.id !== healer.id && a.currentHP / a.stats.maxHP < HEAL_HP_RATIO,
  );
  if (wounded.length === 0) return null;
  return wounded.sort(
    (a, b) => a.currentHP / a.stats.maxHP - b.currentHP / b.stats.maxHP,
  )[0];
}

/**
 * Returns the best position for the healer to move to in order to reach
 * the heal target. Returns healer's current position if already adjacent.
 */
export function findHealPosition(
  healer: Unit,
  target: Unit,
  grid: MapCell[][],
): OffsetCoord | null {
  if (offsetDistance(healer.position, target.position) <= 1) {
    return healer.position;
  }
  const cells = reachableCells(healer.position, grid, healer, getEffectiveMovement(healer));
  if (cells.length === 0) return null;

  return cells.sort((a, b) =>
    offsetDistance(a, target.position) - offsetDistance(b, target.position),
  )[0] ?? null;
}

/**
 * Updates unitId occupancy in the grid after a unit moves.
 * Must be called immediately after dispatching moveUnit so subsequent
 * pathfinding sees correct occupancy.
 */
export function updateGridCell(
  grid: MapCell[][],
  from: OffsetCoord,
  to: OffsetCoord,
  unitId: string,
): void {
  const fromCell = grid[from.row]?.[from.col];
  if (fromCell) fromCell.unitId = undefined;
  const toCell = grid[to.row]?.[to.col];
  if (toCell) toCell.unitId = unitId;
}

/** Returns the attack range in hexes for a given unit type. */
export function getAttackRange(type: UnitType): number {
  return ATTACK_RANGE[type] ?? 1;
}

/**
 * Core AI decision function. Returns an AIDecision for one enemy unit.
 *
 * Priority:
 *   1. Survival (HP ≤ 35%, non-healer) → retreat
 *   2. Healer → heal wounded ally if one exists
 *   3. Attack → player in attack range
 *   4. Move → approach nearest player
 */
export function decideAction(
  unit: Unit,
  allEnemies: Unit[],
  players: Unit[],
  grid: MapCell[][],
): AIDecision {
  const livingPlayers = players.filter(p => !p.isDead && p.isVisible);

  // 1. Survival
  if (unit.type !== 'healer' && unit.currentHP / unit.stats.maxHP <= SURVIVAL_HP_RATIO) {
    const dest = findRetreatCell(unit, livingPlayers, grid);
    if (dest) return { type: 'move', destination: dest };
    return { type: 'skip' };
  }

  // 2. Healer special path
  if (unit.type === 'healer') {
    const healTarget = findHealerTarget(unit, allEnemies);
    if (healTarget) {
      if (offsetDistance(unit.position, healTarget.position) <= 1) {
        return { type: 'attack', targetId: healTarget.id, healTarget };
      }
      const healPos = findHealPosition(unit, healTarget, grid);
      if (healPos && !sameCell(healPos, unit.position)) {
        return { type: 'move', destination: healPos };
      }
    }
    // No heal target or can't reach: fall through to attack/move
  }

  // 3. Attack
  const inRange = getPlayersInAttackRange(unit, livingPlayers);
  if (inRange.length > 0) {
    const target = findBestAttackTarget(unit, inRange);
    if (target) return { type: 'attack', targetId: target.id, targetUnit: target };
  }

  // 4. Move toward nearest player
  const nearest = findNearestPlayer(unit, livingPlayers);
  if (!nearest) return { type: 'skip' };

  const dest = findApproachCell(unit, nearest, grid);
  if (!dest || sameCell(dest, unit.position)) return { type: 'skip' };

  return { type: 'move', destination: dest };
}
