import { Unit } from '@/types/unit';
import { MapCell } from '@/types/map';
import {
  GameStateSnapshot,
  AIContext,
  TurnPlan,
  UnitAction,
  AIDifficulty,
  ScoreWeights,
  VisibilityMap,
  ProbabilityMap,
  ThreatMap,
  ActionCandidate,
} from './types';
import { generateCandidates, evaluateCandidates, selectBest } from './AIDecisionEngine';
import { attackScoreEvaluator } from '../scoring/attackScore';
import { movementScoreEvaluator } from '../scoring/movementScore';
import { terrainScoreEvaluator } from '../scoring/terrainScore';
import { targetPriorityEvaluator } from '../scoring/targetPriority';
import { safetyScoreEvaluator } from '../scoring/safetyScore';
import { unitSpecificEvaluator } from '../scoring/unitSpecific';
import { itemUsageEvaluator } from '../scoring/itemUsage';
import { skillUsageEvaluator } from '../scoring/skillUsage';
import { groupTacticsEvaluator } from '../scoring/groupTactics';
import { substitutionEvaluator } from '../scoring/substitution';
import { missionAdjustEvaluator } from '../scoring/missionAdjust';
import { supplyLineEvaluator } from '../scoring/supplyLine';
import { DEFAULT_SCORE_WEIGHTS } from '../data/scoreWeights';
import { ScoreEvaluator } from '../scoring/types';
import { buildVisibilityMap, updateVisibilityMap } from '../perception/visibilityMap';
import { buildThreatMap } from '../perception/threatMap';
import { buildProbabilityMap, updateProbabilityMap } from '../perception/probabilityMap';

/** Layer 1: tentativePlan なし (groupTactics は常に 0 を返す) */
const LAYER1_EVALUATORS: ScoreEvaluator[] = [
  attackScoreEvaluator,
  movementScoreEvaluator,
  terrainScoreEvaluator,
  targetPriorityEvaluator,
  safetyScoreEvaluator,
  unitSpecificEvaluator,
  itemUsageEvaluator,
  skillUsageEvaluator,
  missionAdjustEvaluator,
  supplyLineEvaluator,
];

/** Layer 2: tentativePlan あり (groupTactics が実スコアを加算) */
const LAYER2_EVALUATORS: ScoreEvaluator[] = [
  ...LAYER1_EVALUATORS,
  groupTacticsEvaluator,
];

export function buildAIContext(
  unit: Unit,
  snapshot: GameStateSnapshot,
  weights: ScoreWeights,
  difficulty: AIDifficulty,
  visibility: VisibilityMap,
  threat: ThreatMap,
  probability?: ProbabilityMap,
  tentativePlan?: Map<string, ActionCandidate>,
): AIContext {
  const allyUnits = snapshot.enemyUnits.filter(u => !u.isDead);
  const livingPlayers = snapshot.playerUnits.filter(u => !u.isDead);
  return {
    actingUnit: unit,
    allyUnits,
    enemyUnits: livingPlayers,
    visibleEnemyUnits: livingPlayers.filter(u => u.isVisible),
    grid: snapshot.grid,
    currentTurn: snapshot.currentTurn,
    remainingTurns: snapshot.maxTurns != null
      ? Math.max(0, snapshot.maxTurns - snapshot.currentTurn)
      : 0,
    mission: snapshot.mission,
    weights,
    difficulty,
    visibility,
    threat,
    probability,
    teamInventory: snapshot.teamInventory?.enemy,
    tentativePlan,
    reserves: snapshot.reserves?.enemy,
    canSubstitute: !(snapshot.substitutionUsedThisTurn?.enemy) &&
                   (snapshot.reserves?.enemy?.length ?? 0) > 0,
    missionMetadata: snapshot.missionMetadata,
  };
}

export interface TurnResult {
  plan: TurnPlan;
  visibility: VisibilityMap;
  probability?: ProbabilityMap;
  thinkingMs?: number;
}

/** 1ユニットの最善手を評価・選択する */
function evaluateUnit(
  unit: Unit,
  snapshot: GameStateSnapshot,
  weights: ScoreWeights,
  difficulty: AIDifficulty,
  visibility: VisibilityMap,
  threat: ThreatMap,
  probability: ProbabilityMap | undefined,
  tentativePlan: Map<string, ActionCandidate> | undefined,
  evaluators: ScoreEvaluator[],
): ActionCandidate {
  const context = buildAIContext(unit, snapshot, weights, difficulty, visibility, threat, probability, tentativePlan);
  const candidates = generateCandidates(unit, context);
  const scored = evaluateCandidates(candidates, context, evaluators);
  return selectBest(scored, difficulty, context);
}

