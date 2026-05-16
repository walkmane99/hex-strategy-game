import { ActionCandidate, AIContext } from '../core/types';
import { ItemType } from '@/types/item';
import { offsetDistance } from '@/utils/hexMath';
import { ATTACK_RANGE_BY_TYPE } from '../data/scoreWeights';

/**
 * 残ターン数が3以下の場合、各アイテムの発動条件閾値を半減させる。
 * これにより終盤に温存していたアイテムを使い切らせる。
 */
function isRelaxed(remainingTurns: number): boolean {
  return remainingTurns <= 3;
}

export function itemUsageEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  if (candidate.type !== 'useItem' || !candidate.itemId) return 0;

  const itemId = candidate.itemId as ItemType;
  const { actingUnit, allyUnits, visibleEnemyUnits, probability, remainingTurns, mission } = context;
  const relaxed = isRelaxed(remainingTurns);

  switch (itemId) {
    case 'flare': {
      // アサシン疑惑 or 未索敵に複数潜伏 → +90
      // probabilityMap の高確率タイル数で潜伏疑惑を判定する
      if (!probability) return 0;
      const highProbThreshold = relaxed ? 0.25 : 0.5;
      const minHighProbTiles = relaxed ? 2 : 3;
      const highProbCount = [...probability.values()].filter(p => p > highProbThreshold).length;
      const hasAssassinInFog =
        visibleEnemyUnits.some(e => e.type === 'assassin') ||
        highProbCount >= minHighProbTiles;
      return hasAssassinInFog ? 90 : 0;
    }

    case 'carpet_bombing': {
      // 敵HP合計≥1500 or 味方HP<50% → +150
      const hpThreshold = relaxed ? 750 : 1500;
      const allyHpThreshold = relaxed ? 0.75 : 0.5;
      const totalEnemyHP = visibleEnemyUnits.reduce((sum, e) => sum + e.currentHP, 0);
      const anyAllyLowHP = allyUnits.some(a => a.currentHP / a.stats.maxHP < allyHpThreshold);
      return totalEnemyHP >= hpThreshold || anyAllyLowHP ? 150 : 0;
    }

    case 'emp_grenade': {
      // 3マス以内に敵2体以上 → +70
      if (!candidate.targetTile) return 0;
      const radius = relaxed ? 4 : 3;
      const minEnemies = relaxed ? 1 : 2;
      const nearbyCount = visibleEnemyUnits.filter(
        e => offsetDistance(candidate.targetTile!, e.position) <= radius,
      ).length;
      return nearbyCount >= minEnemies ? 70 : 0;
    }

    case 'supply_pack': {
      // 味方HP<40% → +80
      const hpRatioThreshold = relaxed ? 0.8 : 0.4;
      const hasLowHPAlly = allyUnits.some(a => a.currentHP / a.stats.maxHP < hpRatioThreshold);
      return hasLowHPAlly ? 80 : 0;
    }

    case 'drone_recon': {
      // 未索敵エリア≥50% → +60
      if (!probability) return 60; // probabilityMap 未構築 = 完全未索敵
      const totalTiles = probability.size;
      if (totalTiles === 0) return 0;
      const unknownThreshold = relaxed ? 0.15 : 0.25;
      const unknownCount = [...probability.values()].filter(p => p > unknownThreshold).length;
      const ratioThreshold = relaxed ? 0.25 : 0.5;
      return unknownCount / totalTiles >= ratioThreshold ? 60 : 0;
    }

    case 'land_mine': {
      // 敵主力進路上で +50
      // 敵ユニットと自ユニットの中間に位置するタイルを進路と判定
      if (!candidate.targetTile) return 0;
      const routeRadius = relaxed ? 4 : 3;
      const isOnRoute = visibleEnemyUnits.some(e => {
        const distToTile = offsetDistance(candidate.targetTile!, e.position);
        const distToUnit = offsetDistance(actingUnit.position, e.position);
        return distToTile < distToUnit && distToTile <= routeRadius;
      });
      return isOnRoute ? 50 : 0;
    }

    case 'camo_net': {
      // 低HPがスナイパー射程内で +65
      if (!candidate.targetUnit) return 0;
      const snipers = visibleEnemyUnits.filter(e => e.type === 'sniper');
      if (snipers.length === 0) return 0;
      const hpThreshold = relaxed ? 0.7 : 0.5;
      const isLowHP = candidate.targetUnit.currentHP / candidate.targetUnit.stats.maxHP < hpThreshold;
      const sniperRange = ATTACK_RANGE_BY_TYPE['sniper'] ?? 3;
      const inSniperRange = snipers.some(
        s => offsetDistance(candidate.targetUnit!.position, s.position) <= sniperRange,
      );
      return isLowHP && inSniperRange ? 65 : 0;
    }

    case 'smoke_screen': {
      // 味方複数がスナイパー射程内で +55
      const snipers = visibleEnemyUnits.filter(e => e.type === 'sniper');
      if (snipers.length === 0) return 0;
      const sniperRange = ATTACK_RANGE_BY_TYPE['sniper'] ?? 3;
      const minAllies = relaxed ? 1 : 2;
      const alliesInRange = allyUnits.filter(a =>
        snipers.some(s => offsetDistance(a.position, s.position) <= sniperRange),
      ).length;
      return alliesInRange >= minAllies ? 55 : 0;
    }

    case 'barricade': {
      // 防衛戦・進路制限可能で +45
      const isDefensive = mission === 'survival' || mission === 'time_limit' || mission === 'protect_hq';
      if (isDefensive) return 45;
      // 終盤は通常ミッションでも防衛的価値あり
      return relaxed ? 25 : 0;
    }

    default:
      return 0;
  }
}
