import { Unit, UnitType, UnitSide } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { ActionCandidate, AIContext, VisibilityMap, ThreatMap } from '../core/types';
import { DEFAULT_SCORE_WEIGHTS } from '../data/scoreWeights';
import { substitutionEvaluator } from '../scoring/substitution';
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

function makeGrid(rows = 10, cols = 10): MapCell[][] {
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

function makeSubCandidate(unit: Unit, reserveUnit: Unit): ActionCandidate {
  return { type: 'substitute', unit, targetUnit: reserveUnit, score: 0 };
}

// =====================
// Rule 1: 相性交代 (+affinitySwapBonus)
// =====================

describe('substitutionEvaluator — 相性交代 (affinitySwapBonus)', () => {
  const grid = makeGrid();

  it('控えユニットが敵に有利な相性なら +affinitySwapBonus', () => {
    // affinity cycle: タンカー→アーチャー→シーカー→スナイパー→アタッカー→アサシン→タンカー
    // 控え=アタッカー(idx=4), 敵=アサシン(idx=5): diff=1 → advantage
    const unit = makeUnit('e1', 'tanker', { col: 5, row: 5 });
    const reserve = makeUnit('r1', 'attacker', { col: 0, row: 0 });
    const enemy = makeUnit('p1', 'assassin', { col: 6, row: 5 }, { side: 'player' });

    const ctx = makeContext(unit, [enemy], grid);
    const candidate = makeSubCandidate(unit, reserve);
    const score = substitutionEvaluator(candidate, ctx);

    // affinitySwapBonus(70) + actionLossPenalty(-30) = 40 > 0 → 交代する価値あり
    const expected = DEFAULT_SCORE_WEIGHTS.affinitySwapBonus + DEFAULT_SCORE_WEIGHTS.substitutionActionLossPenalty;
    expect(score).toBe(expected);
    expect(score).toBeGreaterThan(0);
  });

  it('控えユニットに相性優位がなければ affinitySwapBonus は加算されない', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const reserve = makeUnit('r1', 'healer', { col: 0, row: 0 }); // healer は相性外
    const enemy = makeUnit('p1', 'tanker', { col: 6, row: 5 }, { side: 'player' });

    const ctx = makeContext(unit, [enemy], grid);
    const candidate = makeSubCandidate(unit, reserve);
    const score = substitutionEvaluator(candidate, ctx);

    expect(score).toBeLessThan(DEFAULT_SCORE_WEIGHTS.affinitySwapBonus);
  });
});

// =====================
// Rule 2: 低HP交代 (+lowHpSubstituteBonus)
// =====================

describe('substitutionEvaluator — 低HP交代 (lowHpSubstituteBonus)', () => {
  const grid = makeGrid();

  it('行動ユニット HP < 20% で +lowHpSubstituteBonus', () => {
    // HP 19% (190/1000); reserve は tanker (healer でも affinity 有利でもない)
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, { currentHP: 190 });
    const reserve = makeUnit('r1', 'tanker', { col: 0, row: 0 });

    const ctx = makeContext(unit, [], grid);
    const candidate = makeSubCandidate(unit, reserve);
    const score = substitutionEvaluator(candidate, ctx);

    // lowHpSubstituteBonus(50) + actionLossPenalty(-30) = 20 > 0
    const expected = DEFAULT_SCORE_WEIGHTS.lowHpSubstituteBonus + DEFAULT_SCORE_WEIGHTS.substitutionActionLossPenalty;
    expect(score).toBe(expected);
    expect(score).toBeGreaterThan(0);
  });

  it('HP >= 20% では lowHpSubstituteBonus は加算されない', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, { currentHP: 200 }); // 20%
    const reserve = makeUnit('r1', 'healer', { col: 0, row: 0 });

    const ctx = makeContext(unit, [], grid);
    const candidate = makeSubCandidate(unit, reserve);
    const score = substitutionEvaluator(candidate, ctx);

    expect(score).toBeLessThan(DEFAULT_SCORE_WEIGHTS.lowHpSubstituteBonus);
  });
});

// =====================
// Rule 3: ヒーラー補充 (+healerSupplementBonus)
// =====================

describe('substitutionEvaluator — ヒーラー補充 (healerSupplementBonus)', () => {
  const grid = makeGrid();

  it('控えがヒーラーで他にヒーラーがいなければ +healerSupplementBonus', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const reserve = makeUnit('r1', 'healer', { col: 0, row: 0 });
    // allyUnits にヒーラーなし
    const ctx = makeContext(unit, [], grid, { allyUnits: [unit] });
    const candidate = makeSubCandidate(unit, reserve);
    const score = substitutionEvaluator(candidate, ctx);

    // healerSupplementBonus(40) + actionLossPenalty(-30) = 10 > 0
    const expected = DEFAULT_SCORE_WEIGHTS.healerSupplementBonus + DEFAULT_SCORE_WEIGHTS.substitutionActionLossPenalty;
    expect(score).toBe(expected);
    expect(score).toBeGreaterThan(0);
  });

  it('既存のヒーラーがいれば healerSupplementBonus は加算されない', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const existingHealer = makeUnit('e2', 'healer', { col: 4, row: 5 });
    const reserve = makeUnit('r1', 'healer', { col: 0, row: 0 });
    const ctx = makeContext(unit, [], grid, { allyUnits: [unit, existingHealer] });
    const candidate = makeSubCandidate(unit, reserve);
    const score = substitutionEvaluator(candidate, ctx);

    expect(score).toBeLessThan(DEFAULT_SCORE_WEIGHTS.healerSupplementBonus);
  });
});

