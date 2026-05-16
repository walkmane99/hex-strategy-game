import { Unit, UnitType, UnitSide, SkillSlot } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { ItemSlot } from '@/types/item';
import { ActionCandidate, AIContext, VisibilityMap, ThreatMap, ProbabilityMap } from '../core/types';
import { DEFAULT_SCORE_WEIGHTS } from '../data/scoreWeights';
import { itemUsageEvaluator } from '../scoring/itemUsage';
import { skillUsageEvaluator } from '../scoring/skillUsage';
import { unitSpecificEvaluator } from '../scoring/unitSpecific';
import { generateCandidates } from '../core/AIDecisionEngine';
import { offsetToCube } from '@/utils/hexMath';

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

function posKey(pos: OffsetCoord): string {
  const c = offsetToCube(pos);
  return `${c.q},${c.r}`;
}

// =====================
// itemUsageEvaluator — 照明弾
// =====================

describe('itemUsageEvaluator — 照明弾 (flare)', () => {
  const grid = makeGrid();
  const unit = makeUnit('e1', 'seeker', { col: 5, row: 5 });

  it('probabilityMap に高確率タイル(>0.5)が 3 つ以上ある状況で発動候補になる', () => {
    const probability: ProbabilityMap = new Map();
    probability.set(posKey({ col: 1, row: 1 }), 0.7);
    probability.set(posKey({ col: 2, row: 2 }), 0.8);
    probability.set(posKey({ col: 3, row: 3 }), 0.6);

    const ctx = makeContext(unit, [], grid, { probability });
    const candidate: ActionCandidate = {
      type: 'useItem', unit, itemId: 'flare', score: 0,
    };
    const score = itemUsageEvaluator(candidate, ctx);
    expect(score).toBe(90);
  });

  it('高確率タイルが 2 つ以下では通常条件で発動しない', () => {
    const probability: ProbabilityMap = new Map();
    probability.set(posKey({ col: 1, row: 1 }), 0.7);
    probability.set(posKey({ col: 2, row: 2 }), 0.8);
    // 3 つ目なし

    const ctx = makeContext(unit, [], grid, { probability });
    const candidate: ActionCandidate = {
      type: 'useItem', unit, itemId: 'flare', score: 0,
    };
    const score = itemUsageEvaluator(candidate, ctx);
    expect(score).toBe(0);
  });
});

// =====================
// itemUsageEvaluator — 補給パック
// =====================

describe('itemUsageEvaluator — 補給パック (supply_pack)', () => {
  const grid = makeGrid();

  it('味方ユニットの HP が 40% 未満のとき発動候補になる', () => {
    const unit = makeUnit('e1', 'healer', { col: 5, row: 5 });
    const wounded = makeUnit('e2', 'tanker', { col: 4, row: 5 }, { currentHP: 350 }); // 35%

    const ctx = makeContext(unit, [], grid, { allyUnits: [unit, wounded] });
    const candidate: ActionCandidate = {
      type: 'useItem', unit, itemId: 'supply_pack', score: 0, targetUnit: wounded,
    };
    const score = itemUsageEvaluator(candidate, ctx);
    expect(score).toBe(80);
  });

  it('全味方が 40% 以上のとき発動しない', () => {
    const unit = makeUnit('e1', 'healer', { col: 5, row: 5 });
    const healthy = makeUnit('e2', 'tanker', { col: 4, row: 5 }, { currentHP: 600 }); // 60%

    const ctx = makeContext(unit, [], grid, { allyUnits: [unit, healthy] });
    const candidate: ActionCandidate = {
      type: 'useItem', unit, itemId: 'supply_pack', score: 0, targetUnit: healthy,
    };
    const score = itemUsageEvaluator(candidate, ctx);
    expect(score).toBe(0);
  });
});

// =====================
// itemUsageEvaluator — 縦断爆撃 (残ターン閾値半減)
// =====================

describe('itemUsageEvaluator — 縦断爆撃 (carpet_bombing) 閾値半減', () => {
  const grid = makeGrid();
  const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });

  function makeCandidate(): ActionCandidate {
    return { type: 'useItem', unit, itemId: 'carpet_bombing', score: 0 };
  }

  it('通常: 可視敵HP合計 < 1500 では発動しない', () => {
    // 可視敵が 1 体、HP=1000 → 合計 1000 < 1500
    const enemy = makeUnit('p1', 'tanker', { col: 3, row: 3 }, {
      side: 'player', currentHP: 1000,
    });
    const ctx = makeContext(unit, [enemy], grid, { remainingTurns: 10 });
    expect(itemUsageEvaluator(makeCandidate(), ctx)).toBe(0);
  });

  it('残り 3 ターン: 閾値半減 (≥750) により HP=1000 でも発動する', () => {
    const enemy = makeUnit('p1', 'tanker', { col: 3, row: 3 }, {
      side: 'player', currentHP: 1000,
    });
    const ctx = makeContext(unit, [enemy], grid, { remainingTurns: 3 });
    expect(itemUsageEvaluator(makeCandidate(), ctx)).toBe(150);
  });
});

