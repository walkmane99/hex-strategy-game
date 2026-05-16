import React from 'react';
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
import Svg, { Line, Circle } from 'react-native-svg';
import PhoneTopBar from '@/components/ui/PhoneTopBar';
import TacBracket from '@/components/ui/TacBracket';
import TacTag from '@/components/ui/TacTag';
import TacBtn from '@/components/ui/TacBtn';
import CapRow from '@/components/ui/CapRow';
import { C, MONO, DISPLAY } from '@/constants/theme';

const STAGES = [
  { id: 'M-01', name: '渓谷の哨戒', mode: '殲滅戦', diff: 'NORMAL', clear: true, rank: 'S' },
  { id: 'M-02', name: '廃墟の確保', mode: '陣地確保', diff: 'NORMAL', clear: true, rank: 'A' },
  { id: 'M-03', name: '夜霧の街', mode: '生存戦', diff: 'HARD', clear: true, rank: 'B' },
  { id: 'M-04', name: '貯水池の罠', mode: '脱出戦', diff: 'HARD', clear: false, rank: '—', current: true },
  { id: 'M-05', name: '第七区画', mode: '攻防非対称', diff: 'EXPERT', clear: false, rank: '—', locked: true },
  { id: 'M-06', name: '前線突破', mode: 'ペイロード', diff: 'EXPERT', clear: false, rank: '—', locked: true },
] as const;

type Stage = typeof STAGES[number];

function getDiffColor(diff: string): string {
  if (diff === 'EXPERT') return C.red;
  if (diff === 'HARD') return C.amber;
  return C.ink2;
}

function getRankColor(rank: string): string {
  if (rank === 'S') return C.amberBright;
  return C.ink2;
}

const MiniMap = React.memo(function MiniMap() {
  const dotPositions = [
    { cx: 14, cy: 14, color: C.amber },
    { cx: 30, cy: 22, color: C.amber },
    { cx: 50, cy: 12, color: C.amber },
    { cx: 60, cy: 36, color: C.amber },
    { cx: 20, cy: 50, color: C.ink3 },
    { cx: 70, cy: 58, color: C.ink3 },
  ];
  const gridLines = [];
  for (let i = 0; i <= 8; i++) {
    gridLines.push(
      <Line
        key={`h${i}`}
        x1={0}
        y1={i * 10}
        x2={84}
        y2={i * 10}
        stroke={C.line}
        strokeWidth={0.5}
      />,
      <Line
        key={`v${i}`}
        x1={i * 10}
        y1={0}
        x2={i * 10}
        y2={84}
        stroke={C.line}
        strokeWidth={0.5}
      />
    );
  }
  return (
    <Svg width={84} height={84} viewBox="0 0 84 84">
      {gridLines}
      {dotPositions.map((d, i) => (
        <Circle key={i} cx={d.cx} cy={d.cy} r={3} fill={d.color} />
      ))}
    </Svg>
  );
});

