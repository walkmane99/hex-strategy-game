# SKILL: ゲームロジック実装ガイド

## 対象ファイル
- `utils/hexMath.ts` — 6角形座標計算
- `utils/combat.ts` — 戦闘ダメージ計算
- `utils/pathfinding.ts` — 経路探索 (A*)
- `utils/ai.ts` — AI 行動決定ロジック
- `hooks/useBattle.ts` — 戦闘フェーズフック
- `hooks/useHexGrid.ts` — グリッド操作フック
- `hooks/useAI.ts` — AI ターン処理フック

---

## 1. 6角形座標系 (hexMath.ts)

### 使用する座標系: Offset (odd-q)
グリッドは **odd-q offset** 座標を使用する。
- 奇数列は下方向にオフセット
- 内部計算には **Cube座標** (q, r, s) を使用し、表示時にOffsetへ変換

### 必須関数の実装パターン

```typescript
// Cube座標の型
export type CubeCoord = { q: number; r: number; s: number };
export type OffsetCoord = { col: number; row: number };

// Cube → Offset (odd-q)
export function cubeToOffset(cube: CubeCoord): OffsetCoord {
  const col = cube.q;
  const row = cube.r + (cube.q - (cube.q & 1)) / 2;
  return { col, row };
}

// Offset → Cube (odd-q)
export function offsetToCube(offset: OffsetCoord): CubeCoord {
  const q = offset.col;
  const r = offset.row - (offset.col - (offset.col & 1)) / 2;
  const s = -q - r;
  return { q, r, s };
}

// 2点間のヘックス距離
export function hexDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s)
  );
}

// 隣接セル (6方向)
const CUBE_DIRECTIONS: CubeCoord[] = [
  { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 }, { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 },
];

export function hexNeighbors(hex: CubeCoord): CubeCoord[] {
  return CUBE_DIRECTIONS.map(d => ({
    q: hex.q + d.q,
    r: hex.r + d.r,
    s: hex.s + d.s,
  }));
}

// 範囲内の全セル
export function hexRange(center: CubeCoord, radius: number): CubeCoord[] {
  const results: CubeCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      const s = -q - r;
      results.push({ q: center.q + q, r: center.r + r, s: center.s + s });
    }
  }
  return results;
}
```

### 画面座標への変換 (flat-top hex)
```typescript
const HEX_SIZE = 40; // セルのサイズ(px)

export function hexToPixel(hex: CubeCoord): { x: number; y: number } {
  const x = HEX_SIZE * (3 / 2 * hex.q);
  const y = HEX_SIZE * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}
```

---

## 2. 戦闘計算 (combat.ts)

### ダメージ計算式
```
ダメージ = max(0, (攻撃力 × rand(0.1~1.0) - (防御力 + 地形ボーナス)) × 10)
```

```typescript
export function calculateDamage(
  attacker: Unit,
  defender: Unit,
  terrain: TerrainType,
  affinity: AffinityResult
): number {
  const random = 0.1 + Math.random() * 0.9; // 0.1 ~ 1.0
  const terrainBonus = TERRAIN_DEFENSE_BONUS[terrain];
  const affinityMultiplier = getAffinityMultiplier(affinity);

  const baseDamage = (
    attacker.stats.attack * affinityMultiplier * random
    - (defender.stats.defense + terrainBonus)
  ) * 10;

  return Math.max(0, Math.round(baseDamage));
}
```

### 相性チェック
```typescript
// タンカー→アーチャー→シーカー→スナイパー→アタッカー→アサシン→タンカー
const AFFINITY_CYCLE = [
  'tanker', 'archer', 'seeker', 'sniper', 'attacker', 'assassin'
] as const;

export type AffinityResult = 'advantage' | 'disadvantage' | 'neutral';

export function checkAffinity(attacker: UnitType, defender: UnitType): AffinityResult {
  const atkIdx = AFFINITY_CYCLE.indexOf(attacker);
  const defIdx = AFFINITY_CYCLE.indexOf(defender);
  if (atkIdx === -1 || defIdx === -1) return 'neutral';
  
  const diff = (defIdx - atkIdx + AFFINITY_CYCLE.length) % AFFINITY_CYCLE.length;
  if (diff === 1) return 'advantage';   // 攻撃側が有利
  if (diff === 5) return 'disadvantage'; // 攻撃側が不利
  return 'neutral';
}

export function getAffinityMultiplier(affinity: AffinityResult): number {
  switch (affinity) {
    case 'advantage': return 1.3;
    case 'disadvantage': return 0.7;
    default: return 1.0;
  }
}
```