// =====================
// skillUsageEvaluator — 戦場の鼓舞
// =====================

describe('skillUsageEvaluator — 戦場の鼓舞 (battlefield_inspiration)', () => {
  const grid = makeGrid();

  function makeSkillCandidate(unit: Unit): ActionCandidate {
    return { type: 'useSkill', unit, skillId: 'battlefield_inspiration', score: 0 };
  }

  it('周囲 3 マス以内に味方 3 体がいるとき発動 (戦闘中)', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, {
      skills: [{ skillId: 'battlefield_inspiration', cooldown: 0 }],
    });
    const ally1 = makeUnit('e2', 'tanker',  { col: 5, row: 4 });
    const ally2 = makeUnit('e3', 'healer',  { col: 5, row: 6 });
    const ally3 = makeUnit('e4', 'archer',  { col: 4, row: 5 });
    const enemy = makeUnit('p1', 'attacker', { col: 8, row: 8 }, { side: 'player' });

    const ctx = makeContext(unit, [enemy], grid, {
      allyUnits: [unit, ally1, ally2, ally3],
    });
    expect(skillUsageEvaluator(makeSkillCandidate(unit), ctx)).toBe(85);
  });

  it('周囲 3 マス以内に味方が 2 体しかいない場合は発動しない', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, {
      skills: [{ skillId: 'battlefield_inspiration', cooldown: 0 }],
    });
    const ally1 = makeUnit('e2', 'tanker', { col: 5, row: 4 });
    const ally2 = makeUnit('e3', 'healer', { col: 5, row: 6 });
    const enemy = makeUnit('p1', 'attacker', { col: 8, row: 8 }, { side: 'player' });

    const ctx = makeContext(unit, [enemy], grid, {
      allyUnits: [unit, ally1, ally2],
    });
    expect(skillUsageEvaluator(makeSkillCandidate(unit), ctx)).toBe(0);
  });
});

// =====================
// skillUsageEvaluator — 緊急修復
// =====================

describe('skillUsageEvaluator — 緊急修復 (emergency_repair)', () => {
  const grid = makeGrid();

  it('自身 HP<40% でクールダウン 0 のとき発動 (+75)', () => {
    const unit = makeUnit('e1', 'engineer', { col: 5, row: 5 }, {
      currentHP: 300,
      skills: [{ skillId: 'emergency_repair', cooldown: 0 }],
    });
    const ctx = makeContext(unit, [], grid);
    const candidate: ActionCandidate = {
      type: 'useSkill', unit, skillId: 'emergency_repair', score: 0,
    };
    expect(skillUsageEvaluator(candidate, ctx)).toBe(75);
  });

  it('クールダウンが残っているとき発動しない', () => {
    const unit = makeUnit('e1', 'engineer', { col: 5, row: 5 }, {
      currentHP: 300,
      skills: [{ skillId: 'emergency_repair', cooldown: 2 }],
    });
    const ctx = makeContext(unit, [], grid);
    const candidate: ActionCandidate = {
      type: 'useSkill', unit, skillId: 'emergency_repair', score: 0,
    };
    expect(skillUsageEvaluator(candidate, ctx)).toBe(0);
  });

  it('HP が 40% 以上のとき発動しない', () => {
    const unit = makeUnit('e1', 'engineer', { col: 5, row: 5 }, {
      currentHP: 500,
      skills: [{ skillId: 'emergency_repair', cooldown: 0 }],
    });
    const ctx = makeContext(unit, [], grid);
    const candidate: ActionCandidate = {
      type: 'useSkill', unit, skillId: 'emergency_repair', score: 0,
    };
    expect(skillUsageEvaluator(candidate, ctx)).toBe(0);
  });
});

// =====================
// unitSpecific — エンジニアが索敵マーカー設置を選好
// =====================