/** UnitAction に変換し、planningGrid を更新する */
function toUnitAction(best: ActionCandidate, planningGrid: MapCell[][]): UnitAction {
  const unit = best.unit;

  if (best.type === 'attack' && best.targetUnit) {
    return { unitId: unit.id, type: 'attack', targetUnit: best.targetUnit };
  }

  if (best.type === 'move' && best.targetTile) {
    const fromCell = planningGrid[unit.position.row]?.[unit.position.col];
    const toCell = planningGrid[best.targetTile.row]?.[best.targetTile.col];
    if (fromCell) fromCell.unitId = undefined;
    if (toCell) toCell.unitId = unit.id;
    return { unitId: unit.id, type: 'move', destination: best.targetTile };
  }

  if (best.type === 'moveAndAttack' && best.targetTile && best.targetUnit) {
    const fromCell = planningGrid[unit.position.row]?.[unit.position.col];
    const toCell = planningGrid[best.targetTile.row]?.[best.targetTile.col];
    if (fromCell) fromCell.unitId = undefined;
    if (toCell) toCell.unitId = unit.id;
    return {
      unitId: unit.id,
      type: 'moveAndAttack',
      destination: best.targetTile,
      targetUnit: best.targetUnit,
    };
  }

  if (best.type === 'useItem' && best.itemId) {
    return { unitId: unit.id, type: 'useItem', itemId: best.itemId };
  }

  if (best.type === 'useSkill' && best.skillId) {
    return { unitId: unit.id, type: 'useSkill', skillId: best.skillId };
  }

  if (best.type === 'substitute' && best.targetUnit) {
    return { unitId: unit.id, type: 'substitute', targetUnit: best.targetUnit };
  }

  return { unitId: unit.id, type: 'wait' };
}

export function executeAITurn(
  snapshot: GameStateSnapshot,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
  difficulty: AIDifficulty = 'normal',
  prevVisibility?: VisibilityMap,
  prevProbability?: ProbabilityMap,
): TurnResult {
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const activeUnits = snapshot.enemyUnits.filter(u => !u.isDead);
  const visiblePlayers = snapshot.playerUnits.filter(u => !u.isDead && u.isVisible);

  // 共有パーセプションを構築
  const visibility = prevVisibility
    ? updateVisibilityMap(prevVisibility, activeUnits, snapshot.grid)
    : buildVisibilityMap(activeUnits, snapshot.grid);

  const threat = buildThreatMap(visiblePlayers, snapshot.grid);

  let probability: ProbabilityMap | undefined;
  if (difficulty !== 'normal') {
    probability = prevProbability
      ? updateProbabilityMap(prevProbability, [], snapshot.grid)
      : buildProbabilityMap(snapshot.grid);
  }

  const actions: UnitAction[] = [];
  const planningGrid: MapCell[][] = snapshot.grid.map(row => row.map(cell => ({ ...cell })));
  const planningSnapshot: GameStateSnapshot = { ...snapshot, grid: planningGrid };

  // =====================
  // Pre-turn: 交代判定 (1ターン1回まで)
  // =====================
  const substitutedUnitIds = new Set<string>();
  const substitutionAvailable = !(snapshot.substitutionUsedThisTurn?.enemy);
  const enemyReserves = snapshot.reserves?.enemy ?? [];

  if (substitutionAvailable && enemyReserves.length > 0) {
    for (const unit of activeUnits) {
      const ctx = buildAIContext(unit, snapshot, weights, difficulty, visibility, threat, probability);
      const subCandidates: ActionCandidate[] = enemyReserves.map(r => ({
        type: 'substitute' as const,
        unit,
        targetUnit: r,
        score: 0,
      }));
      const scored = evaluateCandidates(subCandidates, ctx, [substitutionEvaluator]);
      const best = scored.reduce((a, b) => a.score > b.score ? a : b, scored[0]!);
      if (best.score > 0) {
        actions.push(toUnitAction(best, planningGrid));
        substitutedUnitIds.add(unit.id);
        break;
      }
    }
  }

  const activeForNormal = activeUnits.filter(u => !substitutedUnitIds.has(u.id));

  // =====================
  // Layer 1: 暫定計画 (groupTactics なし)
  // =====================
  const tentativePlan = new Map<string, ActionCandidate>();
  for (const unit of activeForNormal) {
    const best = evaluateUnit(
      unit, snapshot, weights, difficulty,
      visibility, threat, probability,
      undefined, // tentativePlan は未設定
      LAYER1_EVALUATORS,
    );
    tentativePlan.set(unit.id, best);
  }

  // =====================
  // Layer 2: 最終計画 (groupTactics あり)
  // 味方が1体以下の場合はスキップして暫定計画をそのまま使用
  // =====================
  if (activeForNormal.length <= 1) {
    for (const unit of activeForNormal) {
      const best = tentativePlan.get(unit.id)!;
      actions.push(toUnitAction(best, planningGrid));
    }
  } else {
    for (const unit of activeForNormal) {
      const best = evaluateUnit(
        unit, planningSnapshot, weights, difficulty,
        visibility, threat, probability,
        tentativePlan, // Layer 2 では暫定計画を渡す
        LAYER2_EVALUATORS,
      );
      actions.push(toUnitAction(best, planningGrid));
    }
  }

  const thinkingMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[AI] turn thinking: ${thinkingMs.toFixed(1)}ms (${activeUnits.length} units)`);
  }

  return { plan: { actions }, visibility, probability, thinkingMs };
}
