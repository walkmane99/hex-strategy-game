import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, MONO } from '@/constants/theme';

interface MeterProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  segments?: number;
  showLabel?: boolean;
}

const Meter = React.memo(function Meter({
  value,
  max = 20,
  color = C.amber,
  height = 4,
  segments = 20,
  showLabel = false,
}: MeterProps) {
  const fillCount = Math.round((value / max) * segments);

  return (
    <View style={styles.row}>
      <View style={styles.segmentRow}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                height,
                backgroundColor: i < fillCount ? color : C.bg3,
              },
            ]}
          />
        ))}
      </View>
      {showLabel && (
        <Text style={styles.label}>{value}</Text>
      )}
    </View>
  );
});

export default Meter;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 1,
    flex: 1,
  },
  segment: {
    flex: 1,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
    minWidth: 18,
    textAlign: 'right',
  },
});
