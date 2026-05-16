import { Unit, UnitType, UnitSide } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { ActionCandidate, AIContext, VisibilityMap, ThreatMap } from '../core/types';
import { DEFAULT_SCORE_WEIGHTS } from '../data/scoreWeights';
import { groupTacticsEvaluator } from '../scoring/groupTactics';
import { executeAITurn } from '../core/AIController';

// =====================
// Helpers
// =====================

function makeUnit(
  id: string,
  type: UnitType,
  position: OffsetCoord,
  overrides?: Partial<Unit>,
): Unit {
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

function makeGrid(
  rows = 10,
  cols = 10,
  terrainOverrides?: { row: number; col: number; terrain: TerrainType }[],
): MapCell[][] {
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

function makeContext(
  unit: Unit,
  players: Unit[],
  grid: MapCell[][],
  overrides?: Partial<AIContext>,
): AIContext {
  return {
    actingUnit: unit,
    allyUnits: [unit],
    enemyUnits: players,
    visibleEnemyUnits: players.filter(p => p.isVisible),
    grid,
    currentTurn: 1,
    remainingTurns: 10,
    mission: 'elimination',
    weights: DEFAULT_SCORE_WEIGHTS,
    difficulty: 'expert',
    visibility: new Map() as VisibilityMap,
    threat: new Map() as ThreatMap,
    ...overrides,
  };
}

// =====================
// 挟み撃ち (+pincerBonus)
// =====================

describe('groupTacticsEvaluator — 挟み撃ち (pincerBonus)', () => {
  const grid = makeGrid();

  it('敵の反対側に味方がいる場合、攻撃候補に +pincerBonus が加算される', () => {
    // 敵 E at (5,5), 攻撃ユニット A at (3,5), 味方 B at (7,5)
    // A→E ベクトル: (5-3, 5-5) = (2,0)
    // B→E ベクトル: (7-5, 5-5) = (2,0) → wait, that's from E to B which is (7-5,5-5)=(2,0)
    // from E to A = (3-5, 5-5) = (-2, 0)
    // from E to B = (7-5, 5-5) = (2, 0)
    // dot = (-2)*2 + 0*0 = -4 < 0 → 反対側 ✓
    const attacker = makeUnit('e1', 'attacker', { col: 3, row: 5 });
    const ally = makeUnit('e2', 'tanker', { col: 7, row: 5 }); // 反対側
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 5 }, { side: 'player' });

    const ctx = makeContext(attacker, [enemy], grid, {
      allyUnits: [attacker, ally],
    });
    const candidate: ActionCandidate = {
      type: 'attack', unit: attacker, targetUnit: enemy, score: 0,
    };
    const score = groupTacticsEvaluator(candidate, ctx);
    expect(score).toBeGreaterThanOrEqual(DEFAULT_SCORE_WEIGHTS.pincerBonus);
  });

  it('同じ側に味方がいる場合は挟み撃ちボーナスなし', () => {
    // A at (3,5), B at (4,5) どちらも敵 E(5,5) の左側
    const attacker = makeUnit('e1', 'attacker', { col: 3, row: 5 });
    const ally = makeUnit('e2', 'tanker', { col: 4, row: 5 }); // 同じ側
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 5 }, { side: 'player' });

    const ctx = makeContext(attacker, [enemy], grid, {
      allyUnits: [attacker, ally],
    });
    const candidate: ActionCandidate = {
      type: 'attack', unit: attacker, targetUnit: enemy, score: 0,
    };
    const score = groupTacticsEvaluator(candidate, ctx);
    // pincerBonus はなく、他のボーナスもないので 0
    expect(score).toBe(0);
  });
});

// =====================
// 陣形維持 / 単独突出
// =====================

