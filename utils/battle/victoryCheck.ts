import type { Unit } from '@/types/unit';
import type { VictoryCondition } from '@/types/map';

export type VictoryResult =
  | { winner: 'player' | 'enemy' | 'draw'; reason: string }
  | null;

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
): VictoryResult {
  const alivePlayers = playerUnits.filter(u => !u.isDead);
  const aliveEnemies = enemyUnits.filter(u => !u.isDead);

  switch (victoryCondition) {
    case 'elimination':
      if (aliveEnemies.length === 0) return { winner: 'player', reason: '全敵殲滅' };
      if (alivePlayers.length === 0) return { winner: 'enemy', reason: '全プレイヤー撃破' };
      return null;

    case 'survival':
      if (alivePlayers.length === 0) return { winner: 'enemy', reason: 'キーユニット撃破' };
      if (aliveEnemies.length === 0) return { winner: 'player', reason: '生存成功' };
      if (currentTurn > turnLimit) return { winner: 'player', reason: '生存達成' };
      return null;

    case 'time_limit':
      if (alivePlayers.length === 0) return { winner: 'enemy', reason: '全プレイヤー撃破' };
      if (currentTurn > turnLimit) return { winner: 'player', reason: '時間切れ生存' };
      return null;

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
