import { Unit, UnitType, UnitSide } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { GameStateSnapshot } from '../../core/types';

function makeUnit(id: string, type: UnitType, side: UnitSide, position: OffsetCoord, overrides?: Partial<Unit>): Unit {
  return {
    id, type, side, position,
    stats: { maxHP: 1000, attack: 10, defense: 5, movement: 4, scout: 4 },
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
 * Scenario: AI enemy is at critical HP (<30%), enemy (player) is nearby.
 * Expected: AI unit prefers retreating (moving away) over advancing.
 *
 *   col: 0    1    2    3    4    5
 * row0: [retreat←][enemy(crit)][   ][   ][player][   ]
 */
export function createLowHpRetreatScenario(): GameStateSnapshot {
  const grid = makePlainGrid();
  // Enemy unit with critical HP: 25% of maxHP
  const enemy = makeUnit('e1', 'attacker', 'enemy', { col: 2, row: 0 }, {
    currentHP: 250,
  });
  const player = makeUnit('p1', 'tanker', 'player', { col: 5, row: 0 });
  grid[0]![2]!.unitId = 'e1';
  grid[0]![5]!.unitId = 'p1';
  return {
    enemyUnits: [enemy],
    playerUnits: [player],
    grid,
    currentTurn: 1,
    mission: 'elimination',
  };
}

export { makeUnit, makePlainGrid };
