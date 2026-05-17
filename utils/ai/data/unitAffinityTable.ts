import { UnitType } from '@/types/unit';

export interface AffinityInfo {
  strongAgainst: UnitType | null;
  weakAgainst: UnitType | null;
}

// Derived from AFFINITY_CYCLE: tanker → archer → seeker → sniper → attacker → assassin → tanker
export const UNIT_AFFINITY: Record<UnitType, AffinityInfo> = {
  tanker:      { strongAgainst: 'archer',   weakAgainst: 'assassin' },
  archer:      { strongAgainst: 'seeker',   weakAgainst: 'tanker' },
  seeker:      { strongAgainst: 'sniper',   weakAgainst: 'archer' },
  sniper:      { strongAgainst: 'attacker', weakAgainst: 'seeker' },
  attacker:    { strongAgainst: 'assassin', weakAgainst: 'sniper' },
  assassin:    { strongAgainst: 'tanker',   weakAgainst: 'attacker' },
  healer:      { strongAgainst: null, weakAgainst: null },
  engineer:    { strongAgainst: null, weakAgainst: null },
  berserker:   { strongAgainst: null, weakAgainst: null },
  illusionist: { strongAgainst: null, weakAgainst: null },
  logistics:   { strongAgainst: null, weakAgainst: null },
} as const;
