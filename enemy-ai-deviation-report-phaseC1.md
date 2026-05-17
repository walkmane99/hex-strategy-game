# Enemy AI Deviation Report — Phase C1

**対応仕様書**: game-specification_1.md §5.1（ダメージ計算）/ §7.4（勝利条件）  
**実施日**: 2026-05-17  
**テスト結果**: 206/206 全パス (phaseC1: 30件追加)

---

## 概要

フェーズC1はダメージ計算・HP蓄積・勝敗判定の完全プレイアブル化。  
AI攻撃とプレイヤー攻撃を共通の `performAttack` 関数に統一し、将来のアニメーション層向けに `BattleEvent` キューを導入した。

---

## タスク別実装結果

### タスク1: `BattleEvent` 型定義追加

**変更ファイル**: `types/battle.ts`

**実装内容**:
- `BattleEvent` 判別共用体型を追加（`attack` / `heal` / `death` の3種）
- `heal` 型は今フェーズ未使用だが、ヒーラー実装時に再利用できるよう先行定義

```typescript
export type BattleEvent =
  | { type: 'attack'; attackerId: string; defenderId: string; damage: number; affinity: ...; isKill: boolean; timestamp: number; }
  | { type: 'heal'; healerId: string; targetId: string; amount: number; timestamp: number; }
  | { type: 'death'; unitId: string; side: 'player' | 'enemy'; timestamp: number; };
```

---

### タスク2: `battleSlice` に BattleEvent キュー追加

**変更ファイル**: `store/slices/battleSlice.ts`

**実装内容**:
- `BattleState` に `pendingBattleEvents: BattleEvent[]` フィールド追加
- `addBattleEvent` / `consumeBattleEvent` / `clearBattleEvents` の3アクション追加

**消費方針**: 今フェーズはキューに積むだけ。C2フェーズで `BattleEventDispatcher` が購読してアニメーション再生後に `consumeBattleEvent` を呼ぶ。

---

### タスク3: `gameSlice` に `endBattle` / `outcomeReason` 追加

**変更ファイル**: `store/slices/gameSlice.ts`

**実装内容**:
- `GameState` に `outcomeReason: string | null` 追加
- `endBattle({ winner, reason })` アクション追加（`setGameOver` の上位互換）
- `resetGameOutcome` アクション追加

**既存コードとの関係**:  
`setGameOver` は既存コードで使われているため削除せず維持。`endBattle` を新規アクションとして追加し、勝敗理由を文字列で保持できるようにした。

---

### タスク4: `performAttack.ts` 新規実装

**新規ファイル**: `utils/battle/performAttack.ts`

**実装内容**:
- プレイヤー/AI 共通の攻撃実行関数
- `calculateDamage` は既存シグネチャ `(attacker, defender, terrain, auraAtk, auraDef)` を使用（戻り値 `{damage, affinity}` を利用）
- `applyDamage` → `addBattleEvent(attack)` → `addBattleEvent(death)?` の順でディスパッチ

**プランからの変更点**:
- プランでは `calculateDamage(attacker, defender, terrain, affinity)` を想定していたが、既存実装は `(attacker, defender, terrain, auraAtk, auraDef)` シグネチャで内部で `checkAffinity` を呼ぶ設計。`calculateDamage(attacker, defender, terrain, 0, 0)` として呼び出し、戻り値の `affinity` を利用する形に適応した。

---

### タスク5: `victoryCheck.ts` 拡張

**変更ファイル**: `utils/battle/victoryCheck.ts`

**既存コードの状態**: 既に実装済み（`elimination` / `survival` / `time_limit` / `supply_line`）

**追加実装**:
- `escape` 条件（キーユニットが脱出タイル到達）
- `protect_hq` 条件（敵が拠点占拠 or ターン上限到達）
- `missionMetadata?: MissionMetadata | null` オプション引数追加（後方互換性維持）
- 「全プレイヤー撃破」の共通敗北条件を `switch` 前に集約（旧コードは各 case に分散）

**プランからの変更点**:
- 既存テスト (`phase8b.test.ts`) が旧シグネチャ `(victoryCondition, playerUnits, enemyUnits, currentTurn, turnLimit)` を使用しているため、引数順序を維持しオプション引数として追加した（プランのシグネチャ変更は採用せず）

---

### タスク6: `HPBar.tsx` 新規実装

**新規ファイル**: `components/battle/HPBar.tsx`

**実装内容**:
- 汎用 HPBar コンポーネント（`current` / `max` / `width` / `showText` props）
- HPカラー: >50% → 緑、25-50% → オレンジ、<25% → 赤

**UnitToken.tsx との関係**:  
`UnitToken.tsx` は既に inline HP バーを持っていた。`HPBar.tsx` は将来的なパネル表示等に使用できる汎用コンポーネントとして実装。`UnitToken.tsx` の inline バーは既存実装を維持した（重複だが動作確認済みの UI を変更するリスクを避けた）。

