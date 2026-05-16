import { Unit } from '@/types/unit';
import { ActionCandidate, AIContext, AIDifficulty } from './types';
import { ScoreEvaluator } from '../scoring/types';
import { reachableCells } from '@/utils/pathfinding';
import { offsetDistance } from '@/utils/hexMath';
import { ATTACK_RANGE_BY_TYPE } from '../data/scoreWeights';
import { tieBreakerCompare } from './tieBreaker';

export function generateCandidates(
  unit: Unit,
  context: AIContext,
): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];
  const range = ATTACK_RANGE_BY_TYPE[unit.type] ?? 1;
  const { visibleEnemyUnits, grid } = context;

  for (const player of visibleEnemyUnits) {
    if (offsetDistance(unit.position, player.position) <= range) {
      candidates.push({ type: 'attack', unit, targetUnit: player, score: 0 });
    }
  }

  const reachable = reachableCells(unit.position, grid, unit, unit.stats.movement);
  for (const cell of reachable) {
    candidates.push({ type: 'move', unit, targetTile: cell, score: 0 });
  }

  candidates.push({ type: 'wait', unit, score: 0 });

  return candidates;
}

export function evaluateCandidates(
  candidates: ActionCandidate[],
  context: AIContext,
  evaluators: ScoreEvaluator[],
): ActionCandidate[] {
  return candidates.map(candidate => {
    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const evaluator of evaluators) {
      const s = evaluator(candidate, context);
      breakdown[evaluator.name] = s;
      total += s;
    }
    return { ...candidate, score: total, scoreBreakdown: breakdown };
  });
}

export function selectBest(
  candidates: ActionCandidate[],
  difficulty: AIDifficulty,
  context: AIContext,
): ActionCandidate {
  if (candidates.length === 0) {
    // Should never happen — generateCandidates always includes 'wait'
    throw new Error('selectBest called with empty candidates');
  }

  const threshold = difficulty === 'expert' ? 1.0 : difficulty === 'hard' ? 0.9 : 0.7;

  // Sort: first by score descending, then by tie-breaker
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return tieBreakerCompare(a, b, context);
  });

  const first = sorted[0]!;

  if (difficulty === 'expert' || Math.random() < threshold) return first;

  const pool = sorted.slice(0, Math.min(3, sorted.length));
  return pool[Math.floor(Math.random() * pool.length)] ?? first;
}
