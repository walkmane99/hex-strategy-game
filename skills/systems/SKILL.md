# SKILL: システム実装ガイド (Redux / データ管理 / 永続化)

## 対象ファイル
- `store/` — Redux ストア全体
- `store/slices/` — 各スライス
- `hooks/redux.ts` — 型付きフック
- `data/` — ゲームデータ (JSON)

---

## 1. Redux ストア設計

### ストア構造
```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './slices/gameSlice';
import unitReducer from './slices/unitSlice';
import battleReducer from './slices/battleSlice';
import playerReducer from './slices/playerSlice';

export const store = configureStore({
  reducer: {
    game: gameReducer,       // ゲーム全体の状態 (フェーズ、ターン数)
    units: unitReducer,      // ユニットの状態 (HP, 位置, 行動済み)
    battle: battleReducer,   // 戦闘ログ、選択状態
    player: playerReducer,   // プレイヤーデータ (ポイント、解放ユニット)
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 大きなゲームオブジェクトのシリアライズ警告を無効化
        ignoredActions: ['units/setAll'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 型付きフック
```typescript
// hooks/redux.ts
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector(selector);
```

---

## 2. 正規化されたユニット状態

```typescript
// store/slices/unitSlice.ts
import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Unit } from '@/types/unit';

const unitsAdapter = createEntityAdapter<Unit>({
  selectId: (unit) => unit.id,
});

interface UnitsState {
  playerUnits: ReturnType<typeof unitsAdapter.getInitialState>;
  enemyUnits: ReturnType<typeof unitsAdapter.getInitialState>;
  selectedUnitId: string | null;
  reserveUnitId: string | null; // 予備ユニット
}

const initialState: UnitsState = {
  playerUnits: unitsAdapter.getInitialState(),
  enemyUnits: unitsAdapter.getInitialState(),
  selectedUnitId: null,
  reserveUnitId: null,
};

const unitSlice = createSlice({
  name: 'units',
  initialState,
  reducers: {
    // ユニット初期化
    initPlayerUnits: (state, action: PayloadAction<Unit[]>) => {
      unitsAdapter.setAll(state.playerUnits, action.payload);
    },
    // ダメージ適用
    applyDamage: (state, action: PayloadAction<{ id: string; damage: number; side: 'player' | 'enemy' }>) => {
      const { id, damage, side } = action.payload;
      const adapter = side === 'player' ? state.playerUnits : state.enemyUnits;
      const unit = adapter.entities[id];
      if (unit) {
        unit.currentHP = Math.max(0, unit.currentHP - damage);
        unit.isDead = unit.currentHP === 0;
      }
    },
    // 移動
    moveUnit: (state, action: PayloadAction<{ id: string; col: number; row: number; side: 'player' | 'enemy' }>) => {
      const { id, col, row, side } = action.payload;
      const adapter = side === 'player' ? state.playerUnits : state.enemyUnits;
      const unit = adapter.entities[id];
      if (unit) {
        unit.position = { col, row };
      }
    },
    // 行動済みマーク
    markActed: (state, action: PayloadAction<string>) => {
      const unit = state.playerUnits.entities[action.payload];
      if (unit) unit.hasActed = true;
    },
    // ターン開始時リセット
    resetTurnFlags: (state) => {
      Object.values(state.playerUnits.entities).forEach(unit => {
        if (unit) unit.hasActed = false;
      });
      Object.values(state.enemyUnits.entities).forEach(unit => {
        if (unit) unit.hasActed = false;
      });
    },
    // ユニット選択
    selectUnit: (state, action: PayloadAction<string | null>) => {
      state.selectedUnitId = action.payload;
    },
    // 予備ユニット交代
    swapWithReserve: (state, action: PayloadAction<string>) => {
      // 交代ロジック
      const activeId = action.payload;
      const reserveId = state.reserveUnitId;
      if (!reserveId) return;
      
      state.reserveUnitId = activeId;
      // 交代したユニットはそのターン行動不可
      const unit = state.playerUnits.entities[activeId];
      if (unit) unit.hasActed = true;
    },
  },
});

export const { initPlayerUnits, applyDamage, moveUnit, markActed, resetTurnFlags, selectUnit, swapWithReserve } = unitSlice.actions;

