import { Unit, UnitType, UnitSide } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { ActionCandidate, AIContext, VisibilityMap, ThreatMap } from '../core/types';
import { DEFAULT_SCORE_WEIGHTS } from '../data/scoreWeights';
import { terrainScoreEvaluator } from '../scoring/terrainScore';
import { targetPriorityEvaluator } from '../scoring/targetPriority';
import { safetyScoreEvaluator } from '../scoring/safetyScore';
import { unitSpecificEvaluator } from '../scoring/unitSpecific';
import { offsetDistance } from '@/utils/hexMath';
import { executeAITurn } from '../core/AIController';
import { createHealerPriorityScenario } from './fixtures/healerPriority';
import { createLowHpRetreatScenario } from './fixtures/lowHpRetreat';

// ===== Helpers =====

function makeUnit(id: string, type: UnitType, position: OffsetCoord, overrides?: Partial<Unit>): Unit {
  return {
    type,
    side: 'enemy' as UnitSide,
    stats: { maxHP: 1000, attack: 10, defense: 5, movement: 3, scout: 4 },
    currentHP: 1000,
    isVisible: true,
    hasActed: false,
    isDead: false,
    id,
    position,
    ...overrides,
  };
}

function makeGrid(rows = 10, cols = 10, terrainOverrides?: { row: number; col: number; terrain: TerrainType }[]): MapCell[][] {
  const grid = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      position: { row, col } as OffsetCoord,
      terrain: 'plain' as TerrainType,
    })),
  );
  if (terrainOverrides) {
    for (const { row, col, terrain } of terrainOverrides) {
      if (grid[row]?.[col]) grid[row]![col]!.terrain = terrain;
    }
  }
  return grid;
}

function makeContext(unit: Unit, players: Unit[], grid: MapCell[][], overrides?: Partial<AIContext>): AIContext {
  return {
    actingUnit: unit,
    allyUnits: [unit],
    enemyUnits: players,
    visibleEnemyUnits: players.filter(p => p.isVisible),
    grid,
    currentTurn: 1,
    remainingTurns: 0,
    mission: 'elimination',
    weights: DEFAULT_SCORE_WEIGHTS,
    difficulty: 'expert',
    visibility: new Map() as VisibilityMap,
    threat: new Map() as ThreatMap,
    ...overrides,
  };
}

// =====================
// terrainScoreEvaluator
// =====================

