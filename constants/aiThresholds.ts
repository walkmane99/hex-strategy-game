import { SpecialSkillType } from '@/types/unit';

/** 防衛阻害スキルの発動に必要な最低防御力 */
export const DEFENSE_PIERCE_THRESHOLD = 15;

/** スキル使用後に設定されるクールダウン初期値 (ターン数) */
export const SKILL_INITIAL_COOLDOWN: Record<SpecialSkillType, number> = {
  battlefield_inspiration: 3,
  emergency_repair: 3,
  defense_pierce: 4,
  swift_thunder: 3,
  scout_jamming: 3,
  scout_marker: 2,
  decoy: 2,
};
