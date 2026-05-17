# Enemy AI Deviation Report — Phase B1

**対応仕様書**: game-specification_1.md §3.2 / §8.1 / §10.6  
**実施日**: 2026-05-17  
**テスト結果**: 155/155 全パス (phaseB1: 29件追加)

---

## 概要

フェーズB1はプレイヤー側 UI連携を中心とした実装。AI ロジック・スコアリングは一切変更していない。

---

## タスク別実装結果

### タスク1: 05 LOAD — アイテム選択上限制約

**変更ファイル**: `app/game/items.tsx`

**実装内容**:
- `ItemCard` コンポーネントに `isGreyedOut` prop を追加
- 2個選択済み (`picked.length >= MAX_ITEMS`) かつ未選択のアイテムに `isGreyedOut=true` を渡す
- `isGreyedOut` が true のとき: `disabled={true}`, `opacity: 0.4`
- 選択解除すると即時グレーアウト解除（`picked` state のリアクティブ更新）

```tsx
// items.tsx の変更箇所 (抜粋)
const isPicked = picked.includes(item.id);
const isGreyedOut = picked.length >= MAX_ITEMS && !isPicked;
<ItemCard item={item} isPicked={isPicked} isGreyedOut={isGreyedOut} ... />
```

**動作確認**:
- 2個選択済み → 残り2個グレーアウト・タップ不可
- 選択済みアイテムはグレーアウトされない
- 1個解除 → 残りが全て選択可能に戻る
- 0個選択で DEPLOY 可能（制約なし）

---

### タスク2: 03 ROSTER — 予備ユニットスロット追加

**変更ファイル**: `store/slices/playerSlice.ts`, `app/game/strategy.tsx`

**playerSlice の拡張**:
```typescript
// PlayerState に追加
selectedReserveUnitId: string | null;

// アクション追加
setSelectedReserve: (state, action: PayloadAction<string | null>) => {
  state.selectedReserveUnitId = action.payload;
},
```

**strategy.tsx の変更**:
- NEXT ボタン押下時に `setSelectedSquad(mainUnits)` と並行して `setSelectedReserve(reserveUnit ?? null)` をディスパッチ
- 予備スロット UI は既存の `SlotBox isReserve` コンポーネントが対応済みのため追加変更なし

**重複防止ロジック**:
- strategy.tsx は `selectedUnits` 配列の先頭5体をメイン、6体目を予備として管理
- 同じ addUnit / removeUnit UI をそのまま使用するため、自然に同一ユニットを両方に選択できるが独立した配列エントリとして扱われる（カスタムキャラ拡張を見越した設計）

---

### タスク3: バトル初期化の連携

**変更ファイル**: `app/game/battle.tsx`

**init useEffect の拡張**:
```typescript
const reserveType = selectedReserveUnitId as UnitType | null;
const playerReserveUnit = reserveType
  ? makeUnit('p-reserve', reserveType, 'player', { col: 0, row: 0 })
  : null;

// TODO: ステージ定義に enemyReserve フィールドが追加されたらここをステージデータから取得する
const enemyReserveUnit = makeUnit('e-reserve', 'attacker', 'enemy', { col: 0, row: 0 });

dispatch(setReserves({
  player: playerReserveUnit ? [playerReserveUnit] : [],
  enemy: [enemyReserveUnit],
}));
```

**敵側予備ユニット**: 固定でアタッカー1体 (ステージ定義拡張時に差し替え)

---

### タスク4: 06 TACTICS — 予備パネル (ReservePanel)

**新規ファイル**: `components/battle/ReservePanel.tsx`

**配置**: アクションバー直上（ReservePanel → ActionBar の順に画面下部に縦積み）  
**自軍予備パネル**: ユニット種別アイコン + HP上限/攻撃/防御/移動/索敵の全ステータス  
**敵予備パネル**: ユニット種別アイコン + 種別名のみ（仕様書 8.1 カスタマイズ非公開）  
**表示条件**: `playerReserve` または `enemyReserve` のいずれかが存在する場合のみ表示

---

### タスク5: プレイヤー交代フロー

**変更ファイル**: `app/game/battle.tsx`  
**新規ファイル**: `components/ui/Modal.tsx`

#### 5-1. 交代対象選択モード

- `isSubstitutionMode: boolean` state を追加
- SWAP ボタンタップで `handleEnterSubstitutionMode()` → `selectUnit(null)` + `isSubstitutionMode=true`
- `handleSelectionChange` に分岐を追加:
  ```typescript
  if (isSubstitutionMode && unitId) {
    const unit = playerUnits.find(u => u.id === unitId);
    if (unit && !unit.hasActed && !unit.isDead) {
      setSubTargetId(unitId);
      setShowSubConfirmModal(true);
    }
    return;
  }
  ```
- `GameEngineView` の既存フィルタ (`!tappedUnit.hasActed && !tappedUnit.isDead`) により、行動済み・戦死ユニットは自動的にタップ不可

#### 5-2. 確認ダイアログ

