import { Platform } from 'react-native';

export const C = {
  bg0: '#07090a',
  bg1: '#0d1012',
  bg2: '#14181b',
  bg3: '#1c2125',
  bg4: '#262c30',
  line: '#2d343a',
  lineStrong: '#3d464d',
  ink: '#e6e2d6',
  ink2: '#aaa69a',
  ink3: '#6b6b62',
  ink4: '#3f4347',
  amber: '#ff8a1e',
  amberBright: '#ffb547',
  amberSoft: '#6b3a06',
  red: '#e23a2b',
  redSoft: '#4a1410',
  cyan: '#2ec5d3',
  green: '#5eaa3a',
  olive: '#4a4f2a',
} as const;

export const MONO = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: 'monospace',
}) as string;

export const DISPLAY = Platform.select({
  ios: 'System',
  android: 'sans-serif-condensed',
  default: 'System',
}) as string;
