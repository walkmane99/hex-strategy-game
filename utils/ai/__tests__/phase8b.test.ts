import { Unit, UnitType, UnitSide } from '@/types/unit';
import { OffsetCoord } from '@/types/map';
import { isSupplyLineCut, computeSupplyStatuses } from '../perception/supplyLineStatus';
import { calculateDamage, getEffectiveMovement } from '@/utils/combat';
import { checkVictory } from '@/utils/battle/victoryCheck';

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
    id,
    type,
    side: 'player' as UnitSide,
    position,
    stats: { maxHP: 1000, attack: 10, defense: 5, movement: 4, scout: 4 },
    currentHP: 1000,
    isVisible: true,
    hasActed: false,
    isDead: false,
    ...overrides,
  };
}

// =====================
// 1. isSupplyLineCut — 基本判定
// =====================

describe('isSupplyLineCut — 基本判定', () => {
  const base: OffsetCoord = { col: 0, row: 0 };

  it('敵が経路上にいる場合 → true', () => {
    const unit = makeUnit('u1', 'attacker', { col: 4, row: 4 });
    const hostile = makeUnit('h1', 'attacker', { col: 2, row: 2 }, { side: 'enemy' });
    expect(isSupplyLineCut(unit, base, [hostile])).toBe(true);
  });

  it('敵が経路上にいない場合 → false', () => {
    const unit = makeUnit('u1', 'attacker', { col: 4, row: 4 });
    const hostile = makeUnit('h1', 'attacker', { col: 5, row: 5 }, { side: 'enemy' });
    expect(isSupplyLineCut(unit, base, [hostile])).toBe(false);
  });

  it('敵がいない場合 → false', () => {
    const unit = makeUnit('u1', 'attacker', { col: 4, row: 4 });
    expect(isSupplyLineCut(unit, base, [])).toBe(false);
  });
});

// =====================
// 2. ロジスティクス兵の補給線耐性
// =====================

describe('ロジスティクス兵 — 補給線耐性', () => {
  const base: OffsetCoord = { col: 0, row: 0 };

  it('経路上に敵がいても logistics は切断されない', () => {
    const unit = makeUnit('l1', 'logistics', { col: 4, row: 4 });
    const hostile = makeUnit('h1', 'attacker', { col: 2, row: 2 }, { side: 'enemy' });
    expect(isSupplyLineCut(unit, base, [hostile])).toBe(false);
  });

  it('isSupplyCut が true でも logistics は補給接続扱い', () => {
    const unit = makeUnit('l1', 'logistics', { col: 4, row: 4 }, { isSupplyCut: true });
    const hostile = makeUnit('h1', 'attacker', { col: 2, row: 2 }, { side: 'enemy' });
    // isSupplyLineCut はロジスティクス兵に false を返す
    expect(isSupplyLineCut(unit, base, [hostile])).toBe(false);
  });
});

// =====================
// 3. 基地マス上のユニットは非切断
// =====================

describe('isSupplyLineCut — 基地マス上', () => {
  it('基地マスと同じ位置のユニットは切断されない', () => {
    const base: OffsetCoord = { col: 3, row: 3 };
    const unit = makeUnit('u1', 'attacker', { col: 3, row: 3 });
    const hostile = makeUnit('h1', 'attacker', { col: 3, row: 3 }, { side: 'enemy' });
    expect(isSupplyLineCut(unit, base, [hostile])).toBe(false);
  });
});

// =====================
// 4. 戦死ユニットは判定スキップ
// =====================

