import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, MONO } from '@/constants/theme';

interface TacHeaderProps {
  k: string;
  label: string;
  right?: string;
  color?: string;
}

const TacHeader = React.memo(function TacHeader({
  k,
  label,
  right,
  color = C.amber,
}: TacHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.key, { color }]}>{`<${k}>`}</Text>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dash} />
      {right !== undefined && (
        <Text style={styles.right}>{right}</Text>
      )}
    </View>
  );
});

export default TacHeader;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
  },
  key: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1.2,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink,
    letterSpacing: 2,
  },
  dash: {
    flex: 1,
    alignSelf: 'center',
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line,
  },
  right: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
});