describe('unitSpecificEvaluator — エンジニアの scout_marker 選好', () => {
  it('scout_marker の useSkill 候補が highland タイルで高地移動より高スコア', () => {
    const grid = makeGrid(10, 10, [{ row: 3, col: 3, terrain: 'highland' }]);
    const unit = makeUnit('e1', 'engineer', { col: 5, row: 5 }, {
      skills: [{ skillId: 'scout_marker', cooldown: 0 }],
    });
    const ctx = makeContext(unit, [], grid);

    // useSkill scout_marker on highland → 25
    const useSkillHighland: ActionCandidate = {
      type: 'useSkill', unit, skillId: 'scout_marker',
      targetTile: { col: 3, row: 3 }, score: 0,
    };
    const useSkillScore = unitSpecificEvaluator(useSkillHighland, ctx);
    expect(useSkillScore).toBe(25);

    // move (旧近似) は 0 になること
    const moveHighland: ActionCandidate = {
      type: 'move', unit, targetTile: { col: 3, row: 3 }, score: 0,
    };
    const moveScore = unitSpecificEvaluator(moveHighland, ctx);
    expect(moveScore).toBe(0);
  });
});

// =====================
// unitSpecific — イリュージョニストがデコイ設置を選好
// =====================

describe('unitSpecificEvaluator — イリュージョニストの decoy 選好', () => {
  it('decoy の useSkill 候補が敵索敵範囲内のとき森林移動より高スコア', () => {
    const grid = makeGrid(10, 10, [{ row: 4, col: 4, terrain: 'forest' }]);
    const unit = makeUnit('e1', 'illusionist', { col: 5, row: 5 }, {
      skills: [{ skillId: 'decoy', cooldown: 0 }],
    });
    const enemy = makeUnit('p1', 'sniper', { col: 3, row: 3 }, { side: 'player' });
    const ctx = makeContext(unit, [enemy], grid);

    // useSkill decoy on tile overlapping enemy scout range
    const useSkillDecoy: ActionCandidate = {
      type: 'useSkill', unit, skillId: 'decoy',
      targetTile: { col: 4, row: 4 }, score: 0,
    };
    const useSkillScore = unitSpecificEvaluator(useSkillDecoy, ctx);
    // enemy at (3,3), dist to (4,4) should be ≤3 → overlapCount ≥ 1
    expect(useSkillScore).toBeGreaterThan(0);

    // move to forest (旧近似) は 0 になること
    const moveForest: ActionCandidate = {
      type: 'move', unit, targetTile: { col: 4, row: 4 }, score: 0,
    };
    const moveScore = unitSpecificEvaluator(moveForest, ctx);
    expect(moveScore).toBe(0);
  });
});

// =====================
// generateCandidates — useItem / useSkill 候補の生成確認
// =====================

describe('generateCandidates — フェーズ5 候補生成', () => {
  const grid = makeGrid();

  it('teamInventory があれば useItem 候補が含まれる', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, { stats: { maxHP: 1000, attack: 10, defense: 5, movement: 0, scout: 0 } });
    const inventory: ItemSlot[] = [{ itemId: 'supply_pack', remainingUses: 1 }];
    const ctx = makeContext(unit, [], grid, { teamInventory: inventory });

    const candidates = generateCandidates(unit, ctx);
    const itemCandidates = candidates.filter(c => c.type === 'useItem');
    expect(itemCandidates.length).toBeGreaterThan(0);
    expect(itemCandidates.some(c => c.itemId === 'supply_pack')).toBe(true);
  });

  it('unit.skills があれば useSkill 候補が含まれる', () => {
    const unit = makeUnit('e1', 'engineer', { col: 5, row: 5 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 0, scout: 0 },
      skills: [{ skillId: 'scout_marker', cooldown: 0 }],
    });
    const ctx = makeContext(unit, [], grid);

    const candidates = generateCandidates(unit, ctx);
    const skillCandidates = candidates.filter(c => c.type === 'useSkill');
    expect(skillCandidates.length).toBeGreaterThan(0);
    expect(skillCandidates.some(c => c.skillId === 'scout_marker')).toBe(true);
  });

  it('クールダウン中のスキルは候補に含まれない', () => {
    const unit = makeUnit('e1', 'engineer', { col: 5, row: 5 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 0, scout: 0 },
      skills: [{ skillId: 'scout_marker', cooldown: 2 }],
    });
    const ctx = makeContext(unit, [], grid);

    const candidates = generateCandidates(unit, ctx);
    const skillCandidates = candidates.filter(c => c.type === 'useSkill' && c.skillId === 'scout_marker');
    expect(skillCandidates.length).toBe(0);
  });

  it('remainingUses が 0 のアイテムは候補に含まれない', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 0, scout: 0 },
    });
    const inventory: ItemSlot[] = [{ itemId: 'supply_pack', remainingUses: 0 }];
    const ctx = makeContext(unit, [], grid, { teamInventory: inventory });

    const candidates = generateCandidates(unit, ctx);
    expect(candidates.filter(c => c.type === 'useItem').length).toBe(0);
  });
});
