# Enemy AI Deviation Report — Phase 8a

**対応仕様書**: game-specification_1.md (更新版)
**実施日**: 2026-05-16
**テスト結果**: 126/126 全パス (phase8a: 22件追加)

---

## 仕様書更新への対応

### 1. ヒーラー回復範囲 半径1への修正

**変更ファイル**: `constants/gameConfig.ts`

| 変更前 | 変更後 |
|--------|--------|
| `HEALER_RANGE: 5` | `HEALER_RANGE: 1` |

**影響範囲**:
- `utils/ai/scoring/unitSpecific.ts` の `evaluateHealer` — AURA_CONFIG.HEALER_RANGE を参照しているため自動適用
- groupTactics.ts の `lowHpProtectionBonus` (距離2マス) は保護範囲であり回復範囲とは別概念のため変更不要

---

### 2. 移動・アクションのトレードオフルール実装

**変更ファイル**: `utils/ai/core/AIDecisionEngine.ts`

**実装内容**:
- `moveAndAttack` 候補生成を追加（仕様書 4.2.1）
- 非スナイパー・非バーサーカー: `offsetDistance(current, dest) < unit.stats.movement` のときのみ生成
- バーサーカー: 全力移動後も `moveAndAttack` 候補を生成
- スナイパー: `moveAndAttack` 候補を生成しない（射撃静止前提）
- 現在地への移動は `dist === 0` でスキップ（attack 候補と重複防止）

**ユニット別動作**:
| ユニット | 全力移動後 moveAndAttack |
|---------|------------------------|
| バーサーカー | ○ 生成 |
| アサシン | × 生成しない |
| スナイパー | × 生成しない (移動量問わず) |
| ヒーラー (移動2) | 1マス移動なら ○、2マス (全力) なら × |
| その他 | 全力移動は × |

---

### 3. アサシン発見確率式の正式実装

**変更ファイル**: `utils/ai/perception/visibilityMap.ts`

