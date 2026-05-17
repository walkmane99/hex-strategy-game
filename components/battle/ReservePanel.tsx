import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Unit } from '@/types/unit';
import { C, MONO, DISPLAY } from '@/constants/theme';
import { UNIT_NAMES_JA } from '@/constants/unitStats';
import UnitGlyph from '@/components/units/UnitGlyph';

interface ReservePanelProps {
  playerReserve: Unit | null;
  enemyReserve: Unit | null;
}

export default function ReservePanel({ playerReserve, enemyReserve }: ReservePanelProps) {
  if (!playerReserve && !enemyReserve) return null;

  return (
    <View style={styles.container}>
      {playerReserve && (
        <View style={[styles.panel, styles.playerPanel]}>
          <Text style={styles.sideLabel}>予備 / ALLY</Text>
          <View style={styles.row}>
            <View style={styles.glyphBox}>
              <UnitGlyph kind={playerReserve.type.toUpperCase()} size={16} color={C.amber} />
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.unitName}>{UNIT_NAMES_JA[playerReserve.type]}</Text>
              <Text style={styles.statsLine}>
                {`HP ${playerReserve.stats.maxHP} · ATK ${playerReserve.stats.attack} · DEF ${playerReserve.stats.defense}`}
              </Text>
              <Text style={styles.statsLine}>
                {`MV ${playerReserve.stats.movement} · SCN ${playerReserve.stats.scout}`}
              </Text>
            </View>
          </View>
        </View>
      )}
      {enemyReserve && (
        <View style={[styles.panel, styles.enemyPanel]}>
          <Text style={[styles.sideLabel, { color: C.cyan }]}>予備 / ENEMY</Text>
          <View style={styles.row}>
            <View style={[styles.glyphBox, { borderColor: C.cyan }]}>
              <UnitGlyph kind={enemyReserve.type.toUpperCase()} size={16} color={C.cyan} />
            </View>
            {/* カスタマイズ内容は非公開 (仕様書 8.1) */}
            <Text style={styles.hiddenStats}>
              {UNIT_NAMES_JA[enemyReserve.type]}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 6,
  },
  panel: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 140,
  },
  playerPanel: {
    borderColor: C.amber,
    backgroundColor: '#1a0d00',
  },
  enemyPanel: {
    borderColor: C.cyan,
    backgroundColor: '#001a1f',
  },
  sideLabel: {
    fontFamily: MONO,
    fontSize: 7,
    color: C.amber,
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glyphBox: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: C.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCol: {
    flex: 1,
    gap: 1,
  },
  unitName: {
    fontFamily: DISPLAY,
    fontSize: 10,
    fontWeight: '600',
    color: C.ink,
  },
  statsLine: {
    fontFamily: MONO,
    fontSize: 7,
    color: C.ink3,
  },
  hiddenStats: {
    fontFamily: DISPLAY,
    fontSize: 10,
    fontWeight: '600',
    color: C.ink,
  },
});
