import { configureStore } from '@reduxjs/toolkit';
import unitReducer, {
  initPlayerUnits,
  initEnemyUnits,
  applyDamage,
  playerUnitSelectors,
  enemyUnitSelectors,
} from '@/store/slices/unitSlice';
import battleReducer from '@/store/slices/battleSlice';
import playerReducer from '@/store/slices/playerSlice';
import gameReducer, { endBattle } from '@/store/slices/gameSlice';
import { performAttack } from '@/utils/battle/performAttack';
import { checkVictory } from '@/utils/battle/victoryCheck';
import { Unit, UnitType } from '@/types/unit';
import { UNIT_BASE_STATS } from '@/constants/unitStats';

function makeUnit(
  id: string,
  type: UnitType,
  side: 'player' | 'enemy',
  overrides?: Partial<Unit>,
): Unit {
  const stats = UNIT_BASE_STATS[type];
  return {
    id, type, side, stats,
    currentHP: stats.maxHP,
    position: { col: 0, row: 0 },
    isVisible: true,
    hasActed: false,
    isDead: false,
    ...overrides,
  };
}

function makeStore() {
  return configureStore({
    reducer: {
      units: unitReducer,
      battle: battleReducer,
      player: playerReducer,
      game: gameReducer,
    },
  });
}

describe('battle-damage — applyDamage 基本動作', () => {
  it('applyDamage で enemy の currentHP が減少する', () => {
    const store = makeStore();
    const enemy = makeUnit('e1', 'attacker', 'enemy');
    store.dispatch(initEnemyUnits([enemy]));

    const before = enemyUnitSelectors.selectById(store.getState(), 'e1')!.currentHP;
    store.dispatch(applyDamage({ id: 'e1', damage: 10, side: 'enemy' }));
    const after = enemyUnitSelectors.selectById(store.getState(), 'e1')!.currentHP;

    expect(after).toBe(before - 10);
  });

  it('HP が 0 以下になると isDead = true', () => {
    const store = makeStore();
    const enemy = makeUnit('e1', 'attacker', 'enemy', { currentHP: 5 });
    store.dispatch(initEnemyUnits([enemy]));

    store.dispatch(applyDamage({ id: 'e1', damage: 100, side: 'enemy' }));
    const after = enemyUnitSelectors.selectById(store.getState(), 'e1')!;

    expect(after.currentHP).toBe(0);
    expect(after.isDead).toBe(true);
  });

  it('player の HP も正しく減少する', () => {
    const store = makeStore();
    const player = makeUnit('p1', 'tanker', 'player');
    store.dispatch(initPlayerUnits([player]));

    store.dispatch(applyDamage({ id: 'p1', damage: 20, side: 'player' }));
    const after = playerUnitSelectors.selectById(store.getState(), 'p1')!;

    expect(after.currentHP).toBe(player.stats.maxHP - 20);
  });
});

describe('battle-damage — performAttack 統合', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('performAttack 後に enemy の HP が減少し BattleEvent が積まれる', () => {
    const store = makeStore();
    // attacker(attack=15) vs attacker(defense=7): random=0.5 → damage=13 > 0
    const attacker = makeUnit('p1', 'attacker', 'player');
    const defender = makeUnit('e1', 'attacker', 'enemy');
    store.dispatch(initPlayerUnits([attacker]));
    store.dispatch(initEnemyUnits([defender]));

    const before = enemyUnitSelectors.selectById(store.getState(), 'e1')!.currentHP;
    performAttack(attacker, defender, 'plain', 'enemy', store.dispatch);

    const after = enemyUnitSelectors.selectById(store.getState(), 'e1')!.currentHP;
    expect(after).toBeLessThan(before);

    const events = store.getState().battle.pendingBattleEvents;
    expect(events.some(e => e.type === 'attack')).toBe(true);
  });

  it('HP が 1 の敵を攻撃すると isDead = true になり death イベントが積まれる', () => {
    const store = makeStore();
    const attacker = makeUnit('p1', 'attacker', 'player');
    const defender = makeUnit('e1', 'attacker', 'enemy', { currentHP: 1 });
    store.dispatch(initPlayerUnits([attacker]));
    store.dispatch(initEnemyUnits([defender]));

    performAttack(attacker, defender, 'plain', 'enemy', store.dispatch);

    const after = enemyUnitSelectors.selectById(store.getState(), 'e1')!;
    expect(after.isDead).toBe(true);
    const events = store.getState().battle.pendingBattleEvents;
    expect(events.some(e => e.type === 'death')).toBe(true);
  });
});

describe('battle-damage — checkVictory との連携', () => {
  it('全敵撃破後 checkVictory が player 勝利を返す', () => {
    const players = [makeUnit('p1', 'attacker', 'player')];
    const enemies = [{ ...makeUnit('e1', 'attacker', 'enemy'), isDead: true, currentHP: 0 }];

    const result = checkVictory('elimination', players, enemies, 1, 20);
    expect(result).toMatchObject({ winner: 'player' });
  });

  it('全プレイヤー撃破後 checkVictory が enemy 勝利を返す', () => {
    const players = [{ ...makeUnit('p1', 'attacker', 'player'), isDead: true, currentHP: 0 }];
    const enemies = [makeUnit('e1', 'attacker', 'enemy')];

    const result = checkVictory('elimination', players, enemies, 1, 20);
    expect(result).toMatchObject({ winner: 'enemy' });
  });

  it('endBattle dispatch 後に gameSlice.isGameOver が true', () => {
    const store = makeStore();
    store.dispatch(endBattle({ winner: 'player', reason: '全敵殲滅' }));

    const state = store.getState().game;
    expect(state.isGameOver).toBe(true);
    expect(state.winner).toBe('player');
    expect(state.outcomeReason).toBe('全敵殲滅');
  });
});
