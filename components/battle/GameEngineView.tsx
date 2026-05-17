import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GameEngine } from 'react-native-game-engine';
import { Unit } from '@/types/unit';
import { OffsetCoord, MapCell } from '@/types/map';
import { UnitEntity, ConfigEntity } from './types';
import UnitToken from './UnitToken';
import MovementSystem from '@/systems/MovementSystem';
import { offsetToPixelSVG, pixelToOffset } from '@/utils/pixelToHex';
import { findPath } from '@/utils/pathfinding';
import { useAppDispatch } from '@/hooks/redux';
import { moveUnit, selectUnit } from '@/store/slices/unitSlice';
import { clearSelectionCells, setAnimating } from '@/store/slices/battleSlice';

const r = 18;
const pad = 6;
const cols = 10;
const svgW = pad * 2 + r + (cols - 1) * 1.5 * r + r;

const TOKEN_SIZE_SVG = (r - 4) * 2;

interface GameEngineViewProps {
  playerUnits: Unit[];
  enemyUnits: Unit[];
  selectedUnitId: string | null;
  reachableCells: OffsetCoord[];
  attackableEnemyIds: Set<string>;
  isExternalAnimating: boolean;
  gridRef: React.MutableRefObject<MapCell[][]>;
  mapWidth: number;
  showSupplyLine?: boolean;
  onSelectionChange: (unitId: string | null) => void;
  onMoveComplete: (unitId: string, finalPos: OffsetCoord) => void;
  onAttackEnemy: (attackerId: string, targetId: string) => void;
}

