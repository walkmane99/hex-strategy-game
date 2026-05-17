import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { RootState } from '@/store';
import {
  playerUnitSelectors,
  enemyUnitSelectors,
  initPlayerUnits,
  initEnemyUnits,
  selectUnit,
  markActed,
  applyDamage,
  setUnitVisible,
  tickCooldowns,
  substituteUnit,
  updateSupplyStatuses,
} from '@/store/slices/unitSlice';
import {
  setReachableCells,
  setAttackableCells,
  clearSelectionCells,
  setAnimating,
  addLog,
  setTeamInventory,
  setReserves,
  executeSubstitution,
  resetSubstitutionFlag,
  setMissionMetadata,
} from '@/store/slices/battleSlice';
import { ItemSlot } from '@/types/item';
import { endPlayerTurn } from '@/store/slices/gameSlice';
import TacBracket from '@/components/ui/TacBracket';
import TacTag from '@/components/ui/TacTag';
import Meter from '@/components/ui/Meter';
import Modal from '@/components/ui/Modal';
import UnitGlyph from '@/components/units/UnitGlyph';
import HexMapView from '@/components/hex/HexMapView';
import HexOverlayView from '@/components/battle/HexOverlayView';
import GameEngineView from '@/components/battle/GameEngineView';
import ReservePanel from '@/components/battle/ReservePanel';
import MissionStartOverlay from '@/components/battle/MissionStartOverlay';
import { C, MONO, DISPLAY } from '@/constants/theme';
import { UNIT_BASE_STATS, UNIT_NAMES_JA } from '@/constants/unitStats';
import { MapCell, OffsetCoord, TerrainType } from '@/types/map';
import { Unit, UnitType } from '@/types/unit';
import { AffinityResult, calculateDamage, getEffectiveMovement } from '@/utils/combat';
import { computeSupplyStatuses } from '@/utils/ai/perception/supplyLineStatus';
import { reachableCells } from '@/utils/pathfinding';
import { offsetDistance } from '@/utils/hexMath';
import { getAttackRange } from '@/utils/ai';
import { computeVisibleEnemyIds } from '@/utils/scout';
import { useAI } from '@/hooks/useAI';

const URBAN_MAP: string[] = [
  '..##..f...',
  '.##....f..',
  '.#..^^.fff',
  '...^##..f.',
  '..^.##....',
  '..xx..~~..',
  '...x.~~...',
  'f...~~..##',
  'ff.~~...##',
  '.f....x...',
];

const CHAR_TO_TERRAIN: Record<string, TerrainType> = {
  '.': 'plain',
  '^': 'highland',
  f: 'forest',
  '~': 'water',
  '#': 'building',
  x: 'rubble',
};

function buildGrid(mapRows: string[], units: Unit[]): MapCell[][] {
  const grid: MapCell[][] = [];
  for (let row = 0; row < 10; row++) {
    grid[row] = [];
    for (let col = 0; col < 10; col++) {
      const char = mapRows[row]?.[col] ?? '.';
      grid[row][col] = {
        position: { col, row },
        terrain: CHAR_TO_TERRAIN[char] ?? 'plain',
      };
    }
  }
  for (const u of units) {
    const cell = grid[u.position.row]?.[u.position.col];
    if (cell) cell.unitId = u.id;
  }
  return grid;
}

function makeUnit(
  id: string,
  type: UnitType,
  side: 'player' | 'enemy',
  position: OffsetCoord,
  hpOverride?: number
): Unit {
  const stats = UNIT_BASE_STATS[type];
  return {
    id,
    type,
    side,
    stats,
    currentHP: hpOverride ?? stats.maxHP,
    position,
    isVisible: true,
    hasActed: false,
    isDead: false,
  };
}

const PLAYER_SPAWN_POSITIONS: OffsetCoord[] = [
  { col: 1, row: 8 },
  { col: 2, row: 7 },
  { col: 3, row: 8 },
  { col: 0, row: 6 },
  { col: 4, row: 6 },
];

