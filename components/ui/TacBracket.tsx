import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { C, MONO } from '@/constants/theme';

interface TacBracketProps {
  children: React.ReactNode;
  color?: string;
  padding?: number;
  label?: string;
  count?: string;
  style?: ViewStyle;
  bgColor?: string;
}

const TacBracket = React.memo(function TacBracket({
  children,
  color = C.amber,
  padding = 10,
  label,
  count,
  style,
  bgColor = C.bg1,
}: TacBracketProps) {
  const cornerSize = 10;

  return (
    <View style={[{ marginTop: label ? 12 : 0 }, style]}>
      {label && (
        <View
          style={[
            styles.labelContainer,
            { backgroundColor: bgColor },
          ]}
        >
          <Text style={[styles.labelText, { color }]}>
            {label}{count ? ` · ${count}` : ''}
          </Text>
        </View>
      )}

      {/* Corner TL */}
      <View
        style={[
          styles.cornerTL,
          { width: cornerSize, height: cornerSize, borderTopColor: color, borderLeftColor: color },
        ]}
      />
      {/* Corner TR */}
      <View
        style={[
          styles.cornerTR,
          { width: cornerSize, height: cornerSize, borderTopColor: color, borderRightColor: color },
        ]}
      />
      {/* Corner BL */}
      <View
        style={[
          styles.cornerBL,
          { width: cornerSize, height: cornerSize, borderBottomColor: color, borderLeftColor: color },
        ]}
      />
      {/* Corner BR */}
      <View
        style={[
          styles.cornerBR,
          { width: cornerSize, height: cornerSize, borderBottomColor: color, borderRightColor: color },
        ]}
      />

      <View style={[styles.inner, { padding, backgroundColor: bgColor }]}>
        {children}
      </View>
    </View>
  );
});

export default TacBracket;

const styles = StyleSheet.create({
  labelContainer: {
    position: 'absolute',
    top: -8,
    left: 14,
    zIndex: 2,
    paddingHorizontal: 6,
  },
  labelText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1.2,
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 1,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    zIndex: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    zIndex: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  inner: {
    overflow: 'hidden',
  },
});