---

### タスク7: `UnitToken.tsx` — isDead 時の灰色化

**変更ファイル**: `components/battle/UnitToken.tsx`

**変更内容**:
- 旧実装: `isDead === true` のとき `return null`（画面から消える）
- 新実装: `isDead === true` のとき `opacity: 0.25`・背景/枠を灰色・`pointerEvents="none"` で透過表示

**理由**: 撃破演出（フェードアウト等、C2予定）の拡張ポイントとして維持。現フェーズでは即座に灰色表示になる。

---

### タスク8: `battle.tsx` — performAttack 経由統一 + 勝敗判定 useEffect

**変更ファイル**: `app/game/battle.tsx`

**実装内容**:

1. `handleAttackEnemy` を `performAttack` 経由に変更
   - 直接 `calculateDamage` + `applyDamage` を呼んでいた箇所を `performAttack(attacker, target, terrain, 'enemy', dispatch)` に置換
   - 返り値の `AttackResult` から `damage` / `affinity` を取得してログ・CombatEvent を構成

2. 勝敗判定 useEffect を追加
   - `playerUnits` / `enemyUnits` / `currentTurn` が変化するたびに `checkVictory` を呼ぶ
   - 勝敗確定時に `endBattle` と `addLog` をディスパッチ

**既存コードとの関係**:  
`battle.tsx` には既に攻撃モード (`actionPhase = 'attack_ready'`) が実装済みだった。プランの「攻撃モード state machine 追加」は不要で、既存の `handleAttackEnemy` のロジックを `performAttack` に差し替えるのみで対応できた。

---

### タスク9: `useAI.ts` — performAttack 経由統一

**変更ファイル**: `hooks/useAI.ts`

**変更内容**:
- `case 'attack'` ブロックで直接呼んでいた `calculateDamage` + `applyDamage` を `performAttack` に置換
- `calculateDamage` / `applyDamage` の import を削除
- ログに `result.affinity` を追加

---

### タスク10: テスト実装

**新規ファイル**:
- `utils/battle/__tests__/performAttack.test.ts` (6件)
- `utils/battle/__tests__/victoryCheck.test.ts` (13件)
- `__tests__/battle-damage.test.tsx` (11件)

**合計新規テスト**: 30件 → 累計 **206テスト**

---

## プランからの主な乖離・判断記録

| 項目 | プラン記述 | 実際の実装 | 理由 |
|------|----------|------------|------|
| `calculateDamage` シグネチャ | `(attacker, defender, terrain, affinity)` | `(attacker, defender, terrain, 0, 0)` で既存実装を利用 | 既存 `calculateDamage` は内部で `checkAffinity` を呼ぶ設計のため |
| `victoryCheck.ts` API | 引数順序変更・`BattleOutcome` 型に変更 | 既存 `VictoryResult` 型・引数順序を維持しオプション引数を追加 | `phase8b.test.ts` の既存テストが旧 API を使用しているため後方互換性を優先 |
| `HPBar.tsx` と UnitToken | HPBar をトークンに埋め込む | HPBar は standalone として作成、UnitToken は inline バーを維持 | 既存動作するバーを変更するリスクを避けた |
| 攻撃モード実装 | battle.tsx に新規 state machine 追加 | 既実装済みの `actionPhase='attack_ready'` ロジックをそのまま活用 | B1フェーズで既に実装されていた |
| `BattleOutcome` 型 | 新規型 `BattleOutcome` を定義 | 既存 `VictoryResult` 型を拡張して使用 | 型の重複を避けた |
| テスト数 | 約33件 | 30件 | 一部の重複テスト（死亡ユニットのattackable除外）は pure function テストでカバー |

---

## 動作確認

**テスト (206/206パス)**:
- `performAttack`: applyDamage 適用・BattleEvent キュー積み・death イベント・isKill 正確性・side 振り分け・affinity 反映
- `victoryCheck`: 殲滅戦・生存戦・脱出戦・時間切れ・拠点防衛・補給線・敗北条件・ongoing
- `battle-damage`: applyDamage HP減少・isDead=true・performAttack 統合・checkVictory 連携・endBattle dispatch

**型チェック**: `npx tsc --noEmit` エラーなし

---

## 残課題（C2以降）

| 課題 | 優先度 |
|------|-------|
| 07 ENGAGE画面（VS演出 + ダメージプレビュー） | 中 |
| `BattleEventDispatcher.tsx` で `pendingBattleEvents` を購読してアニメーション再生 | 中 |
| 撃破時のフェードアウトアニメーション | 中 |
| ダメージ数値フロート表示 | 中 |
| 08 DEBRIEF画面 + 結果集計 | 中 |
| ヒーラー回復の `performHeal` ユーティリティ | 中 |
| アイテム使用の実行系（`consumeItem` との統合） | 中 |
| スキル発動の実行系 | 中 |
| 攻撃確認ダイアログ（オプション設定） | 低 |
