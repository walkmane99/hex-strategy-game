import { Unit, UnitType, UnitSide } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { ActionCandidate, AIContext, VisibilityMap, ThreatMap, GameEvent } from '../core/types';
import { DEFAULT_SCORE_WEIGHTS } from '../data/scoreWeights';
import {
  buildVisibilityMap,
  updateVisibilityMap,
  isUnitVisible,
  getSightRange,
  posKey,
} from '../perception/visibilityMap';
import { buildProbabilityMap, updateProbabilityMap } from '../perception/probabilityMap';
import { buildThreatMap, getThreatAt } from '../perception/threatMap';
import { safetyScoreEvaluator } from '../scoring/safetyScore';
import { unitSpecificEvaluator } from '../scoring/unitSpecific';
import { offsetToCube } from '@/utils/hexMath';

// =====================
// Helpers
// =====================

function makeUnit(id: string, type: UnitType, position: OffsetCoord, overrides?: Partial<Unit>): Unit {
  return {
    id, type, position,
    side: 'enemy' as UnitSide,
    stats: { maxHP: 1000, attack: 10, defense: 5, movement: 3, scout: 4 },
    currentHP: 1000,
    isVisible: true,
    hasActed: false,
    isDead: false,
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

function makeContext(unit: Unit, players: Unit[], grid: MapCell[][], vis?: VisibilityMap, overrides?: Partial<AIContext>): AIContext {
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
    visibility: vis ?? new Map() as VisibilityMap,
    threat: new Map() as ThreatMap,
    ...overrides,
  };
}

// =====================
// visibilityMap
// =====================

describe('buildVisibilityMap', () => {
  it('marks cells within sight range as visible', () => {
    const grid = makeGrid();
    // scout=4, STAT_PER_RANGE=4 → statBonus=1, BASE_RANGE=2, total range=3
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const map = buildVisibilityMap([unit], grid);
    expect(map.get(posKey({ col: 5, row: 5 }))).toBe('visible'); // self
    expect(map.get(posKey({ col: 5, row: 4 }))).toBe('visible'); // adjacent
  });

  it('does not mark cells outside sight range', () => {
    const grid = makeGrid();
    const unit = makeUnit('e1', 'attacker', { col: 0, row: 0 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 3, scout: 0 },
    });
    // scout=0 → range=2
    const map = buildVisibilityMap([unit], grid);
    // Cell 5 steps away should not be visible
    expect(map.has(posKey({ col: 5, row: 5 }))).toBe(false);
  });

  it('extends sight range when on highland', () => {
    const grid = makeGrid(10, 10, [{ row: 0, col: 0, terrain: 'highland' }]);
    const unit = makeUnit('e1', 'attacker', { col: 0, row: 0 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 3, scout: 0 },
    });
    // range=2 on plain, +1 on highland → 3
    const plainMap = buildVisibilityMap([unit], makeGrid());
    const highlandMap = buildVisibilityMap([unit], grid);
    expect(highlandMap.size).toBeGreaterThan(plainMap.size);
  });
});

describe('updateVisibilityMap', () => {
  it('converts previously-visible cells to fog when unit moves away', () => {
    const grid = makeGrid();
    // Unit initially at col:0, gives visibility at col:0-3 range
    const unitBefore = makeUnit('e1', 'attacker', { col: 0, row: 0 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 10, scout: 0 },
    });
    const first = buildVisibilityMap([unitBefore], grid);

    // Unit moves far away — cells near col:0 are no longer visible
    const unitAfter = makeUnit('e1', 'attacker', { col: 9, row: 9 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 10, scout: 0 },
    });
    const updated = updateVisibilityMap(first, [unitAfter], grid);

    // A cell that was visible (near col:0) should now be 'fog'
    const key = posKey({ col: 1, row: 0 });
    expect(updated.get(key)).toBe('fog');
  });

  it('keeps newly-visible cells as visible', () => {
    const grid = makeGrid();
    const unitAt9 = makeUnit('e1', 'attacker', { col: 9, row: 9 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 10, scout: 0 },
    });
    const prev = buildVisibilityMap([unitAt9], grid);
    // Move to col:0 — cells near col:0 should now be visible
    const unitAt0 = makeUnit('e1', 'attacker', { col: 0, row: 0 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 10, scout: 0 },
    });
    const updated = updateVisibilityMap(prev, [unitAt0], grid);
    expect(updated.get(posKey({ col: 0, row: 0 }))).toBe('visible');
  });
});

// =====================
// isUnitVisible (assassin detection)
// =====================

