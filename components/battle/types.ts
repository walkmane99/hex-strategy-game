import React from 'react';
import { OffsetCoord } from '@/types/map';
import { Unit } from '@/types/unit';

export interface UnitEntity {
  unitId: string;
  unitData: Unit;
  isSelected: boolean;
  pixelX: number;
  pixelY: number;
  tokenSize: number;
  movePath: OffsetCoord[];
  pathIndex: number;
  pathProgress: number;
  pathSegmentPixels: Array<{ x: number; y: number }>;
  showSupplyLine?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer: React.ComponentType<any>;
}

export interface ConfigEntity {
  isAnimating: boolean;
  scale: number;
  renderer: undefined;
}
