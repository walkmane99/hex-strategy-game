import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { C, MONO, DISPLAY } from '@/constants/theme';

interface MissionStartOverlayProps {
  accent?: string;
  missionCode?: string;
  missionName?: string;
  onComplete?: () => void;
}

// アニメーションタイミング (ms)
const SLIDE_IN  = 300;
const HOLD      = 1500;
const FADE_OUT  = 500;
const TOTAL     = SLIDE_IN + HOLD + FADE_OUT;
const BAR_H     = 80; // バーの高さ (px) — 約 22% of ~360px map

export default function MissionStartOverlay({
  accent = C.amber,
  missionCode = 'OP. 0451',
  missionName = 'M-01 · 市街地制圧',
  onComplete,
}: MissionStartOverlayProps) {
  const easeOut = Easing.out(Easing.cubic);
  const easeIn  = Easing.in(Easing.cubic);

  // Shared values
  const barTopY    = useSharedValue(-BAR_H);
  const barBotY    = useSharedValue(BAR_H);
  const textOp     = useSharedValue(0);
  const textScaleX = useSharedValue(0.4);
  const subOp      = useSharedValue(0);
  const markOp     = useSharedValue(0);
  const markScale  = useSharedValue(0.5);
  const scanOp     = useSharedValue(0);

  useEffect(() => {
    // ── バー（上下）スライドイン → ホールド → スライドアウト ──
    barTopY.value = withSequence(
      withTiming(0,       { duration: SLIDE_IN, easing: easeOut }),
      withDelay(HOLD, withTiming(-BAR_H, { duration: FADE_OUT, easing: easeIn })),
    );
    barBotY.value = withSequence(
      withTiming(0,       { duration: SLIDE_IN, easing: easeOut }),
      withDelay(HOLD, withTiming(BAR_H, { duration: FADE_OUT, easing: easeIn })),
    );

    // ── MISSION START テキスト ──
    textOp.value = withDelay(SLIDE_IN + 200, withSequence(
      withTiming(1, { duration: 350, easing: easeOut }),
      withDelay(HOLD - 200, withTiming(0, { duration: FADE_OUT })),
    ));
    textScaleX.value = withDelay(SLIDE_IN + 200,
      withTiming(1, { duration: 350, easing: easeOut }),
    );

    // ── サブタイトル ──
    subOp.value = withDelay(SLIDE_IN + 400, withSequence(
      withTiming(1, { duration: 250, easing: easeOut }),
      withDelay(HOLD - 300, withTiming(0, { duration: FADE_OUT })),
    ));

    // ── コーナーブラケット ──
    markOp.value = withDelay(SLIDE_IN + 300, withSequence(
      withTiming(1, { duration: 300, easing: easeOut }),
      withDelay(HOLD - 200, withTiming(0, { duration: FADE_OUT })),
    ));
    markScale.value = withDelay(SLIDE_IN + 300,
      withTiming(1, { duration: 300, easing: easeOut }),
    );

    // ── スキャンライン ──
    scanOp.value = withDelay(SLIDE_IN + 200, withSequence(
      withTiming(0.7, { duration: 150 }),
      withDelay(HOLD - 200, withTiming(0, { duration: FADE_OUT })),
    ));

    // アニメーション完了後にコールバック
    const timer = setTimeout(() => onComplete?.(), TOTAL + 50);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animated styles
  const barTopStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: barTopY.value }] }));
  const barBotStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: barBotY.value }] }));
  const textStyle      = useAnimatedStyle(() => ({
    opacity: textOp.value,
    transform: [{ scaleX: textScaleX.value }],
  }));
  const subStyle       = useAnimatedStyle(() => ({ opacity: subOp.value }));
  const markStyle      = useAnimatedStyle(() => ({
    opacity: markOp.value,
    transform: [{ scale: markScale.value }],
  }));
  const scanStyle      = useAnimatedStyle(() => ({ opacity: scanOp.value }));

  const CORNERS: [boolean, boolean][] = [[false, false], [true, false], [false, true], [true, true]];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* 上バー */}
      <Animated.View
        style={[styles.bar, styles.barTop, { borderBottomColor: accent }, barTopStyle]}
      />
      {/* 下バー */}
      <Animated.View
        style={[styles.bar, styles.barBot, { borderTopColor: accent }, barBotStyle]}
      />

      {/* スキャンライン */}
      <Animated.View
        style={[styles.scanline, { backgroundColor: accent }, scanStyle]}
      />

      {/* コーナーブラケット */}
      {CORNERS.map(([right, bottom], i) => (
        <Animated.View
          key={i}
          style={[
            styles.cornerMark,
            {
              left:         right  ? undefined : 8,
              right:        right  ? 8 : undefined,
              top:          bottom ? undefined : '34%',
              bottom:       bottom ? '34%' : undefined,
              borderLeftWidth:   right  ? 0 : 1.5,
              borderRightWidth:  right  ? 1.5 : 0,
              borderTopWidth:    bottom ? 0 : 1.5,
              borderBottomWidth: bottom ? 1.5 : 0,
              borderColor: accent,
            },
            markStyle,
          ]}
        />
      ))}

      {/* MISSION START */}
      <Animated.View style={[styles.textWrap, textStyle]}>
        <Text style={[styles.missionText, { textShadowColor: accent }]}>
          MISSION START
        </Text>
      </Animated.View>

      {/* サブタイトル */}
      <Animated.View style={[styles.subWrap, subStyle]}>
        <View style={[styles.subLine, { backgroundColor: accent }]} />
        <Text style={[styles.subText, { color: accent }]}>
          {missionCode} · {missionName}
        </Text>
        <View style={[styles.subLine, { backgroundColor: accent }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_H,
    backgroundColor: 'rgba(7,9,10,0.92)',
    borderStyle: 'solid',
    borderWidth: 0,
  },
  barTop: {
    top: 0,
    borderBottomWidth: 1,
  },
  barBot: {
    bottom: 0,
    borderTopWidth: 1,
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    elevation: 4,
  },
  cornerMark: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderStyle: 'solid',
  },
  textWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '44%',
    alignItems: 'center',
  },
  missionText: {
    fontFamily: DISPLAY,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    color: '#f5efe2',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '57%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  subLine: {
    width: 18,
    height: 1,
  },
  subText: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 2,
  },
});
