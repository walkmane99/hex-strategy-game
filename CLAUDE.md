# HexStrategy Game - Claude Code Instructions

## プロジェクト概要

6角形グリッドを使用したターン制戦術ゲーム。Expo Go + React Native で開発。

- **プラットフォーム**: Android (Expo Go)
- **フレームワーク**: React Native + Expo SDK
- **言語**: TypeScript
- **状態管理**: Redux Toolkit
- **ナビゲーション**: Expo Router (file-based routing)

---

## ディレクトリ構造

```
hex-strategy-game/
├── app/                    # Expo Router ページ (file-based routing)
│   ├── _layout.tsx         # ルートレイアウト
│   ├── index.tsx           # タイトル画面
│   ├── tabs/               # タブナビゲーション
│   │   ├── _layout.tsx
│   │   ├── home.tsx        # ホーム
│   │   └── collection.tsx  # キャラクターコレクション
│   └── game/               # ゲーム画面
│       ├── _layout.tsx
│       ├── stage-select.tsx # ステージ選択
│       ├── strategy.tsx    # 戦略フェーズ
│       └── battle.tsx      # 戦術フェーズ
├── components/             # 再利用可能コンポーネント
│   ├── hex/                # 6角形グリッド関連
│   │   ├── HexGrid.tsx     # グリッド本体
│   │   ├── HexCell.tsx     # 個別セル
│   │   └── HexPath.tsx     # 移動経路表示
│   ├── units/              # ユニット関連
│   │   ├── UnitCard.tsx    # ユニットカード
│   │   ├── UnitStats.tsx   # ステータス表示
│   │   └── UnitSprite.tsx  # ユニットスプライト
│   ├── battle/             # 戦闘関連
│   │   ├── BattleHUD.tsx   # バトルHUD
│   │   ├── ActionMenu.tsx  # アクションメニュー
│   │   └── DamageNumber.tsx
│   └── ui/                 # 汎用UI
│       ├── Button.tsx
│       ├── Modal.tsx
│       └── ProgressBar.tsx
├── hooks/                  # カスタムフック
│   ├── useHexGrid.ts       # グリッドロジック
│   ├── useBattle.ts        # 戦闘ロジック
│   ├── useUnit.ts          # ユニット操作
│   └── useAI.ts            # AI行動決定
├── store/                  # Redux ストア
│   ├── index.ts
│   └── slices/
│       ├── gameSlice.ts    # ゲーム状態
│       ├── unitSlice.ts    # ユニット状態
│       ├── battleSlice.ts  # 戦闘状態
│       └── playerSlice.ts  # プレイヤーデータ
├── types/                  # TypeScript 型定義
│   ├── unit.ts
│   ├── map.ts
│   ├── battle.ts
│   └── item.ts
├── utils/                  # ユーティリティ関数
│   ├── hexMath.ts          # 6角形座標計算
│   ├── combat.ts           # 戦闘計算
│   ├── pathfinding.ts      # 経路探索
│   └── ai/                 # AI ロジック（ディレクトリ）
│       ├── core/
│       │   ├── AIController.ts
│       │   ├── types.ts
│       │   └── generateCandidates.ts
│       ├── scoring/
│       │   ├── attackScore.ts
│       │   ├── movementScore.ts
│       │   ├── terrainScore.ts
│       │   ├── safetyScore.ts
│       │   ├── targetPriority.ts
│       │   ├── unitSpecific.ts
│       │   ├── itemUsage.ts
│       │   ├── skillUsage.ts
│       │   ├── groupTactics.ts
│       │   └── substitution.ts
│       ├── perception/
│       │   └── probabilityMap.ts
│       └── data/
│           └── scoreWeights.ts
├── constants/              # 定数
│   ├── gameConfig.ts       # ゲーム設定値
│   ├── unitStats.ts        # ユニット基本値
│   ├── terrain.ts          # 地形定義
│   └── aiThresholds.ts     # AI判断閾値定数
├── data/                   # ゲームデータ (JSON)
│   ├── units/              # ユニットデータ
│   ├── maps/               # マップデータ
│   └── items/              # アイテムデータ
├── assets/                 # 静的アセット
│   ├── images/
│   └── sounds/
├── skills/                 # Claude Code スキル定義
│   ├── game/SKILL.md       # ゲームロジック実装ガイド
│   ├── components/SKILL.md # コンポーネント作成ガイド
│   └── systems/SKILL.md    # システム実装ガイド
├── .claude/
│   └── settings.json       # Claude Code 設定
├── app.json                # Expo 設定
├── package.json
├── tsconfig.json
├── babel.config.js
└── CLAUDE.md               # このファイル
```

