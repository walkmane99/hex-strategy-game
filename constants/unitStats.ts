import { UnitType } from '@/types/unit';
import { UnitStats } from '@/types/unit';

export const UNIT_NAMES_JA: Record<UnitType, string> = {
  tanker:      'タンカー',
  attacker:    'アタッカー',
  healer:      'ヒーラー',
  seeker:      'シーカー',
  assassin:    'アサシン',
  sniper:      'スナイパー',
  archer:      'アーチャー',
  engineer:    'エンジニア',
  berserker:   'バーサーカー',
  illusionist: 'イリュージョニスト',
  logistics:   'ロジスティクス兵',
};

// 各ユニットのベースステータス (カスタマイズ前)
export const UNIT_BASE_STATS: Record<UnitType, UnitStats> = {
  tanker:      { maxHP: 1000, attack: 6,  defense: 15, movement: 4,  scout: 5  },
  attacker:    { maxHP: 1000, attack: 15, defense: 7,  movement: 6,  scout: 5  },
  healer:      { maxHP: 1000, attack: 3,  defense: 8,  movement: 5,  scout: 6  },
  seeker:      { maxHP: 1000, attack: 5,  defense: 6,  movement: 15, scout: 15 },
  assassin:    { maxHP: 1000, attack: 13, defense: 6,  movement: 14, scout: 7  },
  sniper:      { maxHP: 1000, attack: 16, defense: 5,  movement: 4,  scout: 8  },
  archer:      { maxHP: 1000, attack: 11, defense: 7,  movement: 7,  scout: 8  },
  engineer:    { maxHP: 1000, attack: 7,  defense: 9,  movement: 6,  scout: 9  },
  berserker:   { maxHP: 1000, attack: 12, defense: 8,  movement: 7,  scout: 5  },
  illusionist: { maxHP: 1000, attack: 5,  defense: 7,  movement: 8,  scout: 12 },
  logistics:   { maxHP: 1000, attack: 4,  defense: 10, movement: 4,  scout: 8  },
};

// 相性サイクル (強い順)
// タンカー → アーチャー → シーカー → スナイパー → アタッカー → アサシン → タンカー
export const AFFINITY_CYCLE: UnitType[] = [
  'tanker', 'archer', 'seeker', 'sniper', 'attacker', 'assassin',
];

// 最初から使用可能なユニット (11種)
export const INITIAL_UNITS: UnitType[] = [
  'tanker', 'attacker', 'healer', 'seeker', 'assassin',
  'sniper', 'archer', 'engineer', 'berserker', 'illusionist', 'logistics',
];
