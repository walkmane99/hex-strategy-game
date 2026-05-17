import { Unit, UnitType, UnitSide } from '@/types/unit';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { ActionCandidate, AIContext, VisibilityMap, ThreatMap } from '../core/types';
import { DEFAULT_SCORE_WEIGHTS } from '../data/scoreWeights';
import { generateCandidates } from '../core/AIDecisionEngine';
import { isAssassinVisible } from '../perception/visibilityMap';
import { missionAdjustEvaluator } from '../scoring/missionAdjust';
import { supplyLineEvaluator } from '../scoring/supplyLine';
import { AURA_CONFIG } from '@/constants/gameConfig';
import { unitSpecificEvaluator } from '../scoring/unitSpecific';
import { MissionMetadata } from '@/types/mission';

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

function makeGrid(rows = 10, cols = 10, terrain: TerrainType = 'plain'): MapCell[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      position: { row, col } as OffsetCoord,
      terrain,
    })),
  );
}

function makeGridWithCell(
  rows = 10,
  cols = 10,
  overrides: Array<{ row: number; col: number; terrain: TerrainType }>,
): MapCell[][] {
  const grid = makeGrid(rows, cols, 'plain');
  for (const { row, col, terrain } of overrides) {
    if (grid[row]?.[col]) {
      grid[row]![col]!.terrain = terrain;
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
// 1. ヒーラー回復範囲 半径1
// =====================

describe('ヒーラー回復範囲 = 半径1', () => {
  it('AURA_CONFIG.HEALER_RANGE が 1 に更新されていること', () => {
    expect(AURA_CONFIG.HEALER_RANGE).toBe(1);
  });

  it('距離1の味方がいる移動先で healerSupportBonus が乗る', () => {
    const grid = makeGrid();
    const healer = makeUnit('h1', 'healer', { col: 5, row: 5 });
    const ally = makeUnit('a1', 'attacker', { col: 5, row: 6 }); // 距離1

    const candidate: ActionCandidate = {
      type: 'move',
      unit: healer,
      targetTile: { col: 5, row: 4 }, // ally から距離2だが、healerの移動先として評価
      score: 0,
    };
    // 距離1の味方がいる移動先
    const candidateClose: ActionCandidate = {
      type: 'move',
      unit: healer,
      targetTile: { col: 5, row: 5 }, // healerの現在地 (ally との距離1)
      score: 0,
    };

    const ctx = makeContext(healer, [], grid, {
      actingUnit: healer,
      allyUnits: [healer, ally],
    });
    const scoreClose = unitSpecificEvaluator(candidateClose, ctx);
    const scoreFar = unitSpecificEvaluator(candidate, ctx);

    // 距離1 <= HEALER_RANGE(1) → healerSupportBonus
    expect(scoreClose).toBeGreaterThan(0);
    // 距離2 > HEALER_RANGE(1) → ペナルティ側
    expect(scoreFar).toBeLessThan(scoreClose);
  });

  it('距離2の味方には healerSupportBonus が乗らない', () => {
    const grid = makeGrid();
    const healer = makeUnit('h1', 'healer', { col: 5, row: 5 });
    const ally = makeUnit('a1', 'attacker', { col: 5, row: 7 }); // 距離2

    const candidate: ActionCandidate = {
      type: 'move',
      unit: healer,
      targetTile: { col: 5, row: 5 }, // ally との距離 2
      score: 0,
    };

    const ctx = makeContext(healer, [], grid, {
      actingUnit: healer,
      allyUnits: [healer, ally],
    });
    const score = unitSpecificEvaluator(candidate, ctx);
    // 距離2 > HEALER_RANGE(1) なので healerSupportBonus は乗らず負値になる
    expect(score).toBeLessThanOrEqual(0);
  });
});

// =====================
// 2. 移動・攻撃トレードオフ: スナイパー
// =====================

describe('移動・攻撃トレードオフ: スナイパー', () => {
  const grid = makeGrid();

  it('スナイパーは moveAndAttack 候補を生成しない', () => {
    const sniper = makeUnit('s1', 'sniper', { col: 5, row: 5 });
    // スナイパー射程3の敵を3マス先に配置
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 2 }, { side: 'player' });
    const ctx = makeContext(sniper, [enemy], grid);

    const candidates = generateCandidates(sniper, ctx);
    const moveAndAttack = candidates.filter(c => c.type === 'moveAndAttack');
    expect(moveAndAttack).toHaveLength(0);
  });

  it('スナイパーは通常の attack 候補と move 候補を生成する', () => {
    const sniper = makeUnit('s1', 'sniper', { col: 5, row: 5 });
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 3 }, { side: 'player' }); // 距離2
    const ctx = makeContext(sniper, [enemy], grid);

    const candidates = generateCandidates(sniper, ctx);
    expect(candidates.some(c => c.type === 'attack')).toBe(true);
    expect(candidates.some(c => c.type === 'move')).toBe(true);
  });
});

