import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { C } from '@/constants/theme';

interface UnitGlyphProps {
  kind: string;
  size?: number;
  color?: string;
}

const UnitGlyph = React.memo(function UnitGlyph({
  kind,
  size = 18,
  color = C.amber,
}: UnitGlyphProps) {
  const commonProps = {
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const renderIcon = () => {
    switch (kind.toUpperCase()) {
      case 'TANKER':
        return (
          <>
            <Path {...commonProps} d="M4 14 L12 5 L20 14 Z" />
            <Path {...commonProps} d="M7 14 V19 H17 V14" />
          </>
        );
      case 'ATTACKER':
        return (
          <>
            <Path {...commonProps} d="M4 20 L20 4" />
            <Path {...commonProps} d="M14 4 H20 V10" />
            <Path {...commonProps} d="M9 9 L15 15" />
          </>
        );
      case 'HEALER':
        return (
          <>
            <Path {...commonProps} d="M12 4 V20" />
            <Path {...commonProps} d="M4 12 H20" />
            <Circle cx={12} cy={12} r={8} {...commonProps} />
          </>
        );
      case 'SEEKER':
        return (
          <>
            <Circle cx={11} cy={11} r={6} {...commonProps} />
            <Path {...commonProps} d="M15 15 L20 20" />
            <Path {...commonProps} d="M11 8 V14 M8 11 H14" />
          </>
        );
      case 'ASSASSIN':
        return (
          <>
            <Path {...commonProps} d="M5 19 L19 5" />
            <Path {...commonProps} d="M14 5 H19 V10" />
            <Path {...commonProps} d="M5 14 L10 19" />
          </>
        );
      case 'SNIPER':
        return (
          <>
            <Circle cx={12} cy={12} r={7} {...commonProps} />
            <Path {...commonProps} d="M12 2 V7 M12 17 V22 M2 12 H7 M17 12 H22" />
          </>
        );
      case 'ARCHER':
        return (
          <>
            <Path {...commonProps} d="M5 19 Q12 5 19 19" />
            <Path {...commonProps} d="M5 19 L19 19" />
            <Path {...commonProps} d="M12 5 V19" />
          </>
        );
      case 'ENGINEER':
        return (
          <>
            <Circle cx={12} cy={12} r={3} {...commonProps} />
            <Path
              {...commonProps}
              d="M12 4 V8 M12 16 V20 M4 12 H8 M16 12 H20 M6 6 L8.5 8.5 M15.5 15.5 L18 18 M6 18 L8.5 15.5 M15.5 8.5 L18 6"
            />
          </>
        );
      case 'BERSERKER':
        return (
          <>
            <Path {...commonProps} d="M6 20 Q9 12 12 4 Q15 12 18 20" />
            <Path {...commonProps} d="M9 14 H15" />
          </>
        );
      case 'ILLUSION':
      case 'ILLUSIONIST':
        return (
          <>
            <Path {...commonProps} d="M5 12 Q12 5 19 12 Q12 19 5 12" />
            <Circle cx={12} cy={12} r={2} fill={color} stroke={color} strokeWidth={1.6} />
          </>
        );
      default:
        return (
          <Rect x={5} y={5} width={14} height={14} {...commonProps} />
        );
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderIcon()}
    </Svg>
  );
});

export default UnitGlyph;
