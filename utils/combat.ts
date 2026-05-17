import { Unit, UnitType } from '@/types/unit';
import { TerrainType } from '@/types/map';
import { COMBAT_CONFIG } from '@/constants/gameConfig';
import { AFFINITY_CYCLE, TERRAIN_CONFIG } from '@/constants';
import { TERRAIN_CONFIG as TC } from '@/constants/terrain';

export type AffinityResult = 'advantage' | 'disadvantage' | 'neutral';

// =====================
// 相性チェック
// =====================

export function checkAffinity(attackerType: UnitType, defenderType: UnitType): AffinityResult {
  const atkIdx = AFFINITY_CYCLE.indexOf(attackerType);
  const defIdx = AFFINITY_CYCLE.indexOf(defenderType);

  // サイクル外のユニット (healer, engineer, berserker, illusionist) は neutral
  if (atkIdx === -1 || defIdx === -1) return 'neutral';

  const diff = (defIdx - atkIdx + AFFINITY_CYCLE.length) % AFFINITY_CYCLE.length;
  if (diff === 1) return 'advantage';    // 攻撃側が有利 (+30%)
  if (diff === AFFINITY_CYCLE.length - 1) return 'disadvantage'; // 攻撃側が不利 (-30%)
  return 'neutral';
}

export function getAffinityMultiplier(affinity: AffinityResult): number {
  switch (affinity) {
    case 'advantage':    return COMBAT_CONFIG.AFFINITY_BONUS;
    case 'disadvantage': return COMBAT_CONFIG.AFFINITY_PENALTY;
    default:             return 1.0;
  }
}

// =====================
// ダメージ計算
// =====================

/**
 * ダメージ計算
 * ダメージ = max(0, (攻撃力 × 相性 × rand(0.1~1.0) - (防御力 + 地形ボーナス)) × 10)
 * 補給線切断時: 攻撃側 -30%、防御側 -20%
 */
export function calculateDamage(
  attacker: Unit,
  defender: Unit,
  defenderTerrain: TerrainType,
  attackerAuraBonus: number = 0,
  defenderAuraBonus: number = 0
): { damage: number; affinity: AffinityResult } {
  const affinity = checkAffinity(attacker.type, defender.type);
  const affinityMult = getAffinityMultiplier(affinity);
  const random = COMBAT_CONFIG.RANDOM_MIN + Math.random() * (COMBAT_CONFIG.RANDOM_MAX - COMBAT_CONFIG.RANDOM_MIN);

  const atkSupplyMult = attacker.isSupplyCut ? 0.7 : 1.0;
  const defSupplyMult = defender.isSupplyCut ? 0.8 : 1.0;

  const terrainDefense = TC[defenderTerrain].defenseBonus;
  const effectiveAttack = (attacker.stats.attack + attackerAuraBonus) * affinityMult * atkSupplyMult;
  const effectiveDefense = defender.stats.defense * defSupplyMult + defenderAuraBonus + terrainDefense;

  const rawDamage = (effectiveAttack * random - effectiveDefense) * COMBAT_CONFIG.DAMAGE_MULTIPLIER;
  const damage = Math.max(COMBAT_CONFIG.MIN_DAMAGE, Math.round(rawDamage));

  return { damage, affinity };
}

/** 補給線切断中のユニットは移動力 -1（最低1）*/
export function getEffectiveMovement(unit: Unit): number {
  if (unit.isSupplyCut) return Math.max(1, unit.stats.movement - 1);
  return unit.stats.movement;
}

// =====================
// バーサーカー特殊計算
// =====================

/** バーサーカーのHP割合に応じた攻撃力倍率 */
export function getBerserkerMultiplier(currentHP: number, maxHP: number): number {
  const hpRatio = currentHP / maxHP;
  // HP 100% → 等倍, HP 0% → 2倍 (線形)
  return 1 + (1 - hpRatio);
}

// =====================
// ヒーラー回復計算
// =====================

import { AURA_CONFIG } from '@/constants/gameConfig';

/** 補給線切断中のターゲットへの回復は半減 */
export function calculateHeal(target?: Unit): number {
  const base = Math.round(
    AURA_CONFIG.HEALER_HEAL_MIN +
    Math.random() * (AURA_CONFIG.HEALER_HEAL_MAX - AURA_CONFIG.HEALER_HEAL_MIN)
  );
  return target?.isSupplyCut ? Math.floor(base * 0.5) : base;
}
