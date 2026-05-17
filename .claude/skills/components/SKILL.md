# SKILL: React Native Component Creation Guide

## Target Files
- `components/hex/` — Hex grid components
- `components/units/` — Unit display components
- `components/battle/` — Battle UI components
- `components/ui/` — General-purpose UI components

---

## 1. Environment Constraints (Expo Go)

### Allowed Libraries
```
react-native (core)
expo-*  (official Expo SDK)
react-native-reanimated   # animation
react-native-gesture-handler  # gestures
react-native-game-engine  # physics
react-native-svg          # SVG rendering (hex grid)
@reduxjs/toolkit          # state management
react-redux
expo-router               # navigation
```

### Strictly Prohibited
- `react-native-skia` (not supported in Expo Go)
- Any unmanaged packages that include native modules
- Dynamic image loading via `require()` — use static `import` instead

---

## 2. Hex Grid Implementation (HexGrid.tsx)

### SVG-based Implementation Pattern
```typescript
import Svg, { Polygon, G, Text } from 'react-native-svg';

const HEX_SIZE = 36;

// Flat-top hexagon vertex coordinates
function hexCorners(cx: number, cy: number, size: number): string {
  const angles = [0, 60, 120, 180, 240, 300];
  return angles
    .map(deg => {
      const rad = (Math.PI / 180) * deg;
      return `${cx + size * Math.cos(rad)},${cy + size * Math.sin(rad)}`;
    })
    .join(' ');
}

// Tile visibility: 'unexplored' | 'visible' | 'explored'
// isGhost: true when this tile has a last-known-position ghost marker
export const HexCell: React.FC<HexCellProps> = React.memo(({
  hex, terrain, unit, isSelected, isReachable, visibility, isGhost, onPress
}) => {
  const { x, y } = hexToPixel(hex);

  // Terrain fill changes by visibility state
  const fill = getTerrainColor(terrain, visibility);
  const stroke = isSelected ? '#FFD700' : isReachable ? '#00FF88' : '#444';
  const strokeWidth = isSelected || isReachable ? 2 : 0.5;

  // In 'unexplored', render black — terrain shape still drawn for grid consistency
  // In 'explored', render dim terrain — no enemy unit tokens
  // In 'visible', render normally — all units shown
  const showUnit = unit && visibility === 'visible';
  const showGhost = isGhost && visibility === 'explored';

  return (
    <G onPress={() => onPress(hex)}>
      <Polygon
        points={hexCorners(x, y, HEX_SIZE)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {showUnit && <UnitIcon x={x} y={y} unit={unit} />}
      {showGhost && <GhostIcon x={x} y={y} />}
    </G>
  );
});
```

### Ghost Icon (Last Known Position Marker)
```typescript
// Rendered on explored plain tiles where an enemy was last seen
export const GhostIcon: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <Text
    x={x} y={y}
    fontSize={18}
    textAnchor="middle"
    alignmentBaseline="central"
    opacity={0.45}
    fill="#FF6B6B"
  >
    ?
  </Text>
);
```

### Terrain Passability Rules
**Water tiles are impassable for all units — no exceptions.**
- Never set `isReachable = true` for water tiles regardless of unit type.
- Apply this check in `pathfinding.ts` and also defensively in `HexCell` rendering.

```typescript
// pathfinding.ts
function isPassable(terrain: TerrainType, _unit: Unit): boolean {
  if (terrain === 'water') return false; // Impassable for ALL units
  return true;
}
```

### Touch-responsive Scrolling
```typescript
// Drag-scroll with PanResponder
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

## 3. Component Creation Template

### Standard Component
```typescript
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { useAppSelector, useAppDispatch } from '@/hooks/redux';

