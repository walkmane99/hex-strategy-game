import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, MONO } from '@/constants/theme';

interface CapRowProps {
  left: string;
  right: string;
  color?: string;
}

const CapRow = React.memo(function CapRow({ left, right, color = C.ink3 }: CapRowProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color }]}>{left.toUpperCase()}</Text>
      <Text style={[styles.text, { color }]}>{right.toUpperCase()}</Text>
    </View>
  );
});

export default CapRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  text: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