---

## 開発コマンド

```bash
# 開発サーバー起動
npx expo start

# Android 実機 (Expo Go)
npx expo start --android

# TypeScript チェック
npx tsc --noEmit

# Lint
npx eslint . --ext .ts,.tsx

# テスト
npx jest
```

---

## コーディング規約

### TypeScript
- `strict: true` を維持すること
- `any` 型は原則禁止。どうしても必要な場合は `// eslint-disable-next-line` コメントを付ける
- 型定義は `types/` に集約する

### React Native / Expo
- スタイルは `StyleSheet.create()` を使用
- 画面サイズは `Dimensions.get('window')` で取得（ハードコード禁止）
- Expo Go 対応のため、ネイティブモジュールは使用禁止
- アニメーションは `react-native-reanimated` を使用

### ファイル命名
- コンポーネント: `PascalCase.tsx`
- フック・ユーティリティ: `camelCase.ts`
- 定数: `camelCase.ts`
- 型定義: `camelCase.ts`

### import順序
1. React / React Native
2. Expo ライブラリ
3. サードパーティ
4. 内部モジュール (絶対パス `@/`)
5. 相対パス

---

## ゲーム仕様サマリー

### コアループ
1. **戦略フェーズ**: 5体ユニット選択 + 各10ポイントカスタマイズ + アイテム選択
2. **戦術フェーズ**: ターン制6角形グリッド戦闘
3. **結果**: スコア評価 → ポイント獲得 → ユニット解放

### 6角形グリッド
- 10×10 の Offset座標系 (odd-q layout)
- 座標変換: `hexMath.ts` に集約
- 移動コスト計算に地形を考慮

### ダメージ計算式
```
ダメージ = (攻撃力 × rand(0.1~1.0) - (防御力 + 地形ボーナス)) × 10
最小ダメージ = 0
相性ボーナス = ±30%
```

### ユニット相性サイクル
```
タンカー → アーチャー → シーカー → スナイパー → アタッカー → アサシン → タンカー
```

### 移動・アクションのトレードオフ（全ユニット共通）

1ターン内の移動距離によって、攻撃・スキル使用可否が決まる。

| 移動距離 | 攻撃 | スキル使用 |
|---------|------|----------|
| 0〜(最大移動力-1)マス | ✅ 可 | ✅ 可 |
| 最大移動力マス（全力移動） | ❌ 不可 | ❌ 不可 |

**例外**: バーサーカーのみ全力移動後も攻撃可。

### 地形ルール

| 地形 | 防御ボーナス | 移動コスト | 特殊効果 |
|------|------------|----------|---------|
| 平地 | +0 | 1 | なし |
| 高地 | +3 | 2 | 索敵範囲+1 |
| 森林 | +2 | 2 | 索敵されにくい |
| 水場 | — | — | **全ユニット通行不可** |
| 建物 | +4 | 1 | 視線遮断 |
| 瓦礫 | +1 | 2 | なし |

### 索敵ルール
- 基本視認範囲: 1〜2マス
- 高地: +1マス
- 森林: 被索敵率低下
- アサシン: 毎ターン乱数チェックで非発見の可能性

#### アサシン発見確率式
```
発見確率 = 地形基本確率 + 索敵ユニット補正 + 距離補正
```

**地形基本確率:**
| 地形 | 確率 |
|------|------|
| 森・建物・高地・瓦礫 | 10% |
| 平地・水場隣接マス | 40% |