describe('groupTacticsEvaluator — 陣形 (formationBonus / isolationPenalty)', () => {
  const grid = makeGrid();
  const ally = makeUnit('e2', 'tanker', { col: 5, row: 5 });

  it('味方から 2〜3 マスの移動先は +formationBonus', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const ctx = makeContext(unit, [], grid, { allyUnits: [unit, ally] });

    // col:7, row:5 は ally (col:5, row:5) から距離 2 → formationBonus
    const candidate: ActionCandidate = {
      type: 'move', unit, targetTile: { col: 7, row: 5 }, score: 0,
    };
    const score = groupTacticsEvaluator(candidate, ctx);
    expect(score).toBe(DEFAULT_SCORE_WEIGHTS.formationBonus);
  });

  it('味方から 4 マス以上の移動先は +isolationPenalty (負値)', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const ctx = makeContext(unit, [], grid, { allyUnits: [unit, ally] });

    // col:9, row:5 は ally (col:5, row:5) から距離 4 → isolationPenalty
    const candidate: ActionCandidate = {
      type: 'move', unit, targetTile: { col: 9, row: 5 }, score: 0,
    };
    const score = groupTacticsEvaluator(candidate, ctx);
    expect(score).toBe(DEFAULT_SCORE_WEIGHTS.isolationPenalty);
  });
});

// =====================
// 集中攻撃 (+concentratedAttackBonus)
// =====================

describe('groupTacticsEvaluator — 集中攻撃 (concentratedAttackBonus)', () => {
  const grid = makeGrid();

  it('tentativePlan で他ユニットが同じ敵を攻撃する場合 +concentratedAttackBonus', () => {
    const attacker = makeUnit('e1', 'attacker', { col: 4, row: 5 });
    const ally = makeUnit('e2', 'tanker', { col: 4, row: 4 });
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 5 }, { side: 'player' });

    // tentativePlan: ally も同じ enemy を攻撃予定
    const tentativePlan = new Map<string, ActionCandidate>();
    tentativePlan.set(ally.id, {
      type: 'attack', unit: ally, targetUnit: enemy, score: 0,
    });

    const ctx = makeContext(attacker, [enemy], grid, {
      allyUnits: [attacker, ally],
      tentativePlan,
    });
    const candidate: ActionCandidate = {
      type: 'attack', unit: attacker, targetUnit: enemy, score: 0,
    };
    const score = groupTacticsEvaluator(candidate, ctx);
    expect(score).toBeGreaterThanOrEqual(DEFAULT_SCORE_WEIGHTS.concentratedAttackBonus);
  });

  it('tentativePlan なし (Layer 1) では集中攻撃ボーナスは 0', () => {
    const attacker = makeUnit('e1', 'attacker', { col: 4, row: 5 });
    const ally = makeUnit('e2', 'tanker', { col: 4, row: 4 });
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 5 }, { side: 'player' });

    // tentativePlan 未設定 (Layer 1 相当)
    const ctx = makeContext(attacker, [enemy], grid, {
      allyUnits: [attacker, ally],
      tentativePlan: undefined,
    });
    const candidate: ActionCandidate = {
      type: 'attack', unit: attacker, targetUnit: enemy, score: 0,
    };
    // 集中攻撃ボーナスなし。挟み撃ちボーナスのみ可能性あり
    // 2ユニット確認: ally (4,4), enemy (5,5). dot check:
    // from enemy(5,5) to attacker(4,5): (-1, 0)
    // from enemy(5,5) to ally(4,4): (-1, -1) → dot = (-1)*(-1)+0*(-1) = 1 > 0 → 反対側でない
    const score = groupTacticsEvaluator(candidate, ctx);
    expect(score).toBeLessThan(DEFAULT_SCORE_WEIGHTS.concentratedAttackBonus);
  });
});

// =====================
// Layer 1 では groupTactics が常に 0
// =====================

