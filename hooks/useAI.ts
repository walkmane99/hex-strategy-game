import { MutableRefObject, useCallback } from 'react';
import { useDispatch, useStore } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import {
  playerUnitSelectors,
  enemyUnitSelectors,
  moveUnit,
  applyDamage,
  resetTurnFlags,
} from '@/store/slices/unitSlice';
import { endEnemyTurn } from '@/store/slices/gameSlice';
import { addLog, setAnimating } from '@/store/slices/battleSlice';
import { calculateDamage } from '@/utils/combat';
import { updateGridCell } from '@/utils/ai';
import { executeAITurn } from '@/utils/ai/core/AIController';
import { DEFAULT_SCORE_WEIGHTS } from '@/utils/ai/data/scoreWeights';
import { MapCell } from '@/types/map';

const MOVE_DELAY = 600;
const ATTACK_DELAY = 400;
const BETWEEN_UNIT = 300;

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export function useAI(gridRef: MutableRefObject<MapCell[][]>): {
  runAITurn: () => Promise<void>;
} {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();

  const runAITurn = useCallback(async () => {
    dispatch(setAnimating(true));

    try {
      const state = store.getState();
      const snapshot = {
        enemyUnits: enemyUnitSelectors.selectAll(state).filter(u => !u.isDead),
        playerUnits: playerUnitSelectors.selectAll(state).filter(u => !u.isDead),
        grid: gridRef.current,
        currentTurn: state.game.currentTurn,
        mission: 'elimination' as const,
      };

      const plan = executeAITurn(snapshot, DEFAULT_SCORE_WEIGHTS, 'normal');
      const currentTurn = state.game.currentTurn;

      for (const action of plan.actions) {
        if (action.type === 'move' && action.destination) {
          const freshState = store.getState();
          const unit = enemyUnitSelectors.selectById(freshState, action.unitId);
          if (!unit || unit.isDead) continue;

          const from = unit.position;
          const to = action.destination;
          dispatch(moveUnit({ id: unit.id, position: to, side: 'enemy' }));
          updateGridCell(gridRef.current, from, to, unit.id);
          dispatch(addLog({
            turn: currentTurn,
            action: { type: 'move', unitId: unit.id, targetPos: to },
            result: `${unit.id} → (${to.col},${to.row})`,
            timestamp: Date.now(),
          }));
          await wait(MOVE_DELAY);

        } else if (action.type === 'attack' && action.targetUnit) {
          const freshState = store.getState();
          const unit = enemyUnitSelectors.selectById(freshState, action.unitId);
          const freshTarget = playerUnitSelectors.selectById(freshState, action.targetUnit.id);
          if (!unit || unit.isDead || !freshTarget || freshTarget.isDead) continue;

          const targetCell = gridRef.current[freshTarget.position.row]?.[freshTarget.position.col];
          const terrain = targetCell?.terrain ?? 'plain';
          const { damage } = calculateDamage(unit, freshTarget, terrain, 0, 0);
          dispatch(applyDamage({ id: freshTarget.id, damage, side: 'player' }));
          dispatch(addLog({
            turn: currentTurn,
            action: { type: 'attack', unitId: unit.id, targetId: freshTarget.id },
            damage,
            result: `${unit.id} hit ${freshTarget.id} for ${damage}`,
            timestamp: Date.now(),
          }));
          await wait(ATTACK_DELAY);
        }

        await wait(BETWEEN_UNIT);
      }
    } finally {
      dispatch(setAnimating(false));
      dispatch(resetTurnFlags());
      dispatch(endEnemyTurn());
    }
  }, [dispatch, store, gridRef]);

  return { runAITurn };
}