export default function GameEngineView({
  playerUnits,
  enemyUnits,
  selectedUnitId,
  reachableCells,
  attackableEnemyIds,
  isExternalAnimating,
  gridRef,
  mapWidth,
  showSupplyLine = false,
  onSelectionChange,
  onMoveComplete,
  onAttackEnemy,
}: GameEngineViewProps) {
  const dispatch = useAppDispatch();
  const scale = mapWidth / svgW;
  const tokenSize = TOKEN_SIZE_SVG * scale;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineRef = useRef<any>(null);
  const isAnimatingRef = useRef(false);
  const entitiesRef = useRef<Record<string, unknown>>({});

  // Refs to always-fresh values inside onEvent
  const playerUnitsRef = useRef(playerUnits);
  const enemyUnitsRef = useRef(enemyUnits);
  const selectedUnitIdRef = useRef(selectedUnitId);
  const reachableCellsRef = useRef(reachableCells);
  const attackableEnemyIdsRef = useRef(attackableEnemyIds);
  const isExternalAnimatingRef = useRef(isExternalAnimating);
  const scaleRef = useRef(scale);
  const onMoveCompleteRef = useRef(onMoveComplete);
  const onAttackEnemyRef = useRef(onAttackEnemy);

  useEffect(() => { playerUnitsRef.current = playerUnits; }, [playerUnits]);
  useEffect(() => { enemyUnitsRef.current = enemyUnits; }, [enemyUnits]);
  useEffect(() => { selectedUnitIdRef.current = selectedUnitId; }, [selectedUnitId]);
  useEffect(() => { reachableCellsRef.current = reachableCells; }, [reachableCells]);
  useEffect(() => { attackableEnemyIdsRef.current = attackableEnemyIds; }, [attackableEnemyIds]);
  useEffect(() => { isExternalAnimatingRef.current = isExternalAnimating; }, [isExternalAnimating]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { onMoveCompleteRef.current = onMoveComplete; }, [onMoveComplete]);
  useEffect(() => { onAttackEnemyRef.current = onAttackEnemy; }, [onAttackEnemy]);

  function buildEntitiesFromUnits(
    pUnits: Unit[],
    eUnits: Unit[],
    selectedId: string | null,
    sc: number,
    ts: number,
    supplyLine: boolean,
  ): Record<string, unknown> {
    const entities: Record<string, unknown> = {};
    for (const unit of [...pUnits, ...eUnits]) {
      if (unit.isDead) continue;
      const svgPos = offsetToPixelSVG(unit.position.col, unit.position.row);
      const entity: UnitEntity = {
        unitId: unit.id,
        unitData: unit,
        isSelected: unit.id === selectedId,
        pixelX: svgPos.x * sc,
        pixelY: svgPos.y * sc,
        tokenSize: ts,
        movePath: [],
        pathIndex: 0,
        pathProgress: 0,
        pathSegmentPixels: [],
        showSupplyLine: supplyLine,
        renderer: UnitToken,
      };
      entities[unit.id] = entity;
    }
    const config: ConfigEntity & { scale: number } = {
      isAnimating: false,
      scale: sc,
      renderer: undefined,
    };
    entities.__config = config;
    return entities;
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialEntities = useMemo(
    () => {
      const e = buildEntitiesFromUnits(playerUnits, enemyUnits, selectedUnitId, scale, tokenSize, showSupplyLine);
      entitiesRef.current = e;
      return e;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Update isSelected when selection changes
  useEffect(() => {
    if (!engineRef.current || isAnimatingRef.current) return;
    const updated: Record<string, unknown> = { ...entitiesRef.current };
    for (const key of Object.keys(updated)) {
      if (key === '__config') continue;
      const e = updated[key] as UnitEntity;
      if (!e.unitId) continue;
      updated[key] = { ...e, isSelected: e.unitId === selectedUnitId };
    }
    entitiesRef.current = updated;
    engineRef.current.swap(updated);
  }, [selectedUnitId]);

  // Update unitData + pixel positions when Redux units change (handles AI moves too).
  // Skip during player-triggered animation to avoid disrupting the movement.
  useEffect(() => {
    if (!engineRef.current || isAnimatingRef.current) return;
    const sc = scaleRef.current;
    const updated: Record<string, unknown> = { ...entitiesRef.current };
    for (const unit of [...playerUnits, ...enemyUnits]) {
      const existing = updated[unit.id] as UnitEntity | undefined;
      if (existing) {
        const svgPos = offsetToPixelSVG(unit.position.col, unit.position.row);
        updated[unit.id] = {
          ...existing,
          unitData: unit,
          pixelX: svgPos.x * sc,
          pixelY: svgPos.y * sc,
        };
      }
    }
    entitiesRef.current = updated;
    engineRef.current.swap(updated);
  }, [playerUnits, enemyUnits]);

  const onEvent = useCallback(
    (event: { type: string; hex?: OffsetCoord; unitId?: string; finalPos?: OffsetCoord }) => {
      if (event.type === 'HEX_TAPPED') {
        if (isAnimatingRef.current || isExternalAnimatingRef.current) return;
        const hex = event.hex!;
        const currentSelectedId = selectedUnitIdRef.current;
        const grid = gridRef.current;
        const reach = reachableCellsRef.current;
        const sc = scaleRef.current;

        const tappedCell = grid[hex.row]?.[hex.col];
        const tappedUnitId = tappedCell?.unitId;
        const allUnits = [...playerUnitsRef.current, ...enemyUnitsRef.current];
        const tappedUnit = tappedUnitId ? allUnits.find((u) => u.id === tappedUnitId) : undefined;

        // No selection: select a friendly unacted unit
        if (!currentSelectedId) {
          if (tappedUnit?.side === 'player' && !tappedUnit.hasActed && !tappedUnit.isDead) {
            onSelectionChange(tappedUnitId!);
          }
          return;
        }

        // Attack: tapped an enemy that's in attack range
        if (tappedUnit?.side === 'enemy' && attackableEnemyIdsRef.current.has(tappedUnit.id)) {
          onAttackEnemyRef.current(currentSelectedId, tappedUnit.id);
          return;
        }

        // Switch to another friendly unacted unit
        if (tappedUnit?.side === 'player' && tappedUnitId !== currentSelectedId && !tappedUnit.hasActed) {
          onSelectionChange(tappedUnitId!);
          return;
        }

        // Move to reachable empty cell
        const isReachable = reach.some((c) => c.col === hex.col && c.row === hex.row);

        if (isReachable && !tappedUnitId) {
          const selectedUnit = allUnits.find((u) => u.id === currentSelectedId);
          if (!selectedUnit) return;

          const startPos = selectedUnit.position;
          const startCell = grid[startPos.row]?.[startPos.col];
          const savedId = startCell?.unitId;
          if (startCell) startCell.unitId = undefined;

          const path = findPath(startPos, hex, grid, selectedUnit, selectedUnit.stats.movement);

          if (startCell && savedId) startCell.unitId = savedId;

          if (!path || path.length < 2) {
            onSelectionChange(null);
            return;
          }

          const pathSegmentPixels = path.map((pos) => {
            const svgPos = offsetToPixelSVG(pos.col, pos.row);
            return { x: svgPos.x * sc, y: svgPos.y * sc };
          });

          if (grid[hex.row]?.[hex.col]) grid[hex.row][hex.col].unitId = currentSelectedId;
          if (startCell) startCell.unitId = undefined;

          const updated: Record<string, unknown> = {
            ...entitiesRef.current,
            [currentSelectedId]: {
              ...(entitiesRef.current[currentSelectedId] as UnitEntity),
              movePath: path,
              pathIndex: 0,
              pathProgress: 0,
              pathSegmentPixels,
            },
            __config: { ...(entitiesRef.current.__config as ConfigEntity), isAnimating: true },
          };
          entitiesRef.current = updated;
          engineRef.current?.swap(updated);
          isAnimatingRef.current = true;
          dispatch(setAnimating(true));
          return;
        }

        // Deselect
        onSelectionChange(null);
      }

      if (event.type === 'MOVE_COMPLETE') {
        const { unitId, finalPos } = event;
        if (!unitId || !finalPos) return;

        const svgPos = offsetToPixelSVG(finalPos.col, finalPos.row);
        const sc = scaleRef.current;
        const movedEntity = entitiesRef.current[unitId] as UnitEntity | undefined;
        if (!movedEntity) return;

        const updated: Record<string, unknown> = {
          ...entitiesRef.current,
          [unitId]: {
            ...movedEntity,
            pixelX: svgPos.x * sc,
            pixelY: svgPos.y * sc,
            movePath: [],
            pathIndex: 0,
            pathProgress: 0,
            pathSegmentPixels: [],
            isSelected: false,
          },
          __config: { ...(entitiesRef.current.__config as ConfigEntity), isAnimating: false },
        };
        entitiesRef.current = updated;
        engineRef.current?.swap(updated);

        isAnimatingRef.current = false;
        dispatch(moveUnit({ id: unitId, position: finalPos, side: movedEntity.unitData.side }));
        dispatch(setAnimating(false));
        // Delegate markActed, selectUnit, clearSelectionCells to onMoveComplete
        onMoveCompleteRef.current(unitId, finalPos);
      }
    },
    [dispatch, gridRef, onSelectionChange]
  );

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <GameEngine
        ref={engineRef}
        systems={[MovementSystem]}
        entities={initialEntities}
        onEvent={onEvent}
        running
      />
      <View
        style={StyleSheet.absoluteFillObject}
        onStartShouldSetResponder={() => !isAnimatingRef.current && !isExternalAnimatingRef.current}
        onResponderRelease={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          const hex = pixelToOffset(locationX, locationY, scaleRef.current);
          if (hex) onEvent({ type: 'HEX_TAPPED', hex });
        }}
      />
    </View>
  );
}