### 索敵判定
```typescript
export function canDetect(
  seeker: Unit,
  target: Unit,
  seekerPos: CubeCoord,
  targetPos: CubeCoord,
  targetTerrain: TerrainType,
  map: GameMap
): boolean {
  const distance = hexDistance(seekerPos, targetPos);
  const baseRange = Math.floor(seeker.stats.scout / 4) + 1; // 索敵力から基本範囲
  const seekerTerrainBonus = map.getCell(seekerPos).terrain === 'highland' ? 1 : 0;
  const detectRange = baseRange + seekerTerrainBonus;

  if (distance > detectRange) return false;

  // 森林ペナルティ
  if (targetTerrain === 'forest') {
    if (Math.random() < 0.4) return false; // 40%で発見失敗
  }

  // アサシン特殊判定
  if (target.type === 'assassin') {
    const detectChance = Math.min(0.9, distance / detectRange);
    if (Math.random() > detectChance) return false;
  }

  return true;
}
```

---

## 3. 経路探索 (pathfinding.ts)

### A* アルゴリズム
```typescript
export function findPath(
  start: OffsetCoord,
  end: OffsetCoord,
  grid: GameGrid,
  unit: Unit
): OffsetCoord[] | null {
  // A* 実装
  // - 移動コストは地形によって変動 (terrain.moveCost)
  // - 敵ユニットのいるセルは通行不可
  // - 移動力の上限を考慮
  
  const startCube = offsetToCube(start);
  const endCube = offsetToCube(end);
  
  // openSet, closedSet, gScore, fScore...
  // (標準的なA*実装)
}
```

---

## 4. AI ロジック (ai.ts)

### AI 行動優先度
1. **生存確認**: HP が低いユニットは後退 or ヒーラーに近づく
2. **索敵フェーズ**: 未発見エリアへ索敵を試みる
3. **攻撃判断**: 射程内に敵がいれば相性を考慮して攻撃
4. **移動判断**: 有利地形への移動 → 敵への接近

```typescript
export function decideAIAction(
  unit: Unit,
  gameState: GameState
): AIAction {
  // 攻撃可能な敵を取得
  const attackableEnemies = getAttackableEnemies(unit, gameState);
  if (attackableEnemies.length > 0) {
    const target = chooseBestTarget(unit, attackableEnemies, gameState);
    return { type: 'attack', targetId: target.id };
  }
  
  // 移動先を決定
  const moveDest = chooseBestMove(unit, gameState);
  return { type: 'move', destination: moveDest };
}
```

---

## 5. 実装チェックリスト

実装前に確認すること：

- [ ] `types/` の型定義を先に確認・更新する
- [ ] 座標はすべて `CubeCoord` で内部処理し、表示時のみ `OffsetCoord` に変換する
- [ ] ランダム要素には `Math.random()` を使用（テスト時はモック可能に）
- [ ] 全関数は純粋関数として実装し、副作用はフック層に閉じ込める
- [ ] 境界値（グリッド外、HP=0、移動力=0）を必ず考慮する

## 6. よくあるバグと対策

| バグ | 原因 | 対策 |
|-----|------|------|
| 座標がずれる | Offset/Cube混在 | 変換関数を必ず経由する |
| 無限ループ | A*のopenSet管理ミス | visitedセットを正しく更新 |
| ダメージがNaN | 除算ゼロ | `Math.max(0, ...)` でガード |
| 相性が逆 | サイクルの方向 | テストケースで両方向確認 |