describe('terrainScoreEvaluator', () => {
  const unit = makeUnit('e1', 'attacker', { col: 0, row: 0 });
  const player = makeUnit('p1', 'healer', { col: 5, row: 0 }, { side: 'player' });

  it('returns 0 for non-move candidates', () => {
    const grid = makeGrid();
    const ctx = makeContext(unit, [player], grid);
    const candidate: ActionCandidate = { type: 'attack', unit, targetUnit: player, score: 0 };
    expect(terrainScoreEvaluator(candidate, ctx)).toBe(0);
  });

  it('returns 0 for plain terrain', () => {
    const grid = makeGrid();
    const ctx = makeContext(unit, [player], grid);
    const candidate: ActionCandidate = { type: 'move', unit, targetTile: { col: 1, row: 0 }, score: 0 };
    expect(terrainScoreEvaluator(candidate, ctx)).toBe(0);
  });

  it('returns highGroundBonus for highland destination', () => {
    const grid = makeGrid(10, 10, [{ row: 1, col: 0, terrain: 'highland' }]);
    const ctx = makeContext(unit, [player], grid);
    const candidate: ActionCandidate = { type: 'move', unit, targetTile: { col: 0, row: 1 }, score: 0 };
    expect(terrainScoreEvaluator(candidate, ctx)).toBe(DEFAULT_SCORE_WEIGHTS.highGroundBonus);
  });

  it('returns buildingBonus for building destination', () => {
    const grid = makeGrid(10, 10, [{ row: 2, col: 0, terrain: 'building' }]);
    const ctx = makeContext(unit, [player], grid);
    const candidate: ActionCandidate = { type: 'move', unit, targetTile: { col: 0, row: 2 }, score: 0 };
    expect(terrainScoreEvaluator(candidate, ctx)).toBe(DEFAULT_SCORE_WEIGHTS.buildingBonus);
  });

  it('returns waterPenalty (negative) for water destination', () => {
    const grid = makeGrid(10, 10, [{ row: 3, col: 0, terrain: 'water' }]);
    const ctx = makeContext(unit, [player], grid);
    const candidate: ActionCandidate = { type: 'move', unit, targetTile: { col: 0, row: 3 }, score: 0 };
    expect(terrainScoreEvaluator(candidate, ctx)).toBe(DEFAULT_SCORE_WEIGHTS.waterPenalty);
    expect(DEFAULT_SCORE_WEIGHTS.waterPenalty).toBeLessThan(0);
  });

  it('prefers highland over plain over water', () => {
    const grid = makeGrid(10, 10, [
      { row: 1, col: 0, terrain: 'highland' },
      { row: 3, col: 0, terrain: 'water' },
    ]);
    const ctx = makeContext(unit, [player], grid);
    const highland: ActionCandidate = { type: 'move', unit, targetTile: { col: 0, row: 1 }, score: 0 };
    const plain: ActionCandidate = { type: 'move', unit, targetTile: { col: 1, row: 0 }, score: 0 };
    const water: ActionCandidate = { type: 'move', unit, targetTile: { col: 0, row: 3 }, score: 0 };
    expect(terrainScoreEvaluator(highland, ctx))
      .toBeGreaterThan(terrainScoreEvaluator(plain, ctx));
    expect(terrainScoreEvaluator(plain, ctx))
      .toBeGreaterThan(terrainScoreEvaluator(water, ctx));
  });
});

// =========================
// targetPriorityEvaluator
// =========================

