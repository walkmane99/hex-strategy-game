import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PhoneTopBar from '@/components/ui/PhoneTopBar';
import TacBracket from '@/components/ui/TacBracket';
import TacHeader from '@/components/ui/TacHeader';
import TacBtn from '@/components/ui/TacBtn';
import CapRow from '@/components/ui/CapRow';
import { C, MONO, DISPLAY } from '@/constants/theme';

const SCORE_ROWS = [
  { label: 'クリア時間',   sub: '残3T × 10',      val: '+30' },
  { label: '残存ユニット', sub: '5体',             val: '+250' },
  { label: '特殊条件',     sub: 'HVT撃破',         val: '+80' },
  { label: '撃破数',       sub: '7体',             val: '+140' },
  { label: '低被害クリア', sub: '−4%',            val: '+90' },
  { label: '難易度補正',   sub: '×1.5 (HARD)',   val: 'x1.5' },
] as const;

const REWARDS = [
  { name: 'ドローン偵察', code: 'DRONE',    n: '×2' },
  { name: '迷彩ネット',   code: 'CAMO',     n: '×1' },
  { name: '新ユニット解放', code: 'ENGINEER', n: 'NEW' },
] as const;

export default function ResultScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <PhoneTopBar
        left="OPS › DEBRIEF"
        mid="作戦終了"
        right="04:33"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.debriefLabel}>—— DEBRIEF ——</Text>
          <Text style={styles.victory}>VICTORY</Text>
          <Text style={styles.victoryJa}>作戦目標を達成</Text>

          {/* Rank row */}
          <View style={styles.rankRow}>
            <View>
              <Text style={styles.rankLabel}>RANK</Text>
              <Text style={styles.rankLetter}>S</Text>
            </View>
            <View style={styles.rankStats}>
              <CapRow left="TURN" right="09 / 12" />
              <CapRow left="SURV" right="5 / 5" />
              <CapRow left="KILL" right="07" />
              <CapRow left="DMG" right="-04%" />
            </View>
          </View>
        </View>

        {/* Score breakdown */}
        <View style={styles.section}>
          <TacBracket label="SCORE / BREAKDOWN" padding={10}>
            {SCORE_ROWS.map((row, i) => (
              <View
                key={i}
                style={[
                  styles.scoreRow,
                  i < SCORE_ROWS.length - 1 && styles.scoreRowBorder,
                ]}
              >
                <Text style={styles.scoreLabel}>{row.label}</Text>
                <Text style={styles.scoreSub}>{row.sub}</Text>
                <Text style={styles.scoreVal}>{row.val}</Text>
              </View>
            ))}
            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL · POINTS</Text>
              <Text style={styles.totalVal}>885</Text>
            </View>
          </TacBracket>
        </View>

        {/* Rewards */}
        <View style={styles.section}>
          <TacHeader k="LOOT" label="獲得報酬" right="03" />
          <View style={styles.rewardRow}>
            {REWARDS.map((r) => (
              <View key={r.code} style={styles.rewardCard}>
                <Text style={styles.rewardCode}>{r.code}</Text>
                <Text style={styles.rewardName}>{r.name}</Text>
                <Text style={styles.rewardN}>{r.n}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TacBtn ghost style={styles.recordsBtn}>
          RECORDS
        </TacBtn>
        <TacBtn
          primary
          kbd="A"
          style={styles.nextBtn}
          onPress={() => router.replace('/')}
        >
          次の作戦へ
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
  headerSection: {
    paddingTop: 30,
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  debriefLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink3,
    letterSpacing: 3.2,
  },
  victory: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 48,
    fontWeight: '700',
    color: C.amberBright,
    letterSpacing: 1.4,
    marginTop: 6,
  },
  victoryJa: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.ink2,
    marginTop: 4,
    letterSpacing: 1.6,
  },
  rankRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-end',
    marginTop: 14,
  },
  rankLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  rankLetter: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 64,
    fontWeight: '700',
    color: C.amber,
    lineHeight: 70,
  },
  rankStats: {
    gap: 4,
    paddingBottom: 8,
  },
  section: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 5,
    marginBottom: 5,
  },
  scoreRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    borderStyle: 'dashed',
  },
  scoreLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.ink2,
    flex: 1,
  },
  scoreSub: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink3,
    marginRight: 8,
  },
  scoreVal: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 14,
    fontWeight: '700',
    color: C.amber,
    minWidth: 42,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.lineStrong,
  },
  totalLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink,
    letterSpacing: 1.8,
  },
  totalVal: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 30,
    fontWeight: '700',
    color: C.amberBright,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  rewardCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.amber,
    backgroundColor: '#2a1a08',
    padding: 8,
    gap: 2,
  },
  rewardCode: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  rewardName: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 11,
    fontWeight: '600',
    color: C.ink,
    lineHeight: 14,
  },
  rewardN: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 14,
    fontWeight: '700',
    color: C.amber,
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    paddingHorizontal: 14,
    backgroundColor: C.bg0,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  recordsBtn: {
    flex: 1,
  },
  nextBtn: {
    flex: 2,
  },
});