// =====================
// Rule 4: 補給切れ (+supplyCutBonus)
// =====================

describe('substitutionEvaluator — 補給切れ (supplyCutBonus)', () => {
  const grid = makeGrid();

  it('スキルもアイテムも尽きたとき、スコアが +supplyCutBonus 分高くなる', () => {
    const unitNoSupply = makeUnit('e1', 'attacker', { col: 5, row: 5 }, {
      skills: [{ skillId: 'battlefield_inspiration', cooldown: 3, remainingUses: 0 }],
    });
    const unitWithSupply = makeUnit('e2', 'attacker', { col: 5, row: 5 }, {
      skills: [{ skillId: 'battlefield_inspiration', cooldown: 0, remainingUses: 2 }],
    });
    const reserve = makeUnit('r1', 'tanker', { col: 0, row: 0 });

    const ctxNoSupply = makeContext(unitNoSupply, [], grid, { actingUnit: unitNoSupply, teamInventory: [] });
    const ctxWithSupply = makeContext(unitWithSupply, [], grid, { actingUnit: unitWithSupply, teamInventory: [{ itemId: 'flare', remainingUses: 1 }] });

    const scoreNoSupply = substitutionEvaluator(makeSubCandidate(unitNoSupply, reserve), ctxNoSupply);
    const scoreWithSupply = substitutionEvaluator(makeSubCandidate(unitWithSupply, reserve), ctxWithSupply);

    // 補給切れ時のスコアが supplyCutBonus(30) 分高い
    expect(scoreNoSupply - scoreWithSupply).toBe(DEFAULT_SCORE_WEIGHTS.supplyCutBonus);
  });
});

// =====================
// Rule 5: 行動消費ペナルティ (常に -30)
// =====================

describe('substitutionEvaluator — 行動消費ペナルティ (substitutionActionLossPenalty)', () => {
  const grid = makeGrid();

  it('他の条件が一切なくても負値を返す (= 交代しない方がよい)', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, { currentHP: 1000 });
    const reserve = makeUnit('r1', 'healer', { col: 0, row: 0 }); // healer, affinity neutral
    // ally に既存ヒーラーあり → healerSupplementBonus なし
    const existingHealer = makeUnit('e2', 'healer', { col: 4, row: 5 });
    // 敵なし → affinitySwapBonus なし; HP 100% → lowHpSubstituteBonus なし; skill/item あり → supplyCutBonus なし
    const ctx = makeContext(unit, [], grid, {
      allyUnits: [unit, existingHealer],
      teamInventory: [{ itemId: 'flare', remainingUses: 1 }],
    });
    const candidate = makeSubCandidate(unit, reserve);
    const score = substitutionEvaluator(candidate, ctx);

    expect(score).toBe(DEFAULT_SCORE_WEIGHTS.substitutionActionLossPenalty); // -30
  });
});

// =====================
// executeAITurn: 交代が actions に含まれる
// =====================

describe('executeAITurn — 交代アクション', () => {
  it('条件が整えば substitute が actions に含まれる', () => {
    const grid = makeGrid();

    // HP 10% (100/1000) の敵ユニット → lowHpSubstituteBonus(50) + actionLossPenalty(-30) = 20 > 0
    const lowHpEnemy = makeUnit('e1', 'attacker', { col: 0, row: 0 }, { currentHP: 100 });
    const reserveUnit = makeUnit('r1', 'healer', { col: 5, row: 5 });
    const player = makeUnit('p1', 'tanker', { col: 9, row: 9 }, { side: 'player' });

    const snapshot = {
      enemyUnits: [lowHpEnemy],
      playerUnits: [player],
      grid,
      currentTurn: 1,
      maxTurns: 20,
      mission: 'elimination' as const,
      reserves: { player: [], enemy: [reserveUnit] },
      substitutionUsedThisTurn: { player: false, enemy: false },
    };

    const result = executeAITurn(snapshot);
    const subAction = result.plan.actions.find(a => a.type === 'substitute');
    expect(subAction).toBeDefined();
    expect(subAction?.unitId).toBe('e1');
    expect(subAction?.targetUnit?.id).toBe('r1');
  });

  it('substitutionUsedThisTurn が true なら 2 度目の交代は起きない', () => {
    const grid = makeGrid();
    const lowHpEnemy = makeUnit('e1', 'attacker', { col: 0, row: 0 }, { currentHP: 100 });
    const reserveUnit = makeUnit('r1', 'healer', { col: 5, row: 5 });
    const player = makeUnit('p1', 'tanker', { col: 9, row: 9 }, { side: 'player' });

    const snapshot = {
      enemyUnits: [lowHpEnemy],
      playerUnits: [player],
      grid,
      currentTurn: 1,
      maxTurns: 20,
      mission: 'elimination' as const,
      reserves: { player: [], enemy: [reserveUnit] },
      substitutionUsedThisTurn: { player: false, enemy: true }, // 既に使用済み
    };

    const result = executeAITurn(snapshot);
    const subAction = result.plan.actions.find(a => a.type === 'substitute');
    expect(subAction).toBeUndefined();
  });
});
