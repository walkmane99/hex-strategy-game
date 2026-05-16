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
import PhoneTopBar from '@/components/ui/PhoneTopBar';
import TacBracket from '@/components/ui/TacBracket';
import TacHeader from '@/components/ui/TacHeader';
import TacTag from '@/components/ui/TacTag';
import TacBtn from '@/components/ui/TacBtn';
import UnitGlyph from '@/components/units/UnitGlyph';
import { C, MONO, DISPLAY } from '@/constants/theme';

type StatKey = 'hp' | 'atk' | 'def' | 'mv' | 'scn';

const INITIAL_STATS: Record<StatKey, number> = {
  hp: 14,
  atk: 18,
  def: 8,
  mv: 10,
  scn: 6,
};

const STAT_LABELS: Record<StatKey, { code: string; kana: string }> = {
  hp:  { code: 'HP ', kana: '体力' },
  atk: { code: 'ATK', kana: '攻撃' },
  def: { code: 'DEF', kana: '防御' },
  mv:  { code: 'MV ', kana: '移動' },
  scn: { code: 'SCN', kana: '索敵' },
};

const TOTAL_POINTS = 10;
const BASE = 10;
const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'mv', 'scn'];

const StatRow = React.memo(function StatRow({
  statKey,
  value,
  remaining,
  onMinus,
  onPlus,
  isLast,
}: {
  statKey: StatKey;
  value: number;
  remaining: number;
  onMinus: () => void;
  onPlus: () => void;
  isLast: boolean;
}) {
  const { code, kana } = STAT_LABELS[statKey];
  const segments = 20;
  const baseSegments = BASE;
  const extraSegments = value > BASE ? value - BASE : 0;

  return (
    <View style={[styles.statRow, !isLast && styles.statRowBorder]}>
      {/* Label */}
      <View style={styles.statLabelCol}>
        <Text style={styles.statCode}>{code}</Text>
        <Text style={styles.statKana}>{kana}</Text>
      </View>

      {/* Bar */}
      <View style={styles.statBarWrap}>
        <View style={styles.statBarSegments}>
          {Array.from({ length: segments }).map((_, i) => {
            let bg: string;
            if (i < baseSegments) {
              bg = i < value ? C.amberSoft : C.bg2;
            } else {
              bg = i < value ? C.amber : C.bg4;
            }
            return (
              <View
                key={i}
                style={[styles.statBarSegment, { backgroundColor: bg }]}
              />
            );
          })}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.statControls}>
        <Pressable
          onPress={onMinus}
          disabled={value <= 1}
          style={[styles.ctrlBtn, styles.ctrlBtnMinus, value <= 1 && { opacity: 0.3 }]}
        >
          <Text style={styles.ctrlBtnText}>−</Text>
        </Pressable>
        <Text style={styles.statValue}>{value}</Text>
        <Pressable
          onPress={onPlus}
          disabled={remaining <= 0}
          style={[styles.ctrlBtn, styles.ctrlBtnPlus, remaining <= 0 && { opacity: 0.3 }]}
        >
          <Text style={[styles.ctrlBtnText, { color: C.amberBright }]}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
});

