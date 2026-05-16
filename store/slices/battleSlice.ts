import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BattleLog } from '@/types/battle';
import { OffsetCoord } from '@/types/map';
import { ItemUsage } from '@/types/item';

interface BattleState {
  logs: BattleLog[];
  reachableCells: OffsetCoord[];
  attackableCells: OffsetCoord[];
  activeItems: ItemUsage[];
  isAnimating: boolean;
}

const initialState: BattleState = {
  logs: [],
  reachableCells: [],
  attackableCells: [],
  activeItems: [],
  isAnimating: false,
};

const battleSlice = createSlice({
  name: 'battle',
  initialState,
  reducers: {
    addLog: (state, action: PayloadAction<BattleLog>) => {
      state.logs.push(action.payload);
    },
    setReachableCells: (state, action: PayloadAction<OffsetCoord[]>) => {
      state.reachableCells = action.payload;
    },
    setAttackableCells: (state, action: PayloadAction<OffsetCoord[]>) => {
      state.attackableCells = action.payload;
    },
    clearSelectionCells: (state) => {
      state.reachableCells = [];
      state.attackableCells = [];
    },
    addActiveItem: (state, action: PayloadAction<ItemUsage>) => {
      state.activeItems.push(action.payload);
    },
    tickItems: (state) => {
      state.activeItems = state.activeItems
        .map(item => ({ ...item, remainingTurns: item.remainingTurns - 1 }))
        .filter(item => item.remainingTurns > 0);
    },
    setAnimating: (state, action: PayloadAction<boolean>) => {
      state.isAnimating = action.payload;
    },
    resetBattle: () => initialState,
  },
});

export const {
  addLog,
  setReachableCells,
  setAttackableCells,
  clearSelectionCells,
  addActiveItem,
  tickItems,
  setAnimating,
  resetBattle,
} = battleSlice.actions;

export default battleSlice.reducer;