describe('targetPriorityEvaluator', () => {
  const attacker = makeUnit('e1', 'attacker', { col: 0, row: 0 });
  const healer = makeUnit('p1', 'healer', { col: 1, row: 0 }, { side: 'player' });
  const tanker = makeUnit('p2', 'tanker', { col: 1, row: 0 }, { side: 'player' });
  const sniper = makeUnit('p3', 'sniper', { col: 1, row: 0 }, { side: 'player' });
  const illusionist = makeUnit('p4', 'illusionist', { col: 1, row: 0 }, { side: 'player' });
  const grid = makeGrid();

  it('returns 0 for wait candidate', () => {
    const ctx = makeContext(attacker, [healer], grid);
    const candidate: ActionCandidate = { type: 'wait', unit: attacker, score: 0 };
    expect(targetPriorityEvaluator(candidate, ctx)).toBe(0);
  });

  it('returns -30 for attacking an illusionist (decoying penalty)', () => {
    const ctx = makeContext(attacker, [illusionist], grid);
    const candidate: ActionCandidate = { type: 'attack', unit: attacker, targetUnit: illusionist, score: 0 };
    expect(targetPriorityEvaluator(candidate, ctx)).toBe(-30);
  });

  it('returns 0 for attacking non-illusionist targets', () => {
    const ctx = makeContext(attacker, [tanker], grid);
    const candidate: ActionCandidate = { type: 'attack', unit: attacker, targetUnit: tanker, score: 0 };
    expect(targetPriorityEvaluator(candidate, ctx)).toBe(0);
  });

  it('returns 0 for move when no visible enemies', () => {
    const ctx: AIContext = { ...makeContext(attacker, [], grid), visibleEnemyUnits: [] };
    const candidate: ActionCandidate = { type: 'move', unit: attacker, targetTile: { col: 1, row: 0 }, score: 0 };
    expect(targetPriorityEvaluator(candidate, ctx)).toBe(0);
  });

  it('gives healerPriority bonus for move that reaches attack range of healer', () => {
    const ctx = makeContext(attacker, [healer], grid);
    // attacker range = 1, healer at col:1 row:0, moving to col:0 row:0 (adjacent = dist 1)
    const candidate: ActionCandidate = { type: 'move', unit: attacker, targetTile: { col: 0, row: 0 }, score: 0 };
    const score = targetPriorityEvaluator(candidate, ctx);
    expect(score).toBeGreaterThanOrEqual(DEFAULT_SCORE_WEIGHTS.healerPriority);
  });

  it('gives rangedPriority bonus for move reaching sniper', () => {
    const ctx = makeContext(attacker, [sniper], grid);
    const candidate: ActionCandidate = { type: 'move', unit: attacker, targetTile: { col: 0, row: 0 }, score: 0 };
    const score = targetPriorityEvaluator(candidate, ctx);
    expect(score).toBeGreaterThanOrEqual(DEFAULT_SCORE_WEIGHTS.rangedPriority);
  });

  it('scores healer move higher than tanker move at same distance', () => {
    const healerCtx = makeContext(attacker, [healer], grid);
    const tankerCtx = makeContext(attacker, [tanker], grid);
    const moveToHealer: ActionCandidate = { type: 'move', unit: attacker, targetTile: { col: 0, row: 0 }, score: 0 };
    const moveToTanker: ActionCandidate = { type: 'move', unit: attacker, targetTile: { col: 0, row: 0 }, score: 0 };
    expect(targetPriorityEvaluator(moveToHealer, healerCtx))
      .toBeGreaterThan(targetPriorityEvaluator(moveToTanker, tankerCtx));
  });

  it('gives no bonus for move that does not reach attack range', () => {
    // attacker at col:0, healer at col:3, move to col:1 — still 2 cells from healer (range=1)
    const farHealer = makeUnit('p1', 'healer', { col: 3, row: 0 }, { side: 'player' });
    const ctx = makeContext(attacker, [farHealer], grid);
    const candidate: ActionCandidate = { type: 'move', unit: attacker, targetTile: { col: 1, row: 0 }, score: 0 };
    expect(targetPriorityEvaluator(candidate, ctx)).toBe(0);
  });
});

// ====================
// safetyScoreEvaluator
// ====================

