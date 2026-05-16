import { CubeCoord, OffsetCoord } from '@/types/map';
import { GRID_CONFIG } from '@/constants/gameConfig';

// =====================
// 座標変換
// =====================

/** Cube座標 → Offset座標 (odd-q) */
export function cubeToOffset(cube: CubeCoord): OffsetCoord {
  const col = cube.q;
  const row = cube.r + (cube.q - (cube.q & 1)) / 2;
  return { col, row };
}

/** Offset座標 → Cube座標 (odd-q) */
export function offsetToCube(offset: OffsetCoord): CubeCoord {
  const q = offset.col;
  const r = offset.row - (offset.col - (offset.col & 1)) / 2;
  const s = -q - r;
  return { q, r, s };
}

// =====================
// 距離・近傍
// =====================

/** 2つのCube座標間のヘックス距離 */
export function hexDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s)
  );
}

/** 2つのOffset座標間のヘックス距離 */
export function offsetDistance(a: OffsetCoord, b: OffsetCoord): number {
  return hexDistance(offsetToCube(a), offsetToCube(b));
}

const CUBE_DIRECTIONS: CubeCoord[] = [
  { q: 1, r: -1, s: 0 },
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
];

/** 隣接する6マスを返す */
export function hexNeighbors(hex: CubeCoord): CubeCoord[] {
  return CUBE_DIRECTIONS.map(d => ({
    q: hex.q + d.q,
    r: hex.r + d.r,
    s: hex.s + d.s,
  }));
}

/** Offset座標の隣接マスを返す */
export function offsetNeighbors(offset: OffsetCoord): OffsetCoord[] {
  return hexNeighbors(offsetToCube(offset)).map(cubeToOffset);
}

/** radius マス以内の全Cube座標を返す (center含む) */
export function hexRange(center: CubeCoord, radius: number): CubeCoord[] {
  const results: CubeCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (
      let r = Math.max(-radius, -q - radius);
      r <= Math.min(radius, -q + radius);
      r++
    ) {
      const s = -q - r;
      results.push({ q: center.q + q, r: center.r + r, s: center.s + s });
    }
  }
  return results;
}

/** radius マス以内の全Offset座標を返す */
export function offsetRange(center: OffsetCoord, radius: number): OffsetCoord[] {
  return hexRange(offsetToCube(center), radius).map(cubeToOffset);
}

// =====================
// 画面座標変換 (flat-top)
// =====================

const SIZE = GRID_CONFIG.HEX_SIZE;
const SPACING = GRID_CONFIG.HEX_SPACING;

/** Cube座標 → 画面ピクセル座標 */
export function hexToPixel(hex: CubeCoord): { x: number; y: number } {
  const x = SIZE * SPACING * (3 / 2) * hex.q;
  const y = SIZE * SPACING * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

/** Offset座標 → 画面ピクセル座標 */
export function offsetToPixel(offset: OffsetCoord): { x: number; y: number } {
  return hexToPixel(offsetToCube(offset));
}

/** flat-top 六角形の6頂点座標 (SVG polygon用) */
export function hexCornerPoints(cx: number, cy: number): string {
  const angles = [0, 60, 120, 180, 240, 300];
  return angles
    .map(deg => {
      const rad = (Math.PI / 180) * deg;
      return `${(cx + SIZE * Math.cos(rad)).toFixed(2)},${(cy + SIZE * Math.sin(rad)).toFixed(2)}`;
    })
    .join(' ');
}

// =====================
// グリッド境界チェック
// =====================

/** Offset座標がグリッド内か確認 */
export function isInBounds(offset: OffsetCoord): boolean {
  return (
    offset.col >= 0 &&
    offset.col < GRID_CONFIG.WIDTH &&
    offset.row >= 0 &&
    offset.row < GRID_CONFIG.HEIGHT
  );
}

/** グリッド内の隣接マスのみ返す */
export function validNeighbors(offset: OffsetCoord): OffsetCoord[] {
  return offsetNeighbors(offset).filter(isInBounds);
}