// セレクター
export const playerUnitsSelectors = unitsAdapter.getSelectors(
  (state: RootState) => state.units.playerUnits
);
export const enemyUnitsSelectors = unitsAdapter.getSelectors(
  (state: RootState) => state.units.enemyUnits
);

export default unitSlice.reducer;
```

---

## 3. ゲームフェーズ管理

```typescript
// store/slices/gameSlice.ts
export type GamePhase = 
  | 'title'
  | 'stage-select'
  | 'strategy'    // 戦略フェーズ
  | 'deploy'      // 配置フェーズ
  | 'battle'      // 戦術フェーズ
  | 'result';     // 結果画面

export type TurnOwner = 'player' | 'enemy';

interface GameState {
  phase: GamePhase;
  currentTurn: number;
  turnOwner: TurnOwner;
  currentStageId: string | null;
  victoryCondition: VictoryCondition;
  isGameOver: boolean;
  winner: TurnOwner | null;
}
```

---

## 4. データ永続化

### AsyncStorage + Redux
```typescript
// utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVE_KEY = '@hexgame:playerData';

export async function savePlayerData(data: PlayerState): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Save failed:', e);
  }
}

export async function loadPlayerData(): Promise<PlayerState | null> {
  try {
    const json = await AsyncStorage.getItem(SAVE_KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Load failed:', e);
    return null;
  }
}
```

### 保存するデータ
```typescript
interface PlayerState {
  totalPoints: number;
  unlockedUnitTypes: UnitType[];
  unlockedItems: ItemType[];
  customCharacters: CustomCharacter[];
  clearedStages: { [stageId: string]: StageResult };
  settings: GameSettings;
}
```

---

## 5. ゲームデータ JSON 形式

### ユニットデータ (data/units/base-units.json)
```json
[
  {
    "type": "tanker",
    "nameJa": "タンカー",
    "baseStats": {
      "maxHP": 1000,
      "attack": 8,
      "defense": 15,
      "movement": 4,
      "scout": 5
    },
    "affinity": {
      "strong": ["archer"],
      "weak": ["assassin"]
    },
    "aura": {
      "type": "defense_boost",
      "range": 2,
      "value": 2
    }
  }
]
```

### マップデータ (data/maps/stage-001.json)
```json
{
  "id": "stage-001",
  "nameJa": "平原の戦い",
  "width": 10,
  "height": 10,
  "cells": [
    { "col": 0, "row": 0, "terrain": "plain" },
    { "col": 1, "row": 0, "terrain": "highland" }
  ],
  "playerSpawnArea": [
    { "col": 0, "row": 8 }, { "col": 1, "row": 8 }
  ],
  "enemySpawnArea": [
    { "col": 0, "row": 0 }, { "col": 1, "row": 0 }
  ],
  "victoryCondition": "elimination",
  "turnLimit": 20
}
```

---

## 6. Thunk アクション (非同期処理)

```typescript
// store/slices/gameSlice.ts
import { createAsyncThunk } from '@reduxjs/toolkit';

// AIターン処理
export const executeAITurn = createAsyncThunk(
  'game/executeAITurn',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const enemyUnits = enemyUnitsSelectors.selectAll(state);
    
    for (const unit of enemyUnits) {
      if (unit.isDead || unit.hasActed) continue;
      
      // AI行動決定 (utils/ai.ts)
      const action = decideAIAction(unit, state);
      
      // アニメーション待機
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (action.type === 'move') {
        dispatch(moveUnit({ id: unit.id, ...action.destination, side: 'enemy' }));
      } else if (action.type === 'attack') {
        // ダメージ計算・適用
        const damage = calculateDamage(/* ... */);
        dispatch(applyDamage({ id: action.targetId, damage, side: 'player' }));
      }
    }
  }
);
```

---

## 7. 実装チェックリスト

- [ ] ストアの型 (`RootState`, `AppDispatch`) は必ず export する
- [ ] セレクターは `createSelector` でメモ化する
- [ ] 非同期処理は `createAsyncThunk` を使用する
- [ ] `immer` (RTK内蔵) を活かして直接 mutate する (spread 不要)
- [ ] 保存データのバリデーションを実装する (スキーマが変わった場合の対応)
- [ ] AIターン中はユーザー入力をブロックする UI フラグを設ける
