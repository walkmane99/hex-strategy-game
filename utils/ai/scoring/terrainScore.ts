import { TerrainType } from '@/types/map';
import { ActionCandidate, AIContext, ScoreWeights } from '../core/types';

function terrainBonus(terrain: TerrainType, weights: ScoreWeights): number {
  switch (terrain) {
    case 'building': return weights.buildingBonus;
    case 'highland': return weights.highGroundBonus;
    case 'forest':   return weights.forestBonus;
    case 'rubble':   return weights.rubbleBonus;
    case 'water':    return weights.waterPenalty;
    default:         return 0;
  }
}

export function terrainScoreEvaluator(
  candidate: ActionCandidate,
  context: AIContext,
): number {
  if (candidate.type !== 'move' && candidate.type !== 'moveAndAttack') return 0;
  if (!candidate.targetTile) return 0;
  const { grid, weights } = context;
  const { row, col } = candidate.targetTile;
  const cell = grid[row]?.[col];
  if (!cell) return 0;
  return terrainBonus(cell.terrain, weights);
}
