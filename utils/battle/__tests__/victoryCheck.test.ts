import { checkVictory } from '../victoryCheck';
import { Unit, UnitType } from '@/types/unit';
import { UNIT_BASE_STATS } from '@/constants/unitStats';
import { OffsetCoord } from '@/types/map';

function makeUnit(
  id: string,
  type: UnitType,
  side: 'player' | 'enemy',
  pos: OffsetCoord = { col: 0, row: 0 },
  overrides?: Partial<Unit>,
): Unit {
  const stats = UNIT_BASE_STATS[type];
  return {
    id, type, side, stats,
    currentHP: stats.maxHP,
    position: pos,
    isVisible: true,
    hasActed: false,
    isDead: false,
    ...overrides,
  };
}

const alive = (u: Unit) => ({ ...u, isDead: false });
const dead = (u: Unit) => ({ ...u, isDead: true, currentHP: 0 });

describe('checkVictory — elimination', () => {
  it('全敵撃破 → player 勝利', () => {
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [dead(makeUnit('e1', 'attacker', 'enemy'))];
    expect(checkVictory('elimination', players, enemies, 1, 20)).toMatchObject({ winner: 'player' });
  });

  it('全プレイヤー撃破 → enemy 勝利', () => {
    const players = [dead(makeUnit('p1', 'attacker', 'player'))];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    expect(checkVictory('elimination', players, enemies, 1, 20)).toMatchObject({ winner: 'enemy' });
  });

  it('双方生存 → null', () => {
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    expect(checkVictory('elimination', players, enemies, 1, 20)).toBeNull();
  });
});

describe('checkVictory — survival', () => {
  it('ターン上限超過 → player 勝利', () => {
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    expect(checkVictory('survival', players, enemies, 21, 20)).toMatchObject({ winner: 'player' });
  });

  it('キーユニット撃破 → enemy 勝利', () => {
    const p1 = dead(makeUnit('key1', 'attacker', 'player'));
    const players = [p1, makeUnit('p2', 'tanker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    const result = checkVictory('survival', players, enemies, 5, 20, { keyUnitIds: ['key1'] });
    expect(result).toMatchObject({ winner: 'enemy' });
  });

  it('ターン内 → null', () => {
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    expect(checkVictory('survival', players, enemies, 10, 20)).toBeNull();
  });
});

describe('checkVictory — time_limit', () => {
  it('ターン上限超過 → player 勝利', () => {
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    expect(checkVictory('time_limit', players, enemies, 21, 20)).toMatchObject({ winner: 'player' });
  });

  it('ターン内 → null', () => {
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    expect(checkVictory('time_limit', players, enemies, 20, 20)).toBeNull();
  });
});

describe('checkVictory — escape', () => {
  it('キーユニットが脱出タイル到達 → player 勝利', () => {
    const escape: OffsetCoord = { col: 9, row: 9 };
    const key = makeUnit('key1', 'attacker', 'player', escape);
    const players = [key, makeUnit('p2', 'tanker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    const result = checkVictory('escape', players, enemies, 5, 20, {
      keyUnitIds: ['key1'],
      escapeTiles: [escape],
    });
    expect(result).toMatchObject({ winner: 'player' });
  });

  it('キーユニット撃破 → enemy 勝利', () => {
    const key = dead(makeUnit('key1', 'attacker', 'player'));
    const players = [key];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    const result = checkVictory('escape', players, enemies, 5, 20, { keyUnitIds: ['key1'] });
    expect(result).toMatchObject({ winner: 'enemy' });
  });

  it('未脱出・未死亡 → null', () => {
    const key = makeUnit('key1', 'attacker', 'player', { col: 0, row: 0 });
    const players = [key];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];
    const result = checkVictory('escape', players, enemies, 5, 20, {
      keyUnitIds: ['key1'],
      escapeTiles: [{ col: 9, row: 9 }],
    });
    expect(result).toBeNull();
  });
});

describe('checkVictory — protect_hq', () => {
  it('ターン上限超過 → player 勝利', () => {
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy', { col: 3, row: 3 })];
    const result = checkVictory('protect_hq', players, enemies, 21, 20, {
      hqLocation: { col: 5, row: 5 },
    });
    expect(result).toMatchObject({ winner: 'player' });
  });

  it('敵が拠点を占拠 → enemy 勝利', () => {
    const hq: OffsetCoord = { col: 5, row: 5 };
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy', hq)];
    const result = checkVictory('protect_hq', players, enemies, 5, 20, { hqLocation: hq });
    expect(result).toMatchObject({ winner: 'enemy' });
  });

  it('拠点未占拠・ターン内 → null', () => {
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [makeUnit('e1', 'attacker', 'enemy', { col: 3, row: 3 })];
    const result = checkVictory('protect_hq', players, enemies, 5, 20, {
      hqLocation: { col: 5, row: 5 },
    });
    expect(result).toBeNull();
  });
});

describe('checkVictory — 共通敗北条件', () => {
  it('全プレイヤー撃破は全ての勝利条件より優先される', () => {
    const players = [dead(makeUnit('p1', 'attacker', 'player'))];
    const enemies = [dead(makeUnit('e1', 'attacker', 'enemy'))];
    // 敵も全滅しているが、プレイヤーが先に全滅
    const result = checkVictory('elimination', players, enemies, 1, 20);
    expect(result).toMatchObject({ winner: 'enemy' });
  });
});
