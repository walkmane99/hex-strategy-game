# SKILL: Systems Implementation Guide (Redux / Data / Persistence)

## Target Files
- `store/` — Redux store
- `store/slices/` — Individual slices
- `hooks/redux.ts` — Typed hooks
- `data/` — Game data (JSON)
- `constants/aiThresholds.ts` — AI threshold constants
- `types/mission.ts` — Mission metadata types

---

## 1. Redux Store Design

### Store Structure
```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import gameReducer   from './slices/gameSlice';
import unitReducer   from './slices/unitSlice';
import battleReducer from './slices/battleSlice';
import playerReducer from './slices/playerSlice';

export const store = configureStore({
  reducer: {
    game:   gameReducer,    // Overall state (phase, turn count)
    units:  unitReducer,    // Unit state (HP, position, hasActed, skills, cooldowns)
    battle: battleReducer,  // Battle log, selection, inventory, reserves, mission
    player: playerReducer,  // Player data (points, unlocked units, selected items)
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['units/setAll'],
      },
    }),
});

export type RootState  = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Typed Hooks
```typescript
// hooks/redux.ts
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector(selector);
```

---

## 2. Unit Slice (unitSlice.ts)

```typescript
import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Unit, SkillSlot } from '@/types/unit';

const unitsAdapter = createEntityAdapter<Unit>({ selectId: (u) => u.id });

interface UnitsState {
  playerUnits: ReturnType<typeof unitsAdapter.getInitialState>;
  enemyUnits:  ReturnType<typeof unitsAdapter.getInitialState>;
  selectedUnitId: string | null;
}

const unitSlice = createSlice({
  name: 'units',
  initialState: {
    playerUnits: unitsAdapter.getInitialState(),
    enemyUnits:  unitsAdapter.getInitialState(),
    selectedUnitId: null,
  } as UnitsState,
  reducers: {
    // ── Initialization ──────────────────────────────────────────
    initPlayerUnits: (state, action: PayloadAction<Unit[]>) => {
      unitsAdapter.setAll(state.playerUnits, action.payload);
    },
    initEnemyUnits: (state, action: PayloadAction<Unit[]>) => {
      unitsAdapter.setAll(state.enemyUnits, action.payload);
    },

    // ── Damage / HP ─────────────────────────────────────────────
    applyDamage: (state, action: PayloadAction<{ id: string; damage: number; side: 'player' | 'enemy' }>) => {
      const { id, damage, side } = action.payload;
      const entities = side === 'player' ? state.playerUnits.entities : state.enemyUnits.entities;
      const unit = entities[id];
      if (unit) {
        unit.currentHP = Math.max(0, unit.currentHP - damage);
        unit.isDead    = unit.currentHP === 0;
      }
    },

    // ── Movement ────────────────────────────────────────────────
    moveUnit: (state, action: PayloadAction<{ id: string; col: number; row: number; side: 'player' | 'enemy' }>) => {
      const { id, col, row, side } = action.payload;
      const entities = side === 'player' ? state.playerUnits.entities : state.enemyUnits.entities;
      const unit = entities[id];
      if (unit) unit.position = { col, row };
    },

    // ── Turn flags ──────────────────────────────────────────────
    markActed: (state, action: PayloadAction<string>) => {
      const unit = state.playerUnits.entities[action.payload];
      if (unit) unit.hasActed = true;
    },
    resetTurnFlags: (state) => {
      for (const unit of Object.values(state.playerUnits.entities)) {
        if (unit) unit.hasActed = false;
      }
      for (const unit of Object.values(state.enemyUnits.entities)) {
        if (unit) unit.hasActed = false;
      }
    },

    // ── Selection ───────────────────────────────────────────────
    selectUnit: (state, action: PayloadAction<string | null>) => {
      state.selectedUnitId = action.payload;
    },

    // ── Substitution (enemy side) ────────────────────────────────
    // Replaces an active enemy unit with a reserve unit.
    // The incoming unit is registered with hasActed: true (no action this turn).
    substituteEnemy: (
      state,
      action: PayloadAction<{ removedUnitId: string; newUnit: Unit; position: { col: number; row: number } }>
    ) => {
      const { removedUnitId, newUnit, position } = action.payload;
      unitsAdapter.removeOne(state.enemyUnits, removedUnitId);
      unitsAdapter.addOne(state.enemyUnits, {
        ...newUnit,
        position,
        hasActed: true, // Cannot act the turn it enters
      });
    },

    // ── Skill cooldowns ─────────────────────────────────────────
    // Call at the start of each team's turn to tick down all cooldowns.
    tickCooldowns: (state, action: PayloadAction<'player' | 'enemy'>) => {
      const entities = action.payload === 'player'
        ? state.playerUnits.entities
        : state.enemyUnits.entities;
      for (const unit of Object.values(entities)) {
        if (!unit?.skills) continue;
        for (const skill of unit.skills) {
          if (skill.cooldown > 0) skill.cooldown -= 1;
        }
      }
    },

    // Activate a skill: reset its cooldown and decrement remainingUses.
    activateSkill: (
      state,
      action: PayloadAction<{ unitId: string; skillId: string; side: 'player' | 'enemy' }>
    ) => {
      const { unitId, skillId, side } = action.payload;
      const entities = side === 'player' ? state.playerUnits.entities : state.enemyUnits.entities;
      const unit = entities[unitId];
      if (!unit?.skills) return;
      const skill = unit.skills.find(s => s.skillId === skillId);
      if (skill) {
        skill.cooldown      = SKILL_INITIAL_COOLDOWN[skill.skillId as SpecialSkillType] ?? 3;
        skill.remainingUses = Math.max(0, skill.remainingUses - 1);
      }
    },
  },
});

