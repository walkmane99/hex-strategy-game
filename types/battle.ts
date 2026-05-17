import { OffsetCoord } from './map';

export type BattlePhase = 'strategy' | 'deploy' | 'player_turn' | 'enemy_turn' | 'result';

export type ActionType = 'move' | 'attack' | 'use_item' | 'swap_reserve' | 'skip';

export interface BattleAction {
  type: ActionType;
  unitId: string;
  targetId?: string;
  targetPos?: OffsetCoord;
  itemType?: string;
}

export interface BattleLog {
  turn: number;
  action: BattleAction;
  damage?: number;
  result: string;
  timestamp: number;
}

export interface StageResult {
  stageId: string;
  cleared: boolean;
  turnsUsed: number;
  survivingUnits: number;
  totalUnits: number;
  specialConditions: string[];
  pointsEarned: number;
  timestamp: number;
}

export interface AIAction {
  type: 'move' | 'attack' | 'skip';
  destination?: OffsetCoord;
  targetId?: string;
}

export type BattleEvent =
  | {
      type: 'attack';
      attackerId: string;
      defenderId: string;
      damage: number;
      affinity: 'advantage' | 'disadvantage' | 'neutral';
      isKill: boolean;
      timestamp: number;
    }
  | {
      type: 'heal';
      healerId: string;
      targetId: string;
      amount: number;
      timestamp: number;
    }
  | {
      type: 'death';
      unitId: string;
      side: 'player' | 'enemy';
      timestamp: number;
    };