describe('safetyScoreEvaluator', () => {
  const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
  const grid = makeGrid();

  it('returns 0 for non-move candidates', () => {
    const player = makeUnit('p1', 'tanker', { col: 6, row: 5 }, { side: 'player' });
    const ctx = makeContext(unit, [player], grid);
    const candidate: ActionCandidate = { type: 'attack', unit, targetUnit: player, score: 0 };
    expect(safetyScoreEvaluator(candidate, ctx)).toBe(0);
  });

  it('returns 0 when no visible enemies', () => {
    const ctx: AIContext = { ...makeContext(unit, [], grid), visibleEnemyUnits: [] };
    const candidate: ActionCandidate = { type: 'move', unit, targetTile: { col: 6, row: 5 }, score: 0 };
    expect(safetyScoreEvaluator(candidate, ctx)).toBe(0);
  });

  it('gives positive safety bonus for wounded unit moving out of all enemy ranges', () => {
    // Wounded unit (25% HP) moving away from a tanker (range 1)
    const woundedUnit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, { currentHP: 250 });
    const player = makeUnit('p1', 'tanker', { col: 3, row: 5 }, { side: 'player' });
    const ctx = makeContext(woundedUnit, [player], grid);
    const safeMove: ActionCandidate = { type: 'move', unit: woundedUnit, targetTile: { col: 7, row: 5 }, score: 0 };
    const score = safetyScoreEvaluator(safeMove, ctx);
    expect(score).toBeGreaterThan(0);
  });

  it('gives no safety bonus for full-HP unit moving out of range (healthy units fight)', () => {
    const player = makeUnit('p1', 'tanker', { col: 3, row: 5 }, { side: 'player' });
    const ctx = makeContext(unit, [player], grid);
    const safeMove: ActionCandidate = { type: 'move', unit, targetTile: { col: 7, row: 5 }, score: 0 };
    const score = safetyScoreEvaluator(safeMove, ctx);
    expect(score).toBe(0);
  });

  it('penalizes advancing at critical HP (<30%)', () => {
    const lowHpUnit = makeUnit('e1', 'attacker', { col: 2, row: 5 }, { currentHP: 250 });
    const player = makeUnit('p1', 'tanker', { col: 5, row: 5 }, { side: 'player' });
    const ctx = makeContext(lowHpUnit, [player], grid);
    // Move toward enemy (col:3, closer than col:2)
    const advanceCandidate: ActionCandidate = { type: 'move', unit: lowHpUnit, targetTile: { col: 3, row: 5 }, score: 0 };
    // Move away (col:1, further from col:5)
    const retreatCandidate: ActionCandidate = { type: 'move', unit: lowHpUnit, targetTile: { col: 1, row: 5 }, score: 0 };
    const advanceScore = safetyScoreEvaluator(advanceCandidate, ctx);
    const retreatScore = safetyScoreEvaluator(retreatCandidate, ctx);
    expect(retreatScore).toBeGreaterThan(advanceScore);
  });

  it('applies assassin range penalty', () => {
    // Assassin (range 1) adjacent to destination
    const assassin = makeUnit('p1', 'assassin', { col: 4, row: 5 }, { side: 'player' });
    const ctx = makeContext(unit, [assassin], grid);
    const inRangeMove: ActionCandidate = { type: 'move', unit, targetTile: { col: 4, row: 5 }, score: 0 };
    const safeMove: ActionCandidate = { type: 'move', unit, targetTile: { col: 0, row: 0 }, score: 0 };
    const inRangeScore = safetyScoreEvaluator(inRangeMove, ctx);
    const safeScore = safetyScoreEvaluator(safeMove, ctx);
    expect(safeScore).toBeGreaterThan(inRangeScore);
  });
});

// ====================
// unitSpecificEvaluator
// ====================

describe('unitSpecificEvaluator — tanker', () => {
  const grid = makeGrid();

  it('gives +20 for moving near a wounded ally', () => {
    const tanker = makeUnit('e1', 'tanker', { col: 0, row: 0 });
    const woundedAlly = makeUnit('e2', 'healer', { col: 2, row: 0 }, { currentHP: 600 }); // 60% HP
    const ctx: AIContext = {
      ...makeContext(tanker, [], grid),
      allyUnits: [tanker, woundedAlly],
    };
    // Moving to col:1 puts tanker within 2 cells of woundedAlly at col:2
    const candidate: ActionCandidate = { type: 'move', unit: tanker, targetTile: { col: 1, row: 0 }, score: 0 };
    expect(unitSpecificEvaluator(candidate, ctx)).toBe(20);
  });

  it('gives 0 when no wounded ally nearby', () => {
    const tanker = makeUnit('e1', 'tanker', { col: 0, row: 0 });
    const healthyAlly = makeUnit('e2', 'healer', { col: 2, row: 0 }, { currentHP: 1000 });
    const ctx: AIContext = {
      ...makeContext(tanker, [], grid),
      allyUnits: [tanker, healthyAlly],
    };
    const candidate: ActionCandidate = { type: 'move', unit: tanker, targetTile: { col: 1, row: 0 }, score: 0 };
    expect(unitSpecificEvaluator(candidate, ctx)).toBe(0);
  });
});

