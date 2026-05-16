import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, MONO } from '@/constants/theme';

interface TacTagProps {
  children: React.ReactNode;
  color?: string;
}

const TacTag = React.memo(function TacTag({ children, color = C.amber }: TacTagProps) {
  return (
    <View style={[styles.container, { borderColor: color }]}>
      <Text style={[styles.text, { color }]}>
        {typeof children === 'string' ? children.toUpperCase() : children}
      </Text>
    </View>
  );
});

export default TacTag;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  text: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
