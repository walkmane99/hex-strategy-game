import { OffsetCoord } from '@/types/map';
import { isInBounds } from './hexMath';

const r = 18;
const pad = 6;

/** hex (col, row) → SVG center pixel coords (matches HexMapView internal formula) */
export function offsetToPixelSVG(col: number, row: number): { x: number; y: number } {
  return {
    x: pad + r + col * 1.5 * r,
    y: pad + r + row * Math.sqrt(3) * r + (col % 2 ? (Math.sqrt(3) * r) / 2 : 0),
  };
}

/**
 * Screen pixel → hex offset coord (inverse of offsetToPixelSVG * scale).
 * Uses fractional axial coords + cube rounding.
 * Returns null when outside grid bounds.
 */
export function pixelToOffset(
  screenX: number,
  screenY: number,
  scale: number
): OffsetCoord | null {
  const svgX = screenX / scale;
  const svgY = screenY / scale;

  const localX = svgX - pad - r;
  const localY = svgY - pad - r;

  const qFrac = localX / (1.5 * r);
  const rFrac = localY / (Math.sqrt(3) * r) - qFrac / 2;
  const sFrac = -qFrac - rFrac;

  let q = Math.round(qFrac);
  let ri = Math.round(rFrac);
  let s = Math.round(sFrac);

  const dq = Math.abs(q - qFrac);
  const dr = Math.abs(ri - rFrac);
  const ds = Math.abs(s - sFrac);

  if (dq > dr && dq > ds) {
    q = -ri - s;
  } else if (dr > ds) {
    ri = -q - s;
  } else {
    s = -q - ri;
  }

  // cube → odd-q offset
  const col = q;
  const row = ri + (q - (q & 1)) / 2;
  const coord: OffsetCoord = { col, row };

  return isInBounds(coord) ? coord : null;
}
