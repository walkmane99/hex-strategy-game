export type ItemType =
  | 'flare'            // 照明弾
  | 'camo_net'         // 迷彩ネット
  | 'supply_pack'      // 補給パック
  | 'emp_grenade'      // EMP手榴弾
  | 'land_mine'        // 地雷
  | 'drone_recon'      // ドローン偵察
  | 'carpet_bombing'   // 縦断爆撃
  | 'smoke_screen'     // 煙幕
  | 'time_accelerator' // 時間加速器
  | 'barricade'        // 仮設バリケード
  // 陣取り専用
  | 'color_bomb'       // 色変換爆弾
  | 'territory_shield' // 陣地防衛シールド
  | 'warp_gate';       // ワープゲート

export interface Item {
  type: ItemType;
  nameJa: string;
  descriptionJa: string;
  unlockCondition: string;
  targetType: ItemTargetType;
  duration?: number; // ターン継続数
}

export type ItemTargetType =
  | 'area'       // 範囲指定
  | 'unit'       // 単体ユニット
  | 'all_enemy'  // 全敵
  | 'cell';      // マス指定

export interface ItemUsage {
  itemType: ItemType;
  usedAt: number; // ターン数
  targetPos?: { col: number; row: number };
  targetUnitId?: string;
  remainingTurns: number;
}