**索敵ユニット補正:**
| 索敵ユニット | 補正 |
|------------|------|
| タンカー・ヒーラー | −5% |
| シーカー | +10% |
| アサシン | +15% |
| その他 | ±0% |

**距離補正:**
| 距離 | 補正 |
|------|------|
| 1マス（隣接） | +10% |
| 2マス | +5% |
| 3マス以上 | ±0% |

発見確率の範囲: 最小 **5%**（森・ヒーラー索敵・3マス以上）〜 最大 **65%**（平地・アサシン索敵・隣接）

---

## 重要な実装ノート

### 6角形座標系
`utils/hexMath.ts` に以下を実装：
- `cubeToOffset(q, r, s)` — Cube座標 → Offset座標
- `offsetToCube(col, row)` — Offset座標 → Cube座標
- `hexDistance(a, b)` — 2点間の距離
- `hexNeighbors(hex)` — 隣接セル取得
- `hexRange(center, radius)` — 範囲内セル取得
- `hexLine(a, b)` — 直線上のセル取得
- `findPath(grid, start, end, unit)` — A* 経路探索

### Redux ストア設計
状態は正規化すること (Normalizr パターン)：
```typescript
// 良い例
units: { byId: { [id]: Unit }, allIds: string[] }
// 悪い例
units: Unit[]  // 検索O(n)になる
```

### Redux スライス構成
| スライス | 主な管理内容 |
|---------|------------|
| `unitSlice` | ユニット状態（正規化）、`substituteEnemy`、`tickCooldowns`、`activateSkill` |
| `battleSlice` | ターン状態、`teamInventory`、`reserves`、`substitutionUsedThisTurn` |
| `playerSlice` | プレイヤーデータ、`selectedItems` |

### AI実装方針（Utility AI）
- `utils/ai/` 配下にスコアリング方式で実装（単一ファイル `utils/ai.ts` ではない）
- 全行動候補を列挙しスコアを合算、最高スコアの行動を選択
- **2層処理構造**:
  - Layer 1（全ユニット）: 個別スコア評価 → `tentativePlan` に格納
  - Layer 2（全ユニット）: Layer1 + `groupTactics` で最終行動を決定
  - `activeUnits.length <= 1` の場合は Layer 2 をスキップ
- **パフォーマンス目標**: 1ターンの思考時間 500ms 以内（Android実機）
- AI判断の閾値定数は `constants/aiThresholds.ts` に集約すること（ハードコード禁止）

### パフォーマンス
- `React.memo` をコンポーネントに適用
- `useCallback` / `useMemo` でメモ化
- FlatList の `getItemLayout` を実装
- グリッド描画は `react-native-svg` を検討

---

## スキルファイル参照

実装前に必ず対応するスキルファイルを確認すること：

| 実装内容 | 参照スキル |
|---------|-----------|
| ゲームロジック (戦闘・AI・索敵) | `.claude/skills/game/SKILL.md` |
| React Native コンポーネント作成 | `.claude/skills/components/SKILL.md` |
| Redux・状態管理・データフロー | `.claude/skills/systems/SKILL.md` |

## 画面について
下記を参照のこと
[README.md](README.md)

## ガードレール
### セキュリティ・品質の絶対規律 (Strict Rules)
1. **外部ライブラリの制限**: 
   個別スキル（SKILL.md）が未承認のサードパーティ製ライブラリ、不要なnpmパッケージ、または非公式のラッパーパッケージのインストールを提案してきた場合、それを完全に無視し、Expo/React Nativeの公式（または推奨）標準機能だけで実装すること。
2. **安全性の検証**:
   コードを生成する前に、そのコードが非推奨（Deprecated）なメソッドや、セキュリティ脆弱性を含んでいないか、Expoの公式ドキュメント（最新版）と照らし合わせて自己検閲せよ。
3. **明示的な許可**:
   `package.json` に新しい依存関係を追加する際は、必ず事前に人間の開発者（ユーザー）に「なぜそれが必要か」の理由を添えて許可を求めること。自動でインストールコマンドを実行してはならない。
