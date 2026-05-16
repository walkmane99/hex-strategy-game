# Enemy AI 乖離レポート — フェーズ6完了時点

作成日: 2026-05-16  
対象フェーズ: Phase 6（集団行動・前提条件修正）

---

## 前提条件の対応（フェーズ5残課題）

### 1. アイテム/スキル状態更新の実装

#### Redux アクション追加

| ファイル | 追加アクション | 内容 |
|---------|-------------|------|
| `store/slices/battleSlice.ts` | `consumeItem(team, itemId)` | `remainingUses -= 1`、0になれば削除 |
| `store/slices/battleSlice.ts` | `setTeamInventory({ player, enemy })` | バトル開始時の在庫初期化 |
| `store/slices/unitSlice.ts` | `activateSkill({ unitId, skillId, side })` | `cooldown = SKILL_INITIAL_COOLDOWN[skillId]`、`remainingUses -= 1` |
| `store/slices/unitSlice.ts` | `tickCooldowns(side)` | 全ユニットの全スキル `cooldown -= 1`（最低0） |

#### hooks/useAI.ts 連携

- ターン開始時に `dispatch(tickCooldowns('enemy'))` を実行
- `useItem` アクション実行時に `consumeItem` をディスパッチ
- `useSkill` アクション実行時に `activateSkill` をディスパッチ
- `snapshot` に `state.battle.teamInventory` を含めて AI へ渡す

### 2. defense_pierce 閾値の定数化

`constants/aiThresholds.ts`（新規）に移動：
```typescript
export const DEFENSE_PIERCE_THRESHOLD = 15;
export const SKILL_INITIAL_COOLDOWN: Record<SpecialSkillType, number> = { ... };
```

`skillUsage.ts` のハードコード `>= 15` を `>= DEFENSE_PIERCE_THRESHOLD` に置換。

### 3. protect_hq の VictoryCondition 追加

`types/map.ts` に `'protect_hq'` を追加。  
`itemUsage.ts` の `barricade` 判定で `mission === 'protect_hq'` を考慮するよう更新。

---

## フェーズ6: 集団行動 (groupTactics)

### 実装ファイル

#### `utils/ai/scoring/groupTactics.ts` (新規)

| 評価内容 | 対象 | 条件 | スコア |
|---------|------|------|-------|
| 挟み撃ち | attack | 敵から見て味方が逆方向 (内積 < 0) かつ敵から2マス以内 | +pincerBonus (50) |
| 集中攻撃 | attack | tentativePlan に同じ敵を攻撃する他ユニットが存在 | +concentratedAttackBonus (25) |
| 陣形維持 | move | 最近接味方との距離が 2〜3 マス | +formationBonus (15) |
| 単独突出 | move | 最近接味方との距離が 4 マス以上 | +isolationPenalty (-30) |
| 前衛維持 (tanker) | move | 移動先が全非タンカー味方より敵に近い | +vanguardBonus (20) |
| 後衛維持 (attacker/berserker) | move | タンカー味方が移動先より敵に近い | +vanguardBonus (20) |
| 低HP守護 | move | 移動先が HP<40% 味方より敵に近く、味方から 2 マス以内 | +lowHpProtectionBonus (35) |

**重要**: `concentratedAttackBonus` は `tentativePlan` が設定されている場合のみ（Layer 2）。

#### `utils/ai/data/scoreWeights.ts` 追加

```typescript
concentratedAttackBonus: 25,
vanguardBonus: 20,
lowHpProtectionBonus: 35,
```

`ScoreWeights` インターフェースにも対応フィールドを追加。

### 2層構造への AIController 拡張

```
Layer 1 (全ユニット): LAYER1_EVALUATORS = [attack, movement, terrain, target, safety, unitSpecific, itemUsage, skillUsage]
  → tentativePlan に格納

Layer 2 (全ユニット): LAYER2_EVALUATORS = LAYER1_EVALUATORS + [groupTactics]
  → 最終 UnitAction を生成
  ※ activeUnits.length ≤ 1 の場合は Layer 2 をスキップ
```

`buildAIContext` に `tentativePlan?: Map<string, ActionCandidate>` パラメータを追加。  
`UnitAction` に `itemId?: string` / `skillId?: string` を追加。

### パフォーマンス計測結果

| シナリオ | 思考時間 | 判定 |
|---------|---------|------|
| 6ユニット × 2層 (テスト環境) | 10ms | ✅ 500ms 以内 |
| 1ユニット × 1層 (既存テスト) | 0〜2ms | ✅ |
| 2ユニット × 2層 (既存テスト) | 2ms | ✅ |

---

## テスト結果

```
Tests: 94 passed, 94 total (5 suites)
TypeScript: 0 errors
```

新規 phase6.test.ts: 10テスト
- 挟み撃ち (有/無): 2
- 陣形維持/単独突出: 2
- 集中攻撃 (有/無): 2
- Layer 1 tentativePlan なし: 2
- パフォーマンス (6ユニット 500ms以内): 1
- 低HP守護: 1

---

## 仕様との乖離・判断事項

### [簡略化] 前衛・後衛配置の判定

仕様: "タンカーの前にアタッカーが出ない配置で +20"  
実装: 幾何的な「前後」をユークリッド距離で近似。

- **タンカー行動中**: 移動先が全非タンカー味方より敵に近い → +vanguardBonus
- **アタッカー/バーサーカー行動中**: 任意のタンカー味方が移動先より敵に近い → +vanguardBonus

複雑な方向ベクトル計算を避けることで実装を簡素化。  
より精密な方向制約が必要な場合は Cube 座標のドット積で実装可能。

### [決定] Layer 2 スキップ条件

`activeUnits.length <= 1` の場合、集団スコアが全て0になるため Layer 2 をスキップ。  
これにより 1ユニットシナリオでの計算コストが半減。

### [決定] tickCooldowns の呼び出しタイミング

**敵ターン**: `useAI.ts` の `runAITurn` 開始時に `tickCooldowns('enemy')` を dispatch。  
**プレイヤーターン**: 現在未実装（別途プレイヤーターン管理の hook から呼ぶ必要あり）。

### [継続] concentratedAttackBonus の全ユニット適用

仕様では "2体目以降 +25" だが、実装では「tentativePlan に同じ敵を攻撃するユニットが存在すれば全ユニットが +25」を採用。  
理由: 攻撃順序の定義が曖昧なため。戦略的効果は同等（集中攻撃を強化）。

### [維持] フェーズ5の実装すべて

- probabilityMap の順序（イベント適用→拡散→再ピン）
- tieBreaker の4優先度+シード乱数
- safetyScore のHP依存スケーリング
- targetPriority と attackScore の責務分担
- エンジニア/イリュージョニストの正式実装

---

## 残課題（フェーズ7以降）

| 課題 | 優先度 |
|-----|-------|
| moveAndAttack 候補生成 | 中 |
| プレイヤーターン開始時の tickCooldowns('player') | 中 |
| vanguardBonus の Cube ベクトル精密化 | 低 |
| setTeamInventory のバトル開始連携 | 中 |
| concentratedAttackBonus の "2体目以降" 精確化 | 低 |
