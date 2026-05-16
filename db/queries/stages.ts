import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { stageProgress, type StageProgress } from '@/db/schema';

export async function getAllStages(): Promise<StageProgress[]> {
  return db.select().from(stageProgress);
}

export async function getStage(stageId: string): Promise<StageProgress | null> {
  const rows = await db
    .select()
    .from(stageProgress)
    .where(eq(stageProgress.stageId, stageId));
  return rows[0] ?? null;
}

export async function recordStageResult(params: {
  stageId: string;
  rank: string;
  turns: number;
  survival: number;
  score: number;
}): Promise<void> {
  const existing = await getStage(params.stageId);

  if (!existing) return;

  // ベストスコアのみ更新
  if (!existing.isCleared || params.score > existing.score) {
    await db
      .update(stageProgress)
      .set({
        isCleared: true,
        rank: params.rank,
        bestTurns: params.turns,
        survivalCount: params.survival,
        score: params.score,
        clearedAt: Date.now(),
      })
      .where(eq(stageProgress.stageId, params.stageId));
  }
}
