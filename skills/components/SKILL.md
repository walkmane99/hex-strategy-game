# SKILL: React Native コンポーネント作成ガイド

## 対象ファイル
- `components/hex/` — 6角形グリッドコンポーネント
- `components/units/` — ユニット表示コンポーネント
- `components/battle/` — 戦闘UI コンポーネント
- `components/ui/` — 汎用UIコンポーネント

---

## 1. 環境制約 (Expo Go)

### 使用可能なライブラリ
```
react-native (core)
expo-*  (公式 Expo SDK)
react-native-reanimated   # アニメーション
react-native-gesture-handler  # ジェスチャー
react-native-game-engine　# 物理演算
react-native-svg          # SVG描画 (ヘックスグリッド)
@reduxjs/toolkit          # 状態管理
react-redux
expo-router               # ナビゲーション
```

### 絶対に使用禁止
- `react-native-skia` (Expo Go 非対応)
- ネイティブモジュールを含む未管理パッケージ
- `require()` での動的画像読み込み (静的 `import` を使用)

---

## 2. 6角形グリッド実装 (HexGrid.tsx)

### SVG を使った実装パターン
```typescript
import Svg, { Polygon, G, Text } from 'react-native-svg';

const HEX_SIZE = 36;

// flat-top 六角形の頂点座標
function hexCorners(cx: number, cy: number, size: number): string {
  const angles = [0, 60, 120, 180, 240, 300];
  return angles
    .map(deg => {
      const rad = (Math.PI / 180) * deg;
      return `${cx + size * Math.cos(rad)},${cy + size * Math.sin(rad)}`;
    })
    .join(' ');
}

export const HexCell: React.FC<HexCellProps> = React.memo(({
  hex, terrain, unit, isSelected, isReachable, isVisible, onPress
}) => {
  const { x, y } = hexToPixel(hex);
  const fill = getTerrainColor(terrain, isVisible);
  const stroke = isSelected ? '#FFD700' : isReachable ? '#00FF88' : '#444';
  const strokeWidth = isSelected || isReachable ? 2 : 0.5;

  return (
    <G onPress={() => onPress(hex)}>
      <Polygon
        points={hexCorners(x, y, HEX_SIZE)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {unit && <UnitIcon x={x} y={y} unit={unit} />}
    </G>
  );
});
```

### タッチ対応スクロール
```typescript
// PanResponder でドラッグスクロール
import { PanResponder, Animated } from 'react-native';

const pan = useRef(new Animated.ValueXY()).current;
const panResponder = PanResponder.create({
  onMoveShouldSetPanResponder: () => true,
  onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
    useNativeDriver: false,
  }),
});
```

---

## 3. コンポーネント作成テンプレート

### 標準コンポーネント
```typescript
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { useAppSelector, useAppDispatch } from '@/hooks/redux';

interface Props {
  // 必須 props は明示的に型定義
  id: string;
  onPress?: () => void;
}

export const ComponentName: React.FC<Props> = React.memo(({ id, onPress }) => {
  const dispatch = useAppDispatch();
  const data = useAppSelector(state => state.game.someData);

  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.button}>
        <Text style={styles.text}>...</Text>
      </Pressable>
    </View>
  );
});

ComponentName.displayName = 'ComponentName'; // デバッグ用

const styles = StyleSheet.create({
  container: {
    // flexbox ベース
  },
  button: {
    // Pressable には hitSlop を設定
    hitSlop: 8,
  },
  text: {
    // フォントサイズはスケール対応
  },
});
```

---

## 4. ユニットカード (UnitCard.tsx)

```typescript
export const UnitCard: React.FC<{ unit: Unit; isSelected: boolean }> = React.memo(
  ({ unit, isSelected }) => {
    const borderColor = isSelected ? COLORS.selected : COLORS.border;
    
    return (
      <View style={[styles.card, { borderColor }]}>
        {/* ユニットアイコン */}
        <UnitSprite type={unit.type} size={48} />
        {/* ステータスバー */}
        <HPBar current={unit.currentHP} max={unit.maxHP} />
        {/* ユニット名 */}
        <Text style={styles.name}>{UNIT_NAMES[unit.type]}</Text>
      </View>
    );
  }
);
```

---

## 5. アニメーション

### react-native-reanimated を使う
```typescript
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, withSpring
} from 'react-native-reanimated';

// ダメージ数値のポップアップ
export const DamageNumber: React.FC<{ damage: number }> = ({ damage }) => {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(0, { duration: 1000 });
    translateY.value = withTiming(-50, { duration: 1000 });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[styles.damage, style]}>
      {damage}
    </Animated.Text>
  );
};
```

---

## 6. カラーパレット

```typescript
// constants/colors.ts
export const COLORS = {
  // 地形
  terrain: {
    plain:    '#8DB87A',
    highland: '#A0896B',
    forest:   '#3D6B47',
    water:    '#4A90D9',
    building: '#7A7A8A',
    rubble:   '#8A7A6A',
  },
  // 陣営
  player:   '#4A90D9',  // 青
  enemy:    '#D94A4A',  // 赤
  neutral:  '#888888',
  // UI
  selected: '#FFD700',
  reachable: '#00FF88',
  attackable: '#FF6B6B',
  // テキスト
  text:     '#FFFFFF',
  textDark: '#1A1A2E',
  // 背景
  bg:       '#1A1A2E',
  surface:  '#16213E',
  card:     '#0F3460',
};
```

---

## 7. パフォーマンスチェックリスト

- [ ] 全コンポーネントに `React.memo()` を適用
- [ ] イベントハンドラは `useCallback` でメモ化
- [ ] 重い計算は `useMemo` で結果をキャッシュ
- [ ] `FlatList` に `keyExtractor` と `getItemLayout` を設定
- [ ] SVGは `shouldRasterizeIOS` / `renderToHardwareTextureAndroid` を検討
- [ ] 不要な再レンダリングを `React DevTools` で確認

## 8. よくある問題

| 問題 | 原因 | 解決策 |
|-----|------|-------|
| タッチが反応しない | `overflow: hidden` が伝播を止めている | `hitSlop` を設定する |
| SVGがぼやける | サイズ指定漏れ | `viewBox` と `width/height` を明示 |
| キーボードがレイアウトを崩す | `KeyboardAvoidingView` 不足 | 入力フォームに適用 |
| リストが遅い | `FlatList` 未使用 | `ScrollView` を `FlatList` に変更 |
