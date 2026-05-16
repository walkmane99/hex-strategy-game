import { OffsetCoord } from './map';

export type UnitType =
  | 'tanker'
  | 'attacker'
  | 'healer'
  | 'seeker'
  | 'assassin'
  | 'sniper'
  | 'archer'
  | 'engineer'
  | 'berserker'
  | 'illusionist';

export type UnitSide = 'player' | 'enemy';

export interface UnitStats {
  maxHP: number;
  attack: number;
  defense: number;
  movement: number;
  scout: number;
}

export interface Unit {
  id: string;
  type: UnitType;
  side: UnitSide;
  stats: UnitStats;
  currentHP: number;
  position: OffsetCoord;
  isVisible: boolean;   // 敵から見えているか
  hasActed: boolean;    // このターン行動済みか
  isDead: boolean;
  customPoints?: number; // カスタマイズポイント振り分け済み
}

// 戦略フェーズでのカスタマイズ設定
export interface UnitCustomization {
  unitType: UnitType;
  pointAllocation: Partial<Record<keyof UnitStats, number>>;
}

// キャラクター作成システム用
export type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR';

export interface CustomCharacter {
  id: string;
  baseType: UnitType;
  rarity: Rarity;
  level: number;
  experience: number;
  boostedStats: Partial<UnitStats>;
  unlockedSkills: SpecialSkillType[];
  transferCount: number; // 譲渡回数 (最大3)
  ownerId: string;
  createdAt: number;
}

export type SpecialSkillType =
  | 'battlefield_inspiration'
  | 'emergency_repair'
  | 'defense_pierce'
  | 'swift_thunder'
  | 'scout_jamming';

export interface SpecialSkill {
  type: SpecialSkillType;
  nameJa: string;
  descriptionJa: string;
  pointCost: number;
}
