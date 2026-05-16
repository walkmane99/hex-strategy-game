// ゲーム設定定数

export const GRID_CONFIG = {
  WIDTH: 10,
  HEIGHT: 10,
  HEX_SIZE: 36,         // SVG描画サイズ (px)
  HEX_SPACING: 1.05,    // セル間スペーシング係数
} as const;

export const UNIT_CONFIG = {
  MAX_TEAM_SIZE: 5,       // 出撃ユニット数
  RESERVE_SIZE: 1,        // 予備ユニット数
  STRATEGY_POINTS: 10,    // カスタマイズポイント
  MAX_STAT: 20,           // ステータス上限
  MIN_STAT: 1,            // ステータス最低値
  BASE_HP: 1000,          // 基本HP
  HP_PER_STAT_POINT: 50, // HP増加量/ポイント
} as const;

export const COMBAT_CONFIG = {
  AFFINITY_BONUS: 1.3,    // 相性有利倍率
  AFFINITY_PENALTY: 0.7,  // 相性不利倍率
  MIN_DAMAGE: 0,          // 最小ダメージ
  DAMAGE_MULTIPLIER: 10,  // ダメージ乗数
  RANDOM_MIN: 0.1,        // 乱数最小
  RANDOM_MAX: 1.0,        // 乱数最大
  FOREST_HIDE_CHANCE: 0.4, // 森林での非発見率
} as const;

export const SCOUT_CONFIG = {
  BASE_RANGE: 2,          // 基本索敵範囲
  HIGHLAND_BONUS: 1,      // 高地ボーナス
  STAT_PER_RANGE: 4,      // 索敵力→範囲変換 (scout / STAT_PER_RANGE)
} as const;

export const AURA_CONFIG = {
  TANKER_DEFENSE_BONUS: 2,    // タンカーオーラ防御ボーナス
  ATTACKER_ATTACK_BONUS: 2,   // アタッカーオーラ攻撃ボーナス
  AURA_RANGE: 2,              // オーラ範囲 (マス)
  HEALER_HEAL_MIN: 100,       // ヒーラー回復最小
  HEALER_HEAL_MAX: 150,       // ヒーラー回復最大
  HEALER_RANGE: 1,            // ヒーラー回復範囲 (仕様書4.3: 半径1=隣接6マス)
} as const;

export const POINT_CONFIG = {
  TURNS_REMAINING_MULTIPLIER: 10, // 残ターン×10
  UNIT_SURVIVAL: 50,              // ユニット生存ボーナス
  ENEMY_KILL: 20,                 // 敵撃破ボーナス
  NO_DAMAGE_BONUS: 100,           // 完全無傷ボーナス
  DIFFICULTY_NORMAL: 1.0,
  DIFFICULTY_HARD: 1.5,
  DIFFICULTY_EXPERT: 2.0,
} as const;

export const CUSTOM_CHAR_CONFIG = {
  MIN_POINTS_TO_CREATE: 500,   // キャラ作成最小ポイント
  CUSTOM_STAT_LIMIT: 15,       // カスタムキャラ強化上限
  MAX_TRANSFER_COUNT: 3,       // 譲渡最大回数
  TRANSFER_COOLDOWN_HOURS: 24, // 譲渡クールダウン
  MAX_HELD_CUSTOMS: 10,        // 所持最大数
  LEVEL_MAX: 20,               // レベル上限
} as const;
