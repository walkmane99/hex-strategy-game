import { configureStore } from '@reduxjs/toolkit';
import playerReducer, {
  setSelectedSquad,
  setSelectedReserve,
} from '@/store/slices/playerSlice';
import { UnitType } from '@/types/unit';

function makeStore() {
  return configureStore({ reducer: { player: playerReducer } });
}

describe('03 ROSTER — 予備ユニットスロット', () => {
  it('setSelectedReserve が null の初期値を持つ', () => {
    const store = makeStore();
    expect(store.getState().player.selectedReserveUnitId).toBeNull();
  });

  it('setSelectedReserve で予備ユニットを設定できる', () => {
    const store = makeStore();
    store.dispatch(setSelectedReserve('tanker'));
    expect(store.getState().player.selectedReserveUnitId).toBe('tanker');
  });

  it('setSelectedReserve(null) で予備をクリアできる', () => {
    const store = makeStore();
    store.dispatch(setSelectedReserve('healer'));
    store.dispatch(setSelectedReserve(null));
    expect(store.getState().player.selectedReserveUnitId).toBeNull();
  });

  it('メイン5体と予備の選択が独立して管理される', () => {
    const store = makeStore();
    const mainSquad: UnitType[] = ['tanker', 'attacker', 'healer', 'seeker', 'archer'];
    store.dispatch(setSelectedSquad(mainSquad));
    store.dispatch(setSelectedReserve('assassin'));

    const state = store.getState().player;
    expect(state.selectedSquad).toEqual(mainSquad);
    expect(state.selectedReserveUnitId).toBe('assassin');
  });

  it('予備未選択（null）でも selectedSquad は有効', () => {
    const store = makeStore();
    const mainSquad: UnitType[] = ['tanker', 'attacker', 'healer', 'seeker', 'archer'];
    store.dispatch(setSelectedSquad(mainSquad));
    // setSelectedReserve を呼ばない = DEPLOY 可能

    const state = store.getState().player;
    expect(state.selectedSquad.length).toBe(5);
    expect(state.selectedReserveUnitId).toBeNull();
  });

  it('DEPLOY 時に setSelectedReserve がディスパッチされる（シミュレーション）', () => {
    const store = makeStore();
    const mainSquad: UnitType[] = ['tanker', 'attacker', 'healer', 'seeker', 'archer'];
    const reserveType: UnitType = 'sniper';

    // strategy.tsx の NEXT ボタン相当
    store.dispatch(setSelectedSquad(mainSquad));
    store.dispatch(setSelectedReserve(reserveType));

    expect(store.getState().player.selectedSquad).toEqual(mainSquad);
    expect(store.getState().player.selectedReserveUnitId).toBe(reserveType);
  });

  it('同じユニット種別をメインと予備に設定できる（種別の重複は許容）', () => {
    const store = makeStore();
    // カスタマイズ済みの同じ種別を独立して選ぶシナリオ
    const mainSquad: UnitType[] = ['tanker', 'tanker', 'healer', 'seeker', 'archer'];
    store.dispatch(setSelectedSquad(mainSquad));
    store.dispatch(setSelectedReserve('tanker'));

    expect(store.getState().player.selectedSquad).toEqual(mainSquad);
    expect(store.getState().player.selectedReserveUnitId).toBe('tanker');
  });
});