// =====================
// 3. 移動・攻撃トレードオフ: アサシン (全力移動後は moveAndAttack なし)
// =====================

describe('移動・攻撃トレードオフ: アサシン', () => {
  const grid = makeGrid();

  it('最大移動力の移動先では moveAndAttack 候補が生成されない', () => {
    // movement=3, 敵を距離3先に配置して、そこで攻撃できるか確認
    const assassin = makeUnit('a1', 'assassin', { col: 4, row: 5 });
    // 距離3の敵 (アサシン射程1)
    const enemy = makeUnit('p1', 'tanker', { col: 4, row: 2 }, { side: 'player' });
    const ctx = makeContext(assassin, [enemy], grid);

    const candidates = generateCandidates(assassin, ctx);
    // 距離3 (=movement) の移動先からの moveAndAttack は生成されない
    const maxMovMoveAndAttack = candidates.filter(
      c =>
        c.type === 'moveAndAttack' &&
        c.targetTile &&
        Math.abs(c.targetTile.row - assassin.position.row) +
          Math.abs(c.targetTile.col - assassin.position.col) >=
          assassin.stats.movement,
    );
    expect(maxMovMoveAndAttack).toHaveLength(0);
  });

  it('最大移動力未満の移動先では moveAndAttack 候補が生成される', () => {
    const assassin = makeUnit('a1', 'assassin', { col: 4, row: 5 });
    // 距離1の敵 (射程内から1移動でも届く)
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 5 }, { side: 'player' });
    const ctx = makeContext(assassin, [enemy], grid);

    const candidates = generateCandidates(assassin, ctx);
    const moveAndAttack = candidates.filter(c => c.type === 'moveAndAttack');
    expect(moveAndAttack.length).toBeGreaterThan(0);
  });
});

// =====================
// 4. 移動・攻撃トレードオフ: バーサーカー (全力移動後も attack 可)
// =====================

describe('移動・攻撃トレードオフ: バーサーカー', () => {
  const grid = makeGrid();

  it('最大移動力の移動先でも moveAndAttack 候補が生成される', () => {
    const berserker = makeUnit('b1', 'berserker', { col: 4, row: 5 });
    // 距離3先に敵 + さらに隣接するよう配置
    const enemy = makeUnit('p1', 'tanker', { col: 4, row: 2 }, { side: 'player' }); // 距離3
    const ctx = makeContext(berserker, [enemy], grid);

    const candidates = generateCandidates(berserker, ctx);
    // バーサーカーなら distance==movement でも moveAndAttack あり
    const moveAndAttack = candidates.filter(c => c.type === 'moveAndAttack');
    // 射程1なので、距離3先の敵に隣接する移動先 (距離2) + max移動でも攻撃候補あり
    // 敵が distance 3 にあり、berserker range は 1 → 2マス先に移動して隣接できる
    expect(moveAndAttack.length).toBeGreaterThan(0);
  });
});

// =====================
// 5. アサシン発見確率: 平地・隣接アサシン索敵 = 65%
// =====================