const StageCard = React.memo(function StageCard({
  stage,
  onPress,
}: {
  stage: Stage;
  onPress: () => void;
}) {
  const isCurrent = 'current' in stage && stage.current;
  const isLocked = 'locked' in stage && stage.locked;
  const diffColor = getDiffColor(stage.diff);

  return (
    <Pressable onPress={onPress} disabled={isLocked} style={{ opacity: isLocked ? 0.45 : 1 }}>
      {isCurrent ? (
        <LinearGradient
          colors={['#2a1a08', '#14181b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.stageCard, { borderColor: C.amber }]}
        >
          <StageCardInner stage={stage} diffColor={diffColor} isCurrent={!!isCurrent} isLocked={!!isLocked} />
        </LinearGradient>
      ) : (
        <View style={[styles.stageCard, { borderColor: C.line, backgroundColor: C.bg1 }]}>
          <StageCardInner stage={stage} diffColor={diffColor} isCurrent={!!isCurrent} isLocked={!!isLocked} />
        </View>
      )}
    </Pressable>
  );
});

const StageCardInner = React.memo(function StageCardInner({
  stage,
  diffColor,
  isCurrent,
  isLocked,
}: {
  stage: Stage;
  diffColor: string;
  isCurrent: boolean;
  isLocked: boolean;
}) {
  return (
    <View style={styles.cardRow}>
      {/* ID */}
      <Text style={[styles.stageId, { color: isCurrent ? C.amber : C.ink2 }]}>
        {stage.id}
      </Text>
      {/* Main */}
      <View style={styles.stageMain}>
        <Text style={styles.stageName}>
          {isLocked ? '— LOCKED —' : stage.name}
        </Text>
        <View style={styles.stageMeta}>
          <Text style={styles.stageMode}>{stage.mode}</Text>
          <Text style={[styles.stageDiff, { color: diffColor }]}>{stage.diff}</Text>
        </View>
      </View>
      {/* Rank / Indicator */}
      <View style={styles.rankCol}>
        {isCurrent ? (
          <Text style={styles.nowLabel}>▶ NOW</Text>
        ) : stage.clear ? (
          <>
            <Text style={[styles.rankLetter, { color: getRankColor(stage.rank) }]}>
              {stage.rank}
            </Text>
            <Text style={styles.clrLabel}>CLR</Text>
          </>
        ) : (
          <Text style={styles.rankDash}>—</Text>
        )}
      </View>
    </View>
  );
});

export default function StageSelectScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <PhoneTopBar
        left="MENU › OPS › DEPLOY"
        mid="作戦選択"
        right="04:21"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Theatre info */}
        <View style={styles.section}>
          <TacBracket label="THEATRE / SECTOR-7" padding={10}>
            <View style={styles.theatreRow}>
              <View style={styles.miniMapBox}>
                <MiniMap />
              </View>
              <View style={styles.theatreInfo}>
                <CapRow left="THEATRE" right="SECTOR 7" />
                <CapRow left="WEATHER" right="OVERCAST" />
                <CapRow left="VISIBILITY" right="0.8 KM" />
                <CapRow left="HOSTILES" right="EST. 12" />
                <View style={styles.tagRow}>
                  <TacTag color={C.amber}>HARD</TacTag>
                  <TacTag color={C.cyan}>NEW</TacTag>
                </View>
              </View>
            </View>
          </TacBracket>
        </View>

        {/* Cursor info */}
        <Text style={styles.cursorInfo}>
          {'> 6 MISSIONS · 3 LOCKED · CURSOR ON M-04'}
        </Text>

        {/* Stage list */}
        <View style={styles.stageList}>
          {STAGES.map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              onPress={() => {
                if (!('locked' in stage && stage.locked)) {
                  router.push('/game/strategy');
                }
              }}
            />
          ))}
        </View>

        {/* Bottom padding for absolute button */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Deploy button */}
      <View style={styles.bottomBar}>
        <TacBtn
          primary
          full
          kbd="A"
          onPress={() => router.push('/game/strategy')}
        >
          M-04 へ展開 / DEPLOY
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
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    padding: 14,
  },
  theatreRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  miniMapBox: {
    width: 84,
    height: 84,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg0,
    overflow: 'hidden',
  },
  theatreInfo: {
    flex: 1,
    gap: 3,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  cursorInfo: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  stageList: {
    paddingHorizontal: 14,
    gap: 6,
  },
  stageCard: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stageId: {
    fontFamily: 'monospace',
    fontSize: 11,
    width: 36,
  },
  stageMain: {
    flex: 1,
  },
  stageName: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
  },
  stageMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  stageMode: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  stageDiff: {
    fontFamily: 'monospace',
    fontSize: 9,
  },
  rankCol: {
    width: 44,
    alignItems: 'center',
  },
  nowLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.amber,
  },
  rankLetter: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 18,
    fontWeight: '700',
  },
  clrLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: C.ink3,
  },
  rankDash: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.ink3,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    backgroundColor: C.bg0,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
});