describe('unitSpecificEvaluator — healer', () => {
  const grid = makeGrid();

  it('gives +25 for staying within heal range of an ally', () => {
    const healer = makeUnit('e1', 'healer', { col: 0, row: 0 });
    const ally = makeUnit('e2', 'attacker', { col: 3, row: 0 });
    const ctx: AIContext = {
      ...makeContext(healer, [], grid),
      allyUnits: [healer, ally],
    };
    // col:3 is 3 cells away — within HEALER_RANGE (5)
    const candidate: ActionCandidate = { type: 'move', unit: healer, targetTile: { col: 2, row: 0 }, score: 0 };
    expect(unitSpecificEvaluator(candidate, ctx)).toBe(25);
  });

  it('penalizes moving out of heal range of all allies', () => {
    const healer = makeUnit('e1', 'healer', { col: 5, row: 5 });
    const ally = makeUnit('e2', 'attacker', { col: 5, row: 5 });
    const ctx: AIContext = {
      ...makeContext(healer, [], grid),
      allyUnits: [healer, ally],
    };
    // col:0 row:0 is far from ally at col:5 row:5
    const candidate: ActionCandidate = { type: 'move', unit: healer, targetTile: { col: 0, row: 0 }, score: 0 };
    expect(unitSpecificEvaluator(candidate, ctx)).toBeLessThan(0);
  });
});

describe('unitSpecificEvaluator — assassin', () => {
  const grid = makeGrid();
  const assassin = makeUnit('e1', 'assassin', { col: 0, row: 0 });

  it('gives +25 bonus for attacking a healer', () => {
    const healer = makeUnit('p1', 'healer', { col: 1, row: 0 }, { side: 'player' });
    const ctx = makeContext(assassin, [healer], grid);
    const candidate: ActionCandidate = { type: 'attack', unit: assassin, targetUnit: healer, score: 0 };
    expect(unitSpecificEvaluator(candidate, ctx)).toBe(25);
  });

  it('gives +25 bonus for attacking a tanker', () => {
    const tanker = makeUnit('p1', 'tanker', { col: 1, row: 0 }, { side: 'player' });
    const ctx = makeContext(assassin, [tanker], grid);
    const candidate: ActionCandidate = { type: 'attack', unit: assassin, targetUnit: tanker, score: 0 };
    expect(unitSpecificEvaluator(candidate, ctx)).toBe(25);
  });

  it('gives 0 for attacking other unit types', () => {
    const seeker = makeUnit('p1', 'seeker', { col: 1, row: 0 }, { side: 'player' });
    const ctx = makeContext(assassin, [seeker], grid);
    const candidate: ActionCandidate = { type: 'attack', unit: assassin, targetUnit: seeker, score: 0 };
    expect(unitSpecificEvaluator(candidate, ctx)).toBe(0);
  });
});

describe('unitSpecificEvaluator — sniper', () => {
  it('gives +30 attack bonus when on highland', () => {
    const grid = makeGrid(10, 10, [{ row: 0, col: 0, terrain: 'highland' }]);
    const sniper = makeUnit('e1', 'sniper', { col: 0, row: 0 });
    const player = makeUnit('p1', 'tanker', { col: 3, row: 0 }, { side: 'player' });
    const ctx = makeContext(sniper, [player], grid);
    const candidate: ActionCandidate = { type: 'attack', unit: sniper, targetUnit: player, score: 0 };
    expect(unitSpecificEvaluator(candidate, ctx)).toBe(30);
  });

  it('gives 0 attack bonus when not on highland', () => {
    const grid = makeGrid();
    const sniper = makeUnit('e1', 'sniper', { col: 0, row: 0 });
    const player = makeUnit('p1', 'tanker', { col: 3, row: 0 }, { side: 'player' });
    const ctx = makeContext(sniper, [player], grid);
    const candidate: ActionCandidate = { type: 'attack', unit: sniper, targetUnit: player, score: 0 };
    expect(unitSpecificEvaluator(candidate, ctx)).toBe(0);
  });

  it('penalizes movement proportional to distance (discourages moving)', () => {
    const grid = makeGrid();
    const sniper = makeUnit('e1', 'sniper', { col: 5, row: 5 });
    const player = makeUnit('p1', 'tanker', { col: 9, row: 9 }, { side: 'player' });
    const ctx = makeContext(sniper, [player], grid);
    const shortMove: ActionCandidate = { type: 'move', unit: sniper, targetTile: { col: 6, row: 5 }, score: 0 };
    const longMove: ActionCandidate = { type: 'move', unit: sniper, targetTile: { col: 8, row: 5 }, score: 0 };
    expect(unitSpecificEvaluator(shortMove, ctx))
      .toBeGreaterThan(unitSpecificEvaluator(longMove, ctx));
  });
});

