import React from 'react';
import { View, StyleSheet } from 'react-native';
import UnitGlyph from '@/components/units/UnitGlyph';
import { C } from '@/constants/theme';
import { Unit } from '@/types/unit';
import { OffsetCoord } from '@/types/map';

interface UnitTokenProps {
  unitId: string;
  unitData: Unit;
  isSelected: boolean;
  pixelX: number;
  pixelY: number;
  tokenSize: number;
  movePath: OffsetCoord[];
  pathIndex: number;
  pathProgress: number;
  pathSegmentPixels: Array<{ x: number; y: number }>;
}

export default function UnitToken({
  unitData,
  isSelected,
  pixelX,
  pixelY,
  tokenSize,
}: UnitTokenProps) {
  if (unitData.isDead) return null;

  const isPlayer = unitData.side === 'player';
  const hpFrac = unitData.currentHP / unitData.stats.maxHP;
  const half = tokenSize / 2;

  return (
    <View
      style={[
        styles.token,
        {
          left: pixelX - half,
          top: pixelY - half,
          width: tokenSize,
          height: tokenSize,
          borderRadius: half,
          backgroundColor: isPlayer ? '#1a2e4a' : '#2e1010',
          borderColor: isSelected ? C.amber : isPlayer ? '#2e6aad' : '#a03030',
          borderWidth: isSelected ? 2 : 1,
          opacity: unitData.hasActed ? 0.5 : 1,
          elevation: isSelected ? 4 : 1,
        },
      ]}
    >
      <UnitGlyph
        kind={unitData.type.toUpperCase()}
        size={tokenSize * 0.55}
        color={isPlayer ? C.cyan : C.red}
      />
      <View style={[styles.hpBarBg, { width: tokenSize - 4 }]}>
        <View
          style={[
            styles.hpBarFill,
            {
              width: (tokenSize - 4) * hpFrac,
              backgroundColor:
                hpFrac > 0.5 ? C.green : hpFrac > 0.25 ? C.amber : C.red,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  token: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hpBarBg: {
    position: 'absolute',
    bottom: 2,
    height: 2,
    backgroundColor: '#333',
  },
  hpBarFill: {
    height: 2,
  },
});