interface Props {
  // Explicitly type all required props
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

ComponentName.displayName = 'ComponentName'; // for debugging

const styles = StyleSheet.create({
  container: {
    // flexbox-based layout
  },
  button: {
    // Always set hitSlop on Pressable
    hitSlop: 8,
  },
  text: {
    // Use scalable font sizes
  },
});
```

---

## 4. Unit Card (UnitCard.tsx)

```typescript
export const UnitCard: React.FC<{ unit: Unit; isSelected: boolean }> = React.memo(
  ({ unit, isSelected }) => {
    const borderColor = isSelected ? COLORS.selected : COLORS.border;

    return (
      <View style={[styles.card, { borderColor }]}>
        {/* Unit icon */}
        <UnitSprite type={unit.type} size={48} />
        {/* HP bar */}
        <HPBar current={unit.currentHP} max={unit.maxHP} />
        {/* Unit name */}
        <Text style={styles.name}>{UNIT_NAMES[unit.type]}</Text>
      </View>
    );
  }
);
```

---

## 5. Action Menu (ActionMenu.tsx)

### Move / Action Trade-off Rule
Every unit follows this rule: **moving at full movement speed disables attack and skill use for that turn.**

| Distance moved this turn | Attack | Skill use |
|--------------------------|--------|-----------|
| 0 to (maxMove − 1) tiles | ✅ Available | ✅ Available |
| maxMove tiles (full move) | ❌ Disabled | ❌ Disabled |

**Exception — Berserker only:** attack remains available after full movement.

Implement this in `ActionMenu` by computing `canAct` and disabling the relevant buttons:

```typescript
interface ActionMenuProps {
  unit: Unit;
  movedDistance: number; // tiles moved so far this turn
}

export const ActionMenu: React.FC<ActionMenuProps> = React.memo(({ unit, movedDistance }) => {
  const isFullMove = movedDistance >= unit.movement;
  // Berserker can always attack; all other units cannot after a full move
  const canAttack = unit.type === 'berserker' ? true : !isFullMove;
  const canUseSkill = !isFullMove; // No exceptions for skill use

  return (
    <View style={styles.menu}>
      <ActionButton
        label="Attack"
        disabled={!canAttack}
        onPress={handleAttack}
      />
      <ActionButton
        label="Skill"
        disabled={!canUseSkill}
        onPress={handleSkill}
      />
      <ActionButton label="Wait" onPress={handleWait} />
    </View>
  );
});
```

### Healer Special Case
The Healer's **Heal** action follows the same movement rule:
- Moved 0–1 tiles → Heal available
- Moved 2 tiles (max) → Heal disabled

Heal range is **radius 1 (6 adjacent tiles only)**. Highlight eligible allies within 1 tile when the Heal action is selected.

```typescript
// Highlight heal targets
const healTargets = unit.type === 'healer'
  ? allies.filter(ally => hexDistance(unit.position, ally.position) === 1)
  : [];
```

---

## 6. Animation

### Use react-native-reanimated
```typescript
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, withSpring
} from 'react-native-reanimated';

// Damage number pop-up
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

## 7. Color Palette

```typescript
// constants/colors.ts
export const COLORS = {
  // Terrain — visible state (full brightness)
  terrain: {
    plain:    '#8DB87A',
    highland: '#A0896B',
    forest:   '#3D6B47',
    water:    '#4A90D9', // Impassable — no unit can enter
    building: '#7A7A8A',
    rubble:   '#8A7A6A',
  },
  // Terrain — explored state (dimmed: multiply by ~0.55)
  terrainDim: {
    plain:    '#4E6844',
    highland: '#5A4D3C',
    forest:   '#223D29',
    water:    '#2A5278',
    building: '#454550',
    rubble:   '#4E4540',
  },
  // Fog of war
  fog: {
    unexplored: '#000000',    // Completely black — terrain not yet seen
    exploredOverlay: 'rgba(0,0,0,0.45)', // Semi-transparent overlay on explored tiles
  },
  // Ghost marker (last known position)
  ghost: '#FF6B6B',           // Dim red "?" icon opacity 0.45
  // Factions
  player:   '#4A90D9',  // blue
  enemy:    '#D94A4A',  // red
  neutral:  '#888888',
  // UI states
  selected:   '#FFD700',
  reachable:  '#00FF88',
  attackable: '#FF6B6B',
  disabled:   '#555555', // for greyed-out action buttons
  // Text
  text:     '#FFFFFF',
  textDark: '#1A1A2E',
  // Backgrounds
  bg:       '#1A1A2E',
  surface:  '#16213E',
  card:     '#0F3460',
};

/**
 * Returns the correct fill color for a hex tile based on its visibility state.
 * Use this in HexCell instead of accessing COLORS.terrain directly.
 */
export function getTerrainColor(
  terrain: TerrainType,
  visibility: 'unexplored' | 'visible' | 'explored'
): string {
  if (visibility === 'unexplored') return COLORS.fog.unexplored;
  if (visibility === 'explored')   return COLORS.terrainDim[terrain] ?? COLORS.terrainDim.plain;
  return COLORS.terrain[terrain] ?? COLORS.terrain.plain;
}
```

---

## 8. Performance Checklist

- [ ] Apply `React.memo()` to every component
- [ ] Wrap event handlers with `useCallback`
- [ ] Cache expensive calculations with `useMemo`
- [ ] Set `keyExtractor` and `getItemLayout` on all `FlatList` instances
- [ ] Consider `renderToHardwareTextureAndroid` for SVG-heavy screens
- [ ] Verify no unnecessary re-renders using React DevTools

---

## 9. Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Touch not responding | `overflow: hidden` blocking propagation | Set `hitSlop` |
| SVG appears blurry | Missing size declaration | Explicitly set `viewBox` and `width`/`height` |
| Keyboard breaks layout | Missing `KeyboardAvoidingView` | Wrap input forms with it |
| List scrolling is slow | Using `ScrollView` for long lists | Switch to `FlatList` |
| Action button active after full move | `canAct` not derived from `movedDistance` | Compute from `movedDistance >= unit.movement` |
| Water tile reachable | Missing passability check | Check `terrain === 'water'` in pathfinding |
| Enemy visible in dark forest | Not checking `visibility` before rendering enemy token | Use `showUnit = unit && visibility === 'visible'` |
| Ghost flickers on explored plain | `lastKnownPositions` not cleared after unit re-appears | Dispatch `clearLastKnownPosition` when visibility becomes `'visible'` |
| Terrain looks wrong in explored tiles | Using `COLORS.terrain` directly instead of `getTerrainColor` | Always call `getTerrainColor(terrain, visibility)` |