describe('isAssassinVisible — 発見確率', () => {
  it('平地のアサシンを隣接アサシンが索敵 → 発見確率 65%', () => {
    const grid = makeGrid(); // 全平地
    const target = makeUnit('a1', 'assassin', { col: 5, row: 5 });
    // observer: assassin, distance 1 (隣接)
    const observer = makeUnit('o1', 'assassin', { col: 5, row: 4 }, { side: 'player' });

    // prob = 0.40 (plain) + 0.15 (assassin) + 0.10 (dist=1) = 0.65
    // rng < 0.65 → true, rng >= 0.65 → false
    const visibleJustBelow = isAssassinVisible(target, [observer], grid, () => 0.6499);
    const notVisibleAtBoundary = isAssassinVisible(target, [observer], grid, () => 0.65);

    expect(visibleJustBelow).toBe(true);
    expect(notVisibleAtBoundary).toBe(false);
  });

  it('森のアサシンを3マス先のヒーラーが索敵 → 発見確率 5%', () => {
    const grid = makeGridWithCell(10, 10, [{ row: 5, col: 5, terrain: 'forest' }]);
    const target = makeUnit('a1', 'assassin', { col: 5, row: 5 });
    // observer: healer, distance 3
    const observer = makeUnit('o1', 'healer', { col: 5, row: 2 }, { side: 'player' });
    // observer のsightRange = BASE_RANGE(2) + statBonus(floor(4/4)=1) = 3 → 距離3は範囲内

    // prob = 0.10 (forest) + (-0.05) (healer) + 0 (dist=3) = 0.05
    const visibleJustBelow = isAssassinVisible(target, [observer], grid, () => 0.0499);
    const notVisibleAtBoundary = isAssassinVisible(target, [observer], grid, () => 0.05);

    expect(visibleJustBelow).toBe(true);
    expect(notVisibleAtBoundary).toBe(false);
  });

  it('発見確率は 5%〜65% にクランプされる', () => {
    // 最低値: 森 + ヒーラー + 3マス以上 = 10 - 5 + 0 = 5%
    const gridForest = makeGridWithCell(10, 10, [{ row: 5, col: 5, terrain: 'forest' }]);
    const target = makeUnit('a1', 'assassin', { col: 5, row: 5 });
    const healerFar = makeUnit('o1', 'healer', { col: 5, row: 2 }, { side: 'player' });
    // rng = 0.04 (< 5%) → true
    expect(isAssassinVisible(target, [healerFar], gridForest, () => 0.04)).toBe(true);
    // rng = 0.05 (>= 5%) → false
    expect(isAssassinVisible(target, [healerFar], gridForest, () => 0.05)).toBe(false);
  });
});

// =====================
// 6. missionAdjustEvaluator — 生存戦
// =====================

describe('missionAdjustEvaluator — survival (生存戦)', () => {
  const grid = makeGrid();

  it('キーユニットへの攻撃に +keyUnitAttackBonus (100) が乗る', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const keyEnemy = makeUnit('p1', 'tanker', { col: 6, row: 5 }, { side: 'player' });

    const candidate: ActionCandidate = {
      type: 'attack',
      unit,
      targetUnit: keyEnemy,
      score: 0,
    };
    const meta: MissionMetadata = { keyUnitIds: ['p1'] };
    const ctx = makeContext(unit, [keyEnemy], grid, {
      mission: 'survival',
      missionMetadata: meta,
    });

    const score = missionAdjustEvaluator(candidate, ctx);
    // keyUnitAttackBonus(100) + lowHpEnemyBonus(20) かどうかは HP次第
    // keyEnemy は HP100%・defense5 なので lowHpEnemyBonus は乗らない
    expect(score).toBe(DEFAULT_SCORE_WEIGHTS.keyUnitAttackBonus);
  });

  it('低HP敵への攻撃に +lowHpEnemyBonus (20) が乗る', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const weakEnemy = makeUnit('p1', 'tanker', { col: 6, row: 5 }, {
      side: 'player',
      currentHP: 400, // 40% < 50%
    });

    const candidate: ActionCandidate = {
      type: 'attack',
      unit,
      targetUnit: weakEnemy,
      score: 0,
    };
    const ctx = makeContext(unit, [weakEnemy], grid, {
      mission: 'survival',
    });

    const score = missionAdjustEvaluator(candidate, ctx);
    expect(score).toBe(DEFAULT_SCORE_WEIGHTS.lowHpEnemyBonus);
  });
});

// =====================
// 7. missionAdjustEvaluator — 脱出戦
// =====================

