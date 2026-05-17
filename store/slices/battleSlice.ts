import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BattleLog, BattleEvent } from '@/types/battle';
import { OffsetCoord } from '@/types/map';
import { ItemSlot, ItemType, ItemUsage } from '@/types/item';
import { Unit } from '@/types/unit';
import { MissionMetadata } from '@/types/mission';

interface BattleState {
  logs: BattleLog[];
  reachableCells: OffsetCoord[];
  attackableCells: OffsetCoord[];
  activeItems: ItemUsage[];
  isAnimating: boolean;
  teamInventory: {
    player: ItemSlot[];
    enemy: ItemSlot[];
  };
  reserves: {
    player: Unit[];
    enemy: Unit[];
  };
  substitutionUsedThisTurn: {
    player: boolean;
    enemy: boolean;
  };
  missionMetadata?: MissionMetadata;
  pendingBattleEvents: BattleEvent[];
}

const initialState: BattleState = {
  logs: [],
  reachableCells: [],
  attackableCells: [],
  activeItems: [],
  isAnimating: false,
  teamInventory: { player: [], enemy: [] },
  reserves: { player: [], enemy: [] },
  substitutionUsedThisTurn: { player: false, enemy: false },
  pendingBattleEvents: [],
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
    setTeamInventory: (
      state,
      action: PayloadAction<{ player: ItemSlot[]; enemy: ItemSlot[] }>,
    ) => {
      state.teamInventory = action.payload;
    },
    consumeItem: (
      state,
      action: PayloadAction<{ team: 'player' | 'enemy'; itemId: ItemType }>,
    ) => {
      const { team, itemId } = action.payload;
      const inventory = state.teamInventory[team];
      const idx = inventory.findIndex(s => s.itemId === itemId);
      if (idx === -1) return;
      const slot = inventory[idx]!;
      if (slot.remainingUses <= 1) {
        inventory.splice(idx, 1);
      } else {
        slot.remainingUses -= 1;
      }
    },
    setReserves: (
      state,
      action: PayloadAction<{ player: Unit[]; enemy: Unit[] }>,
    ) => {
      state.reserves = action.payload;
    },
    executeSubstitution: (state, action: PayloadAction<'player' | 'enemy'>) => {
      state.substitutionUsedThisTurn[action.payload] = true;
    },
    resetSubstitutionFlag: (state) => {
      state.substitutionUsedThisTurn = { player: false, enemy: false };
    },
    setMissionMetadata: (state, action: PayloadAction<MissionMetadata>) => {
      state.missionMetadata = action.payload;
    },
    addBattleEvent: (state, action: PayloadAction<BattleEvent>) => {
      state.pendingBattleEvents.push(action.payload);
    },
    consumeBattleEvent: (state) => {
      state.pendingBattleEvents.shift();
    },
    clearBattleEvents: (state) => {
      state.pendingBattleEvents = [];
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
  setTeamInventory,
  consumeItem,
  setReserves,
  executeSubstitution,
  resetSubstitutionFlag,
  setMissionMetadata,
  addBattleEvent,
  consumeBattleEvent,
  clearBattleEvents,
  resetBattle,
} = battleSlice.actions;

export default battleSlice.reducer;
