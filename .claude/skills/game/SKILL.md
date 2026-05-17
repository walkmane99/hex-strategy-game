# SKILL: Game Logic Implementation Guide

## Target Files
- `utils/hexMath.ts` — Hex coordinate math
- `utils/combat.ts` — Battle damage calculation
- `utils/pathfinding.ts` — Pathfinding (A*)
- `utils/ai/` — AI action decision logic (directory, not a single file)
  - `core/AIController.ts`, `core/types.ts`, `core/generateCandidates.ts`
  - `scoring/attackScore.ts`, `movementScore.ts`, `terrainScore.ts`, `safetyScore.ts`
  - `scoring/targetPriority.ts`, `unitSpecific.ts`, `itemUsage.ts`, `skillUsage.ts`
  - `scoring/groupTactics.ts`, `substitution.ts`
  - `perception/probabilityMap.ts`
  - `perception/visibilityMap.ts` — **3-state fog of war** (unexplored / visible / explored)
  - `data/scoreWeights.ts`
- `hooks/useBattle.ts` — Battle phase hook
- `hooks/useHexGrid.ts` — Grid operation hook
- `hooks/useAI.ts` — AI turn processing hook

---

## 1. Hex Coordinate System (hexMath.ts)

### Coordinate System: Offset (odd-q)
The grid uses **odd-q offset** coordinates.
- Odd columns are shifted downward
- All internal calculations use **Cube coordinates** (q, r, s); convert to Offset only for display

### Required Function Implementations

```typescript
// Coordinate types
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

// Distance between two hexes
export function hexDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s)
  );
}

// 6 neighboring hexes
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

// All hexes within radius
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

### Screen Coordinate Conversion (flat-top hex)
```typescript
const HEX_SIZE = 40; // cell size in px

export function hexToPixel(hex: CubeCoord): { x: number; y: number } {
  const x = HEX_SIZE * (3 / 2 * hex.q);
  const y = HEX_SIZE * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}
```

---

## 2. Combat Calculation (combat.ts)

### Damage Formula
```
damage = max(0, (attack × rand(0.1–1.0) − (defense + terrainBonus)) × 10)
```

```typescript
export function calculateDamage(
  attacker: Unit,
  defender: Unit,
  terrain: TerrainType,
  affinity: AffinityResult
): number {
  const random = 0.1 + Math.random() * 0.9; // 0.1 – 1.0
  const terrainBonus = TERRAIN_DEFENSE_BONUS[terrain];
  const affinityMultiplier = getAffinityMultiplier(affinity);

  const baseDamage = (
    attacker.stats.attack * affinityMultiplier * random
    - (defender.stats.defense + terrainBonus)
  ) * 10;

  return Math.max(0, Math.round(baseDamage));
}
```

### Affinity Check
```typescript
// Cycle: tanker → archer → seeker → sniper → attacker → assassin → tanker
const AFFINITY_CYCLE = [
  'tanker', 'archer', 'seeker', 'sniper', 'attacker', 'assassin'
] as const;

export type AffinityResult = 'advantage' | 'disadvantage' | 'neutral';

export function checkAffinity(attacker: UnitType, defender: UnitType): AffinityResult {
  const atkIdx = AFFINITY_CYCLE.indexOf(attacker);
  const defIdx = AFFINITY_CYCLE.indexOf(defender);
  if (atkIdx === -1 || defIdx === -1) return 'neutral';

  const diff = (defIdx - atkIdx + AFFINITY_CYCLE.length) % AFFINITY_CYCLE.length;
  if (diff === 1) return 'advantage';    // attacker has upper hand
  if (diff === 5) return 'disadvantage'; // attacker is at a disadvantage
  return 'neutral';
}