describe('missionAdjustEvaluator — escape (脱出戦)', () => {
  const grid = makeGrid();

  it('キーユニットへの攻撃に +escapeKeyUnitAttackBonus (120) が乗る', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const keyEnemy = makeUnit('p1', 'healer', { col: 6, row: 5 }, { side: 'player' });

    const candidate: ActionCandidate = {
      type: 'attack',
      unit,
      targetUnit: keyEnemy,
      score: 0,
    };
    const meta: MissionMetadata = { keyUnitIds: ['p1'] };
    const ctx = makeContext(unit, [keyEnemy], grid, {
      mission: 'escape',
      missionMetadata: meta,
    });

    const score = missionAdjustEvaluator(candidate, ctx);
    expect(score).toBe(DEFAULT_SCORE_WEIGHTS.escapeKeyUnitAttackBonus);
  });

  it('脱出地点に近い移動先にボーナスが乗る', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const escapeTile: OffsetCoord = { col: 5, row: 1 };
    const meta: MissionMetadata = { escapeTiles: [escapeTile] };
    const ctx = makeContext(unit, [], grid, {
      mission: 'escape',
      missionMetadata: meta,
    });

    // 脱出地点から距離1の移動先
    const candidateClose: ActionCandidate = {
      type: 'move',
      unit,
      targetTile: { col: 5, row: 2 }, // escapeTileから距離1
      score: 0,
    };
    // 脱出地点から距離4の移動先
    const candidateFar: ActionCandidate = {
      type: 'move',
      unit,
      targetTile: { col: 5, row: 5 }, // escapeTileから距離4
      score: 0,
    };

    const scoreClose = missionAdjustEvaluator(candidateClose, ctx);
    const scoreFar = missionAdjustEvaluator(candidateFar, ctx);

    expect(scoreClose).toBeGreaterThan(scoreFar);
    // dist=1: bonus = max(0, 30 - (1-1)*10) = 30
    expect(scoreClose).toBe(30);
    // dist=4: bonus = max(0, 30 - (4-1)*10) = max(0, 0) = 0
    expect(scoreFar).toBe(0);
  });
});

// =====================
// 8. missionAdjustEvaluator — 時間切れ
// =====================

describe('missionAdjustEvaluator — time_limit (時間切れ)', () => {
  const grid = makeGrid();

  it('残り4ターン以上: 守勢モード — アタッカーの前進に attackerAdvancePenalty (-30)', () => {
    const attacker = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 8 }, { side: 'player' }); // 下方向

    // 前進 = 敵に近づく移動
    const candidateAdvance: ActionCandidate = {
      type: 'move',
      unit: attacker,
      targetTile: { col: 5, row: 6 }, // 敵に1マス近づく
      score: 0,
    };
    const candidateRetreat: ActionCandidate = {
      type: 'move',
      unit: attacker,
      targetTile: { col: 5, row: 4 }, // 敵から遠ざかる
      score: 0,
    };

    const ctx = makeContext(attacker, [enemy], grid, {
      mission: 'time_limit',
      remainingTurns: 5, // > 3 → 守勢モード
    });

    const scoreAdvance = missionAdjustEvaluator(candidateAdvance, ctx);
    const scoreRetreat = missionAdjustEvaluator(candidateRetreat, ctx);

    // 前進にはペナルティ
    expect(scoreAdvance).toBeLessThan(scoreRetreat);
    // 後退には attackerAdvancePenalty は乗らない
    // (safetyScore の 0.5× が乗るが符号は context 依存)
  });

  it('残り3ターン以下: 通常モード — attackerAdvancePenalty は乗らない', () => {
    const attacker = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 8 }, { side: 'player' });

    const candidateAdvance: ActionCandidate = {
      type: 'move',
      unit: attacker,
      targetTile: { col: 5, row: 6 },
      score: 0,
    };
    const candidateRetreat: ActionCandidate = {
      type: 'move',
      unit: attacker,
      targetTile: { col: 5, row: 4 },
      score: 0,
    };

    const ctx = makeContext(attacker, [enemy], grid, {
      mission: 'time_limit',
      remainingTurns: 3, // <= 3 → 通常モード
    });

    const scoreAdvance = missionAdjustEvaluator(candidateAdvance, ctx);
    const scoreRetreat = missionAdjustEvaluator(candidateRetreat, ctx);

    // 通常モードではペナルティなし (safetyScore の加算もなし)
    expect(scoreAdvance).toBe(0);
    expect(scoreRetreat).toBe(0);
  });
});

// =====================
// 9. missionAdjustEvaluator — 拠点防衛
// =====================