export const {
  initPlayerUnits, initEnemyUnits,
  applyDamage, moveUnit,
  markActed, resetTurnFlags, selectUnit,
  substituteEnemy, tickCooldowns, activateSkill,
} = unitSlice.actions;

export const playerUnitsSelectors = unitsAdapter.getSelectors(
  (state: RootState) => state.units.playerUnits
);
export const enemyUnitsSelectors = unitsAdapter.getSelectors(
  (state: RootState) => state.units.enemyUnits
);

export default unitSlice.reducer;
```

---

## 3. Battle Slice (battleSlice.ts)

Manages team inventory, reserves, substitution flags, and mission metadata.

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ItemSlot } from '@/types/item';
import { Unit } from '@/types/unit';
import { MissionMetadata } from '@/types/mission';

interface BattleState {
  // Item inventory (team-level, not per-unit)
  teamInventory: { player: ItemSlot[]; enemy: ItemSlot[] };

  // Reserve units (max 1 per team, bench unit)
  reserves: { player: Unit[]; enemy: Unit[] };

  // Prevents more than one substitution per turn per team
  substitutionUsedThisTurn: { player: boolean; enemy: boolean };

  // Mission-specific metadata (key unit IDs, escape tiles, HQ location, etc.)
  missionMetadata: MissionMetadata | null;

  // ── Fog of War ──────────────────────────────────────────────────
  // Per-tile visibility state. Key format: `${col},${row}`
  tileVisibility: Record<string, 'unexplored' | 'visible' | 'explored'>;

  // Last confirmed position of enemy units that re-entered stealth.
  // Only populated for units that vanished into plain terrain (ghost marker shown).
  // Cleared when the unit becomes visible again.
  lastKnownPositions: Record<string, {
    position: { col: number; row: number };
    unitType: string;  // UnitType
    turnLastSeen: number;
  }>;
  // ────────────────────────────────────────────────────────────────

  // UI / log
  battleLog: string[];
  selectedCellId: string | null;
}

const battleSlice = createSlice({
  name: 'battle',
  initialState: {
    teamInventory: { player: [], enemy: [] },
    reserves: { player: [], enemy: [] },
    substitutionUsedThisTurn: { player: false, enemy: false },
    missionMetadata: null,
    tileVisibility: {},          // Populated on battle init via updateTileVisibility()
    lastKnownPositions: {},      // Populated when enemy units re-enter stealth
    battleLog: [],
    selectedCellId: null,
  } as BattleState,
  reducers: {
    // ── Inventory ────────────────────────────────────────────────
    setTeamInventory: (state, action: PayloadAction<{ player: ItemSlot[]; enemy: ItemSlot[] }>) => {
      state.teamInventory = action.payload;
    },
    consumeItem: (state, action: PayloadAction<{ team: 'player' | 'enemy'; itemId: string }>) => {
      const { team, itemId } = action.payload;
      const list = state.teamInventory[team];
      const slot = list.find(s => s.itemId === itemId);
      if (!slot) return;
      slot.remainingUses -= 1;
      if (slot.remainingUses <= 0) {
        state.teamInventory[team] = list.filter(s => s.itemId !== itemId);
      }
    },

    // ── Reserves ─────────────────────────────────────────────────
    setReserves: (state, action: PayloadAction<{ player: Unit[]; enemy: Unit[] }>) => {
      state.reserves = action.payload;
    },

    // ── Substitution flags ───────────────────────────────────────
    // Mark substitution as used for this turn.
    executeSubstitution: (state, action: PayloadAction<'player' | 'enemy'>) => {
      state.substitutionUsedThisTurn[action.payload] = true;
    },
    // Call at the end of each turn (both sides).
    resetSubstitutionFlag: (state) => {
      state.substitutionUsedThisTurn = { player: false, enemy: false };
    },

    // ── Mission metadata ─────────────────────────────────────────
    setMissionMetadata: (state, action: PayloadAction<MissionMetadata>) => {
      state.missionMetadata = action.payload;
    },

    // ── Fog of War ───────────────────────────────────────────────
    // Replace the entire tileVisibility map (result of updateTileVisibility()).
    // Dispatch at the start of each player turn.
    setTileVisibility: (
      state,
      action: PayloadAction<Record<string, 'unexplored' | 'visible' | 'explored'>>
    ) => {
      state.tileVisibility = action.payload;
    },

    // Record last known position when an enemy re-enters stealth on plain terrain.
    setLastKnownPosition: (
      state,
      action: PayloadAction<{
        unitId: string;
        position: { col: number; row: number };
        unitType: string;
        turnLastSeen: number;
      }>
    ) => {
      const { unitId, ...rest } = action.payload;
      state.lastKnownPositions[unitId] = rest;
    },

    // Clear ghost marker when the unit becomes visible again.
    clearLastKnownPosition: (state, action: PayloadAction<string>) => {
      delete state.lastKnownPositions[action.payload];
    },
    // ────────────────────────────────────────────────────────────────

    // ── Log / UI ─────────────────────────────────────────────────
    addLog: (state, action: PayloadAction<string>) => {
      state.battleLog.push(action.payload);
    },
    selectCell: (state, action: PayloadAction<string | null>) => {
      state.selectedCellId = action.payload;
    },
  },
});

export const {
  setTeamInventory, consumeItem,
  setReserves,
  executeSubstitution, resetSubstitutionFlag,
  setMissionMetadata,
  setTileVisibility, setLastKnownPosition, clearLastKnownPosition,
  addLog, selectCell,
} = battleSlice.actions;

export default battleSlice.reducer;
```

