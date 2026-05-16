import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, MONO, DISPLAY } from '@/constants/theme';

interface PhoneTopBarProps {
  left: string;
  mid?: string;
  right?: string;
  color?: string;
}

const PhoneTopBar = React.memo(function PhoneTopBar({
  left,
  mid,
  right,
  color = C.amber,
}: PhoneTopBarProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.diamond, { color }]}>◆</Text>
      <Text style={styles.left}>{left}</Text>
      {mid !== undefined ? (
        <View style={styles.midContainer}>
          <Text style={styles.midText}>{mid}</Text>
        </View>
      ) : (
        <View style={styles.spacer} />
      )}
      {right !== undefined && (
        <Text style={styles.right}>{right}</Text>
      )}
    </View>
  );
});

export default PhoneTopBar;

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    backgroundColor: C.bg0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diamond: {
    fontFamily: 'monospace',
    fontSize: 9,
  },
  left: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink,
    letterSpacing: 1.8,
  },
  midContainer: {
    flex: 1,
    alignItems: 'center',
  },
  midText: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: 1.8,
  },
  spacer: {
    flex: 1,
  },
  right: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink2,
    letterSpacing: 1.4,
  },
});
