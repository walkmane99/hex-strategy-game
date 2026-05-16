import { TerrainConfig, TerrainType } from '@/types/map';

export const TERRAIN_CONFIG: Record<TerrainType, TerrainConfig> = {
  plain: {
    type: 'plain',
    nameJa: '平地',
    defenseBonus: 0,
    moveCost: 1,
    sightBlocker: false,
    reducesDetection: false,
    sightBonus: 0,
    passableBy: 'all',
  },
  highland: {
    type: 'highland',
    nameJa: '高地',
    defenseBonus: 3,
    moveCost: 2,
    sightBlocker: false,
    reducesDetection: false,
    sightBonus: 1,
    passableBy: 'all',
  },
  forest: {
    type: 'forest',
    nameJa: '森林',
    defenseBonus: 2,
    moveCost: 2,
    sightBlocker: false,
    reducesDetection: true,
    sightBonus: 0,
    passableBy: 'all',
  },
  water: {
    type: 'water',
    nameJa: '水場',
    defenseBonus: -1,
    moveCost: 3,
    sightBlocker: false,
    reducesDetection: false,
    sightBonus: 0,
    passableBy: 'none', // 特定ユニットのみ（将来拡張）
  },
  building: {
    type: 'building',
    nameJa: '建物',
    defenseBonus: 4,
    moveCost: 1,
    sightBlocker: true,
    reducesDetection: false,
    sightBonus: 0,
    passableBy: 'all',
  },
  rubble: {
    type: 'rubble',
    nameJa: '瓦礫',
    defenseBonus: 1,
    moveCost: 2,
    sightBlocker: false,
    reducesDetection: false,
    sightBonus: 0,
    passableBy: 'all',
  },
};

// 地形の表示カラー
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  plain:    '#8DB87A',
  highland: '#A0896B',
  forest:   '#3D6B47',
  water:    '#4A90D9',
  building: '#7A7A8A',
  rubble:   '#8A7A6A',
};