---

## 4. Player Slice (playerSlice.ts)

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ItemType } from '@/types/item';

interface PlayerState {
  totalPoints: number;
  unlockedUnitTypes: UnitType[];
  unlockedItems: ItemType[];
  customCharacters: CustomCharacter[];
  clearedStages: { [stageId: string]: StageResult };
  settings: GameSettings;
  // Items chosen in the strategy phase; used to initialize teamInventory at battle start
  selectedItems: ItemType[];
}

const playerSlice = createSlice({
  name: 'player',
  initialState: { /* ... */ } as PlayerState,
  reducers: {
    setSelectedItems: (state, action: PayloadAction<ItemType[]>) => {
      state.selectedItems = action.payload;
    },
    addPoints: (state, action: PayloadAction<number>) => {
      state.totalPoints += action.payload;
    },
    unlockUnit: (state, action: PayloadAction<UnitType>) => {
      if (!state.unlockedUnitTypes.includes(action.payload)) {
        state.unlockedUnitTypes.push(action.payload);
      }
    },
    recordStageResult: (state, action: PayloadAction<{ stageId: string; result: StageResult }>) => {
      state.clearedStages[action.payload.stageId] = action.payload.result;
    },
  },
});

export const { setSelectedItems, addPoints, unlockUnit, recordStageResult } = playerSlice.actions;
export default playerSlice.reducer;
```

---

## 5. Game Phase & Victory Conditions

```typescript
// store/slices/gameSlice.ts
export type GamePhase =
  | 'title'
  | 'stage-select'
  | 'strategy'   // unit selection & customization
  | 'deploy'     // placement phase
  | 'battle'     // tactical phase
  | 'result';    // results screen

export type TurnPhase = 'player_turn' | 'enemy_turn';

// All five victory conditions (protect_hq added to types/map.ts)
export type VictoryCondition =
  | 'elimination'  // destroy all enemy units
  | 'survival'     // keep a specific unit alive
  | 'escape'       // reach a designated tile
  | 'time_limit'   // survive for N turns
  | 'protect_hq';  // defend the HQ tile

