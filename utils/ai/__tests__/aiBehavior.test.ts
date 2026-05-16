import { Unit, UnitType, UnitSide } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { attackScoreEvaluator } from '../scoring/attackScore';
import { movementScoreEvaluator } from '../scoring/movementScore';
import { selectBest, generateCandidates, evaluateCandidates } from '../core/AIDecisionEngine';
import { executeAITurn } from '../core/AIController';
import { DEFAULT_SCORE_WEIGHTS } from '../data/scoreWeights';
import { ActionCandidate, AIContext, GameStateSnapshot, VisibilityMap, ThreatMap } from '../core/types';

// ===== Helpers =====

function makeUnit(
  overrides: { id: string; position: OffsetCoord } & Partial<Unit>,
): Unit {
  return {
    type: 'attacker' as UnitType,
    side: 'enemy' as UnitSide,
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

function makeContext(
  unit: Unit,
  players: Unit[],
  grid: MapCell[][],
): AIContext {
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
  };
}

// ===== attackScoreEvaluator =====

describe('attackScoreEvaluator', () => {
  const attacker = makeUnit({ id: 'e1', position: { col: 0, row: 0 }, type: 'attacker' });
  const healer = makeUnit({ id: 'p1', position: { col: 1, row: 0 }, type: 'healer', side: 'player' });
  const tanker = makeUnit({ id: 'p2', position: { col: 1, row: 0 }, type: 'tanker', side: 'player' });
  const grid = makePlainGrid();

  it('returns 0 for non-attack candidates', () => {
    const context = makeContext(attacker, [healer], grid);
    const candidate: ActionCandidate = {
      type: 'move', unit: attacker, targetTile: { col: 1, row: 0 }, score: 0,
    };
    expect(attackScoreEvaluator(candidate, context)).toBe(0);
  });

  it('returns 0 for attack candidate without targetUnit', () => {
    const context = makeContext(attacker, [healer], grid);
    const candidate: ActionCandidate = { type: 'attack', unit: attacker, score: 0 };
    expect(attackScoreEvaluator(candidate, context)).toBe(0);
  });

  it('applies healerPriority bonus when targeting a healer', () => {
    const context = makeContext(attacker, [healer], grid);
    const candidate: ActionCandidate = {
      type: 'attack', unit: attacker, targetUnit: healer, score: 0,
    };
    const score = attackScoreEvaluator(candidate, context);
    expect(score).toBeGreaterThanOrEqual(DEFAULT_SCORE_WEIGHTS.healerPriority);
  });

  it('scores higher against healer than tanker (same distance)', () => {
    const healerCtx = makeContext(attacker, [healer], grid);
    const tankerCtx = makeContext(attacker, [tanker], grid);
    const healerCandidate: ActionCandidate = {
      type: 'attack', unit: attacker, targetUnit: healer, score: 0,
    };
    const tankerCandidate: ActionCandidate = {
      type: 'attack', unit: attacker, targetUnit: tanker, score: 0,
    };
    expect(attackScoreEvaluator(healerCandidate, healerCtx))
      .toBeGreaterThan(attackScoreEvaluator(tankerCandidate, tankerCtx));
  });

  it('adds finishingBlowBonus when expected damage >= target HP', () => {
    const lowHpTarget = makeUnit({
      id: 'p3', position: { col: 1, row: 0 }, type: 'tanker', side: 'player',
      currentHP: 5,
    });
    const ctx = makeContext(attacker, [lowHpTarget], grid);
    const candidate: ActionCandidate = {
      type: 'attack', unit: attacker, targetUnit: lowHpTarget, score: 0,
    };
    const score = attackScoreEvaluator(candidate, ctx);
    expect(score).toBeGreaterThanOrEqual(DEFAULT_SCORE_WEIGHTS.finishingBlowBonus);
  });
});

// ===== movementScoreEvaluator =====

describe('movementScoreEvaluator', () => {
  const enemy = makeUnit({ id: 'e1', position: { col: 0, row: 0 } });
  const player = makeUnit({ id: 'p1', position: { col: 5, row: 0 }, side: 'player' });
  const grid = makePlainGrid();

  it('returns 0 for non-move candidates', () => {
    const context = makeContext(enemy, [player], grid);
    const candidate: ActionCandidate = {
      type: 'attack', unit: enemy, targetUnit: player, score: 0,
    };
    expect(movementScoreEvaluator(candidate, context)).toBe(0);
  });

  it('returns 0 when there are no visible enemies', () => {
    const ctx: AIContext = { ...makeContext(enemy, [], grid), visibleEnemyUnits: [] };
    const candidate: ActionCandidate = {
      type: 'move', unit: enemy, targetTile: { col: 1, row: 0 }, score: 0,
    };
    expect(movementScoreEvaluator(candidate, ctx)).toBe(0);
  });

  it('scores higher for cells closer to the visible enemy', () => {
    const context = makeContext(enemy, [player], grid);
    const closeCell: ActionCandidate = {
      type: 'move', unit: enemy, targetTile: { col: 4, row: 0 }, score: 0,
    };
    const farCell: ActionCandidate = {
      type: 'move', unit: enemy, targetTile: { col: 1, row: 0 }, score: 0,
    };
    expect(movementScoreEvaluator(closeCell, context))
      .toBeGreaterThan(movementScoreEvaluator(farCell, context));
  });
});

// ===== selectBest =====

describe('selectBest', () => {
  const unit = makeUnit({ id: 'e1', position: { col: 0, row: 0 } });

  it('always returns highest-scored candidate in expert mode', () => {
    const candidates: ActionCandidate[] = [
      { type: 'wait', unit, score: 10 },
      { type: 'attack', unit, score: 100 },
      { type: 'move', unit, targetTile: { col: 1, row: 0 }, score: 50 },
    ];
    const ctx = makeContext(unit, [], makePlainGrid());
    const best = selectBest(candidates, 'expert', ctx);
    expect(best.score).toBe(100);
    expect(best.type).toBe('attack');
  });
});

// ===== executeAITurn integration =====

describe('executeAITurn', () => {
  it('produces an attack action when a player is within attack range', () => {
    const grid = makePlainGrid();
    const enemy = makeUnit({ id: 'e1', position: { col: 0, row: 0 }, side: 'enemy' });
    // adjacent: distance 1 ≤ attacker range 1
    const player = makeUnit({ id: 'p1', position: { col: 0, row: 1 }, side: 'player' });
    grid[0]![0]!.unitId = 'e1';
    grid[1]![0]!.unitId = 'p1';

    const snapshot: GameStateSnapshot = {
      enemyUnits: [enemy],
      playerUnits: [player],
      grid,
      currentTurn: 1,
      mission: 'elimination',
    };

    const { plan } = executeAITurn(snapshot, DEFAULT_SCORE_WEIGHTS, 'expert');
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]!.type).toBe('attack');
    expect(plan.actions[0]!.targetUnit?.id).toBe('p1');
  });

  it('produces a move action when the player is out of attack range', () => {
    const grid = makePlainGrid();
    const enemy = makeUnit({
      id: 'e1', position: { col: 0, row: 0 }, side: 'enemy',
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 2, scout: 4 },
    });
    const player = makeUnit({ id: 'p1', position: { col: 0, row: 5 }, side: 'player' });
    grid[0]![0]!.unitId = 'e1';
    grid[5]![0]!.unitId = 'p1';

    const snapshot: GameStateSnapshot = {
      enemyUnits: [enemy],
      playerUnits: [player],
      grid,
      currentTurn: 1,
      mission: 'elimination',
    };

    const { plan } = executeAITurn(snapshot, DEFAULT_SCORE_WEIGHTS, 'expert');
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]!.type).toBe('move');
    expect(plan.actions[0]!.destination).toBeDefined();
  });

  it('does not crash when no players are visible', () => {
    const grid = makePlainGrid();
    const enemy = makeUnit({ id: 'e1', position: { col: 0, row: 0 }, side: 'enemy' });
    const player = makeUnit({
      id: 'p1', position: { col: 5, row: 5 }, side: 'player', isVisible: false,
    });
    grid[0]![0]!.unitId = 'e1';
    grid[5]![5]!.unitId = 'p1';

    const snapshot: GameStateSnapshot = {
      enemyUnits: [enemy],
      playerUnits: [player],
      grid,
      currentTurn: 1,
      mission: 'elimination',
    };

    const { plan } = executeAITurn(snapshot, DEFAULT_SCORE_WEIGHTS, 'expert');
    expect(plan.actions).toHaveLength(1);
    expect(['move', 'wait']).toContain(plan.actions[0]!.type);
  });

  it('plans moves without collision when multiple enemies act', () => {
    const grid = makePlainGrid();
    const e1 = makeUnit({ id: 'e1', position: { col: 0, row: 0 }, side: 'enemy' });
    const e2 = makeUnit({ id: 'e2', position: { col: 2, row: 0 }, side: 'enemy' });
    const player = makeUnit({ id: 'p1', position: { col: 1, row: 4 }, side: 'player' });
    grid[0]![0]!.unitId = 'e1';
    grid[0]![2]!.unitId = 'e2';
    grid[4]![1]!.unitId = 'p1';

    const snapshot: GameStateSnapshot = {
      enemyUnits: [e1, e2],
      playerUnits: [player],
      grid,
      currentTurn: 1,
      mission: 'elimination',
    };

    const { plan } = executeAITurn(snapshot, DEFAULT_SCORE_WEIGHTS, 'expert');
    expect(plan.actions).toHaveLength(2);

    // Both actions should be defined
    const [a1, a2] = plan.actions;
    expect(a1).toBeDefined();
    expect(a2).toBeDefined();

    // If both move, they must not target the same destination
    if (a1!.type === 'move' && a2!.type === 'move') {
      const d1 = a1!.destination;
      const d2 = a2!.destination;
      const same = d1?.col === d2?.col && d1?.row === d2?.row;
      expect(same).toBe(false);
    }
  });
});
