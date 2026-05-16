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
} from './types';
import { generateCandidates, evaluateCandidates, selectBest } from './AIDecisionEngine';
import { attackScoreEvaluator } from '../scoring/attackScore';
import { movementScoreEvaluator } from '../scoring/movementScore';
import { terrainScoreEvaluator } from '../scoring/terrainScore';
import { targetPriorityEvaluator } from '../scoring/targetPriority';
import { safetyScoreEvaluator } from '../scoring/safetyScore';
import { unitSpecificEvaluator } from '../scoring/unitSpecific';
import { DEFAULT_SCORE_WEIGHTS } from '../data/scoreWeights';
import { ScoreEvaluator } from '../scoring/types';
import { buildVisibilityMap, updateVisibilityMap } from '../perception/visibilityMap';
import { buildThreatMap } from '../perception/threatMap';
import { buildProbabilityMap, updateProbabilityMap } from '../perception/probabilityMap';

const EVALUATORS: ScoreEvaluator[] = [
  attackScoreEvaluator,
  movementScoreEvaluator,
  terrainScoreEvaluator,
  targetPriorityEvaluator,
  safetyScoreEvaluator,
  unitSpecificEvaluator,
];

export function buildAIContext(
  unit: Unit,
  snapshot: GameStateSnapshot,
  weights: ScoreWeights,
  difficulty: AIDifficulty,
  visibility: VisibilityMap,
  threat: ThreatMap,
  probability?: ProbabilityMap,
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
  };
}

export interface TurnResult {
  plan: TurnPlan;
  visibility: VisibilityMap;
  probability?: ProbabilityMap;
}

export function executeAITurn(
  snapshot: GameStateSnapshot,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
  difficulty: AIDifficulty = 'normal',
  prevVisibility?: VisibilityMap,
  prevProbability?: ProbabilityMap,
): TurnResult {
  const allyUnits = snapshot.enemyUnits.filter(u => !u.isDead);
  const visiblePlayers = snapshot.playerUnits.filter(u => !u.isDead && u.isVisible);

  // Build shared perception for this turn
  const visibility = prevVisibility
    ? updateVisibilityMap(prevVisibility, allyUnits, snapshot.grid)
    : buildVisibilityMap(allyUnits, snapshot.grid);

  const threat = buildThreatMap(visiblePlayers, snapshot.grid);

  let probability: ProbabilityMap | undefined;
  if (difficulty !== 'normal') {
    probability = prevProbability
      ? updateProbabilityMap(prevProbability, [], snapshot.grid)
      : buildProbabilityMap(snapshot.grid);
  }

  const actions: UnitAction[] = [];

  // Shallow-clone the grid so we can track planned moves without mutating real state
  const planningGrid: MapCell[][] = snapshot.grid.map(row =>
    row.map(cell => ({ ...cell })),
  );
  const planningSnapshot: GameStateSnapshot = { ...snapshot, grid: planningGrid };

  for (const unit of snapshot.enemyUnits) {
    if (unit.isDead) continue;

    const context = buildAIContext(unit, planningSnapshot, weights, difficulty, visibility, threat, probability);
    const candidates = generateCandidates(unit, context);
    const scored = evaluateCandidates(candidates, context, EVALUATORS);
    const best = selectBest(scored, difficulty, context);

    let action: UnitAction;

    if (best.type === 'attack' && best.targetUnit) {
      action = { unitId: unit.id, type: 'attack', targetUnit: best.targetUnit };
    } else if (best.type === 'move' && best.targetTile) {
      action = { unitId: unit.id, type: 'move', destination: best.targetTile };
      const fromCell = planningGrid[unit.position.row]?.[unit.position.col];
      const toCell = planningGrid[best.targetTile.row]?.[best.targetTile.col];
      if (fromCell) fromCell.unitId = undefined;
      if (toCell) toCell.unitId = unit.id;
    } else {
      action = { unitId: unit.id, type: 'wait' };
    }

    actions.push(action);
  }

  return { plan: { actions }, visibility, probability };
}