export function getAffinityMultiplier(affinity: AffinityResult): number {
  switch (affinity) {
    case 'advantage':    return 1.3;
    case 'disadvantage': return 0.7;
    default:             return 1.0;
  }
}
```

### Move / Action Trade-off Validation

**All units:** moving the full movement allowance in a turn disables attack and skill use.  
**Berserker only:** may attack even after a full move.

```typescript
export function canActAfterMove(unit: Unit, distanceMoved: number): boolean {
  const movedFull = distanceMoved >= unit.stats.movement;
  if (!movedFull) return true;
  // Berserker exception: attack is still allowed after a full move
  // (skill use remains disabled even for berserker)
  return false;
}

export function canAttackAfterMove(unit: Unit, distanceMoved: number): boolean {
  const movedFull = distanceMoved >= unit.stats.movement;
  if (!movedFull) return true;
  return unit.type === 'berserker'; // only exception
}
```

### Assassin Detection Formula

Detection is checked every turn via a probability roll.

```
detectionChance = terrainBase + unitModifier + distanceModifier
```

**Terrain base probability:**
| Terrain | Base chance |
|---------|------------|
| Forest, building, highland, rubble | 10% |
| Plain, tile adjacent to water | 40% |

**Scouting unit modifier:**
| Scouting unit | Modifier |
|---------------|----------|
| Tanker / Healer | −5% |
| Seeker | +10% |
| Assassin | +15% |
| All others | ±0% |

**Distance modifier:**
| Distance to scouting unit | Modifier |
|---------------------------|----------|
| 1 tile (adjacent) | +10% |
| 2 tiles | +5% |
| 3+ tiles | ±0% |

Detection range: **5% – 65%**

```typescript
import {
  ASSASSIN_TERRAIN_BASE,
  ASSASSIN_UNIT_MODIFIER,
  ASSASSIN_DISTANCE_MODIFIER,
} from '@/constants/aiThresholds';

export function checkAssassinDetection(
  assassin: Unit,
  assassinPos: CubeCoord,
  seeker: Unit,
  seekerPos: CubeCoord,
  terrain: TerrainType,
  map: GameMap
): boolean {
  const terrainBase    = ASSASSIN_TERRAIN_BASE[terrain] ?? 0.4;
  const unitModifier   = ASSASSIN_UNIT_MODIFIER[seeker.type] ?? 0;
  const dist           = hexDistance(assassinPos, seekerPos);
  const distModifier   = ASSASSIN_DISTANCE_MODIFIER[Math.min(dist, 3)] ?? 0;

  const detectionChance = terrainBase + unitModifier + distModifier;
  return Math.random() < detectionChance;
}
```

Store the constants in `constants/aiThresholds.ts`:
```typescript
export const ASSASSIN_TERRAIN_BASE: Record<TerrainType, number> = {
  forest:   0.10,
  building: 0.10,
  highland: 0.10,
  rubble:   0.10,
  plain:    0.40,
  water:    0.40, // water-adjacent tiles use this value
};

export const ASSASSIN_UNIT_MODIFIER: Partial<Record<UnitType, number>> = {
  tanker:  -0.05,
  healer:  -0.05,
  seeker:   0.10,
  assassin: 0.15,
};

// Key = distance (clamped to max 3)
export const ASSASSIN_DISTANCE_MODIFIER: Record<number, number> = {
  1: 0.10,
  2: 0.05,
  3: 0.00,
};
```

### Healer Heal Action

The Healer's `heal` action uses the same movement rule as other actions.

- **Heal range**: radius 1 (the 6 immediately adjacent tiles only)
- **Heal available**: moved 0 or 1 tile this turn
- **Heal disabled**: moved 2 tiles (full movement)
- **Heal amount**: 100–150 HP (random)

```typescript
export function getHealTargets(
  healer: Unit,
  healerPos: CubeCoord,
  allies: Unit[],
  allyPositions: Map<string, CubeCoord>
): Unit[] {
  return allies.filter(ally => {
    const pos = allyPositions.get(ally.id);
    return pos !== undefined && hexDistance(healerPos, pos) === 1;
  });
}

