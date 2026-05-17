import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setSelectedSquad, setSelectedReserve } from '@/store/slices/playerSlice';
import { UnitType } from '@/types/unit';
import { UNIT_NAMES_JA, INITIAL_UNITS } from '@/constants/unitStats';
import { UNIT_CONFIG } from '@/constants/gameConfig';
import PhoneTopBar from '@/components/ui/PhoneTopBar';
import TacBracket from '@/components/ui/TacBracket';
import TacHeader from '@/components/ui/TacHeader';
import TacBtn from '@/components/ui/TacBtn';
import UnitGlyph from '@/components/units/UnitGlyph';
import { C, MONO, DISPLAY } from '@/constants/theme';

// Hardcoded stat bars for display (5 segments each)
const UNIT_STAT_BARS: Record<string, number[]> = {
  tanker:      [4, 2, 5, 2, 2],
  attacker:    [4, 5, 2, 3, 2],
  healer:      [4, 1, 3, 3, 3],
  seeker:      [4, 2, 2, 5, 5],
  assassin:    [4, 4, 2, 5, 3],
  sniper:      [4, 5, 1, 2, 3],
  archer:      [4, 4, 2, 3, 3],
  engineer:    [4, 2, 3, 3, 4],
  berserker:   [4, 4, 3, 3, 2],
  illusionist: [4, 2, 2, 4, 4],
};

const STAT_LABELS = ['HP', 'ATK', 'DEF', 'MV', 'SCN'];

