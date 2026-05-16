import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UnitType } from '@/types/unit';
import { ItemType } from '@/types/item';
import { CustomCharacter } from '@/types/unit';
import { StageResult } from '@/types/battle';
import { INITIAL_UNITS } from '@/constants/unitStats';

interface PlayerState {
  totalPoints: number;
  unlockedUnitTypes: UnitType[];
  ownedItems: ItemType[];
  selectedItems: ItemType[];  // 出撃時に持ち込むアイテム
  customCharacters: CustomCharacter[];
  clearedStages: Record<string, StageResult>;
  isLoaded: boolean;
  selectedSquad: UnitType[];
}

const initialState: PlayerState = {
  totalPoints: 0,
  unlockedUnitTypes: [...INITIAL_UNITS],
  ownedItems: [],
  selectedItems: [],
  customCharacters: [],
  clearedStages: {},
  isLoaded: false,
  selectedSquad: [],
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    loadPlayerData: (state, action: PayloadAction<Partial<PlayerState>>) => {
      return { ...state, ...action.payload, isLoaded: true };
    },
    addPoints: (state, action: PayloadAction<number>) => {
      state.totalPoints += action.payload;
    },
    spendPoints: (state, action: PayloadAction<number>) => {
      state.totalPoints = Math.max(0, state.totalPoints - action.payload);
    },
    unlockUnit: (state, action: PayloadAction<UnitType>) => {
      if (!state.unlockedUnitTypes.includes(action.payload)) {
        state.unlockedUnitTypes.push(action.payload);
      }
    },
    addItem: (state, action: PayloadAction<ItemType>) => {
      state.ownedItems.push(action.payload);
    },
    removeItem: (state, action: PayloadAction<ItemType>) => {
      const idx = state.ownedItems.indexOf(action.payload);
      if (idx !== -1) state.ownedItems.splice(idx, 1);
    },
    addCustomCharacter: (state, action: PayloadAction<CustomCharacter>) => {
      state.customCharacters.push(action.payload);
    },
    setSelectedSquad: (state, action: PayloadAction<UnitType[]>) => {
      state.selectedSquad = action.payload;
    },
    setSelectedItems: (state, action: PayloadAction<ItemType[]>) => {
      state.selectedItems = action.payload;
    },
    recordStageResult: (state, action: PayloadAction<StageResult>) => {
      const existing = state.clearedStages[action.payload.stageId];
      // ベストスコアを保存
      if (!existing || action.payload.pointsEarned > existing.pointsEarned) {
        state.clearedStages[action.payload.stageId] = action.payload;
      }
    },
  },
});

export const {
  loadPlayerData,
  addPoints,
  spendPoints,
  unlockUnit,
  addItem,
  removeItem,
  addCustomCharacter,
  setSelectedSquad,
  setSelectedItems,
  recordStageResult,
} = playerSlice.actions;

export default playerSlice.reducer;
