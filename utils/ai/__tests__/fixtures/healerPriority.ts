import { Unit, UnitType, UnitSide } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { GameStateSnapshot } from '../../core/types';

function makeUnit(id: string, type: UnitType, side: UnitSide, position: OffsetCoord, overrides?: Partial<Unit>): Unit {
  return {
    id, type, side, position,
    stats: { maxHP: 1000, attack: 10, defense: 5, movement: 3, scout: 4 },
    currentHP: 1000,
    isVisible: true,
    hasActed: false,
    isDead: false,
    ...overrides,
  };
}

function makePlainGrid(rows = 10, cols = 10): MapCell[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      position: { row, col } as OffsetCoord,
      terrain: 'plain' as TerrainType,
    })),
  );
}

/**
 * Scenario: AI enemy (attacker) is adjacent to both a healer and a tanker.
 * Expected: AI chooses to attack the healer.
 *
 *   col: 0    1      2
 * row0: [enemy] [healer] [tanker]
 */
export function createHealerPriorityScenario(): GameStateSnapshot {
  const grid = makePlainGrid();
  const enemy = makeUnit('e1', 'attacker', 'enemy', { col: 0, row: 0 });
  const healer = makeUnit('p1', 'healer', 'player', { col: 1, row: 0 });
  const tanker = makeUnit('p2', 'tanker', 'player', { col: 2, row: 0 });
  grid[0]![0]!.unitId = 'e1';
  grid[0]![1]!.unitId = 'p1';
  grid[0]![2]!.unitId = 'p2';
  return {
    enemyUnits: [enemy],
    playerUnits: [healer, tanker],
    grid,
    currentTurn: 1,
    mission: 'elimination',
  };
}

export { makeUnit, makePlainGrid };