describe('isSupplyLineCut — 戦死ユニット', () => {
  const base: OffsetCoord = { col: 0, row: 0 };

  it('isDead=true の対象ユニットは false', () => {
    const unit = makeUnit('u1', 'attacker', { col: 4, row: 4 }, { isDead: true });
    const hostile = makeUnit('h1', 'attacker', { col: 2, row: 2 }, { side: 'enemy' });
    expect(isSupplyLineCut(unit, base, [hostile])).toBe(false);
  });

  it('isDead=true の敵は遮断に使われない', () => {
    const unit = makeUnit('u1', 'attacker', { col: 4, row: 4 });
    const hostile = makeUnit('h1', 'attacker', { col: 2, row: 2 }, { side: 'enemy', isDead: true });
    expect(isSupplyLineCut(unit, base, [hostile])).toBe(false);
  });
});

// =====================
// 5. computeSupplyStatuses — 一括更新
// =====================

describe('computeSupplyStatuses', () => {
  const baseLocations = {
    player: { col: 0, row: 9 },
    enemy: { col: 0, row: 0 },
  };

  it('player ユニットが enemy に遮断されている場合 isSupplyCut=true', () => {
    const playerUnit = makeUnit('p1', 'attacker', { col: 0, row: 5 });
    const enemyUnit = makeUnit('e1', 'attacker', { col: 0, row: 7 }, { side: 'enemy' });

    const statuses = computeSupplyStatuses([playerUnit], [enemyUnit], baseLocations);
    expect(statuses.player[0]?.isSupplyCut).toBe(true);
  });

  it('敵に遮断されていない player ユニットは isSupplyCut=false', () => {
    const playerUnit = makeUnit('p1', 'attacker', { col: 0, row: 5 });
    const enemyUnit = makeUnit('e1', 'attacker', { col: 5, row: 5 }, { side: 'enemy' });

    const statuses = computeSupplyStatuses([playerUnit], [enemyUnit], baseLocations);
    expect(statuses.player[0]?.isSupplyCut).toBe(false);
  });
});

// =====================
// 6. ダメージ計算 — 攻撃-30%
// =====================

describe('calculateDamage — 補給線切断の攻撃力補正', () => {
  const terrain = 'plain' as const;

  it('攻撃側が補給切断中 → 通常より低いダメージ期待値', () => {
    const attacker = makeUnit('a1', 'attacker', { col: 0, row: 0 }, { isSupplyCut: true });
    const defender = makeUnit('d1', 'tanker', { col: 1, row: 0 });

    let totalCut = 0;
    const TRIALS = 200;
    for (let i = 0; i < TRIALS; i++) {
      totalCut += calculateDamage(attacker, defender, terrain).damage;
    }

    const attackerNormal = makeUnit('a2', 'attacker', { col: 0, row: 0 });
    let totalNormal = 0;
    for (let i = 0; i < TRIALS; i++) {
      totalNormal += calculateDamage(attackerNormal, defender, terrain).damage;
    }

    expect(totalCut).toBeLessThan(totalNormal);
  });

  it('攻撃側が通常 → 補給切断より高いダメージ期待値', () => {
    const attacker = makeUnit('a1', 'attacker', { col: 0, row: 0 });
    const defender = makeUnit('d1', 'tanker', { col: 1, row: 0 });

    let totalNormal = 0;
    const TRIALS = 200;
    for (let i = 0; i < TRIALS; i++) {
      totalNormal += calculateDamage(attacker, defender, terrain).damage;
    }

    const attackerCut = makeUnit('a2', 'attacker', { col: 0, row: 0 }, { isSupplyCut: true });
    let totalCut = 0;
    for (let i = 0; i < TRIALS; i++) {
      totalCut += calculateDamage(attackerCut, defender, terrain).damage;
    }

    expect(totalNormal).toBeGreaterThan(totalCut);
  });
});

// =====================
// 7. ダメージ計算 — 防御-20%
// =====================