export function calculateHeal(): number {
  return Math.round(100 + Math.random() * 50); // 100–150
}
```

---

## 3. Pathfinding (pathfinding.ts)

### Terrain Passability
**Water is impassable for ALL units — no exceptions.**  
Apply this check as the first gate in the passability function.

```typescript
export function isPassable(terrain: TerrainType, _unit: Unit): boolean {
  if (terrain === 'water') return false; // Hard block — no unit can enter
  // Additional per-unit logic can go here in future if needed
  return true;
}
```

### A* Algorithm
```typescript
export function findPath(
  start: OffsetCoord,
  end: OffsetCoord,
  grid: GameGrid,
  unit: Unit
): OffsetCoord[] | null {
  const startCube = offsetToCube(start);
  const endCube   = offsetToCube(end);

  // Standard A* implementation:
  // - Movement cost varies by terrain (terrain.moveCost)
  // - Tiles occupied by enemy units are impassable
  // - Respect the unit's movement allowance
  // - Water tiles are always impassable (see isPassable above)
}
```

---

## 4. AI Logic (utils/ai/)

> The AI lives in `utils/ai/` — **not** a single `utils/ai.ts` file.  
> Always import from the correct subpath (e.g. `utils/ai/core/AIController`).

### Utility AI — Scoring System
All action candidates are scored; the highest-scoring action is selected.

```typescript
// utils/ai/core/AIController.ts
export function decideAIAction(unit: Unit, gameState: GameState): AIAction {
  const candidates = generateCandidates(unit, gameState);
  const scored = candidates.map(c => ({
    candidate: c,
    score: evaluateCandidate(c, unit, gameState),
  }));
  return pickBest(scored).candidate;
}
```

### Two-layer Processing Structure
```
Layer 1 (all units):
  Evaluators: attack, movement, terrain, target, safety,
              unitSpecific, itemUsage, skillUsage
  → Store results in tentativePlan

Layer 2 (all units):
  Evaluators: all Layer 1 + groupTactics
  → Produce final UnitAction
  ※ Skip Layer 2 when activeUnits.length <= 1
```

### AI Action Priority (reference)
1. **Survival check**: low-HP units retreat or move toward a healer
2. **Scouting**: probe unexplored areas using the probability map
3. **Attack decision**: if an enemy is in range, attack with affinity in mind
4. **Movement decision**: move to favorable terrain → close in on the enemy

### Move/Action Rule in Candidate Generation
Respect `canAttackAfterMove` when generating attack candidates.  
Never generate an `attack` candidate for a unit that has already moved its full allowance — except for the Berserker.

```typescript
// utils/ai/core/generateCandidates.ts
function generateAttackCandidates(unit: Unit, movedDistance: number, ...): ActionCandidate[] {
  if (!canAttackAfterMove(unit, movedDistance)) return [];
  // ... generate candidates normally
}
```

### Performance Target
- **Thinking time per turn**: under 500 ms on Android hardware
- Normal / Hard: 1-ply search
- Expert: 2-ply search on top-N candidates only

### All Threshold Constants → `constants/aiThresholds.ts`
Never hard-code numeric thresholds inside scoring files. Always reference named constants.

```typescript
// constants/aiThresholds.ts
export const DEFENSE_PIERCE_THRESHOLD = 15;
export const SKILL_INITIAL_COOLDOWN: Record<SpecialSkillType, number> = { ... };
export const ASSASSIN_TERRAIN_BASE = { ... };
export const ASSASSIN_UNIT_MODIFIER = { ... };
export const ASSASSIN_DISTANCE_MODIFIER = { ... };
```

---

## 5. Fog of War & Visibility System (visibilityMap.ts)

### Overview: Two-tier Visibility

| Tier | Range | Purpose |
|------|-------|---------|
| **Display visibility** (fog reveal) | 5 tiles (`FOG_VISIBLE_RANGE`) | Controls tile render state (dark / bright) |
| **Tactical visibility** (scouting) | 1–2 tiles (scout stat dependent) | Determines if an enemy unit is "found" and targetable |

Highland's scouting +1 applies only to **tactical visibility**, not display visibility.

### Tile Visibility States

```typescript
export type TileVisibilityState = 'unexplored' | 'visible' | 'explored';

