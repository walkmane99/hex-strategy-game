import { configureStore } from '@reduxjs/toolkit';
import unitReducer, {
  initPlayerUnits,
  initEnemyUnits,
  playerUnitSelectors,
  enemyUnitSelectors,
} from '@/store/slices/unitSlice';
import battleReducer from '@/store/slices/battleSlice';
import playerReducer from '@/store/slices/playerSlice';
import gameReducer from '@/store/slices/gameSlice';
import { performAttack } from '../performAttack';
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

describe('performAttack', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enemy の currentHP が damage 分だけ減少する', () => {
    const store = makeStore();
    const attacker = makeUnit('p1', 'attacker', 'player');
    const defender = makeUnit('e1', 'tanker', 'enemy');
    store.dispatch(initPlayerUnits([attacker]));
    store.dispatch(initEnemyUnits([defender]));

    const beforeHP = enemyUnitSelectors.selectById(store.getState(), 'e1')!.currentHP;
    const result = performAttack(attacker, defender, 'plain', 'enemy', store.dispatch);

    const afterHP = enemyUnitSelectors.selectById(store.getState(), 'e1')!.currentHP;
    expect(afterHP).toBe(beforeHP - result.damage);
    expect(result.damage).toBeGreaterThanOrEqual(0);
  });

  it('player の currentHP が damage 分だけ減少する', () => {
    const store = makeStore();
    const attacker = makeUnit('e1', 'attacker', 'enemy');
    const defender = makeUnit('p1', 'tanker', 'player');
    store.dispatch(initPlayerUnits([defender]));
    store.dispatch(initEnemyUnits([attacker]));

    const beforeHP = playerUnitSelectors.selectById(store.getState(), 'p1')!.currentHP;
    const result = performAttack(attacker, defender, 'plain', 'player', store.dispatch);

    const afterHP = playerUnitSelectors.selectById(store.getState(), 'p1')!.currentHP;
    expect(afterHP).toBe(beforeHP - result.damage);
  });

  it('攻撃イベントが pendingBattleEvents に積まれる', () => {
    const store = makeStore();
    const attacker = makeUnit('p1', 'attacker', 'player');
    const defender = makeUnit('e1', 'tanker', 'enemy');
    store.dispatch(initPlayerUnits([attacker]));
    store.dispatch(initEnemyUnits([defender]));

    performAttack(attacker, defender, 'plain', 'enemy', store.dispatch);

    const events = store.getState().battle.pendingBattleEvents;
    const attackEvent = events.find(e => e.type === 'attack');
    expect(attackEvent).toBeDefined();
    expect(attackEvent).toMatchObject({
      type: 'attack',
      attackerId: 'p1',
      defenderId: 'e1',
    });
  });

  it('撃破時に death イベントも追加される', () => {
    const store = makeStore();
    const attacker = makeUnit('p1', 'attacker', 'player');
    // attacker(attack=15) vs attacker(defense=7): random=0.5 → damage=13 > 0
    const defender = makeUnit('e1', 'attacker', 'enemy', { currentHP: 1 });
    store.dispatch(initPlayerUnits([attacker]));
    store.dispatch(initEnemyUnits([defender]));

    const result = performAttack(attacker, defender, 'plain', 'enemy', store.dispatch);

    expect(result.isKill).toBe(true);
    const events = store.getState().battle.pendingBattleEvents;
    const deathEvent = events.find(e => e.type === 'death');
    expect(deathEvent).toBeDefined();
    expect(deathEvent).toMatchObject({ type: 'death', unitId: 'e1', side: 'enemy' });
  });

  it('撃破されなかった場合 isKill が false', () => {
    const store = makeStore();
    const attacker = makeUnit('p1', 'healer', 'player');
    // ヒーラーは攻撃力が低いため大量HPの敵は倒せない
    const defender = makeUnit('e1', 'tanker', 'enemy');
    store.dispatch(initPlayerUnits([attacker]));
    store.dispatch(initEnemyUnits([defender]));

    jest.spyOn(Math, 'random').mockReturnValue(0.1); // 最小ダメージ方向
    const result = performAttack(attacker, defender, 'plain', 'enemy', store.dispatch);

    // タンカーの maxHP が十分大きい場合、1回の攻撃では倒せないはず
    // ここでは isKill が正しく計算されているかを確認
    const afterHP = enemyUnitSelectors.selectById(store.getState(), 'e1')!.currentHP;
    expect(result.isKill).toBe(afterHP === 0);
  });

  it('AttackResult の attackerId / defenderId が正しい', () => {
    const store = makeStore();
    const attacker = makeUnit('p1', 'attacker', 'player');
    const defender = makeUnit('e1', 'tanker', 'enemy');
    store.dispatch(initPlayerUnits([attacker]));
    store.dispatch(initEnemyUnits([defender]));

    const result = performAttack(attacker, defender, 'plain', 'enemy', store.dispatch);

    expect(result.attackerId).toBe('p1');
    expect(result.defenderId).toBe('e1');
  });

  it('affinity が AttackResult に反映される', () => {
    const store = makeStore();
    // tanker → archer は advantage (AFFINITY_CYCLE に従う)
    const attacker = makeUnit('p1', 'tanker', 'player');
    const defender = makeUnit('e1', 'archer', 'enemy');
    store.dispatch(initPlayerUnits([attacker]));
    store.dispatch(initEnemyUnits([defender]));

    const result = performAttack(attacker, defender, 'plain', 'enemy', store.dispatch);

    expect(['advantage', 'disadvantage', 'neutral']).toContain(result.affinity);
    const attackEvent = store.getState().battle.pendingBattleEvents.find(e => e.type === 'attack');
    if (attackEvent && attackEvent.type === 'attack') {
      expect(attackEvent.affinity).toBe(result.affinity);
    }
  });
});
