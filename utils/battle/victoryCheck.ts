import type { Unit } from '@/types/unit';
import type { VictoryCondition, OffsetCoord } from '@/types/map';
import type { MissionMetadata } from '@/types/mission';

export type VictoryResult =
  | { winner: 'player' | 'enemy' | 'draw'; reason: string }
  | null;

function coordEq(a: OffsetCoord, b: OffsetCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * 勝利条件チェック。
 * 各フレームまたはターン終了後に呼ぶ。null = 勝敗未決定。
 */
export function checkVictory(
  victoryCondition: VictoryCondition,
  playerUnits: Unit[],
  enemyUnits: Unit[],
  currentTurn: number,
  turnLimit: number,
  missionMetadata?: MissionMetadata | null,
): VictoryResult {
  const alivePlayers = playerUnits.filter(u => !u.isDead);
  const aliveEnemies = enemyUnits.filter(u => !u.isDead);

  // 共通敗北条件
  if (alivePlayers.length === 0) return { winner: 'enemy', reason: '全プレイヤー撃破' };

  switch (victoryCondition) {
    case 'elimination':
      if (aliveEnemies.length === 0) return { winner: 'player', reason: '全敵殲滅' };
      return null;

    case 'survival': {
      const keyIds = missionMetadata?.keyUnitIds ?? [];
      if (keyIds.length > 0) {
        const keyAlive = keyIds.every(id => playerUnits.find(u => u.id === id && !u.isDead));
        if (!keyAlive) return { winner: 'enemy', reason: 'キーユニット撃破' };
      }
      if (aliveEnemies.length === 0) return { winner: 'player', reason: '生存成功' };
      if (currentTurn > turnLimit) return { winner: 'player', reason: '生存達成' };
      return null;
    }

    case 'time_limit':
      if (currentTurn > turnLimit) return { winner: 'player', reason: '時間切れ生存' };
      return null;

    case 'escape': {
      const keyIds = missionMetadata?.keyUnitIds ?? [];
      const escapeTiles = missionMetadata?.escapeTiles ?? [];
      const keyAlive = keyIds.every(id => playerUnits.find(u => u.id === id && !u.isDead));
      if (keyIds.length > 0 && !keyAlive) return { winner: 'enemy', reason: 'キーユニット撃破' };
      const escaped = keyIds.some(id => {
        const unit = playerUnits.find(u => u.id === id);
        if (!unit || unit.isDead) return false;
        return escapeTiles.some(t => coordEq(unit.position, t));
      });
      if (escaped) return { winner: 'player', reason: '脱出成功' };
      return null;
    }

    case 'protect_hq': {
      const hq = missionMetadata?.hqLocation;
      if (hq && aliveEnemies.some(u => coordEq(u.position, hq))) {
        return { winner: 'enemy', reason: '拠点占拠' };
      }
      if (currentTurn > turnLimit) return { winner: 'player', reason: '拠点防衛成功' };
      return null;
    }

    case 'supply_line': {
      if (currentTurn <= turnLimit) return null;

      const playerConnected = alivePlayers.filter(u => !u.isSupplyCut).length;
      const enemyConnected = aliveEnemies.filter(u => !u.isSupplyCut).length;

      if (playerConnected > enemyConnected) {
        return { winner: 'player', reason: `補給接続 ${playerConnected} vs ${enemyConnected}` };
      }
      if (enemyConnected > playerConnected) {
        return { winner: 'enemy', reason: `補給接続 ${enemyConnected} vs ${playerConnected}` };
      }
      return { winner: 'draw', reason: '補給接続同数' };
    }

    default:
      return null;
  }
}
