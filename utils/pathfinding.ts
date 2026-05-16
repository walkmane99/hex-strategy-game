import { OffsetCoord, MapCell } from '@/types/map';
import { Unit } from '@/types/unit';
import { validNeighbors, offsetDistance, isInBounds } from './hexMath';
import { TERRAIN_CONFIG } from '@/constants/terrain';

interface PathNode {
  pos: OffsetCoord;
  g: number; // コスト (始点から)
  h: number; // ヒューリスティック (終点まで推定)
  f: number; // g + h
  parent: PathNode | null;
}

const posKey = (p: OffsetCoord) => `${p.col},${p.row}`;

/**
 * A* 経路探索
 * @returns 経路 (始点含む) または null (到達不可)
 */
export function findPath(
  start: OffsetCoord,
  end: OffsetCoord,
  grid: MapCell[][],
  unit: Unit,
  maxMovement: number
): OffsetCoord[] | null {
  const openSet = new Map<string, PathNode>();
  const closedSet = new Set<string>();

  const startNode: PathNode = {
    pos: start,
    g: 0,
    h: offsetDistance(start, end),
    f: offsetDistance(start, end),
    parent: null,
  };

  openSet.set(posKey(start), startNode);

  while (openSet.size > 0) {
    // f値が最小のノードを取得
    let current: PathNode | null = null;
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) current = node;
    }
    if (!current) break;

    const currentKey = posKey(current.pos);

    // 目標到達
    if (current.pos.col === end.col && current.pos.row === end.row) {
      return reconstructPath(current);
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    // 隣接マスを探索
    for (const neighbor of validNeighbors(current.pos)) {
      const key = posKey(neighbor);
      if (closedSet.has(key)) continue;

      const cell = grid[neighbor.row]?.[neighbor.col];
      if (!cell) continue;

      // 通行不可チェック
      if (!isPassable(cell, unit)) continue;

      // 移動コスト計算
      const moveCost = TERRAIN_CONFIG[cell.terrain].moveCost;
      const g = current.g + moveCost;

      // 移動力超過
      if (g > maxMovement) continue;

      const existing = openSet.get(key);
      if (existing && existing.g <= g) continue;

      const node: PathNode = {
        pos: neighbor,
        g,
        h: offsetDistance(neighbor, end),
        f: g + offsetDistance(neighbor, end),
        parent: current,
      };

      openSet.set(key, node);
    }
  }

  return null; // 到達不可
}

/** 到達可能なマスを全列挙 (移動範囲表示用) */
export function reachableCells(
  start: OffsetCoord,
  grid: MapCell[][],
  unit: Unit,
  maxMovement: number
): OffsetCoord[] {
  const visited = new Map<string, number>(); // key → cost
  const queue: Array<{ pos: OffsetCoord; cost: number }> = [{ pos: start, cost: 0 }];
  const results: OffsetCoord[] = [];

  visited.set(posKey(start), 0);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const neighbor of validNeighbors(current.pos)) {
      const key = posKey(neighbor);
      const cell = grid[neighbor.row]?.[neighbor.col];
      if (!cell || !isPassable(cell, unit)) continue;

      const cost = current.cost + TERRAIN_CONFIG[cell.terrain].moveCost;
      if (cost > maxMovement) continue;

      const prevCost = visited.get(key);
      if (prevCost !== undefined && prevCost <= cost) continue;

      visited.set(key, cost);
      results.push(neighbor);
      queue.push({ pos: neighbor, cost });
    }
  }

  return results;
}

function isPassable(cell: MapCell, unit: Unit): boolean {
  // 水場は現在すべて通行不可（将来拡張）
  if (cell.terrain === 'water') return false;
  // 他のユニットがいる場合は通行不可 (味方も含む)
  // TODO: 味方通過を許可する場合はここを修正
  if (cell.unitId) return false;
  return true;
}

function reconstructPath(node: PathNode): OffsetCoord[] {
  const path: OffsetCoord[] = [];
  let current: PathNode | null = node;
  while (current) {
    path.unshift(current.pos);
    current = current.parent;
  }
  return path;
}