// Stored in battleSlice
// tileVisibility: Record<string, TileVisibilityState>
// Key format: `${col},${row}`
```

| State | Render | Condition |
|-------|--------|-----------|
| `unexplored` | Black (terrain hidden) | Never entered any friendly unit's display range |
| `visible` | Bright (normal render) | Within 5 tiles of at least one friendly unit this turn |
| `explored` | Dim (terrain shown, units hidden) | Was `visible` before, now out of display range |

### Core Functions

```typescript
import { FOG_VISIBLE_RANGE } from '@/constants/gameConfig';

/**
 * Called every turn start. Updates tileVisibility in-place.
 * - All tiles within FOG_VISIBLE_RANGE of any friendly unit → 'visible'
 * - Previously 'visible' tiles now outside range → 'explored'
 * - Never downgrades 'explored' to 'unexplored'
 */
export function updateTileVisibility(
  current: Record<string, TileVisibilityState>,
  playerUnitPositions: OffsetCoord[],
  gridBounds: { width: number; height: number }
): Record<string, TileVisibilityState> {
  const next = { ...current };

  // Downgrade visible → explored first
  for (const key of Object.keys(next)) {
    if (next[key] === 'visible') next[key] = 'explored';
  }

  // Upgrade to visible: all tiles within FOG_VISIBLE_RANGE of any player unit
  for (const pos of playerUnitPositions) {
    const cube = offsetToCube(pos);
    const range = hexRange(cube, FOG_VISIBLE_RANGE);
    for (const c of range) {
      const offset = cubeToOffset(c);
      if (offset.col < 0 || offset.col >= gridBounds.width) continue;
      if (offset.row < 0 || offset.row >= gridBounds.height) continue;
      next[`${offset.col},${offset.row}`] = 'visible';
    }
  }

  return next;
}

/**
 * Returns true if the given enemy unit should be treated as stealth
 * (hidden from the player) based on tile visibility + terrain.
 */
export function isUnitStealthInExplored(
  unitPos: OffsetCoord,
  tileVisibility: Record<string, TileVisibilityState>,
  terrain: TerrainType
): boolean {
  const key = `${unitPos.col},${unitPos.row}`;
  const state = tileVisibility[key] ?? 'unexplored';

  if (state === 'visible') return false;           // Always shown in visible range
  // In explored or unexplored: stealth if terrain provides concealment
  const stealthTerrain: TerrainType[] = ['forest', 'building', 'highland', 'rubble'];
  return stealthTerrain.includes(terrain);
}
```

### Last Known Position (Ghost Marker)

When an enemy moves from `visible` to `explored` and becomes stealth, record its last known position:

```typescript
export interface LastKnownPosition {
  unitId: string;
  unitType: UnitType;
  position: OffsetCoord;
  turnLastSeen: number;
}

/**
 * Returns units that just entered stealth (visible → explored transition).
 * Only units on plain / water-adjacent tiles get a ghost marker.
 * Units that vanished into forest/building get no ghost (disappeared into cover).
 */