describe('missionAdjustEvaluator — protect_hq (拠点防衛)', () => {
  const grid = makeGrid();
  const hq: OffsetCoord = { col: 5, row: 5 };
  const meta: MissionMetadata = { hqLocation: hq };

  it('拠点周辺3マス以内への移動に +hqProximityBonus (40) が乗る', () => {
    const unit = makeUnit('e1', 'attacker', { col: 9, row: 9 });

    const candidateNear: ActionCandidate = {
      type: 'move',
      unit,
      targetTile: { col: 5, row: 4 }, // 拠点から距離1
      score: 0,
    };
    const candidateFar: ActionCandidate = {
      type: 'move',
      unit,
      targetTile: { col: 9, row: 9 }, // 拠点から距離8+
      score: 0,
    };

    const ctx = makeContext(unit, [], grid, {
      mission: 'protect_hq',
      missionMetadata: meta,
    });

    expect(missionAdjustEvaluator(candidateNear, ctx)).toBe(DEFAULT_SCORE_WEIGHTS.hqProximityBonus);
    expect(missionAdjustEvaluator(candidateFar, ctx)).toBe(0);
  });

  it('拠点に向かう敵への迎撃攻撃に +hqInterceptBonus (60) が乗る', () => {
    const unit = makeUnit('e1', 'attacker', { col: 6, row: 5 });
    // 拠点から距離3の敵 (≤4 → 迎撃ボーナス)
    const nearEnemy = makeUnit('p1', 'tanker', { col: 5, row: 8 }, { side: 'player' });
    // 拠点から距離6の敵 (>4 → ボーナスなし)
    const farEnemy = makeUnit('p2', 'tanker', { col: 5, row: 0 }, { side: 'player' });

    const candidateNear: ActionCandidate = { type: 'attack', unit, targetUnit: nearEnemy, score: 0 };
    const candidateFar: ActionCandidate = { type: 'attack', unit, targetUnit: farEnemy, score: 0 };

    const ctx = makeContext(unit, [nearEnemy, farEnemy], grid, {
      mission: 'protect_hq',
      missionMetadata: meta,
    });

    expect(missionAdjustEvaluator(candidateNear, ctx)).toBe(DEFAULT_SCORE_WEIGHTS.hqInterceptBonus);
    expect(missionAdjustEvaluator(candidateFar, ctx)).toBe(0);
  });
});

// =====================
// 10. supplyLineEvaluator
// =====================

describe('supplyLineEvaluator — 補給線切断', () => {
  const grid = makeGrid();
  // AI(enemy)基地 = (0,0)、player基地 = (0,9) — (4,4)が player 補給線上に乗らない配置
  const meta: MissionMetadata = {
    baseLocations: {
      player: { col: 0, row: 9 },
      enemy: { col: 0, row: 0 },
    },
  };

  it('自軍補給線上に敵がいる時、さらに補給線上の前進候補に supplyCutSelfPenalty (-40) が乗る', () => {
    // unit(enemy AI): (5,5), enemy base: (0,0), player: (3,3) (経路上)
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const enemyOnPath = makeUnit('p1', 'tanker', { col: 3, row: 3 }, { side: 'player' });

    // 移動先も補給線上
    const candidateOnPath: ActionCandidate = {
      type: 'move',
      unit,
      targetTile: { col: 4, row: 4 }, // (0,0)〜(5,5)の経路上
      score: 0,
    };

    const ctx = makeContext(unit, [enemyOnPath], grid, {
      actingUnit: unit,
      missionMetadata: meta,
    });

    const score = supplyLineEvaluator(candidateOnPath, ctx);
    // 自軍補給線切断中かつ移動先も切断中 → -40
    expect(score).toBeLessThanOrEqual(DEFAULT_SCORE_WEIGHTS.supplyCutSelfPenalty);
  });

  it('基地座標が未設定の場合は 0 を返す', () => {
    const unit = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    const candidate: ActionCandidate = {
      type: 'move',
      unit,
      targetTile: { col: 4, row: 4 },
      score: 0,
    };
    const ctx = makeContext(unit, [], grid, { actingUnit: unit });
    expect(supplyLineEvaluator(candidate, ctx)).toBe(0);
  });
});

// =====================
// 11. moveAndAttack 候補生成
// =====================

describe('generateCandidates — moveAndAttack', () => {
  const grid = makeGrid();

  it('移動先から射程内に敵がいる場合、moveAndAttack 候補が生成される', () => {
    const attacker = makeUnit('e1', 'attacker', { col: 5, row: 5 });
    // 距離2の敵 (attacker移動力3, 1移動して隣接可)
    const enemy = makeUnit('p1', 'tanker', { col: 5, row: 3 }, { side: 'player' });
    const ctx = makeContext(attacker, [enemy], grid);

    const candidates = generateCandidates(attacker, ctx);
    const moveAndAttack = candidates.filter(c => c.type === 'moveAndAttack');

    expect(moveAndAttack.length).toBeGreaterThan(0);
    // 各候補に targetTile と targetUnit が設定されている
    for (const c of moveAndAttack) {
      expect(c.targetTile).toBeDefined();
      expect(c.targetUnit).toBeDefined();
    }
  });
});