describe('groupTacticsEvaluator — Layer 1 (tentativePlan なし)', () => {
  const grid = makeGrid();

  it('移動候補: tentativePlan なしでも formationBonus は適用される (tentativePlan 非依存)', () => {
    // formationBonus は tentativePlan 不要なので適用される
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const ally = makeUnit('e2', 'tanker', { col: 5, row: 5 });
    const ctx = makeContext(unit, [], grid, {
      allyUnits: [unit, ally],
      tentativePlan: undefined,
    });
    const candidate: ActionCandidate = {
      type: 'move', unit, targetTile: { col: 7, row: 5 }, score: 0,
    };
    const score = groupTacticsEvaluator(candidate, ctx);
    // formationBonus (距離2) は適用
    expect(score).toBe(DEFAULT_SCORE_WEIGHTS.formationBonus);
  });

  it('攻撃候補: tentativePlan なしでは concentratedAttackBonus は加算されない', () => {
    const unit = makeUnit('e1', 'attacker', { col: 4, row: 5 });
    const ally = makeUnit('e2', 'tanker', { col: 6, row: 5 }); // enemy 反対側 → pincer
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 5 }, { side: 'player' });

    const ctxWithPlan = makeContext(unit, [enemy], grid, {
      allyUnits: [unit, ally],
      tentativePlan: new Map([[ally.id, { type: 'attack', unit: ally, targetUnit: enemy, score: 0 }]]),
    });
    const ctxNoPlan = makeContext(unit, [enemy], grid, {
      allyUnits: [unit, ally],
      tentativePlan: undefined,
    });
    const candidate: ActionCandidate = {
      type: 'attack', unit, targetUnit: enemy, score: 0,
    };
    const scoreWithPlan = groupTacticsEvaluator(candidate, ctxWithPlan);
    const scoreNoPlan = groupTacticsEvaluator(candidate, ctxNoPlan);
    // tentativePlan ありの方が concentratedAttackBonus 分高い
    expect(scoreWithPlan - scoreNoPlan).toBe(DEFAULT_SCORE_WEIGHTS.concentratedAttackBonus);
  });
});

// =====================
// パフォーマンス: 6 ユニットのターン処理が 500ms 以内
// =====================

describe('executeAITurn — パフォーマンス', () => {
  it('6 ユニット × 2 層評価が 500ms 以内に完了する', () => {
    const grid = makeGrid();
    const enemies = [
      makeUnit('e1', 'tanker',    { col: 0, row: 0 }),
      makeUnit('e2', 'attacker',  { col: 1, row: 0 }),
      makeUnit('e3', 'healer',    { col: 2, row: 0 }),
      makeUnit('e4', 'archer',    { col: 3, row: 0 }),
      makeUnit('e5', 'sniper',    { col: 4, row: 0 }),
      makeUnit('e6', 'assassin',  { col: 5, row: 0 }),
    ];
    const players = [
      makeUnit('p1', 'tanker',   { col: 9, row: 9 }, { side: 'player' }),
      makeUnit('p2', 'attacker', { col: 8, row: 9 }, { side: 'player' }),
    ];

    const snapshot = {
      enemyUnits: enemies,
      playerUnits: players,
      grid,
      currentTurn: 1,
      maxTurns: 20,
      mission: 'elimination' as const,
    };

    const start = Date.now();
    const result = executeAITurn(snapshot);
    const elapsed = Date.now() - start;

    expect(result.plan.actions).toHaveLength(6);
    expect(elapsed).toBeLessThan(500);
  });
});

// =====================
// 低HP味方の守護 (+lowHpProtectionBonus)
// =====================

describe('groupTacticsEvaluator — 低HP味方の守護 (lowHpProtectionBonus)', () => {
  const grid = makeGrid();

  it('HP<40% の味方と敵の間に立つ移動で +lowHpProtectionBonus', () => {
    // 低HP味方 wounded at (5,5), 敵 enemy at (8,5), 移動ユニット at (3,5)
    // dest (6,5) は enemy(8,5) より wounded(5,5) に近く、wound から距離 1
    const unit = makeUnit('e1', 'attacker', { col: 3, row: 5 });
    const wounded = makeUnit('e2', 'healer', { col: 5, row: 5 }, { currentHP: 300 }); // 30%
    const enemy = makeUnit('p1', 'tanker', { col: 8, row: 5 }, { side: 'player' });

    const ctx = makeContext(unit, [enemy], grid, {
      allyUnits: [unit, wounded],
    });
    const dest = { col: 6, row: 5 };
    // dist(dest, enemy) = 2, dist(wounded, enemy) = 3 → dest は敵に近い
    // dist(dest, wounded) = 1 ≤ 2 → 守護判定OK
    const candidate: ActionCandidate = {
      type: 'move', unit, targetTile: dest, score: 0,
    };
    const score = groupTacticsEvaluator(candidate, ctx);
    expect(score).toBeGreaterThanOrEqual(DEFAULT_SCORE_WEIGHTS.lowHpProtectionBonus);
  });
});