describe('isUnitVisible — forest detection', () => {
  const grid = makeGrid(10, 10, [{ row: 2, col: 2, terrain: 'forest' }]);
  const observer = makeUnit('obs', 'seeker', { col: 0, row: 0 }, {
    stats: { maxHP: 1000, attack: 5, defense: 5, movement: 3, scout: 8 },
  });
  // scout=8, STAT_PER_RANGE=4 → range = 2+0+2 = 4, so col:2 row:2 is within range

  it('always detects unit on plain terrain', () => {
    const target = makeUnit('t1', 'assassin', { col: 1, row: 0 });
    // rng always returns 0 (never hides)
    expect(isUnitVisible(target, [observer], makeGrid(), () => 0)).toBe(true);
  });

  it('assassin in forest: detected when rng < discovery probability (20%)', () => {
    const assassin = makeUnit('a1', 'assassin', { col: 2, row: 2 });
    // 3-factor formula: forest(10%) + seeker(+10%) + dist3(0%) = 20%
    // rng=0.15 < 0.20 → detected
    expect(isUnitVisible(assassin, [observer], grid, () => 0.15)).toBe(true);
  });

  it('assassin in forest: NOT detected when rng >= discovery probability (20%)', () => {
    const assassin = makeUnit('a1', 'assassin', { col: 2, row: 2 });
    // 3-factor formula: forest(10%) + seeker(+10%) + dist3(0%) = 20%
    // rng=0.20 >= 0.20 → not detected
    expect(isUnitVisible(assassin, [observer], grid, () => 0.20)).toBe(false);
  });

  it('approx 20% detection rate in 200 trials (forest + seeker + dist3)', () => {
    const assassin = makeUnit('a1', 'assassin', { col: 2, row: 2 });
    let detected = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      if (isUnitVisible(assassin, [observer], grid)) detected++;
    }
    const rate = detected / trials;
    // Expected 20% ± generous tolerance for stochastic test
    expect(rate).toBeGreaterThan(0.08);
    expect(rate).toBeLessThan(0.35);
  });
});

// =====================
// threatMap
// =====================

describe('buildThreatMap', () => {
  it('marks tiles within enemy attack range', () => {
    const grid = makeGrid();
    const tanker = makeUnit('p1', 'tanker', { col: 5, row: 5 }, { side: 'player' });
    // tanker range = 1
    const threat = buildThreatMap([tanker], grid);
    expect(getThreatAt(threat, { col: 5, row: 5 })).toBeGreaterThan(0); // tanker's own cell
    expect(getThreatAt(threat, { col: 5, row: 4 })).toBeGreaterThan(0); // adjacent
  });

  it('accumulates threat from multiple enemies', () => {
    const grid = makeGrid();
    const e1 = makeUnit('p1', 'tanker', { col: 5, row: 5 }, { side: 'player' });
    const e2 = makeUnit('p2', 'tanker', { col: 5, row: 4 }, { side: 'player' });
    const threat = buildThreatMap([e1, e2], grid);
    // (5,5) is in range of e1 (dist=0) and e2 (dist=1) — threatened by 2
    expect(getThreatAt(threat, { col: 5, row: 5 })).toBe(2);
  });

  it('sniper (range 3) threatens cells at 3 hex distance', () => {
    const grid = makeGrid();
    const sniper = makeUnit('p1', 'sniper', { col: 0, row: 0 }, { side: 'player' });
    const threat = buildThreatMap([sniper], grid);
    // col:3 row:0 should be within sniper range
    expect(getThreatAt(threat, { col: 3, row: 0 })).toBeGreaterThan(0);
  });
});

// =====================
// probabilityMap
// =====================

describe('buildProbabilityMap', () => {
  it('initialises all non-water tiles to 0.1', () => {
    const grid = makeGrid(3, 3);
    const map = buildProbabilityMap(grid);
    for (const [, prob] of map) {
      expect(prob).toBeCloseTo(0.1);
    }
  });
});

describe('updateProbabilityMap', () => {
  it('sets last-known position to 0.8 on enemy_lost event', () => {
    const grid = makeGrid();
    const prev = buildProbabilityMap(grid);
    const events: GameEvent[] = [{ type: 'enemy_lost', lastKnown: { col: 3, row: 3 }, unitId: 'x' }];
    const updated = updateProbabilityMap(prev, events, grid);
    const c = offsetToCube({ col: 3, row: 3 });
    expect(updated.get(`${c.q},${c.r}`)).toBeCloseTo(0.8);
  });

  it('zeroes spotted position on enemy_spotted event', () => {
    const grid = makeGrid();
    const prev = buildProbabilityMap(grid);
    const events: GameEvent[] = [{ type: 'enemy_spotted', position: { col: 2, row: 2 } }];
    const updated = updateProbabilityMap(prev, events, grid);
    const c = offsetToCube({ col: 2, row: 2 });
    expect(updated.get(`${c.q},${c.r}`)).toBe(0);
  });

  it('diffuses probability to adjacent tiles', () => {
    const grid = makeGrid();
    const prev = buildProbabilityMap(grid);
    // Place high probability at one tile
    const events: GameEvent[] = [{ type: 'enemy_lost', lastKnown: { col: 5, row: 5 }, unitId: 'x' }];
    const updated = updateProbabilityMap(prev, events, grid);
    // Adjacent tile should have received some spread
    const adjC = offsetToCube({ col: 5, row: 4 });
    const adjProb = updated.get(`${adjC.q},${adjC.r}`) ?? 0;
    expect(adjProb).toBeGreaterThan(0.1); // more than initial unknown
  });
});

