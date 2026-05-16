import { ActionCandidate, AIContext } from '../core/types';

export type ScoreEvaluator = (
  candidate: ActionCandidate,
  context: AIContext,
) => number;
