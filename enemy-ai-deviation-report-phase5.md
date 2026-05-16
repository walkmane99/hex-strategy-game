# Enemy AI 乖離レポート — フェーズ5完了時点

作成日: 2026-05-16  
対象フェーズ: Phase 5（アイテム・スキル）

---

## 実装済み内容

### 1. 型定義の追加・拡張

| ファイル | 変更内容 |
|---------|---------|
| `types/unit.ts` | `SkillSlot` インターフェース追加、`SpecialSkillType` に `scout_marker` / `decoy` 追加、`Unit.skills?: SkillSlot[]` 追加 |
| `types/item.ts` | `ItemSlot` インターフェース追加 |
| `utils/ai/core/types.ts` | `GameStateSnapshot.teamInventory` 追加（`{ player: ItemSlot[]; enemy: ItemSlot[] }`）、`AIContext.teamInventory?: ItemSlot[]` 追加 |

### 2. 新規スコアリングファイル

#### `utils/ai/scoring/itemUsage.ts`
9 種類のアイテムを実装。`remainingTurns <= 3` で全閾値を半減。

| アイテム | 発動条件 | スコア |
|---------|---------|-------|
| 照明弾 (flare) | probabilityMap 高確率タイル(>0.5)が 3 つ以上 or アサシン可視 | +90 |
| 縦断爆撃 (carpet_bombing) | 敵HP合計≥1500 or 味方HP<50% | +150 |
| EMP手榴弾 (emp_grenade) | 3マス以内に敵2体以上 | +70 |
| 補給パック (supply_pack) | 味方HP<40% | +80 |
| ドローン偵察 (drone_recon) | 未索敵エリア≥50% | +60 |
| 地雷 (land_mine) | 敵主力の進路上 | +50 |
| 迷彩ネット (camo_net) | 低HP味方がスナイパー射程内 | +65 |
| 煙幕 (smoke_screen) | 複数味方がスナイパー射程内 | +55 |
| 仮設バリケード (barricade) | 防衛ミッション (survival/time_limit) | +45 |

**閾値半減（残り3ターン）の変化例:**
- 補給パック: HP<40% → HP<80%
- 縦断爆撃: 敵HP合計≥1500 → ≥750、味方HP<50% → <75%
- EMP手榴弾: 3マス内2体 → 4マス内1体
- 照明弾: 高確率タイル3個以上 → 2個以上

#### `utils/ai/scoring/skillUsage.ts`
5 種類の汎用スキルを実装（クールダウン・残使用回数を二重確認）。

| スキル | 発動条件 | スコア |
|-------|---------|-------|
| 戦場の鼓舞 (battlefield_inspiration) | 3マス内味方3体以上 & 戦闘中 | +85 |
| 緊急修復 (emergency_repair) | 自身HP<40% | +75 |
| 防衛阻害 (defense_pierce) | 射程内の高防御(≥15)敵 | +90 |
| 疾風迅雷 (swift_thunder) | とどめ圏内 or 撤退必要(HP<25%) | +95 |
| 索敵妨害 (scout_jamming) | 可視敵スナイパー存在 | +70 |

`scout_marker` / `decoy` の加点は `unitSpecific.ts` に委譲（責務分担）。

### 3. `generateCandidates` 拡張

**useItem 候補生成（枝刈り込み）:**
- 各アイテムにつき最大1〜3候補（爆撃はepsilonグリッド重心1点など）
- `remainingUses === 0` は生成スキップ

**useSkill 候補生成（枝刈り込み）:**
- `cooldown > 0` または `remainingUses === 0` は生成スキップ
- `scout_marker`: 半径5以内の最近傍highland タイル1点
- `decoy`: 敵索敵範囲重複が最大のタイル1点（半径4以内）

### 4. unitSpecific.ts の正式実装置き換え

| ユニット | 変更前（近似） | 変更後（正式） |
|---------|-------------|-------------|
| エンジニア | 高地への移動 +15 | useSkill scout_marker (highland) +25、それ以外 +10 |
| イリュージョニスト | 森林への移動 +20 | useSkill decoy (敵索敵範囲内タイル) +20〜 |

**近似コードの削除**: 両者の `move` タイプに対するボーナスを完全に削除。

### 5. AIController.ts 更新

`EVALUATORS` リストに `itemUsageEvaluator` と `skillUsageEvaluator` を追加。  
`buildAIContext` で `snapshot.teamInventory?.enemy` を `AIContext.teamInventory` へ引き渡し。

### 6. バグ修正（既存）

`hooks/useAI.ts` で `plan.actions` → `result.plan.actions` に修正  
（`executeAITurn` が返す `TurnResult` 型と一致していなかった）。

---

## テスト結果

```
PASS utils/ai/__tests__/phase5.test.ts (17 テスト)
PASS utils/ai/__tests__/phase4.test.ts (既存: 影響なし)
PASS utils/ai/__tests__/aiBehavior.test.ts (既存: 影響なし)
PASS utils/ai/__tests__/scoring.test.ts (既存: 影響なし)

Tests: 84 passed, 84 total
TypeScript: 0 errors (npx tsc --noEmit)
```

---

## 仕様との乖離・判断事項

### [決定] アイテム管理はチーム単位
仕様書「持ち込みアイテムの選択」を「チーム単位」と解釈。  
`GameStateSnapshot.teamInventory: { player: ItemSlot[]; enemy: ItemSlot[] }` で管理。  
AIContext には `teamInventory?: ItemSlot[]`（AI チーム分のみ）を渡す。

### [決定] moveAndAttack はフェーズ5外
型定義(`AIActionType`)に存在するが候補生成なし。フェーズ5に含めず別途相談。

### [仕様に対し緩和] defense_pierce の「高防御」閾値
仕様書に数値記載なし。実装では `defense >= 15` を採用（ユニット基本値からの推定）。  
調整が必要な場合は `constants/unitStats.ts` に定数化推奨。

### [仕様に対し追加] swift_thunder の撃破判定
「攻撃力の 1.5 倍以内の HP」を撃破圏内と判定。乱数ブレを考慮したマージン。

### [仕様外対応] barricade の protect_hq
仕様書に `protect_hq` ミッションタイプが記載されているが `VictoryCondition` 型に未定義。  
`survival` および `time_limit` で代替。`protect_hq` を追加する場合は `types/map.ts` を更新のこと。

### [維持] probabilityMap の順序
「イベント適用→拡散→再ピン」の順序は `probabilityMap.ts` で維持。

### [維持] tieBreaker の4優先度+シード乱数
変更なし。

### [維持] safetyScore のHP依存スケーリング
変更なし。

### [維持] targetPriority と attackScore の責務分担
変更なし。

---

## 残課題（フェーズ6以降）

| 課題 | 優先度 |
|-----|-------|
| moveAndAttack 候補生成 | 中 |
| グループ戦術 (pincerBonus / formationBonus / isolationPenalty) | 高 |
| protect_hq ミッションタイプの追加 | 低 |
| defense_pierce 閾値の定数化 | 低 |
| アイテム使用後の remainingUses 更新（Redux アクション） | 中 |
| スキル使用後の cooldown リセット（Redux アクション） | 中 |
