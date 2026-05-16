import React from 'react';
import { Pressable, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { C, MONO, DISPLAY } from '@/constants/theme';

interface TacBtnProps {
  children?: React.ReactNode;
  primary?: boolean;
  ghost?: boolean;
  onPress?: () => void;
  kbd?: string;
  style?: ViewStyle;
  full?: boolean;
  small?: boolean;
}

const TacBtn = React.memo(function TacBtn({
  children,
  primary = false,
  ghost = false,
  onPress,
  kbd,
  style,
  full = false,
  small = false,
}: TacBtnProps) {
  const borderColor = primary ? C.amber : C.line;
  const backgroundColor = primary ? C.amber : ghost ? 'transparent' : C.bg2;
  const textColor = primary ? '#0a0c0d' : C.ink;
  const pv = small ? 7 : 12;
  const ph = small ? 12 : 16;
  const fontSize = small ? 12 : 14;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          borderColor,
          backgroundColor,
          paddingVertical: pv,
          paddingHorizontal: ph,
          width: full ? '100%' : undefined,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <View style={styles.inner}>
        <Text
          style={[
            styles.label,
            {
              color: textColor,
              fontSize,
            },
          ]}
        >
          {typeof children === 'string' ? children.toUpperCase() : children}
        </Text>
        {kbd !== undefined && (
          <Text style={[styles.kbd, { color: textColor }]}>
            {` [${kbd}]`}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

export default TacBtn;

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'sans-serif-condensed',
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  kbd: {
    fontFamily: 'monospace',
    fontSize: 10,
    opacity: 0.7,
  },
});