describe('unitSpecificEvaluator — berserker', () => {
  const grid = makeGrid();

  it('gives larger bonus for advancing at lower HP', () => {
    const lowHpBerserker = makeUnit('e1', 'berserker', { col: 0, row: 0 }, { currentHP: 100 }); // 10% HP
    const fullHpBerserker = makeUnit('e2', 'berserker', { col: 0, row: 0 }, { currentHP: 1000 }); // 100% HP
    const player = makeUnit('p1', 'tanker', { col: 5, row: 0 }, { side: 'player' });

    const ctxLow = makeContext(lowHpBerserker, [player], grid);
    const ctxFull = makeContext(fullHpBerserker, [player], grid);
    const advanceLow: ActionCandidate = { type: 'move', unit: lowHpBerserker, targetTile: { col: 1, row: 0 }, score: 0 };
    const advanceFull: ActionCandidate = { type: 'move', unit: fullHpBerserker, targetTile: { col: 1, row: 0 }, score: 0 };

    expect(unitSpecificEvaluator(advanceLow, ctxLow))
      .toBeGreaterThan(unitSpecificEvaluator(advanceFull, ctxFull));
  });

  it('gives 0 when retreating (moving away from enemies)', () => {
    const berserker = makeUnit('e1', 'berserker', { col: 5, row: 0 }, { currentHP: 100 });
    const player = makeUnit('p1', 'tanker', { col: 3, row: 0 }, { side: 'player' });
    const ctx = makeContext(berserker, [player], grid);
    // Moving to col:7 is retreating from player at col:3
    const retreatCandidate: ActionCandidate = { type: 'move', unit: berserker, targetTile: { col: 7, row: 0 }, score: 0 };
    expect(unitSpecificEvaluator(retreatCandidate, ctx)).toBe(0);
  });
});

// =============================================
// Integration: healer priority scenario
// =============================================

describe('integration — healer priority', () => {
  it('AI attacks healer over tanker when both are adjacent', () => {
    const scenario = createHealerPriorityScenario();
    const { plan } = executeAITurn(scenario, DEFAULT_SCORE_WEIGHTS, 'expert');
    expect(plan.actions).toHaveLength(1);
    const action = plan.actions[0]!;
    expect(action.type).toBe('attack');
    expect(action.targetUnit?.type).toBe('healer');
  });
});

// =============================================
// Integration: low HP retreat scenario
// =============================================

describe('integration — low HP retreat', () => {
  it('AI at critical HP does not advance closer to the enemy', () => {
    const scenario = createLowHpRetreatScenario();
    const { plan } = executeAITurn(scenario, DEFAULT_SCORE_WEIGHTS, 'expert');
    expect(plan.actions).toHaveLength(1);
    const action = plan.actions[0]!;

    if (action.type === 'move' && action.destination) {
      // Unit starts at col:2, player at col:5 — distance is 3
      // Critical HP unit must not advance (reduce distance to player)
      const playerPos = { col: 5, row: 0 };
      const startPos = { col: 2, row: 0 };
      const destDist = offsetDistance(action.destination, playerPos);
      const startDist = offsetDistance(startPos, playerPos);
      expect(destDist).toBeGreaterThanOrEqual(startDist);
    } else {
      // Waiting is also acceptable for a critical HP unit
      expect(action.type).toBe('wait');
    }
  });
});