const SlotBox = React.memo(function SlotBox({
  unitType,
  index,
  isReserve,
}: {
  unitType?: UnitType;
  index: number;
  isReserve?: boolean;
}) {
  const label = isReserve ? 'RES' : `0${index + 1}`;
  const isFilled = unitType !== undefined;

  if (isFilled) {
    return (
      <LinearGradient
        colors={['#2a1a08', '#14181b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.slot}
      >
        <UnitGlyph kind={unitType.toUpperCase()} size={22} color={C.amber} />
        <Text style={styles.slotLabel}>{label}</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.slot, styles.slotEmpty]}>
      <Text style={styles.slotEmptyDash}>·</Text>
      <Text style={[styles.slotLabel, { color: C.ink4 }]}>{label}</Text>
    </View>
  );
});

const StatMiniBar = React.memo(function StatMiniBar({ bars }: { bars: number[] }) {
  return (
    <View style={styles.statBarsWrap}>
      <View style={styles.statBarsRow}>
        {STAT_LABELS.map((lbl, si) => (
          <View key={lbl} style={styles.statBarCol}>
            <View style={styles.statBarSegments}>
              {Array.from({ length: 5 }).map((_, bi) => (
                <View
                  key={bi}
                  style={[
                    styles.statSegment,
                    { backgroundColor: bi < (bars[si] ?? 0) ? C.amber : C.bg3 },
                  ]}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.statBarLabels}>{'HP·ATK·DEF·MV·SCN'}</Text>
    </View>
  );
});

const UnitRow = React.memo(function UnitRow({
  unitType,
  count,
  isLocked,
  onPress,
  onLongPress,
}: {
  unitType: UnitType;
  count: number;
  isLocked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const bars = UNIT_STAT_BARS[unitType] ?? [3, 3, 3, 3, 3];
  const isSelected = count > 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={isLocked}
      style={{ opacity: isLocked ? 0.4 : 1 }}
      delayLongPress={400}
    >
      {isSelected ? (
        <LinearGradient
          colors={['#2a1a08', '#14181b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.unitRow, { borderColor: C.amber }]}
        >
          <UnitRowInner unitType={unitType} bars={bars} count={count} />
        </LinearGradient>
      ) : (
        <View style={[styles.unitRow, { borderColor: C.line, backgroundColor: C.bg1 }]}>
          <UnitRowInner unitType={unitType} bars={bars} count={count} />
        </View>
      )}
    </Pressable>
  );
});

const UnitRowInner = React.memo(function UnitRowInner({
  unitType,
  bars,
  count,
}: {
  unitType: UnitType;
  bars: number[];
  count: number;
}) {
  const isSelected = count > 0;
  const indicatorText = count === 0 ? '○' : count === 1 ? '●' : `×${count}`;
  const indicatorColor = count === 0 ? C.ink3 : count > 1 ? C.amberBright : C.amber;

  return (
    <>
      {/* Icon box */}
      <View style={[styles.iconBox, { borderColor: isSelected ? C.amber : C.line }]}>
        <UnitGlyph kind={unitType.toUpperCase()} size={20} color={isSelected ? C.amber : C.ink2} />
      </View>
      {/* Name + kind */}
      <View style={styles.nameCol}>
        <Text style={styles.unitName}>{UNIT_NAMES_JA[unitType]}</Text>
        <Text style={styles.unitKind}>{unitType.toUpperCase()}</Text>
      </View>
      {/* Stat bars */}
      <StatMiniBar bars={bars} />
      {/* Count indicator */}
      <Text style={[styles.indicator, { color: indicatorColor }]}>{indicatorText}</Text>
    </>
  );
});

export default function UnitSelectScreen() {
  const dispatch = useAppDispatch();
  const unlockedUnits = useAppSelector((s) => s.player.unlockedUnitTypes);
  const [selectedUnits, setSelectedUnits] = useState<UnitType[]>([]);

  const totalSlots = UNIT_CONFIG.MAX_TEAM_SIZE + UNIT_CONFIG.RESERVE_SIZE;

  const addUnit = (type: UnitType) => {
    if (selectedUnits.length < totalSlots) {
      setSelectedUnits((prev) => [...prev, type]);
    }
  };

  const removeUnit = (type: UnitType) => {
    setSelectedUnits((prev) => {
      const idx = prev.lastIndexOf(type);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  };

  // count per unit type
  const unitCounts: Partial<Record<UnitType, number>> = {};
  for (const t of selectedUnits) {
    unitCounts[t] = (unitCounts[t] ?? 0) + 1;
  }

  const mainUnits = selectedUnits.slice(0, UNIT_CONFIG.MAX_TEAM_SIZE);
  const reserveUnit = selectedUnits[UNIT_CONFIG.MAX_TEAM_SIZE];

  // Use unlockedUnits if available, fallback to INITIAL_UNITS
  const availableUnits: UnitType[] =
    unlockedUnits && unlockedUnits.length > 0 ? unlockedUnits : INITIAL_UNITS;

  const pointsUsed = selectedUnits.length * 4; // placeholder calculation

  return (
    <SafeAreaView style={styles.safeArea}>
      <PhoneTopBar
        left="OPS › DEPLOY › ROSTER"
        mid="編成 ／ 5+1"
        right="STEP 2/4"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {/* Squad selected */}
        <View style={styles.section}>
          <TacBracket label="SQUAD / SELECTED" count="5+1" padding={10}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.slotRow}>
                {Array.from({ length: UNIT_CONFIG.MAX_TEAM_SIZE }).map((_, i) => (
                  <SlotBox
                    key={i}
                    index={i}
                    unitType={mainUnits[i]}
                  />
                ))}
                <SlotBox
                  index={5}
                  unitType={reserveUnit}
                  isReserve
                />
              </View>
            </ScrollView>
            <View style={styles.squadFooter}>
              <Text style={styles.squadFooterLeft}>
                {`主力 ${mainUnits.length} ／ 予備 ${reserveUnit ? 1 : 0}`}
              </Text>
              <Text style={styles.squadFooterRight}>
                {`POINTS USED · ${pointsUsed} / 60`}
              </Text>
            </View>
          </TacBracket>
        </View>

        {/* Roster header */}
        <View style={styles.sectionPad}>
          <TacHeader k="ROSTER" label="利用可能ユニット" right={`${availableUnits.length} / 20`} />
        </View>

        {/* Unit list */}
        <View style={styles.unitList}>
          {availableUnits.map((type) => (
            <UnitRow
              key={type}
              unitType={type}
              count={unitCounts[type] ?? 0}
              isLocked={false}
              onPress={() => addUnit(type)}
              onLongPress={() => removeUnit(type)}
            />
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TacBtn ghost style={styles.backBtn} onPress={() => router.back()}>
          ＜ BACK
        </TacBtn>
        <TacBtn
          primary
          kbd="A"
          style={styles.nextBtn}
          onPress={() => {
            dispatch(setSelectedSquad(mainUnits));
            dispatch(setSelectedReserve(reserveUnit ?? null));
            router.push('/game/customize');
          }}
        >
          カスタマイズへ ▶
        </TacBtn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg0,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  section: {
    padding: 14,
  },
  sectionPad: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slot: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: C.amber,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  slotEmpty: {
    borderColor: C.line,
    backgroundColor: C.bg2,
  },
  slotLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: C.amber,
  },
  slotEmptyDash: {
    fontSize: 18,
    color: C.ink4,
  },
  squadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  squadFooterLeft: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  squadFooterRight: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.amber,
  },
  unitList: {
    paddingHorizontal: 14,
    gap: 6,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderWidth: 1,
    backgroundColor: C.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCol: {
    width: 70,
  },
  unitName: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
  },
  unitKind: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  statBarsWrap: {
    flex: 1,
  },
  statBarsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  statBarCol: {
    flex: 1,
  },
  statBarSegments: {
    flexDirection: 'column',
    gap: 1,
  },
  statSegment: {
    height: 3,
    width: '100%',
  },
  statBarLabels: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: C.ink3,
    marginTop: 2,
  },
  indicator: {
    fontFamily: 'monospace',
    fontSize: 11,
    width: 14,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: C.bg0,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  backBtn: {
    flex: 1,
  },
  nextBtn: {
    flex: 2,
  },
});
