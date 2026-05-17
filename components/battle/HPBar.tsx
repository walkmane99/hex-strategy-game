import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface HPBarProps {
  current: number;
  max: number;
  width?: number;
  showText?: boolean;
}

const HP_COLOR_HIGH = '#4CAF50';
const HP_COLOR_MID  = '#FFB347';
const HP_COLOR_LOW  = '#E63946';

function getHpColor(ratio: number): string {
  if (ratio > 0.5) return HP_COLOR_HIGH;
  if (ratio > 0.25) return HP_COLOR_MID;
  return HP_COLOR_LOW;
}

const HPBar: React.FC<HPBarProps> = React.memo(
  ({ current, max, width = 36, showText = true }) => {
    const ratio = Math.max(0, Math.min(1, current / max));
    const color = getHpColor(ratio);
    const fillWidth = Math.round(ratio * (width - 2));

    return (
      <View style={[styles.container, { width }]}>
        <View style={[styles.bar, { width }]}>
          <View style={[styles.fill, { width: fillWidth, backgroundColor: color }]} />
        </View>
        {showText && (
          <Text style={styles.text} numberOfLines={1}>
            {current}/{max}
          </Text>
        )}
      </View>
    );
  }
);

HPBar.displayName = 'HPBar';

export default HPBar;

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  bar: {
    height: 4,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  text: {
    color: '#cfcfcf',
    fontSize: 8,
    fontFamily: 'monospace',
    marginTop: 1,
  },
});