export function computeNewGhosts(
  previouslyVisible: Set<string>,   // unitIds visible last turn
  nowStealthUnits: EnemyUnit[],      // enemy units that are now stealth
  terrain: (pos: OffsetCoord) => TerrainType,
  currentTurn: number
): LastKnownPosition[] {
  const PLAIN_GHOST_TERRAIN: TerrainType[] = ['plain'];

  return nowStealthUnits
    .filter(u => previouslyVisible.has(u.id))
    .filter(u => PLAIN_GHOST_TERRAIN.includes(terrain(u.position)))
    .map(u => ({
      unitId: u.id,
      unitType: u.type,
      position: u.position,
      turnLastSeen: currentTurn,
    }));
}
```

### Probability Map Integration

When a unit enters stealth in explored terrain, trigger probability re-spread:

```typescript
// In probabilityMap.ts — call after stealth reentry events
export function respreadFromLastKnown(
  map: ProbabilityMap,
  ghost: LastKnownPosition,
  unitMovement: number,
  grid: GameGrid
): ProbabilityMap {
  const next = { ...map };
  const key = `${ghost.position.col},${ghost.position.row}`;

  // 1. Pin probability 1.0 at last known position
  next[key] = 1.0;

  // 2. Spread outward by movement range, blocked by water/walls
  // (use existing spread logic with radius = unitMovement)

  // 3. Re-pin: remove water tiles, normalize
  return next;
}
```

### safetyScore Integration

```typescript
// In scoring/safetyScore.ts — add out-of-sight terrain bonus for AI retreat
import { isUnitStealthInExplored } from '@/utils/ai/perception/visibilityMap';

// Bonus for moving to explored dark terrain (concealment incentive)
if (isUnitStealthInExplored(targetTile, tileVisibility, terrain)) {
  score += weights.outOfSightBonus * (1 - hpRatio); // Scale by HP: more incentive when wounded
}
```

Add to `constants/aiThresholds.ts`:
```typescript
export const OUT_OF_SIGHT_BONUS = 20; // Base score for retreating into explored dark terrain
```

Add to `data/scoreWeights.ts`:
```typescript
outOfSightBonus: OUT_OF_SIGHT_BONUS,
```

---

## 6. Implementation Checklist

Before starting any implementation:

- [ ] Check and update type definitions in `types/` first
- [ ] All internal coordinate handling uses `CubeCoord`; convert to `OffsetCoord` only for rendering
- [ ] Use `Math.random()` for randomness (mock-friendly for tests)
- [ ] Keep all functions pure; confine side effects to hook layer
- [ ] Handle edge cases: out-of-grid, HP = 0, movement = 0, full-move no-attack
- [ ] Water tiles must be blocked in `isPassable` before any other terrain logic
- [ ] All AI numeric thresholds must live in `constants/aiThresholds.ts`
- [ ] Call `updateTileVisibility` at the **start** of every player turn (after unit positions are set)
- [ ] Call `isUnitStealthInExplored` before rendering any enemy unit token or generating AI attack candidates
- [ ] Ghost markers (`lastKnownPositions`) must be cleared when the enemy unit becomes `visible` again

---

## 7. Common Bugs and Fixes

| Bug | Cause | Fix |
|-----|-------|-----|
| Coordinates drift | Mixing Offset and Cube in the same calculation | Always go through conversion functions |
| Infinite loop in pathfinding | Incorrect `openSet` management in A* | Update the `visited` set correctly |
| Damage is NaN | Division by zero | Guard with `Math.max(0, ...)` |
| Affinity direction reversed | Wrong direction in cycle | Verify both directions with unit tests |
| Unit attacks after full move | Missing `canAttackAfterMove` check | Call `canAttackAfterMove` before generating attack candidates |
| Water tile is reachable | Missing passability check | Add `if (terrain === 'water') return false` as first line of `isPassable` |
| Assassin always detected | Ignoring distance / unit modifier | Use `checkAssassinDetection` with all three components |
| AI imports from wrong path | Using `utils/ai.ts` instead of `utils/ai/` | Import from `utils/ai/core/...`, `utils/ai/scoring/...` etc. |
| Enemy visible after entering explored forest | Missing stealth-in-explored check | Call `isUnitStealthInExplored` before rendering enemy tokens |
| Ghost marker not cleared | Enemy became visible but `lastKnownPositions` not updated | Clear entry from `lastKnownPositions` in `clearLastKnownPosition` reducer |
| Tactical vs display range confused | Using `FOG_VISIBLE_RANGE` for attack targeting | Display range (5) ≠ tactical range (1–2). Keep them separate |