import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { OffsetCoord } from '@/types/map';
import { C } from '@/constants/theme';

const cols = 10;
const rows = 10;
const r = 18;
const pad = 6;
const svgW = pad * 2 + r + (cols - 1) * 1.5 * r + r;
const svgH = pad * 2 + rows * Math.sqrt(3) * r + (Math.sqrt(3) * r) / 2;

interface HexOverlayViewProps {
  width: number;
  reachableCells: OffsetCoord[];
  attackableCells: OffsetCoord[];
  selectedHex: OffsetCoord | null;
}

function hexCenterSVG(col: number, row: number) {
  return {
    x: pad + r + col * 1.5 * r,
    y: pad + r + row * Math.sqrt(3) * r + (col % 2 ? (Math.sqrt(3) * r) / 2 : 0),
  };
}

function hexPolyPoints(cx: number, cy: number, size: number): string {
  return Array.from({ length: 6 })
    .map((_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`;
    })
    .join(' ');
}

const HexOverlayView = React.memo(function HexOverlayView({
  width,
  reachableCells,
  attackableCells,
  selectedHex,
}: HexOverlayViewProps) {
  const scale = width / svgW;
  const viewHeight = svgH * scale;

  const reachableSet = useMemo(
    () => new Set(reachableCells.map((c) => `${c.col},${c.row}`)),
    [reachableCells]
  );
  const attackableSet = useMemo(
    () => new Set(attackableCells.map((c) => `${c.col},${c.row}`)),
    [attackableCells]
  );

  const allCells = useMemo(() => {
    const result: Array<{ col: number; row: number; pts: string }> = [];
    for (let c = 0; c < cols; c++) {
      for (let ro = 0; ro < rows; ro++) {
        const { x: cx, y: cy } = hexCenterSVG(c, ro);
        result.push({ col: c, row: ro, pts: hexPolyPoints(cx, cy, r - 0.6) });
      }
    }
    return result;
  }, []);

  return (
    <View style={[StyleSheet.absoluteFillObject, { width, height: viewHeight }]} pointerEvents="none">
      <Svg width={width} height={viewHeight} viewBox={`0 0 ${svgW} ${svgH}`}>
        {attackableCells.length > 0 &&
          allCells
            .filter(({ col, row }) => attackableSet.has(`${col},${row}`))
            .map(({ col, row, pts }) => (
              <Polygon
                key={`atk-${col}-${row}`}
                points={pts}
                fill={C.red}
                stroke="none"
                opacity={0.2}
              />
            ))}
        {reachableCells.length > 0 &&
          allCells
            .filter(({ col, row }) => reachableSet.has(`${col},${row}`))
            .map(({ col, row, pts }) => (
              <Polygon
                key={`mv-${col}-${row}`}
                points={pts}
                fill="none"
                stroke={C.amber}
                strokeWidth={0.5}
                strokeDasharray="1.2,1.2"
                opacity={0.85}
              />
            ))}
        {selectedHex &&
          allCells
            .filter(({ col, row }) => col === selectedHex.col && row === selectedHex.row)
            .map(({ col, row, pts }) => (
              <Polygon
                key={`sel-${col}-${row}`}
                points={pts}
                fill="none"
                stroke={C.amber}
                strokeWidth={2}
              />
            ))}
      </Svg>
    </View>
  );
});

export default HexOverlayView;
