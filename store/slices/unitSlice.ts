import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Unit, SpecialSkillType } from '@/types/unit';
import { OffsetCoord } from '@/types/map';
import { SKILL_INITIAL_COOLDOWN } from '@/constants/aiThresholds';
import type { RootState } from '../index';

// プレイヤーユニット用アダプター
const playerAdapter = createEntityAdapter<Unit>();
// 敵ユニット用アダプター
const enemyAdapter = createEntityAdapter<Unit>();

interface UnitsState {
  playerUnits: ReturnType<typeof playerAdapter.getInitialState>;
  enemyUnits: ReturnType<typeof enemyAdapter.getInitialState>;
  selectedUnitId: string | null;
  reserveUnitId: string | null;
  hoveredCell: OffsetCoord | null;
}

const initialState: UnitsState = {
  playerUnits: playerAdapter.getInitialState(),
  enemyUnits: enemyAdapter.getInitialState(),
  selectedUnitId: null,
  reserveUnitId: null,
  hoveredCell: null,
};

const unitSlice = createSlice({
  name: 'units',
  initialState,
  reducers: {
    initPlayerUnits: (state, action: PayloadAction<Unit[]>) => {
      playerAdapter.setAll(state.playerUnits, action.payload);
    },
    initEnemyUnits: (state, action: PayloadAction<Unit[]>) => {
      enemyAdapter.setAll(state.enemyUnits, action.payload);
    },
    applyDamage: (
      state,
      action: PayloadAction<{ id: string; damage: number; side: 'player' | 'enemy' }>
    ) => {
      const { id, damage, side } = action.payload;
      const adapter = side === 'player' ? state.playerUnits : state.enemyUnits;
      const unit = adapter.entities[id];
      if (unit) {
        unit.currentHP = Math.max(0, unit.currentHP - damage);
        if (unit.currentHP === 0) unit.isDead = true;
      }
    },
    healUnit: (
      state,
      action: PayloadAction<{ id: string; amount: number; side: 'player' | 'enemy' }>
    ) => {
      const { id, amount, side } = action.payload;
      const adapter = side === 'player' ? state.playerUnits : state.enemyUnits;
      const unit = adapter.entities[id];
      if (unit && !unit.isDead) {
        unit.currentHP = Math.min(unit.stats.maxHP, unit.currentHP + amount);
      }
    },
    moveUnit: (
      state,
      action: PayloadAction<{ id: string; position: OffsetCoord; side: 'player' | 'enemy' }>
    ) => {
      const { id, position, side } = action.payload;
      const adapter = side === 'player' ? state.playerUnits : state.enemyUnits;
      const unit = adapter.entities[id];
      if (unit) unit.position = position;
    },
    markActed: (state, action: PayloadAction<string>) => {
      const unit = state.playerUnits.entities[action.payload];
      if (unit) unit.hasActed = true;
    },
    resetTurnFlags: (state) => {
      Object.values(state.playerUnits.entities).forEach(u => { if (u) u.hasActed = false; });
      Object.values(state.enemyUnits.entities).forEach(u => { if (u) u.hasActed = false; });
    },
    selectUnit: (state, action: PayloadAction<string | null>) => {
      state.selectedUnitId = action.payload;
    },
    setHoveredCell: (state, action: PayloadAction<OffsetCoord | null>) => {
      state.hoveredCell = action.payload;
    },
    setUnitVisible: (
      state,
      action: PayloadAction<{ id: string; visible: boolean }>
    ) => {
      const unit = state.enemyUnits.entities[action.payload.id];
      if (unit) unit.isVisible = action.payload.visible;
    },
    swapWithReserve: (state, action: PayloadAction<{ activeId: string }>) => {
      const { activeId } = action.payload;
      const reserveId = state.reserveUnitId;
      if (!reserveId) return;

      // 交代したユニットを行動済みにする
      const activeUnit = state.playerUnits.entities[activeId];
      if (activeUnit) activeUnit.hasActed = true;

      state.reserveUnitId = activeId;
    },
    setReserveUnit: (state, action: PayloadAction<string | null>) => {
      state.reserveUnitId = action.payload;
    },
    activateSkill: (
      state,
      action: PayloadAction<{ unitId: string; skillId: SpecialSkillType; side: 'player' | 'enemy' }>,
    ) => {
      const { unitId, skillId, side } = action.payload;
      const adapter = side === 'player' ? state.playerUnits : state.enemyUnits;
      const unit = adapter.entities[unitId];
      if (!unit?.skills) return;
      const slot = unit.skills.find(s => s.skillId === skillId);
      if (!slot) return;
      slot.cooldown = SKILL_INITIAL_COOLDOWN[skillId] ?? 3;
      if (slot.remainingUses !== undefined) slot.remainingUses = Math.max(0, slot.remainingUses - 1);
    },
    substituteEnemy: (
      state,
      action: PayloadAction<{ removedUnitId: string; newUnit: Unit; position: OffsetCoord }>,
    ) => {
      const { removedUnitId, newUnit, position } = action.payload;
      enemyAdapter.removeOne(state.enemyUnits, removedUnitId);
      enemyAdapter.addOne(state.enemyUnits, { ...newUnit, position, hasActed: true, side: 'enemy' });
    },
    substituteUnit: (
      state,
      action: PayloadAction<{ side: 'player' | 'enemy'; removedUnitId: string; newUnit: Unit; position: OffsetCoord }>,
    ) => {
      const { side, removedUnitId, newUnit, position } = action.payload;
      if (side === 'player') {
        playerAdapter.removeOne(state.playerUnits, removedUnitId);
        playerAdapter.addOne(state.playerUnits, { ...newUnit, position, hasActed: true, side: 'player' });
      } else {
        enemyAdapter.removeOne(state.enemyUnits, removedUnitId);
        enemyAdapter.addOne(state.enemyUnits, { ...newUnit, position, hasActed: true, side: 'enemy' });
      }
    },
    updateSupplyStatuses: (
      state,
      action: PayloadAction<{
        player: Array<{ id: string; isSupplyCut: boolean }>;
        enemy: Array<{ id: string; isSupplyCut: boolean }>;
      }>,
    ) => {
      const { player, enemy } = action.payload;
      player.forEach(({ id, isSupplyCut }) => {
        const u = state.playerUnits.entities[id];
        if (u) u.isSupplyCut = isSupplyCut;
      });
      enemy.forEach(({ id, isSupplyCut }) => {
        const u = state.enemyUnits.entities[id];
        if (u) u.isSupplyCut = isSupplyCut;
      });
    },
    tickCooldowns: (state, action: PayloadAction<'player' | 'enemy'>) => {
      const adapter = action.payload === 'player' ? state.playerUnits : state.enemyUnits;
      Object.values(adapter.entities).forEach(unit => {
        if (!unit?.skills) return;
        for (const slot of unit.skills) {
          if (slot.cooldown > 0) slot.cooldown -= 1;
        }
      });
    },
  },
});

export const {
  initPlayerUnits,
  initEnemyUnits,
  applyDamage,
  healUnit,
  moveUnit,
  markActed,
  resetTurnFlags,
  selectUnit,
  setHoveredCell,
  setUnitVisible,
  swapWithReserve,
  setReserveUnit,
  activateSkill,
  tickCooldowns,
  substituteEnemy,
  substituteUnit,
  updateSupplyStatuses,
} = unitSlice.actions;

// セレクター
export const playerUnitSelectors = playerAdapter.getSelectors(
  (state: RootState) => state.units.playerUnits
);
export const enemyUnitSelectors = enemyAdapter.getSelectors(
  (state: RootState) => state.units.enemyUnits
);

export default unitSlice.reducer;