interface GameState {
  phase: GamePhase;
  turnPhase: TurnPhase;
  currentTurn: number;
  currentStageId: string | null;
  victoryCondition: VictoryCondition;
  isGameOver: boolean;
  winner: 'player' | 'enemy' | null;
}
```

---

## 6. Mission Metadata Type

```typescript
// types/mission.ts
import { OffsetCoord } from '@/utils/hexMath';

export interface MissionMetadata {
  keyUnitIds?:    string[];       // survival / escape: unit(s) that must survive / escape
  escapeTiles?:   OffsetCoord[];  // escape: destination tile(s)
  hqLocation?:    OffsetCoord;    // protect_hq: HQ tile position
  baseLocations?: OffsetCoord[];  // supply line: base positions for both sides
  payloadUnitId?: string;         // payload escort mode
  controlPoints?: OffsetCoord[];  // zone control mode
}
```

---

## 7. Battle Initialization Sequence

Call these dispatches in order at the start of `battle.tsx`:

```typescript
useEffect(() => {
  if (!isInitialized) return;

  // 1. Unit setup
  dispatch(initPlayerUnits(playerUnits));
  dispatch(initEnemyUnits(enemyUnits));

  // 2. Inventory — convert selectedItems (from playerSlice) to ItemSlot[]
  const playerItemSlots: ItemSlot[] = selectedItems.map(itemType => ({
    itemId:        itemType,
    remainingUses: 1,
  }));
  const enemyItemSlots: ItemSlot[] = [
    { itemId: 'flare',       remainingUses: 1 },
    { itemId: 'supply_pack', remainingUses: 1 },
  ];
  dispatch(setTeamInventory({ player: playerItemSlots, enemy: enemyItemSlots }));

  // 3. Reserves
  dispatch(setReserves({ player: playerReserves, enemy: enemyReserves }));

  // 4. Mission metadata
  dispatch(setMissionMetadata(stageMissionMetadata));
}, [isInitialized]);
```

---

## 8. Turn Start Sequence

At the start of each team's turn, dispatch cooldown tick and reset substitution flag:

```typescript
// Player turn start (battle.tsx)
useEffect(() => {
  if (phase !== 'player_turn' || !isInitialized) return;
  dispatch(tickCooldowns('player'));
  // substitution flag is reset at end of previous enemy turn
}, [phase]);

// Enemy turn start (hooks/useAI.ts — runAITurn)
dispatch(tickCooldowns('enemy'));
// ... AI logic ...
dispatch(resetSubstitutionFlag());
```

---

## 9. Data Persistence

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

### What to Persist
```typescript
interface PlayerState {
  totalPoints:       number;
  unlockedUnitTypes: UnitType[];
  unlockedItems:     ItemType[];
  customCharacters:  CustomCharacter[];
  clearedStages:     { [stageId: string]: StageResult };
  settings:          GameSettings;
  selectedItems:     ItemType[]; // strategy phase selection
}
// Do NOT persist battle state — it is rebuilt fresh each session.
```

---

## 10. Game Data JSON Formats

### Unit Data (data/units/base-units.json)
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
      "weak":   ["assassin"]
    },
    "aura": {
      "type":  "defense_boost",
      "range": 2,
      "value": 2
    }
  },
  {
    "type": "healer",
    "nameJa": "ヒーラー",
    "baseStats": {
      "maxHP":     1000,
      "attack":    3,
      "defense":   8,
      "movement":  2,
      "scout":     4
    },
    "healRange": 1,
    "healAmount": { "min": 100, "max": 150 },
    "affinity": { "strong": [], "weak": ["*"] }
  },
  {
    "type": "berserker",
    "nameJa": "バーサーカー",
    "baseStats": {
      "maxHP": 1000,
      "attack": 14,
      "defense": 6,
      "movement": 5,
      "scout": 4
    },
    "specialRule": "canAttackAfterFullMove",
    "affinity": { "strong": ["archer"], "weak": ["sniper"] }
  }
]
```

> **Note — `movement` for Healer is 2.** The move/action trade-off applies as follows:
> - Moved 0–1 tiles → heal available
> - Moved 2 tiles (full) → heal disabled

### Map Data (data/maps/stage-001.json)
```json
{
  "id": "stage-001",
  "nameJa": "平原の戦い",
  "width": 10,
  "height": 10,
  "cells": [
    { "col": 0, "row": 0, "terrain": "plain" },
    { "col": 1, "row": 0, "terrain": "highland" },
    { "col": 2, "row": 0, "terrain": "water" }
  ],
  "playerSpawnArea": [
    { "col": 0, "row": 8 }, { "col": 1, "row": 8 }
  ],
  "enemySpawnArea": [
    { "col": 0, "row": 0 }, { "col": 1, "row": 0 }
  ],
  "victoryCondition": "elimination",
  "turnLimit": 20,
  "missionMetadata": {
    "keyUnitIds":  [],
    "escapeTiles": [],
    "hqLocation":  null,
    "baseLocations": [
      { "col": 5, "row": 0 },
      { "col": 5, "row": 9 }
    ]
  }
}
```

