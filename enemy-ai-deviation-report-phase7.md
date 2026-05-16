# Enemy AI 乖離レポート — フェーズ7完了時点

作成日: 2026-05-16  
対象フェーズ: Phase 7（交代システム・前提条件修正）

---

## 前提条件の対応（フェーズ6残課題）

### 1. tickCooldowns('player') の実装

`app/game/battle.tsx` のプレイヤーターン開始エフェクト (`phase === 'player_turn' && isInitialized`) に
`dispatch(tickCooldowns('player'))` を追加。

### 2. setTeamInventory のバトル開始連携

#### playerSlice 追加

| ファイル | 追加アクション | 内容 |
|---------|-------------|------|
| `store/slices/playerSlice.ts` | `setSelectedItems(ItemType[])` | 出撃時アイテム選択を Redux に保存 |

#### items.tsx 更新

- `ITEM_ID_TO_TYPE` マッピング (IT-01〜IT-08 → ItemType) を追加
- DEPLOY ボタン: `dispatch(setSelectedItems(itemTypes))` → `router.push('/game/battle')`

#### battle.tsx 更新

- `selectedItems` を player state から取得
- 初期化 useEffect に `dispatch(setTeamInventory({ player: playerItemSlots, enemy: enemyItemSlots }))` を追加
- 敵デフォルト: `[{ itemId: 'flare', remainingUses: 1 }, { itemId: 'supply_pack', remainingUses: 1 }]`

---

## フェーズ7: 交代システム (substitution)

### 実装ファイル

#### `utils/ai/scoring/substitution.ts` (新規)

| ルール | 条件 | スコア |
|-------|------|-------|
| 相性交代 | 控えユニットが可視敵のいずれかに有利相性 | +affinitySwapBonus (70) |
| 低HP交代 | 行動ユニット HP < 20% | +lowHpSubstituteBonus (50) |
| ヒーラー補充 | 控えがヒーラーかつ他にヒーラー不在 | +healerSupplementBonus (40) |
| 補給切れ | スキルが全CD中/使い切り かつ teamInventory が空 | +supplyCutBonus (30) |
| 行動消費ペナルティ | 常に適用 | +substitutionActionLossPenalty (-30) |

**重要**: `supplyCutBonus` は `teamInventory` が `undefined` の場合は適用しない（定義済みで空配列の場合のみ発動）。スキルも未定義ユニットには発動しない。

#### `utils/ai/data/scoreWeights.ts` 追加

```typescript
affinitySwapBonus: 70,
lowHpSubstituteBonus: 50,
healerSupplementBonus: 40,
supplyCutBonus: 30,
substitutionActionLossPenalty: -30,
```

`ScoreWeights` インターフェースにも対応フィールドを追加。

### Redux 拡張

#### `store/slices/battleSlice.ts`

| 追加 | 内容 |
|-----|------|
| `reserves: { player: Unit[]; enemy: Unit[] }` | 各チームの控えユニット |
| `substitutionUsedThisTurn: { player: boolean; enemy: boolean }` | ターン内交代済みフラグ |
| `setReserves({ player, enemy })` | 控えユニット初期化 |
| `executeSubstitution('player' \| 'enemy')` | 交代実施フラグを立てる |
| `resetSubstitutionFlag()` | ターン終了時にフラグリセット |

#### `store/slices/unitSlice.ts`

| 追加アクション | 内容 |
|-------------|------|
| `substituteEnemy({ removedUnitId, newUnit, position })` | 敵ユニットを控えと差し替え（`hasActed: true` で登録） |

### GameStateSnapshot / AIContext 拡張

```typescript
// GameStateSnapshot
reserves?: { player: Unit[]; enemy: Unit[] };
substitutionUsedThisTurn?: { player: boolean; enemy: boolean };

// AIContext
reserves?: Unit[];       // AI チームの控えユニット
canSubstitute?: boolean; // 今ターン交代可能か
```

`buildAIContext` が `snapshot.reserves?.enemy` と `snapshot.substitutionUsedThisTurn?.enemy` を読み取って設定。

### AIController の 交代前処理

```
Pre-turn (各ユニット): substitutionAvailable && enemyReserves.length > 0 の場合
  → 各 activeUnit に対して substitute 候補を生成し substitutionEvaluator で評価
  → score > 0 なら actions に追加、そのユニットを Layer1/2 の対象から除外
  → 1ターン1回のみ (break)

Layer 1 / Layer 2: substitutedUnitIds を除いたユニットのみ処理
```

### hooks/useAI.ts 追加

- snapshot に `reserves`, `substitutionUsedThisTurn` を追加
- `action.type === 'substitute'`: `substituteEnemy`, `executeSubstitution`, `addLog` を dispatch
- finally ブロックに `dispatch(resetSubstitutionFlag())` を追加

---

## テスト結果

```
Tests: 104 passed, 104 total (6 suites)
TypeScript: 0 errors
```

新規 phase7.test.ts: 10テスト
- 相性交代 (有/無): 2
- 低HP交代 (有/無): 2
- ヒーラー補充 (有/無): 2
- 補給切れ (差分検証): 1
- 行動消費ペナルティ (常時-30): 1
- executeAITurn 交代アクション確認: 1
- substitutionUsedThisTurn ガード: 1

---

## 仕様との乖離・判断事項

### [決定] supplyCutBonus の発動条件

仕様: "補給切れ時 +30"  
実装: `teamInventory` が `undefined` のときは発動しない（`= []` の場合のみ発動）。  
理由: undefined はインベントリ未設定（機能未有効化）を意味し、「使い切った」とは区別する。

### [決定] 交代ユニットの `hasActed: true`

仕様: "行動消費 -30"  
実装: `substituteEnemy` で新ユニットを `hasActed: true` で登録。同ターン内の行動は不可。

### [決定] 交代は 1 ターン 1 体

仕様: 明記なし  
実装: Pre-turn ループで最初に `score > 0` になったユニットが交代し即 `break`。  
理由: 複数交代の抑止（`substitutionUsedThisTurn` フラグは呼び出し元の hook で管理）。

### [簡略化] 「主要な敵」判定

仕様: "主要な敵に対する相性" → 近傍の高HP敵などを優先  
実装: `visibleEnemyUnits` 全体に対して判定（最初に `advantage` が見つかれば適用）。  
理由: 「主要な敵」の定義が曖昧なため。実用上の差は小さく、過度な複雑化を避けた。

### [継続] フェーズ5/6 の実装すべて

- 2層構造 (Layer 1 + Layer 2)
- tieBreaker の4優先度+シード乱数
- safetyScore のHP依存スケーリング
- groupTactics の各ボーナス
- probabilityMap の順序

---

## 残課題（フェーズ8以降）

| 課題 | 優先度 |
|-----|-------|
| setReserves のバトル開始連携 (戦略フェーズから控えを設定) | 中 |
| プレイヤー側交代 (swap_reserve) の UI 実装 | 中 |
| moveAndAttack 候補生成 | 中 |
| vanguardBonus の Cube ベクトル精密化 | 低 |
| concentratedAttackBonus の "2体目以降" 精確化 | 低 |
