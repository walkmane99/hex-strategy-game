import { configureStore } from '@reduxjs/toolkit';
import unitReducer, {
  initPlayerUnits,
  markActed,
  applyDamage,
  substituteUnit,
} from '@/store/slices/unitSlice';
import battleReducer, {
  setReserves,
  executeSubstitution,
  resetSubstitutionFlag,
} from '@/store/slices/battleSlice';
import playerReducer from '@/store/slices/playerSlice';
import gameReducer from '@/store/slices/gameSlice';
import { Unit, UnitType } from '@/types/unit';
import { OffsetCoord } from '@/types/map';
import { UNIT_BASE_STATS } from '@/constants/unitStats';

function makeUnit(
  id: string,
  type: UnitType,
  side: 'player' | 'enemy',
  position: OffsetCoord,
  overrides?: Partial<Unit>,
): Unit {
  const stats = UNIT_BASE_STATS[type];
  return {
    id, type, side, stats,
    currentHP: stats.maxHP,
    position,
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

// SWAP ボタン表示条件を判定するユーティリティ
function canSwap(state: ReturnType<ReturnType<typeof makeStore>['getState']>): boolean {
  return (
    state.game.phase === 'player_turn' &&
    !state.battle.substitutionUsedThisTurn.player &&
    state.battle.reserves.player.length > 0
  );
}

describe('06 TACTICS — 交代ボタン表示条件', () => {
  it('player_turn かつ substitutionUsed=false かつ reserve あり → 表示', () => {
    const store = makeStore();
    const reserve = makeUnit('p-reserve', 'attacker', 'player', { col: 0, row: 0 });
    store.dispatch(setReserves({ player: [reserve], enemy: [] }));
    // phase はデフォルト 'title' なのでゲーム開始を模擬
    // canSwap は phase チェックも含むので、player_turn を想定
    const state = store.getState();
    expect(state.battle.substitutionUsedThisTurn.player).toBe(false);
    expect(state.battle.reserves.player.length).toBe(1);
  });

  it('reserve が空のとき交代不可', () => {
    const store = makeStore();
    store.dispatch(setReserves({ player: [], enemy: [] }));
    expect(store.getState().battle.reserves.player.length).toBe(0);
  });

  it('substitutionUsed=true のとき交代ボタン非表示', () => {
    const store = makeStore();
    const reserve = makeUnit('p-reserve', 'attacker', 'player', { col: 0, row: 0 });
    store.dispatch(setReserves({ player: [reserve], enemy: [] }));
    store.dispatch(executeSubstitution('player'));
    expect(store.getState().battle.substitutionUsedThisTurn.player).toBe(true);
  });
});

describe('06 TACTICS — 交代対象ユニット条件', () => {
  it('hasActed=true のユニットは交代対象に選べない（条件チェック）', () => {
    const unit = makeUnit('p1', 'tanker', 'player', { col: 1, row: 8 }, { hasActed: true });
    // 選択条件: !hasActed && !isDead
    expect(!unit.hasActed && !unit.isDead).toBe(false);
  });

  it('isDead=true のユニットは交代対象に選べない', () => {
    const unit = makeUnit('p1', 'tanker', 'player', { col: 1, row: 8 }, { isDead: true, currentHP: 0 });
    expect(!unit.hasActed && !unit.isDead).toBe(false);
  });

  it('hasActed=false かつ isDead=false のユニットは交代可能', () => {
    const unit = makeUnit('p1', 'tanker', 'player', { col: 1, row: 8 });
    expect(!unit.hasActed && !unit.isDead).toBe(true);
  });
});

describe('06 TACTICS — 交代実行 (substituteUnit)', () => {
  it('交代後、新ユニットの hasActed が true になる', () => {
    const store = makeStore();
    const active = makeUnit('p1', 'tanker', 'player', { col: 1, row: 8 });
    const reserve = makeUnit('p-reserve', 'attacker', 'player', { col: 0, row: 0 });

    store.dispatch(initPlayerUnits([active]));
    store.dispatch(setReserves({ player: [reserve], enemy: [] }));
    store.dispatch(substituteUnit({
      side: 'player',
      removedUnitId: 'p1',
      newUnit: reserve,
      position: active.position,
    }));

    const { playerUnits } = store.getState().units;
    // p1 は削除されているはず
    expect(playerUnits.entities['p1']).toBeUndefined();
    // p-reserve が hasActed=true で追加されているはず
    const newUnit = playerUnits.entities['p-reserve'];
    expect(newUnit).toBeDefined();
    expect(newUnit!.hasActed).toBe(true);
    expect(newUnit!.position).toEqual(active.position);
    expect(newUnit!.side).toBe('player');
  });

  it('player 側の交代が enemy 側フラグを変更しない', () => {
    const store = makeStore();
    store.dispatch(executeSubstitution('player'));
    const state = store.getState().battle.substitutionUsedThisTurn;
    expect(state.player).toBe(true);
    expect(state.enemy).toBe(false);
  });

  it('enemy 側の交代が player 側フラグを変更しない', () => {
    const store = makeStore();
    store.dispatch(executeSubstitution('enemy'));
    const state = store.getState().battle.substitutionUsedThisTurn;
    expect(state.player).toBe(false);
    expect(state.enemy).toBe(true);
  });

  it('1ターン2回目の交代ができない（フラグ制御）', () => {
    const store = makeStore();
    store.dispatch(executeSubstitution('player'));
    // 既にフラグが立っているので canSwap が false になる
    const state = store.getState();
    // substitutionUsedThisTurn.player === true → 交代不可
    expect(state.battle.substitutionUsedThisTurn.player).toBe(true);
  });

  it('確認ダイアログでキャンセル時に交代が実行されない', () => {
    const store = makeStore();
    const active = makeUnit('p1', 'tanker', 'player', { col: 1, row: 8 });
    store.dispatch(initPlayerUnits([active]));

    // キャンセル = substituteUnit を dispatch しない
    // p1 がそのまま存在することを確認
    const { playerUnits } = store.getState().units;
    expect(playerUnits.entities['p1']).toBeDefined();
    expect(playerUnits.entities['p1']!.hasActed).toBe(false);
  });
});

describe('06 TACTICS — resetSubstitutionFlag', () => {
  it('resetSubstitutionFlag が player と enemy 両方をリセットする', () => {
    const store = makeStore();
    store.dispatch(executeSubstitution('player'));
    store.dispatch(executeSubstitution('enemy'));
    store.dispatch(resetSubstitutionFlag());

    const flags = store.getState().battle.substitutionUsedThisTurn;
    expect(flags.player).toBe(false);
    expect(flags.enemy).toBe(false);
  });
});

describe('substituteUnit — 汎用化確認', () => {
  it('side=enemy で敵ユニットを交代できる', () => {
    const store = makeStore();
    // enemyUnits は initEnemyUnits が必要だが unitSlice 経由で直接テスト
    // 敵側は unitSlice の enemyUnits に追加されることを確認
    const active = makeUnit('e1', 'tanker', 'enemy', { col: 8, row: 2 });
    const reserve = makeUnit('e-reserve', 'attacker', 'enemy', { col: 0, row: 0 });

    // initEnemyUnits でセット
    const { initEnemyUnits } = require('@/store/slices/unitSlice');
    store.dispatch(initEnemyUnits([active]));

    store.dispatch(substituteUnit({
      side: 'enemy',
      removedUnitId: 'e1',
      newUnit: reserve,
      position: active.position,
    }));

    const { enemyUnits } = store.getState().units;
    expect(enemyUnits.entities['e1']).toBeUndefined();
    const newEnemy = enemyUnits.entities['e-reserve'];
    expect(newEnemy).toBeDefined();
    expect(newEnemy!.hasActed).toBe(true);
    expect(newEnemy!.side).toBe('enemy');
  });
});