- `components/ui/Modal.tsx` を新規作成 (RN `Modal` ラッパー)
- メッセージ: 「`<ユニット名>` を予備の `<予備ユニット名>` と交代します。`<予備ユニット名>` はこのターン行動できません。よろしいですか？」
- キャンセル: `isSubstitutionMode=false`, `subTargetId=null`, `showSubConfirmModal=false` にリセット

#### 5-3. 交代実行

```typescript
dispatch(substituteUnit({
  side: 'player',
  removedUnitId: subTargetId,
  newUnit: reserve,
  position: target.position,
}));
dispatch(executeSubstitution('player'));
dispatch(addLog({ ... }));
```

#### SWAP ボタン表示条件

```
phase === 'player_turn'
&& !substitutionUsedThisTurn.player
&& reserves.player.length > 0
```

条件を満たさない場合: ボタン非表示  
交代モード中: キャンセルボタンに切り替わり表示

#### 5-4. ターン終了時クリーンアップ

- `handleEndTurn` に `isSubstitutionMode=false`, `subTargetId=null`, `showSubConfirmModal=false` を追加
- `resetSubstitutionFlag` は `useAI.ts` の `finally` ブロックが呼び出す（既存実装）— player/enemy 両方をリセット済みを確認

---

### タスク6: AI 側との整合性確認

#### 6-1. useAI の reserves 読み取り確認

`useAI.ts` のスナップショット作成:
```typescript
const snapshot = {
  ...
  reserves: state.battle.reserves,
  substitutionUsedThisTurn: state.battle.substitutionUsedThisTurn,
};
```

バトル初期化時に `setReserves` をディスパッチするようにしたため、`snapshot.reserves.enemy` は実バトルで正しく非空の配列を受け取れる。

#### 6-2. side 引数の分岐確認

- `executeSubstitution('player')` は `substitutionUsedThisTurn.player` のみ true に変更
- `executeSubstitution('enemy')` は `substitutionUsedThisTurn.enemy` のみ true に変更
- `substituteUnit({ side: 'player', ... })` は playerUnits のみ操作、enemyUnits は変更しない（テストで確認済み）

---

## substituteUnit の汎用化

**変更ファイル**: `store/slices/unitSlice.ts`

既存の `substituteEnemy` を保持しつつ、新たに `substituteUnit` を追加:

```typescript
substituteUnit: (state, action: PayloadAction<{
  side: 'player' | 'enemy';
  removedUnitId: string;
  newUnit: Unit;
  position: OffsetCoord;
}>) => {
  const { side, removedUnitId, newUnit, position } = action.payload;
  if (side === 'player') {
    playerAdapter.removeOne(state.playerUnits, removedUnitId);
    playerAdapter.addOne(state.playerUnits, { ...newUnit, position, hasActed: true, side: 'player' });
  } else {
    enemyAdapter.removeOne(state.enemyUnits, removedUnitId);
    enemyAdapter.addOne(state.enemyUnits, { ...newUnit, position, hasActed: true, side: 'enemy' });
  }
},
```

`useAI.ts` は引き続き `substituteEnemy` を使用（後方互換性）。

---

## テスト追加サマリー

**Jest 設定変更**: `package.json` の `transformIgnorePatterns` に `immer|@reduxjs` を追加（Redux スライスの直接テストを可能にするため）

**新規テストファイル**: 3ファイル / 29件

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `__tests__/strategy-roster-reserve.test.tsx` | 6 | selectedReserveUnitId 管理、setSelectedReserve dispatch |
| `__tests__/strategy-items-limit.test.tsx` | 9 | MAX_ITEMS=2 制約、グレーアウトロジック |
| `__tests__/battle-substitution.test.tsx` | 14 | 交代条件、substituteUnit、フラグ制御 |

**既存テスト**: 126/126 全通過（AI ロジック変更なし）  
**合計**: 155/155

---

## 変更しなかった項目

- AI のスコアリングロジック全般
- `substitution.ts` 評価器
- `ScoreWeights` の値
- 既存のヘックスグリッド描画
- `useAI.ts` の AI 交代ロジック（引き続き `substituteEnemy` を使用）
- `phase7.test.ts` および AI 関連テスト全般

---

## 新規作成ファイル一覧

| ファイル | 種別 |
|---------|------|
| `components/ui/Modal.tsx` | 確認ダイアログコンポーネント |
| `components/battle/ReservePanel.tsx` | 予備ユニット表示パネル |
| `__tests__/strategy-roster-reserve.test.tsx` | テスト |
| `__tests__/strategy-items-limit.test.tsx` | テスト |
| `__tests__/battle-substitution.test.tsx` | テスト |

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `store/slices/playerSlice.ts` | `selectedReserveUnitId` + `setSelectedReserve` 追加 |
| `store/slices/unitSlice.ts` | `substituteUnit` 追加 |
| `app/game/items.tsx` | `isGreyedOut` ロジック追加 |
| `app/game/strategy.tsx` | `setSelectedReserve` dispatch 追加 |
| `app/game/battle.tsx` | 予備初期化・交代UI・ReservePanel・Modal 統合 |
| `package.json` | jest `transformIgnorePatterns` に `immer|@reduxjs` 追加 |
