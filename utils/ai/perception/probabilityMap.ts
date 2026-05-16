import { MapCell, OffsetCoord } from '@/types/map';
import { ProbabilityMap, GameEvent } from '../core/types';
import { offsetToCube, offsetNeighbors, isInBounds } from '@/utils/hexMath';

const UNKNOWN_INITIAL = 0.1;
const LAST_KNOWN_VALUE = 0.8;
const DIFFUSE_RATE = 0.3;

function posKey(pos: OffsetCoord): string {
  const c = offsetToCube(pos);
  return `${c.q},${c.r}`;
}

/** Initialise probability map: all reachable tiles start at UNKNOWN_INITIAL. */
export function buildProbabilityMap(grid: MapCell[][]): ProbabilityMap {
  const map: ProbabilityMap = new Map();
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < (grid[row]?.length ?? 0); col++) {
      const cell = grid[row]?.[col];
      if (cell && cell.terrain !== 'water') {
        map.set(posKey({ col, row }), UNKNOWN_INITIAL);
      }
    }
  }
  return map;
}

/**
 * Update probability map given game events and apply one-step diffusion.
 * - enemy_spotted:  zero out that tile (we know where they are)
 * - enemy_lost:     set last known position to LAST_KNOWN_VALUE
 * - enemy_moved:    zero out origin, set destination to LAST_KNOWN_VALUE
 */
export function updateProbabilityMap(
  prev: ProbabilityMap,
  events: GameEvent[],
  grid: MapCell[][],
): ProbabilityMap {
  // Collect event-driven pins so we can re-apply them after diffusion
  const eventPins = new Map<string, number>();
  for (const event of events) {
    if (event.type === 'enemy_spotted') {
      eventPins.set(posKey(event.position), 0);
    } else if (event.type === 'enemy_lost') {
      eventPins.set(posKey(event.lastKnown), LAST_KNOWN_VALUE);
    } else if (event.type === 'enemy_moved') {
      eventPins.set(posKey(event.from), 0);
      eventPins.set(posKey(event.to), LAST_KNOWN_VALUE);
    }
  }

  const next = new Map(prev);
  for (const [key, val] of eventPins) {
    next.set(key, val);
  }

  // Diffuse: each tile with probability > 0 spreads DIFFUSE_RATE to neighbours
  const diffused = new Map(next);
  for (const [key, prob] of next) {
    if (prob <= 0) continue;
    const spread = prob * DIFFUSE_RATE;

    // Resolve offset from key to find neighbours
    const [q, r] = key.split(',').map(Number) as [number, number];
    const cube = { q, r, s: -q - r };
    const dirs = [
      { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
      { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 },
    ];

    for (const d of dirs) {
      const nq = cube.q + d.q;
      const nr = cube.r + d.r;
      const nKey = `${nq},${nr}`;
      const current = diffused.get(nKey);
      if (current === undefined) continue; // off-map or water
      diffused.set(nKey, Math.min(1, current + spread));
    }
  }

  // Re-pin event tiles — diffusion from neighbours must not override them
  for (const [key, val] of eventPins) {
    if (diffused.has(key)) diffused.set(key, val);
  }

  return diffused;
}
