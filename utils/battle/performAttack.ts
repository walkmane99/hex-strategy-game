import type { AppDispatch } from '@/store';
import type { Unit } from '@/types/unit';
import type { TerrainType } from '@/types/map';
import type { BattleEvent } from '@/types/battle';
import { calculateDamage } from '@/utils/combat';
import { applyDamage } from '@/store/slices/unitSlice';
import { addBattleEvent } from '@/store/slices/battleSlice';

export interface AttackResult {
  damage: number;
  affinity: 'advantage' | 'disadvantage' | 'neutral';
  isKill: boolean;
  attackerId: string;
  defenderId: string;
}

/**
 * プレイヤー/AI 共通の攻撃実行関数。
 * - ダメージを実乱数で計算（AI予測値は使わない）
 * - applyDamage で実HPを減らす
 * - BattleEvent をキューに積む（将来のアニメーション層が消費）
 */
export function performAttack(
  attacker: Unit,
  defender: Unit,
  defenderTerrain: TerrainType,
  defenderSide: 'player' | 'enemy',
  dispatch: AppDispatch,
): AttackResult {
  const { damage, affinity } = calculateDamage(attacker, defender, defenderTerrain, 0, 0);
  const isKill = defender.currentHP - damage <= 0;

  dispatch(applyDamage({ id: defender.id, damage, side: defenderSide }));

  const attackEvent: BattleEvent = {
    type: 'attack',
    attackerId: attacker.id,
    defenderId: defender.id,
    damage,
    affinity,
    isKill,
    timestamp: Date.now(),
  };
  dispatch(addBattleEvent(attackEvent));

  if (isKill) {
    const deathEvent: BattleEvent = {
      type: 'death',
      unitId: defender.id,
      side: defenderSide,
      timestamp: Date.now(),
    };
    dispatch(addBattleEvent(deathEvent));
  }

  return { damage, affinity, isKill, attackerId: attacker.id, defenderId: defender.id };
}