> **Water tiles in map data are decoration only — they must never appear in any unit's reachable tile set.**  
> Validate this in `pathfinding.ts` via `isPassable`.

### Item Data (data/items/items.json)
```json
[
  { "id": "flare",           "nameJa": "照明弾",     "maxUses": 1 },
  { "id": "carpet_bombing",  "nameJa": "縦断爆撃",   "maxUses": 1 },
  { "id": "emp_grenade",     "nameJa": "EMP手榴弾",  "maxUses": 1 },
  { "id": "supply_pack",     "nameJa": "補給パック", "maxUses": 1 },
  { "id": "drone_recon",     "nameJa": "ドローン偵察", "maxUses": 1 },
  { "id": "land_mine",       "nameJa": "地雷",       "maxUses": 1 },
  { "id": "camo_net",        "nameJa": "迷彩ネット", "maxUses": 1 },
  { "id": "smoke_screen",    "nameJa": "煙幕",       "maxUses": 1 },
  { "id": "barricade",       "nameJa": "仮設バリケード", "maxUses": 1 }
]
```

---

## 11. Async Thunk — AI Turn

```typescript
// store/slices/gameSlice.ts
import { createAsyncThunk } from '@reduxjs/toolkit';

export const executeAITurn = createAsyncThunk(
  'game/executeAITurn',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;

    // Tick cooldowns at turn start
    dispatch(tickCooldowns('enemy'));

    const enemyUnits = enemyUnitsSelectors.selectAll(state);

    for (const unit of enemyUnits) {
      if (unit.isDead || unit.hasActed) continue;

      // AI decision from utils/ai/core/AIController — NOT utils/ai.ts
      const result = decideAIAction(unit, state);

      await new Promise(resolve => setTimeout(resolve, 500)); // animation delay

      switch (result.type) {
        case 'move':
          dispatch(moveUnit({ id: unit.id, ...result.destination, side: 'enemy' }));
          break;
        case 'attack':
          dispatch(applyDamage({ id: result.targetId, damage: result.damage, side: 'player' }));
          break;
        case 'useItem':
          dispatch(consumeItem({ team: 'enemy', itemId: result.itemId }));
          break;
        case 'useSkill':
          dispatch(activateSkill({ unitId: unit.id, skillId: result.skillId, side: 'enemy' }));
          break;
        case 'substitute':
          dispatch(substituteEnemy({ removedUnitId: result.removedUnitId, newUnit: result.newUnit, position: result.position }));
          dispatch(executeSubstitution('enemy'));
          dispatch(addLog(`Enemy substituted unit.`));
          break;
      }

      dispatch(markActed(unit.id));
    }

    dispatch(resetSubstitutionFlag());
  }
);
```

---

## 12. Implementation Checklist

- [ ] Always export `RootState` and `AppDispatch` from `store/index.ts`
- [ ] Memoize selectors with `createSelector`
- [ ] Use `createAsyncThunk` for all async operations
- [ ] Leverage `immer` (built into RTK) — mutate state directly, no spread needed
- [ ] Validate persisted data on load (handle schema migrations)
- [ ] Block user input during AI turn with a UI flag in `gameSlice`
- [ ] Dispatch `tickCooldowns(side)` at the **start** of each team's turn
- [ ] Dispatch `resetSubstitutionFlag()` at the **end** of each turn
- [ ] Dispatch `setTeamInventory` + `setReserves` + `setMissionMetadata` on battle init
- [ ] Import AI logic from `utils/ai/core/AIController` — never from `utils/ai.ts`
- [ ] Water tiles must never appear in any unit's reachable set (enforce in pathfinding)
- [ ] Dispatch `setTileVisibility` (result of `updateTileVisibility()`) at the **start** of each player turn
- [ ] Dispatch `setLastKnownPosition` when an enemy transitions `visible → explored` on plain terrain
- [ ] Dispatch `clearLastKnownPosition` when a previously-ghosted enemy re-enters a `visible` tile
- [ ] Initialize `tileVisibility` to all-`unexplored` on battle start; do NOT persist it between battles