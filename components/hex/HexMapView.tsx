import React, { useMemo } from 'react';
import Svg, {
  Polygon,
  Path,
  G,
  Text as SvgText,
  Rect as SvgRect,
  Circle as SvgCircle,
  Defs,
  ClipPath,
  Image as SvgImage,
} from 'react-native-svg';
import { C } from '@/constants/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TILE_IMAGES: Record<string, number> = {
  '.': require('@/project/assets/tile-plains.png'),
  '^': require('@/project/assets/tile-mountain.png'),
  f: require('@/project/assets/tile-forest.png'),
  '~': require('@/project/assets/tile-water.png'),
  '#': require('@/project/assets/tile-building.png'),
  x: require('@/project/assets/tile-rubble.png'),
};

interface HexMapViewProps {
  preset?: string;
  width?: number;
  showFog?: boolean;
  showThreat?: boolean;
  accent?: string;
  showUnits?: boolean;
  showOverlays?: boolean;
  playerPositions?: Array<{ col: number; row: number }>;
}

const TERRAIN_DATA: Record<string, { fill: string; stroke: string; lc: string }> = {
  '.': { fill: '#1a1f1d', stroke: '#252b29', lc: '#3a4239' },
  '^': { fill: '#2a2418', stroke: '#3a3120', lc: '#7a6033' },
  'f': { fill: '#162119', stroke: '#1f3025', lc: '#3d6a48' },
  '~': { fill: '#0e1a23', stroke: '#1a2b39', lc: '#3a5e7a' },
  '#': { fill: '#23201a', stroke: '#3b362a', lc: '#a08755' },
  'x': { fill: '#1a1816', stroke: '#2b2723', lc: '#5a4f3f' },
};

const MAPS: Record<string, string[]> = {
  '都市部 / URBAN': [
    '..##..f...',
    '.##....f..',
    '.#..^^.fff',
    '...^##..f.',
    '..^.##....',
    '..xx..~~..',
    '...x.~~...',
    'f...~~..##',
    'ff.~~...##',
    '.f....x...',
  ],
  '渓谷 / VALLEY': [
    '^^^.....^^',
    '^^......^^',
    '^...ff..^.',
    '....fff...',
    '...~~~....',
    '...~~~....',
    '...~~~....',
    '...fff....',
    '^...ff...^',
    '^^.....^^^',
  ],
  '森林帯 / WOODS': [
    'fff..fff..',
    'ff..ffff..',
    'f...ff^^..',
    '...ff^^^..',
    '..ff..^^..',
    '..ff..xx..',
    '...ff.xx..',
    'f..fff.ff.',
    'ff..fff.ff',
    'fff..ff.ff',
  ],
  '廃墟 / RUINS': [
    '##..xx..##',
    '#x..xx..x#',
    'xx....xx..',
    '..####....',
    '..####.xx.',
    '.xx.##....',
    '....##.xx.',
    'xx....xx..',
    '#x..xx..x#',
    '##..xx..##',
  ],
};

function hexCenter(col: number, row: number, r: number): { x: number; y: number } {
  return {
    x: r + col * 1.5 * r,
    y: row * Math.sqrt(3) * r + (col % 2 ? (Math.sqrt(3) * r) / 2 : 0) + r,
  };
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 })
    .map((_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    })
    .join(' ');
}