// =====================
// safetyScore — sniper non-detected bonus
// =====================

describe('safetyScoreEvaluator — sniper non-detected bonus', () => {
  // Sniper with scout=8 at col:0 row:0
  // range = 2 + 0 + floor(8/4) = 4
  const grid = makeGrid();
  const sniper = makeUnit('p1', 'sniper', { col: 0, row: 0 }, {
    side: 'player',
    stats: { maxHP: 1000, attack: 16, defense: 5, movement: 4, scout: 8 },
  });
  // Wounded AI unit at col:5 row:5 (25% HP, so injuryScale > 0 for safety bonuses)
  const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, { currentHP: 250 });

  it('gives +sniperNonDetectedBonus when destination is outside sniper sight range', () => {
    const ctx = makeContext(unit, [sniper], grid);
    // col:9 row:9 is far from sniper at col:0 — outside range 4
    const safeCandidate: ActionCandidate = {
      type: 'move', unit, targetTile: { col: 9, row: 9 }, score: 0,
    };
    const score = safetyScoreEvaluator(safeCandidate, ctx);
    // Should include sniperNonDetectedBonus (20)
    expect(score).toBeGreaterThanOrEqual(DEFAULT_SCORE_WEIGHTS.sniperNonDetectedBonus);
  });

  it('does NOT give sniper bonus when destination is within sniper sight range', () => {
    const ctx = makeContext(unit, [sniper], grid);
    // col:1 row:0 is adjacent to sniper — clearly in range
    const exposedCandidate: ActionCandidate = {
      type: 'move', unit, targetTile: { col: 1, row: 0 }, score: 0,
    };
    const score = safetyScoreEvaluator(exposedCandidate, ctx);
    // sniperNonDetectedBonus should not appear here
    const safeCandidate: ActionCandidate = {
      type: 'move', unit, targetTile: { col: 9, row: 9 }, score: 0,
    };
    const safeScore = safetyScoreEvaluator(safeCandidate, ctx);
    expect(safeScore - score).toBeGreaterThanOrEqual(DEFAULT_SCORE_WEIGHTS.sniperNonDetectedBonus);
  });
});

// =====================
// unitSpecific — seeker uses fog tiles
// =====================

describe('unitSpecificEvaluator — seeker fog exploration', () => {
  const grid = makeGrid();
  const seeker = makeUnit('e1', 'seeker', { col: 5, row: 5 });

  it('scores higher for destination adjacent to fog tiles', () => {
    // Build visibility where tiles near col:6 row:5 are fog
    const visibility: VisibilityMap = new Map();
    // col:7 row:5 is fog
    const fogCube = offsetToCube({ col: 7, row: 5 });
    visibility.set(`${fogCube.q},${fogCube.r}`, 'fog');

    const ctxWithFog = makeContext(seeker, [], grid, visibility);
    const ctxEmpty = makeContext(seeker, [], grid, new Map() as VisibilityMap);

    // Moving to col:6 row:5 is adjacent to fog at col:7 row:5
    const towardFog: ActionCandidate = {
      type: 'move', unit: seeker, targetTile: { col: 6, row: 5 }, score: 0,
    };
    // Moving to col:4 row:5 has no fog neighbors in the fog map
    const awayFromFog: ActionCandidate = {
      type: 'move', unit: seeker, targetTile: { col: 4, row: 5 }, score: 0,
    };

    const fogScore = unitSpecificEvaluator(towardFog, ctxWithFog);
    const noFogScore = unitSpecificEvaluator(awayFromFog, ctxWithFog);

    // Toward fog should score seekerExploreBonus, away should not
    expect(fogScore).toBe(DEFAULT_SCORE_WEIGHTS.seekerExploreBonus);
    expect(noFogScore).toBe(0);
  });

  it('falls back to distance-based exploration when visibility map is empty', () => {
    const player = makeUnit('p1', 'tanker', { col: 0, row: 5 }, { side: 'player' });
    const ctx = makeContext(seeker, [player], grid, new Map() as VisibilityMap);

    // Moving away from the player (exploration direction)
    const awayCandidate: ActionCandidate = {
      type: 'move', unit: seeker, targetTile: { col: 8, row: 5 }, score: 0,
    };
    expect(unitSpecificEvaluator(awayCandidate, ctx)).toBe(DEFAULT_SCORE_WEIGHTS.seekerExploreBonus);
  });
});