const DEFAULT_SQUAD: UnitType[] = ['tanker', 'attacker', 'healer', 'seeker', 'archer'];

const ENEMY_SPAWN: Array<{ type: UnitType; position: OffsetCoord }> = [
  { type: 'tanker',   position: { col: 8, row: 2 } },
  { type: 'attacker', position: { col: 6, row: 2 } },
  { type: 'archer',   position: { col: 7, row: 1 } },
];

type ActionPhase = 'select' | 'attack_ready';

interface CombatEvent {
  attackerName: string;
  targetName: string;
  damage: number;
  affinity: AffinityResult;
  side: 'player' | 'enemy';
}

export default function TacticsScreen() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const screenWidth = Dimensions.get('window').width;
  const mapWidth = screenWidth - 16;

  const playerUnits = useAppSelector(playerUnitSelectors.selectAll);
  const enemyUnits = useAppSelector(enemyUnitSelectors.selectAll);
  const selectedUnitId = useAppSelector((s) => s.units.selectedUnitId);
  const reachableCellsList = useAppSelector((s) => s.battle.reachableCells);
  const attackableCells = useAppSelector((s) => s.battle.attackableCells);
  const isAnimating = useAppSelector((s) => s.battle.isAnimating);
  const currentTurn = useAppSelector((s) => s.game.currentTurn);
  const phase = useAppSelector((s) => s.game.phase);
  const selectedSquad = useAppSelector((s) => s.player.selectedSquad);
  const selectedItems = useAppSelector((s) => s.player.selectedItems);
  const selectedReserveUnitId = useAppSelector((s) => s.player.selectedReserveUnitId);
  const reserves = useAppSelector((s) => s.battle.reserves);
  const substitutionUsedThisTurn = useAppSelector((s) => s.battle.substitutionUsedThisTurn);
  const missionMetadata = useAppSelector((s) => s.battle.missionMetadata);

  const gridRef = useRef<MapCell[][]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [actionPhase, setActionPhase] = useState<ActionPhase>('select');
  const [pendingAttackUnitId, setPendingAttackUnitId] = useState<string | null>(null);
  const [attackableEnemyIds, setAttackableEnemyIds] = useState<Set<string>>(new Set());
  const [combatEvent, setCombatEvent] = useState<CombatEvent | null>(null);
  const combatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSubstitutionMode, setIsSubstitutionMode] = useState(false);
  const [subTargetId, setSubTargetId] = useState<string | null>(null);
  const [showSubConfirmModal, setShowSubConfirmModal] = useState(false);
  const [showMissionStart, setShowMissionStart] = useState(true);

  const { runAITurn } = useAI(gridRef);

  const playerPositions = useMemo(
    () => playerUnits.filter((u) => !u.isDead).map((u) => u.position),
    [playerUnits]
  );

  // Initialize battle on mount
  useEffect(() => {
    const squadTypes = selectedSquad.length > 0 ? selectedSquad : DEFAULT_SQUAD;
    const pUnits = squadTypes.map((type, i) =>
      makeUnit(`p${i + 1}`, type, 'player', PLAYER_SPAWN_POSITIONS[i])
    );
    const eUnits = ENEMY_SPAWN.map((s, i) =>
      makeUnit(`e${i + 1}`, s.type, 'enemy', s.position, Math.floor(UNIT_BASE_STATS[s.type].maxHP * 0.88))
    );
    dispatch(initPlayerUnits(pUnits));
    dispatch(initEnemyUnits(eUnits));
    gridRef.current = buildGrid(URBAN_MAP, [...pUnits, ...eUnits]);

    const playerItemSlots: ItemSlot[] = selectedItems.map(id => ({ itemId: id, remainingUses: 1 }));
    const enemyItemSlots: ItemSlot[] = [
      { itemId: 'flare', remainingUses: 1 },
      { itemId: 'supply_pack', remainingUses: 1 },
    ];
    dispatch(setTeamInventory({ player: playerItemSlots, enemy: enemyItemSlots }));

    // 予備ユニット初期化
    const reserveType = selectedReserveUnitId as UnitType | null;
    const playerReserveUnit = reserveType
      ? makeUnit('p-reserve', reserveType, 'player', { col: 0, row: 0 })
      : null;
    // TODO: ステージ定義に enemyReserve フィールドが追加されたらここをステージデータから取得する
    const enemyReserveUnit = makeUnit('e-reserve', 'attacker', 'enemy', { col: 0, row: 0 });
    dispatch(setReserves({
      player: playerReserveUnit ? [playerReserveUnit] : [],
      enemy: [enemyReserveUnit],
    }));

    setIsInitialized(true);
  }, [dispatch, selectedSquad, selectedItems, selectedReserveUnitId]);

  // Scouting: update enemy visibility at turn start
  const updateVisibility = useCallback(() => {
    const state = store.getState();
    const freshPlayers = playerUnitSelectors.selectAll(state).filter(u => !u.isDead);
    const freshEnemies = enemyUnitSelectors.selectAll(state).filter(u => !u.isDead);
    const visibleIds = computeVisibleEnemyIds(freshPlayers, freshEnemies, gridRef.current);
    for (const enemy of freshEnemies) {
      const shouldBeVisible = visibleIds.has(enemy.id);
      if (enemy.isVisible !== shouldBeVisible) {
        dispatch(setUnitVisible({ id: enemy.id, visible: shouldBeVisible }));
      }
    }
  }, [dispatch, store]);

  useEffect(() => {
    if (phase === 'player_turn' && isInitialized) {
      updateVisibility();
      dispatch(tickCooldowns('player'));

      if (missionMetadata?.baseLocations) {
        const state = store.getState();
        const freshPlayers = playerUnitSelectors.selectAll(state).filter(u => !u.isDead);
        const freshEnemies = enemyUnitSelectors.selectAll(state).filter(u => !u.isDead);
        const statuses = computeSupplyStatuses(
          freshPlayers,
          freshEnemies,
          missionMetadata.baseLocations,
        );
        dispatch(updateSupplyStatuses(statuses));
      }
    }
  }, [phase, isInitialized, updateVisibility, dispatch, missionMetadata, store]);

  // Recompute move/attack overlays when selection or phase changes
  useEffect(() => {
    if (!selectedUnitId) {
      dispatch(clearSelectionCells());
      setAttackableEnemyIds(new Set());
      return;
    }
    const unit = [...playerUnits, ...enemyUnits].find(u => u.id === selectedUnitId);
    if (!unit || !gridRef.current.length) {
      dispatch(clearSelectionCells());
      setAttackableEnemyIds(new Set());
      return;
    }

    const attackRange = getAttackRange(unit.type);
    const attackableEnemies = enemyUnits.filter(
      e => !e.isDead && e.isVisible && offsetDistance(unit.position, e.position) <= attackRange
    );
    const newAttackableIds = new Set(attackableEnemies.map(e => e.id));
    setAttackableEnemyIds(newAttackableIds);
    dispatch(setAttackableCells(attackableEnemies.map(e => e.position)));

    if (actionPhase === 'attack_ready') {
      dispatch(setReachableCells([]));
    } else {
      const startCell = gridRef.current[unit.position.row]?.[unit.position.col];
      const savedUnitId = startCell?.unitId;
      if (startCell) startCell.unitId = undefined;
      const cells = reachableCells(unit.position, gridRef.current, unit, getEffectiveMovement(unit));
      if (startCell && savedUnitId) startCell.unitId = savedUnitId;
      dispatch(setReachableCells(cells));
    }
  }, [selectedUnitId, actionPhase, playerUnits, enemyUnits, dispatch]);

  const handleSelectionChange = useCallback(
    (unitId: string | null) => {
      if (actionPhase === 'attack_ready') return;
      if (isSubstitutionMode && unitId) {
        const unit = playerUnits.find(u => u.id === unitId);
        if (unit && !unit.hasActed && !unit.isDead) {
          setSubTargetId(unitId);
          setShowSubConfirmModal(true);
        }
        return;
      }
      dispatch(selectUnit(unitId));
    },
    [dispatch, actionPhase, isSubstitutionMode, playerUnits]
  );

  // Called by GameEngineView after player move animation completes
  const handleMoveComplete = useCallback((unitId: string, finalPos: OffsetCoord) => {
    const state = store.getState();
    const freshEnemies = enemyUnitSelectors.selectAll(state).filter(e => !e.isDead && e.isVisible);

    const attackRange = getAttackRange(
      playerUnitSelectors.selectById(state, unitId)?.type ?? 'attacker'
    );
    const hasTargets = freshEnemies.some(
      e => offsetDistance(finalPos, e.position) <= attackRange
    );

    // Update visibility from new position
    updateVisibility();

    if (hasTargets) {
      setActionPhase('attack_ready');
      setPendingAttackUnitId(unitId);
      dispatch(selectUnit(unitId));
    } else {
      dispatch(markActed(unitId));
      dispatch(clearSelectionCells());
      dispatch(selectUnit(null));
      setActionPhase('select');
    }
  }, [store, dispatch, updateVisibility]);

  // Called by GameEngineView when player taps an attackable enemy
  const handleAttackEnemy = useCallback((attackerId: string, targetId: string) => {
    const state = store.getState();
    const attacker = playerUnitSelectors.selectById(state, attackerId);
    const target = enemyUnitSelectors.selectById(state, targetId);
    if (!attacker || !target || target.isDead) return;

    const targetCell = gridRef.current[target.position.row]?.[target.position.col];
    const terrain = targetCell?.terrain ?? 'plain';
    const { damage, affinity } = calculateDamage(attacker, target, terrain, 0, 0);

    dispatch(applyDamage({ id: targetId, damage, side: 'enemy' }));
    dispatch(markActed(attackerId));
    dispatch(clearSelectionCells());
    dispatch(selectUnit(null));
    dispatch(addLog({
      turn: state.game.currentTurn,
      action: { type: 'attack', unitId: attackerId, targetId },
      damage,
      result: `${attackerId} hit ${targetId} for ${damage} [${affinity}]`,
      timestamp: Date.now(),
    }));

    setCombatEvent({
      attackerName: UNIT_NAMES_JA[attacker.type] ?? attacker.type,
      targetName: UNIT_NAMES_JA[target.type] ?? target.type,
      damage,
      affinity,
      side: 'player',
    });

    setActionPhase('select');
    setPendingAttackUnitId(null);
    setAttackableEnemyIds(new Set());

    if (combatTimerRef.current) clearTimeout(combatTimerRef.current);
    combatTimerRef.current = setTimeout(() => setCombatEvent(null), 2500);
  }, [store, dispatch, gridRef]);

  const handleWaitAction = useCallback(() => {
    if (!pendingAttackUnitId) return;
    dispatch(markActed(pendingAttackUnitId));
    dispatch(clearSelectionCells());
    dispatch(setAttackableCells([]));
    dispatch(selectUnit(null));
    setPendingAttackUnitId(null);
    setActionPhase('select');
    setAttackableEnemyIds(new Set());
  }, [pendingAttackUnitId, dispatch]);

  const handleEnterSubstitutionMode = useCallback(() => {
    dispatch(selectUnit(null));
    dispatch(clearSelectionCells());
    setIsSubstitutionMode(true);
  }, [dispatch]);

  const handleSubstitutionConfirm = useCallback(() => {
    if (!subTargetId) return;
    const state = store.getState();
    const target = playerUnitSelectors.selectById(state, subTargetId);
    const reserve = state.battle.reserves.player[0];
    if (!target || !reserve) return;

    dispatch(substituteUnit({
      side: 'player',
      removedUnitId: subTargetId,
      newUnit: reserve,
      position: target.position,
    }));
    dispatch(executeSubstitution('player'));
    dispatch(addLog({
      turn: state.game.currentTurn,
      action: { type: 'swap_reserve', unitId: subTargetId, targetId: reserve.id },
      result: `${UNIT_NAMES_JA[target.type]} が ${UNIT_NAMES_JA[reserve.type]} と交代した`,
      timestamp: Date.now(),
    }));
    setIsSubstitutionMode(false);
    setSubTargetId(null);
    setShowSubConfirmModal(false);
  }, [subTargetId, dispatch, store]);

  const handleSubstitutionCancel = useCallback(() => {
    setSubTargetId(null);
    setShowSubConfirmModal(false);
    setIsSubstitutionMode(false);
  }, []);

  const handleEndTurn = useCallback(() => {
    if (isAnimating || actionPhase === 'attack_ready') return;
    dispatch(selectUnit(null));
    dispatch(clearSelectionCells());
    dispatch(endPlayerTurn());
    setActionPhase('select');
    setPendingAttackUnitId(null);
    setAttackableEnemyIds(new Set());
    setIsSubstitutionMode(false);
    setSubTargetId(null);
    setShowSubConfirmModal(false);
    runAITurn();
  }, [dispatch, isAnimating, actionPhase, runAITurn]);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (combatTimerRef.current) clearTimeout(combatTimerRef.current);
  }, []);

  const selectedUnit = selectedUnitId
    ? [...playerUnits, ...enemyUnits].find((u) => u.id === selectedUnitId)
    : undefined;

  const playerReserve = reserves.player[0] ?? null;
  const enemyReserve = reserves.enemy[0] ?? null;
  const canSwap =
    phase === 'player_turn' &&
    !substitutionUsedThisTurn.player &&
    reserves.player.length > 0;

  const subTarget = subTargetId
    ? playerUnits.find(u => u.id === subTargetId)
    : undefined;
  const subModalMessage = subTarget && playerReserve
    ? `${UNIT_NAMES_JA[subTarget.type]} を予備の ${UNIT_NAMES_JA[playerReserve.type]} と交代します。\n${UNIT_NAMES_JA[playerReserve.type]} はこのターン行動できません。よろしいですか？`
    : '';

  const pad = 6;
  const r = 18;
  const svgW = pad * 2 + r + (10 - 1) * 1.5 * r + r;
  const svgH = pad * 2 + 10 * Math.sqrt(3) * r + (Math.sqrt(3) * r) / 2;
  const mapHeight = svgH * (mapWidth / svgW);

  const affinityColor = combatEvent?.affinity === 'advantage'
    ? C.green
    : combatEvent?.affinity === 'disadvantage'
    ? C.red
    : C.ink2;

  const affinityLabel = combatEvent?.affinity === 'advantage'
    ? '有利'
    : combatEvent?.affinity === 'disadvantage'
    ? '不利'
    : '通常';

  if (!isInitialized) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ gestureEnabled: false }} />

      {/* Turn bar */}
      <View style={styles.turnBar}>
        <Text style={[styles.turnLabel, phase === 'enemy_turn' && { color: C.cyan }]}>
          {phase === 'enemy_turn' ? '◆ ENEMY TURN' : actionPhase === 'attack_ready' ? '◆ ATTACK PHASE' : '◆ FRIENDLY TURN'}
        </Text>
        <Text style={styles.turnCount}>{String(currentTurn).padStart(2, '0')} / 12</Text>
        <Text style={styles.turnTime}>TURN {currentTurn}</Text>
      </View>

      {/* Mission ribbon */}
      <View style={styles.missionRibbon}>
        <View style={styles.missionBadge}>
          <Text style={styles.missionBadgeNum}>01</Text>
        </View>
        <View style={styles.missionInfo}>
          <Text style={styles.missionTitle}>M-01 · 市街地制圧</Text>
          <Text style={styles.missionObj}>OBJ · 全敵殲滅</Text>
        </View>
        <View style={styles.missionTurns}>
          <Text style={styles.missionTurnsLabel}>残ターン</Text>
          <Text style={styles.missionTurnsNum}>{Math.max(0, 12 - currentTurn)}</Text>
        </View>
      </View>

      {/* Map area (3-layer stack) */}
      <View style={[styles.mapWrap, { paddingHorizontal: 8 }]}>
        <View style={{ width: mapWidth, height: mapHeight, overflow: 'hidden' }}>
          <HexMapView
            width={mapWidth}
            showFog={true}
            showThreat={false}
            accent={C.amber}
            preset="都市部 / URBAN"
            showUnits={false}
            showOverlays={false}
            playerPositions={playerPositions}
          />
          <HexOverlayView
            width={mapWidth}
            reachableCells={reachableCellsList}
            attackableCells={attackableCells}
            selectedHex={selectedUnit?.position ?? null}
          />
          <GameEngineView
            playerUnits={playerUnits}
            enemyUnits={enemyUnits}
            selectedUnitId={selectedUnitId}
            reachableCells={reachableCellsList}
            attackableEnemyIds={attackableEnemyIds}
            isExternalAnimating={isAnimating}
            gridRef={gridRef}
            mapWidth={mapWidth}
            showSupplyLine={!!missionMetadata?.baseLocations}
            onSelectionChange={handleSelectionChange}
            onMoveComplete={handleMoveComplete}
            onAttackEnemy={handleAttackEnemy}
          />
          {showMissionStart && (
            <MissionStartOverlay
              accent={C.amber}
              onComplete={() => setShowMissionStart(false)}
            />
          )}
        </View>
      </View>

      {/* Attack phase banner */}
      {actionPhase === 'attack_ready' && (
        <View style={styles.attackBanner}>
          <Text style={styles.attackBannerText}>⚔ 攻撃フェーズ · 敵ユニットをタップして攻撃</Text>
        </View>
      )}

      {/* Substitution mode banner */}
      {isSubstitutionMode && (
        <View style={styles.subBanner}>
          <Text style={styles.subBannerText}>↔ 交代フェーズ · 交代する自軍ユニットをタップ</Text>
        </View>
      )}

      {/* Unit panel / combat result */}
      <View style={styles.unitPanel}>
        {combatEvent ? (
          <TacBracket
            label={`COMBAT · ${combatEvent.side === 'player' ? '自軍攻撃' : '敵軍攻撃'}`}
            count="RESULT"
            padding={10}
          >
            <View style={styles.combatRow}>
              <View style={styles.combatUnit}>
                <Text style={styles.combatUnitName}>{combatEvent.attackerName}</Text>
                <Text style={styles.combatUnitRole}>攻撃</Text>
              </View>
              <View style={styles.combatCenter}>
                <Text style={[styles.combatAffinity, { color: affinityColor }]}>{affinityLabel}</Text>
                <Text style={styles.combatDamage}>
                  DMG <Text style={[styles.combatDamageNum, { color: affinityColor }]}>
                    {combatEvent.damage}
                  </Text>
                </Text>
              </View>
              <View style={styles.combatUnit}>
                <Text style={styles.combatUnitName}>{combatEvent.targetName}</Text>
                <Text style={styles.combatUnitRole}>被弾</Text>
              </View>
            </View>
          </TacBracket>
        ) : selectedUnit ? (
          <TacBracket
            label={`UNIT ${selectedUnit.id.toUpperCase()} · ${selectedUnit.type.toUpperCase()}`}
            count={actionPhase === 'attack_ready' ? 'ATTACK' : selectedUnit.hasActed ? 'ACTED' : 'ACTIVE'}
            padding={10}
          >
            <View style={styles.unitPanelRow}>
              <View style={styles.unitGlyphBox}>
                <UnitGlyph kind={selectedUnit.type.toUpperCase()} size={32} color={C.amber} />
              </View>
              <View style={styles.unitStats}>
                <Text style={styles.unitTitle}>
                  {UNIT_NAMES_JA[selectedUnit.type]} / {selectedUnit.id.toUpperCase()}
                </Text>
                <View style={styles.unitStatLine}>
                  <Text style={styles.statLabel}>HP </Text>
                  <Text style={styles.statAmber}>
                    {selectedUnit.currentHP}/{selectedUnit.stats.maxHP}
                  </Text>
                  <Text style={[styles.statLabel, { marginLeft: 8 }]}>POS </Text>
                  <Text style={styles.statInk}>
                    {String.fromCharCode(65 + selectedUnit.position.col)}
                    {selectedUnit.position.row + 1}
                  </Text>
                </View>
                <Meter
                  value={selectedUnit.currentHP}
                  max={selectedUnit.stats.maxHP}
                  color={C.amber}
                  height={4}
                  segments={20}
                />
              </View>
              <View style={styles.statGrid}>
                <View style={styles.statGrid2x2}>
                  <Text style={styles.statGridItem}>ATK {String(selectedUnit.stats.attack).padStart(2, '0')}</Text>
                  <Text style={[styles.statGridItem, { color: C.amber }]}>
                    DEF {String(selectedUnit.stats.defense).padStart(2, '0')}
                  </Text>
                  <Text style={styles.statGridItem}>MV  {String(selectedUnit.stats.movement).padStart(2, '0')}</Text>
                  <Text style={styles.statGridItem}>SCN {String(selectedUnit.stats.scout).padStart(2, '0')}</Text>
                </View>
              </View>
            </View>
          </TacBracket>
        ) : (
          <TacBracket label="UNIT ─── SELECT" count="STANDBY" padding={10}>
            <Text style={styles.noSelectionText}>タップしてユニットを選択</Text>
          </TacBracket>
        )}
      </View>

      {/* Reserve panel (常に表示, 仕様書 10.6) */}
      <ReservePanel playerReserve={playerReserve} enemyReserve={enemyReserve} />

      {/* Action bar */}
      <View style={styles.actionBar}>
        {actionPhase === 'attack_ready' ? (
          <>
            <Pressable style={styles.waitBtn} onPress={handleWaitAction}>
              <Text style={styles.waitBtnJa}>待　機</Text>
              <Text style={styles.waitBtnEn}>WAIT</Text>
            </Pressable>
            <View style={styles.turnInfo}>
              <TacTag color={C.red}>攻撃 OR 待機を選択</TacTag>
            </View>
          </>
        ) : (
          <>
            <Pressable
              style={[
                styles.endTurnBtn,
                isAnimating && styles.endTurnBtnDisabled,
              ]}
              onPress={handleEndTurn}
              disabled={isAnimating}
            >
              <Text style={[styles.endTurnJa, isAnimating && { color: C.ink3 }]}>ターン終了</Text>
              <Text style={[styles.endTurnEn, isAnimating && { color: C.ink3 }]}>END TURN</Text>
            </Pressable>
            {canSwap && !isSubstitutionMode && (
              <Pressable
                style={styles.swapBtn}
                onPress={handleEnterSubstitutionMode}
                disabled={isAnimating}
              >
                <Text style={styles.swapBtnJa}>交　代</Text>
                <Text style={styles.swapBtnEn}>SWAP</Text>
              </Pressable>
            )}
            {isSubstitutionMode && (
              <Pressable
                style={styles.swapCancelBtn}
                onPress={handleSubstitutionCancel}
              >
                <Text style={styles.swapCancelLabel}>キャンセル</Text>
              </Pressable>
            )}
            <View style={styles.turnInfo}>
              <TacTag color={C.cyan}>
                {playerUnits.filter((u) => !u.hasActed && !u.isDead).length} UNITS READY
              </TacTag>
            </View>
          </>
        )}
      </View>
      {/* Substitution confirmation modal */}
      <Modal
        visible={showSubConfirmModal}
        title="交代 / SWAP"
        message={subModalMessage}
        cancelLabel="キャンセル"
        confirmLabel="交代する"
        onCancel={handleSubstitutionCancel}
        onConfirm={handleSubstitutionConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg0,
  },
  turnBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    backgroundColor: C.bg0,
  },
  turnLabel: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.amber,
  },
  turnCount: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.ink2,
  },
  turnTime: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.ink2,
  },
  missionRibbon: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    backgroundColor: C.bg1,
    gap: 10,
    alignItems: 'center',
  },
  missionBadge: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: C.amber,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionBadgeNum: {
    fontFamily: DISPLAY,
    fontSize: 14,
    fontWeight: '700',
    color: C.amber,
    transform: [{ rotate: '-45deg' }],
  },
  missionInfo: {
    flex: 1,
  },
  missionTitle: {
    fontFamily: DISPLAY,
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
    letterSpacing: 0.6,
  },
  missionObj: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.ink3,
    letterSpacing: 1.6,
    marginTop: 2,
  },
  missionTurns: {
    alignItems: 'flex-end',
  },
  missionTurnsLabel: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.ink3,
  },
  missionTurnsNum: {
    fontFamily: DISPLAY,
    fontSize: 18,
    fontWeight: '700',
    color: C.amber,
  },
  mapWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  attackBanner: {
    marginHorizontal: 12,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: C.red,
  },
  attackBannerText: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.red,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  unitPanel: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    paddingTop: 4,
  },
  unitPanelRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  unitGlyphBox: {
    width: 54,
    height: 54,
    borderWidth: 1,
    borderColor: C.amber,
    backgroundColor: C.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitStats: {
    flex: 1,
    gap: 4,
  },
  unitTitle: {
    fontFamily: DISPLAY,
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
  },
  unitStatLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statLabel: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.ink2,
  },
  statAmber: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.amber,
  },
  statInk: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.ink,
  },
  statGrid: {
    width: 78,
    gap: 4,
    alignItems: 'flex-start',
  },
  statGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  statGridItem: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.ink3,
    width: 36,
  },
  noSelectionText: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.ink3,
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Combat result panel
  combatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  combatUnit: {
    flex: 1,
    alignItems: 'center',
  },
  combatUnitName: {
    fontFamily: DISPLAY,
    fontSize: 12,
    fontWeight: '600',
    color: C.ink,
  },
  combatUnitRole: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.ink3,
    marginTop: 2,
  },
  combatCenter: {
    alignItems: 'center',
    gap: 4,
  },
  combatAffinity: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1,
  },
  combatDamage: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.ink2,
  },
  combatDamageNum: {
    fontFamily: DISPLAY,
    fontSize: 18,
    fontWeight: '700',
  },
  // Action bar
  actionBar: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.bg0,
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  endTurnBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.amber,
    backgroundColor: '#1a0d00',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  endTurnBtnDisabled: {
    borderColor: C.line,
    backgroundColor: C.bg1,
  },
  endTurnJa: {
    fontFamily: DISPLAY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: C.amber,
  },
  endTurnEn: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.amber,
  },
  waitBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.cyan,
    backgroundColor: '#001a1f',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  waitBtnJa: {
    fontFamily: DISPLAY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: C.cyan,
  },
  waitBtnEn: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.cyan,
  },
  swapBtn: {
    borderWidth: 1,
    borderColor: C.amber,
    backgroundColor: '#1a0d00',
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  swapBtnJa: {
    fontFamily: DISPLAY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: C.amber,
  },
  swapBtnEn: {
    fontFamily: MONO,
    fontSize: 9,
    color: C.amber,
  },
  swapCancelBtn: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapCancelLabel: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.ink2,
  },
  subBanner: {
    marginHorizontal: 12,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1a0d00',
    borderWidth: 1,
    borderColor: C.amber,
  },
  subBannerText: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.amber,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  turnInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
