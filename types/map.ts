export type TerrainType =
  | 'plain'
  | 'highland'
  | 'forest'
  | 'water'
  | 'building'
  | 'rubble';

export interface OffsetCoord {
  col: number;
  row: number;
}

export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

export interface TerrainConfig {
  type: TerrainType;
  nameJa: string;
  defenseBonus: number;
  moveCost: number;
  sightBlocker: boolean;
  reducesDetection: boolean;
  sightBonus: number;
  passableBy: UnitTypeFilter; // 'all' | 'land' | 'none'
}

export type UnitTypeFilter = 'all' | 'land' | 'none';

export interface MapCell {
  position: OffsetCoord;
  terrain: TerrainType;
  unitId?: string;         // 現在のユニットID
  playerColor?: 'player' | 'enemy' | null; // 陣取りモード用
  isScoutMarker?: boolean; // エンジニアの索敵マーカー
  scoutMarkerTurns?: number;
}

export interface GameMap {
  id: string;
  nameJa: string;
  width: number;
  height: number;
  cells: MapCell[][];
  playerSpawnArea: OffsetCoord[];
  enemySpawnArea: OffsetCoord[];
  victoryCondition: VictoryCondition;
  turnLimit?: number;
}

export type VictoryCondition =
  | 'elimination'  // 殲滅戦
  | 'survival'     // 生存戦
  | 'escape'       // 脱出戦
  | 'time_limit'   // 時間切れ
  | 'territory'    // 陣取り
  | 'protect_hq';  // 本拠地防衛