**旧実装**: 森林のみ FOREST_HIDE_CHANCE=0.4 でランダム判定
**新実装**: 3要素式 (仕様書 4.3 #5)

```
発見確率 = 地形基本確率 + 索敵ユニット補正 + 距離補正
クランプ: [5%, 65%]
```

| 要素 | 値 |
|------|-----|
| 森・建物・高地・瓦礫 | 10% |
| 平地・その他 | 40% |
| タンカー・ヒーラー索敵 | -5% |
| シーカー索敵 | +10% |
| アサシン索敵 | +15% |
| その他 | ±0% |
| 距離1 | +10% |
| 距離2 | +5% |
| 距離3+ | ±0% |

**境界値確認**:
- 平地 + アサシン索敵 + 距離1: 40+15+10 = **65%** (クランプ上限)
- 森 + ヒーラー索敵 + 距離3+: 10-5+0 = **5%** (クランプ下限)

**関連テスト更新**: `phase4.test.ts` の assassin detection テスト3件を新式に合わせて修正

---

### 4. setReserves バトル開始連携

**現状確認**: `setReserves` アクション (`store/slices/battleSlice.ts`) は実装済み。
**未対応**: バトル開始時のディスパッチ呼び出し (strategy.tsx → battle.tsx 連携)。
プレイヤー側の予備ユニット選択 UI が未実装のため、今フェーズは型定義・アクション整備にとどめ、UI実装時に別途対応する。

---

## フェーズ8a 本体 実装内容

### 5. missionAdjust.ts 実装

**新規ファイル**: `utils/ai/scoring/missionAdjust.ts`

| ミッション | 評価内容 |
|-----------|---------|
| elimination | タンカー前衛ボーナス 1.5倍 (vanguardBonus × 0.5 を加算) |
| survival | 低HP/低防御敵 +20、キーユニット +100 |
| escape | キーユニット攻撃 +120、脱出地点接近 +30〜0 (距離減衰)、タンカー保持 +40 |
| time_limit | 残り4ターン以上: safetyScore×0.5加算、攻撃前進ペナルティ -30、ヒーラー後退 +25 |
| protect_hq | 拠点3マス以内移動 +40、拠点近傍4マス以内の敵迎撃 +60 |

**設計**: 他評価器のスコアを上書きせず `ActionCandidate.score` への加算方式

---

### 6. MissionMetadata 型追加

**新規ファイル**: `types/mission.ts`

```typescript
export interface MissionMetadata {
  keyUnitIds?: string[];
  escapeTiles?: OffsetCoord[];
  hqLocation?: OffsetCoord;
  baseLocations?: OffsetCoord[];
  payloadUnitId?: string;
  controlPoints?: OffsetCoord[];
}
```

**連携**:
- `utils/ai/core/types.ts`: `AIContext.missionMetadata`, `GameStateSnapshot.missionMetadata` を追加
- `store/slices/battleSlice.ts`: `setMissionMetadata` アクション追加

---

### 7. supplyLine.ts 実装

**新規ファイル**: `utils/ai/scoring/supplyLine.ts`

**補給線判定アルゴリズム**: `dist(unit, base) == dist(unit, interposer) + dist(interposer, base)` が成立する場合に遮断と判定 (ヘックス最短経路定理)

| スコア | 値 | 条件 |
|--------|-----|------|
| supplyCutPositionBonus | +55 | 移動先が敵の補給経路上 |
| supplyCutTargetBonus | +25 | 自軍が切断中の敵を攻撃 |
| supplyCutSelfPenalty | -40 | 自軍補給線切断中にさらに切断域へ前進 |

**前提条件**: `missionMetadata.baseLocations` が設定されている場合のみ評価 (未設定時は 0)

---

### 8. moveAndAttack 候補生成と評価器対応

**更新ファイル**:
- `utils/ai/scoring/attackScore.ts`: `moveAndAttack` 型を `attack` と同等に評価 (targetUnit)
- `utils/ai/scoring/movementScore.ts`: `moveAndAttack` 型を `move` と同等に評価 (targetTile)
- `utils/ai/scoring/terrainScore.ts`: 同上
- `utils/ai/scoring/safetyScore.ts`: 同上 (移動先の安全度)
- `utils/ai/scoring/targetPriority.ts`: `moveAndAttack` はイルージョニスト判定のみ (二重計上防止)
- `utils/ai/core/AIController.ts`: `toUnitAction` に `moveAndAttack` ケース追加
- `utils/ai/core/tieBreaker.ts`: `movementCost`/`avgAllyDistance`/`threatAt` を `moveAndAttack` 対応 (移動コストが大きい候補より直接攻撃が優先される)

---

### 9. ScoreWeights 追加項目

**更新ファイル**: `utils/ai/data/scoreWeights.ts`, `utils/ai/core/types.ts`

| キー | 値 | 用途 |
|------|----|------|
| lowHpEnemyBonus | 20 | 生存戦: 低HP/低防御敵 |
| keyUnitAttackBonus | 100 | 生存戦: キーユニット攻撃 |
| escapeKeyUnitAttackBonus | 120 | 脱出戦: キーユニット攻撃 |
| escapeApproachBonus | 30 | 脱出戦: 脱出地点接近 |
| escapeBlockBonus | 50 | 脱出戦: 経路遮断ポジション |
| escapeTankerHoldBonus | 40 | 脱出戦: タンカー保持 |
| defensiveSafetyMultiplier | 1.5 | 時間切れ: 守勢係数 |
| attackerAdvancePenalty | -30 | 時間切れ: 前進ペナルティ |
| healerRearBonus | 25 | 時間切れ: ヒーラー後退 |
| hqProximityBonus | 40 | 拠点防衛: 近接ボーナス |
| hqInterceptBonus | 60 | 拠点防衛: 迎撃ボーナス |
| supplyCutPositionBonus | 55 | 補給線: 遮断位置 |
| supplyCutTargetBonus | 25 | 補給線: 切断中の敵追撃 |
| supplyCutSelfPenalty | -40 | 補給線: 自軍切断ペナルティ |

---

## 変更しなかった項目

- フェーズ5/6/7 の実装すべて (substitution, groupTactics, item/skillUsage)
- 2層処理構造 (Layer1/Layer2)
- safetyScore のスケーリング方式 (missionAdjust内で0.5×加算により1.5倍化)
- バーサーカーの加算ボーナス型 `(1 - hpRatio) × 60`

tieBreaker.ts は `movementCost`/`avgAllyDistance`/`threatAt` の3関数を `moveAndAttack` 型対応に拡張したが、アルゴリズム自体 (低脅威→低移動コスト→近い味方→決定論的乱数) は変更なし。

---

## テスト追加サマリー

**新規ファイル**: `utils/ai/__tests__/phase8a.test.ts` (22件)

| カテゴリ | テスト数 |
|---------|---------|
| ヒーラー回復範囲 | 3 |
| スナイパー moveAndAttack 禁止 | 2 |
| アサシン トレードオフ | 2 |
| バーサーカー 全力移動後攻撃 | 1 |
| アサシン発見確率 | 3 |
| 生存戦 missionAdjust | 2 |
| 脱出戦 missionAdjust | 2 |
| 時間切れ missionAdjust | 2 |
| 拠点防衛 missionAdjust | 2 |
| 補給線 supplyLine | 2 |
| moveAndAttack 候補生成 | 1 |

**既存テスト修正**: `phase4.test.ts` の assassin 検出テスト 3件 (旧 FOREST_HIDE_CHANCE=0.4 ベース → 新3要素式ベース)

**総テスト**: 126/126 通過 (追加22 + 既存104)