describe('calculateDamage — 補給線切断の防御力補正', () => {
  const terrain = 'plain' as const;

  it('防御側が補給切断中 → 通常より高いダメージ期待値', () => {
    const attacker = makeUnit('a1', 'attacker', { col: 0, row: 0 });
    const defenderCut = makeUnit('d1', 'tanker', { col: 1, row: 0 }, { isSupplyCut: true });

    let totalCut = 0;
    const TRIALS = 200;
    for (let i = 0; i < TRIALS; i++) {
      totalCut += calculateDamage(attacker, defenderCut, terrain).damage;
    }

    const defenderNormal = makeUnit('d2', 'tanker', { col: 1, row: 0 });
    let totalNormal = 0;
    for (let i = 0; i < TRIALS; i++) {
      totalNormal += calculateDamage(attacker, defenderNormal, terrain).damage;
    }

    expect(totalCut).toBeGreaterThan(totalNormal);
  });

  it('防御側が通常 → 補給切断より低いダメージ期待値', () => {
    const attacker = makeUnit('a1', 'attacker', { col: 0, row: 0 });
    const defenderNormal = makeUnit('d1', 'tanker', { col: 1, row: 0 });
    const defenderCut = makeUnit('d2', 'tanker', { col: 1, row: 0 }, { isSupplyCut: true });

    let totalNormal = 0;
    let totalCut = 0;
    const TRIALS = 200;
    for (let i = 0; i < TRIALS; i++) {
      totalNormal += calculateDamage(attacker, defenderNormal, terrain).damage;
      totalCut += calculateDamage(attacker, defenderCut, terrain).damage;
    }

    expect(totalCut).toBeGreaterThan(totalNormal);
  });
});

// =====================
// 8. 移動力減少 — 最低1
// =====================

describe('getEffectiveMovement — 補給線切断', () => {
  it('補給切断中は movement -1', () => {
    const unit = makeUnit('u1', 'attacker', { col: 0, row: 0 }, { isSupplyCut: true });
    expect(getEffectiveMovement(unit)).toBe(unit.stats.movement - 1);
  });

  it('補給切断中でも最低 1 を保証', () => {
    const unit = makeUnit('u1', 'attacker', { col: 0, row: 0 }, {
      stats: { maxHP: 1000, attack: 10, defense: 5, movement: 1, scout: 4 },
      isSupplyCut: true,
    });
    expect(getEffectiveMovement(unit)).toBe(1);
  });

  it('補給正常なら stats.movement そのまま', () => {
    const unit = makeUnit('u1', 'attacker', { col: 0, row: 0 });
    expect(getEffectiveMovement(unit)).toBe(unit.stats.movement);
  });
});

// =====================
// 9. 兵站モード勝利判定
// =====================

describe('checkVictory — supply_line', () => {
  const makeAliveUnit = (id: string, isSupplyCut = false) =>
    makeUnit(id, 'attacker', { col: 0, row: 0 }, { isSupplyCut });

  it('規定ターン前は null', () => {
    const players = [makeAliveUnit('p1'), makeAliveUnit('p2')];
    const enemies = [makeAliveUnit('e1')];
    expect(checkVictory('supply_line', players, enemies, 10, 15)).toBeNull();
  });

  it('規定ターン後、player 接続数 > enemy → player 勝利', () => {
    const players = [makeAliveUnit('p1'), makeAliveUnit('p2')]; // 2接続
    const enemies = [makeAliveUnit('e1', true)];                // 0接続
    const result = checkVictory('supply_line', players, enemies, 16, 15);
    expect(result?.winner).toBe('player');
  });

  it('規定ターン後、enemy 接続数 > player → enemy 勝利', () => {
    const players = [makeAliveUnit('p1', true)];                // 0接続
    const enemies = [makeAliveUnit('e1'), makeAliveUnit('e2')]; // 2接続
    const result = checkVictory('supply_line', players, enemies, 16, 15);
    expect(result?.winner).toBe('enemy');
  });

  it('規定ターン後、接続数同数 → 引き分け', () => {
    const players = [makeAliveUnit('p1')];  // 1接続
    const enemies = [makeAliveUnit('e1')];  // 1接続
    const result = checkVictory('supply_line', players, enemies, 16, 15);
    expect(result?.winner).toBe('draw');
  });
});