function hexPathStr(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 })
    .map((_, i) => {
      const a = (Math.PI / 3) * i;
      const prefix = i === 0 ? 'M' : 'L';
      return `${prefix} ${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    })
    .join(' ') + ' Z';
}

const cols = 10;
const rows = 10;
const r = 18;
const pad = 6;

const svgW = pad * 2 + r + (cols - 1) * 1.5 * r + r;
const svgH = pad * 2 + rows * Math.sqrt(3) * r + (Math.sqrt(3) * r) / 2;

type UnitDef = {
  col: number;
  row: number;
  kind: string;
  id: string;
  hp: number;
  spotted?: boolean;
};

const blueUnits: UnitDef[] = [
  { col: 1, row: 8, kind: 'TANKER', id: 'B1', hp: 92 },
  { col: 2, row: 7, kind: 'ATTACKER', id: 'B2', hp: 78 },
  { col: 3, row: 8, kind: 'HEALER', id: 'B3', hp: 100 },
  { col: 0, row: 6, kind: 'SEEKER', id: 'B4', hp: 64 },
  { col: 4, row: 6, kind: 'ARCHER', id: 'B5', hp: 85 },
];

const redUnits: UnitDef[] = [
  { col: 8, row: 2, kind: 'TANKER', id: 'R2', hp: 100, spotted: true },
  { col: 6, row: 2, kind: 'ATTACKER', id: 'R3', hp: 88, spotted: true },
];

const HexMapView = React.memo(function HexMapView({
  preset = '都市部 / URBAN',
  width = 360,
  showFog = true,
  showThreat = true,
  accent = C.amber,
  showUnits = true,
  showOverlays = true,
  playerPositions,
}: HexMapViewProps) {
  const mapData = MAPS[preset] ?? MAPS['都市部 / URBAN'];
  const scale = width / svgW;
  const viewHeight = svgH * scale;

  const selected = blueUnits[0];

  const { hexCells, moveCells, threatCells, fogCells } = useMemo(() => {
    const cells: Array<{
      col: number;
      row: number;
      terrain: string;
      cx: number;
      cy: number;
      points: string;
    }> = [];

    for (let c = 0; c < cols; c++) {
      for (let ro = 0; ro < rows; ro++) {
        const terrain = mapData[ro]?.[c] ?? '.';
        const { x: cx, y: cy } = hexCenter(c, ro, r);
        const adjustedCx = cx + pad;
        const adjustedCy = cy + pad;
        cells.push({
          col: c,
          row: ro,
          terrain,
          cx: adjustedCx,
          cy: adjustedCy,
          points: hexPoints(adjustedCx, adjustedCy, r - 0.6),
        });
      }
    }

    // Fog is always computed when showFog=true, independent of showOverlays
    const fogCellSet = new Set<string>();
    if (showFog) {
      const observers = playerPositions ?? blueUnits;
      for (let c = 0; c < cols; c++) {
        for (let ro = 0; ro < rows; ro++) {
          let closestDist = 999;
          for (const bu of observers) {
            const d = Math.abs(c - bu.col) + Math.abs(ro - bu.row);
            if (d < closestDist) closestDist = d;
          }
          if (closestDist > 4) {
            fogCellSet.add(`${c},${ro}`);
          }
        }
      }
    }

    if (!showOverlays) {
      return { hexCells: cells, moveCells: new Set<string>(), threatCells: new Set<string>(), fogCells: fogCellSet };
    }

    const moveCellSet = new Set<string>();
    for (let c = 0; c < cols; c++) {
      for (let ro = 0; ro < rows; ro++) {
        const dc = Math.abs(c - selected.col);
        const dr = Math.abs(ro - selected.row);
        if (dc + dr <= 3 && !(c === 0 && ro === 0)) {
          const terrain = mapData[ro]?.[c] ?? '.';
          if (terrain !== '~' && terrain !== '#') {
            moveCellSet.add(`${c},${ro}`);
          }
        }
      }
    }

    const threatCellSet = new Set<string>();
    if (showThreat) {
      for (const ru of redUnits) {
        if (ru.spotted) {
          for (let c = 0; c < cols; c++) {
            for (let ro = 0; ro < rows; ro++) {
              const dc = Math.abs(c - ru.col);
              const dr = Math.abs(ro - ru.row);
              if (dc + dr <= 3) {
                threatCellSet.add(`${c},${ro}`);
              }
            }
          }
        }
      }
    }

    return {
      hexCells: cells,
      moveCells: moveCellSet,
      threatCells: threatCellSet,
      fogCells: fogCellSet,
    };
  }, [mapData, showFog, showThreat, showOverlays, playerPositions]);

  return (
    <Svg
      width={width}
      height={viewHeight}
      viewBox={`0 0 ${svgW} ${svgH}`}
    >
      {/* Background */}
      <SvgRect x={0} y={0} width={svgW} height={svgH} fill={C.bg0} />

      {/* Clip paths only for visible (non-fog) terrain tiles */}
      <Defs>
        {hexCells
          .filter(({ col, row }) => !fogCells.has(`${col},${row}`))
          .map(({ col, row, cx, cy }) => (
            <ClipPath key={`clip-${col}-${row}`} id={`hclip_${col}_${row}`}>
              <Path d={hexPathStr(cx, cy, r - 0.9)} />
            </ClipPath>
          ))}
      </Defs>

      {/* Terrain tiles */}
      {hexCells.map(({ col, row, terrain, cx, cy, points }) => {
        const t = TERRAIN_DATA[terrain] ?? TERRAIN_DATA['.'];
        const tileImg = TILE_IMAGES[terrain];
        const tileSize = (r - 0.6) * 2;
        const isFog = fogCells.has(`${col},${row}`);
        return (
          <G key={`t-${col}-${row}`}>
            <Polygon
              points={points}
              fill={tileImg && !isFog ? '#0a0c0a' : t.fill}
              stroke={t.stroke}
              strokeWidth={0.6}
            />
            {tileImg && !isFog && (
              <G clipPath={`url(#hclip_${col}_${row})`}>
                <SvgImage
                  href={tileImg}
                  x={cx - (r - 0.6)}
                  y={cy - (r - 0.6)}
                  width={tileSize}
                  height={tileSize}
                  preserveAspectRatio="xMidYMid slice"
                />
                <Path
                  d={hexPathStr(cx, cy, r - 0.9)}
                  fill="none"
                  stroke="#000"
                  strokeOpacity={0.35}
                  strokeWidth={0.8}
                />
              </G>
            )}
          </G>
        );
      })}

      {/* Threat cells */}
      {showThreat &&
        hexCells
          .filter(({ col, row }) => threatCells.has(`${col},${row}`))
          .map(({ col, row, points }) => (
            <Polygon
              key={`th-${col}-${row}`}
              points={points}
              fill={C.red}
              stroke="none"
              opacity={0.15}
            />
          ))}

      {/* Move cells */}
      {hexCells
        .filter(({ col, row }) => moveCells.has(`${col},${row}`) && !(col === selected.col && row === selected.row))
        .map(({ col, row, points }) => (
          <Polygon
            key={`mv-${col}-${row}`}
            points={points}
            fill="none"
            stroke={accent}
            strokeWidth={0.5}
            strokeDasharray="1.2,1.2"
            opacity={0.85}
          />
        ))}

      {/* Selected cell */}
      {hexCells
        .filter(({ col, row }) => col === selected.col && row === selected.row)
        .map(({ col, row, points }) => (
          <Polygon
            key={`sel-${col}-${row}`}
            points={points}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
          />
        ))}

      {/* Fog overlay — fully opaque since no image is rendered beneath */}
      {showFog &&
        hexCells
          .filter(({ col, row }) => fogCells.has(`${col},${row}`))
          .map(({ col, row, points }) => (
            <Polygon
              key={`fog-${col}-${row}`}
              points={points}
              fill={C.bg0}
              stroke="none"
              opacity={0.92}
            />
          ))}

      {/* Blue units */}
      {showUnits && blueUnits.map((u) => {
        const { x: cx, y: cy } = hexCenter(u.col, u.row, r);
        const ucx = cx + pad;
        const ucy = cy + pad;
        const unitPts = hexPoints(ucx, ucy, r * 0.55);
        const hpFrac = u.hp / 100;
        const barW = r * 1.1;
        const barX = ucx - barW / 2;
        const barY = ucy + r * 0.65;
        return (
          <G key={`bu-${u.id}`}>
            <Polygon
              points={unitPts}
              fill="#1a2e4a"
              stroke="#2e6aad"
              strokeWidth={1}
            />
            <SvgText
              x={ucx}
              y={ucy + 3.5}
              textAnchor="middle"
              fontSize={7}
              fill={C.cyan}
              fontFamily="monospace"
            >
              {u.id}
            </SvgText>
            <SvgRect x={barX} y={barY} width={barW} height={2} fill={C.bg3} />
            <SvgRect
              x={barX}
              y={barY}
              width={barW * hpFrac}
              height={2}
              fill={hpFrac > 0.5 ? C.green : hpFrac > 0.25 ? C.amber : C.red}
            />
          </G>
        );
      })}

      {/* Red units (spotted only) */}
      {showUnits && redUnits
        .filter((u) => u.spotted)
        .map((u) => {
          const { x: cx, y: cy } = hexCenter(u.col, u.row, r);
          const ucx = cx + pad;
          const ucy = cy + pad;
          const unitPts = hexPoints(ucx, ucy, r * 0.55);
          const hpFrac = u.hp / 100;
          const barW = r * 1.1;
          const barX = ucx - barW / 2;
          const barY = ucy + r * 0.65;
          return (
            <G key={`ru-${u.id}`}>
              <Polygon
                points={unitPts}
                fill="#2e1010"
                stroke="#a03030"
                strokeWidth={1}
              />
              <SvgText
                x={ucx}
                y={ucy + 3.5}
                textAnchor="middle"
                fontSize={7}
                fill={C.red}
                fontFamily="monospace"
              >
                {u.id}
              </SvgText>
              <SvgRect x={barX} y={barY} width={barW} height={2} fill={C.bg3} />
              <SvgRect
                x={barX}
                y={barY}
                width={barW * hpFrac}
                height={2}
                fill={C.red}
              />
            </G>
          );
        })}
    </Svg>
  );
});

export default HexMapView;