export default function CustomizeScreen() {
  const [stats, setStats] = useState<Record<StatKey, number>>({ ...INITIAL_STATS });

  const usedPoints = STAT_KEYS.reduce((sum, k) => {
    return sum + (stats[k] > BASE ? stats[k] - BASE : 0);
  }, 0);
  const remaining = TOTAL_POINTS - usedPoints;

  const adjustStat = (key: StatKey, delta: number) => {
    setStats((prev) => {
      const next = prev[key] + delta;
      if (next < 1) return prev;
      if (delta > 0 && remaining <= 0) return prev;
      if (delta > 0 && next > BASE + remaining + (prev[key] > BASE ? prev[key] - BASE : 0)) {
        return prev;
      }
      return { ...prev, [key]: next };
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <PhoneTopBar
        left="OPS › DEPLOY › TUNE"
        mid="ユニット調整"
        right="STEP 3/4"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {/* Unit card */}
        <View style={styles.section}>
          <TacBracket label="UNIT 02" count="ATTACKER" padding={12}>
            <View style={styles.unitCardRow}>
              {/* Glyph box */}
              <View style={styles.glyphBox}>
                <UnitGlyph kind="ATTACKER" size={56} color={C.amberBright} />
                <Text style={styles.glyphNum}>02</Text>
                <Text style={styles.glyphLevel}>SR · LV.7</Text>
              </View>
              {/* Info */}
              <View style={styles.unitInfo}>
                <Text style={styles.unitClass}>アタッカー</Text>
                <Text style={styles.unitClassEn}>ATTACKER · CLASS-A</Text>
                <View style={styles.tagsRow}>
                  <TacTag color={C.amber}>攻撃力重視</TacTag>
                  <TacTag color={C.cyan}>+ATK aura</TacTag>
                </View>
                <View style={styles.descBox}>
                  <Text style={styles.descText}>
                    {'周囲2マス以内の味方の攻撃力 +2。アサシンに強い／タンカーに弱い。'}
                  </Text>
                </View>
              </View>
            </View>
          </TacBracket>
        </View>

        {/* Point allocation */}
        <View style={styles.sectionPad}>
          <TacHeader
            k="ALLOC"
            label="ポイント振り分け"
            right={`${usedPoints} / ${TOTAL_POINTS} PT`}
          />
          <View style={styles.allocBlock}>
            {STAT_KEYS.map((key, i) => (
              <StatRow
                key={key}
                statKey={key}
                value={stats[key]}
                remaining={remaining}
                onMinus={() => adjustStat(key, -1)}
                onPlus={() => adjustStat(key, 1)}
                isLast={i === STAT_KEYS.length - 1}
              />
            ))}
            <View style={styles.ptRow}>
              <Text style={styles.ptLabel}>残 PT</Text>
              <Text style={styles.ptValue}>{remaining}</Text>
            </View>
          </View>
        </View>

        {/* Affinity */}
        <View style={styles.sectionPad}>
          <TacHeader k="REL" label="相性" />
          <View style={styles.affinityRow}>
            {/* Strong vs */}
            <View style={styles.affinityBox}>
              <Text style={[styles.affinityTitle, { color: C.green }]}>STRONG VS</Text>
              <View style={styles.affinityInner}>
                <UnitGlyph kind="ASSASSIN" size={16} color={C.green} />
                <Text style={styles.affinityName}>アサシン</Text>
                <Text style={[styles.affinityBonus, { color: C.green }]}>+30%</Text>
              </View>
            </View>
            {/* Weak vs */}
            <View style={styles.affinityBox}>
              <Text style={[styles.affinityTitle, { color: C.red }]}>WEAK VS</Text>
              <View style={styles.affinityInner}>
                <UnitGlyph kind="TANKER" size={16} color={C.red} />
                <Text style={styles.affinityName}>タンカー</Text>
                <Text style={[styles.affinityBonus, { color: C.red }]}>−30%</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TacBtn ghost style={styles.backBtn} onPress={() => router.back()}>
          ＜ 戻る
        </TacBtn>
        <TacBtn
          primary
          kbd="A"
          style={styles.nextBtn}
          onPress={() => router.push('/game/items')}
        >
          確定 / NEXT
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
    paddingBottom: 6,
  },
  sectionPad: {
    padding: 8,
    paddingHorizontal: 14,
  },
  unitCardRow: {
    flexDirection: 'row',
    gap: 14,
  },
  glyphBox: {
    width: 96,
    height: 96,
    borderWidth: 1,
    borderColor: C.amber,
    backgroundColor: C.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphNum: {
    position: 'absolute',
    top: 4,
    left: 6,
    fontFamily: 'monospace',
    fontSize: 8,
    color: C.amber,
  },
  glyphLevel: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    fontFamily: 'monospace',
    fontSize: 8,
    color: C.ink3,
  },
  unitInfo: {
    flex: 1,
    gap: 4,
  },
  unitClass: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
  },
  unitClassEn: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
    letterSpacing: 1.6,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  descBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line,
    padding: 6,
    marginTop: 2,
  },
  descText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.ink2,
    lineHeight: 18,
  },
  allocBlock: {
    backgroundColor: C.bg1,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  statRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    borderStyle: 'dashed',
  },
  statLabelCol: {
    width: 38,
  },
  statCode: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink2,
  },
  statKana: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  statBarWrap: {
    flex: 1,
  },
  statBarSegments: {
    flexDirection: 'row',
    gap: 1,
  },
  statBarSegment: {
    flex: 1,
    height: 8,
  },
  statControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctrlBtn: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnMinus: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: 'transparent',
  },
  ctrlBtnPlus: {
    borderWidth: 1,
    borderColor: C.amber,
    backgroundColor: C.amberSoft,
  },
  ctrlBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.ink,
    lineHeight: 16,
  },
  statValue: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.amber,
    minWidth: 22,
    textAlign: 'center',
  },
  ptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  ptLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink3,
  },
  ptValue: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 18,
    fontWeight: '700',
    color: C.amber,
  },
  affinityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  affinityBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg1,
    padding: 8,
    gap: 4,
  },
  affinityTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
  },
  affinityInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  affinityName: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.ink,
    flex: 1,
  },
  affinityBonus: {
    fontFamily: 'monospace',
    fontSize: 10,
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
