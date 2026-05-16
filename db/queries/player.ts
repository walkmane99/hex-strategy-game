import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { player, type Player } from '@/db/schema';

const PLAYER_ID = 1;

export async function getPlayer(): Promise<Player | null> {
  const rows = await db.select().from(player).where(eq(player.id, PLAYER_ID));
  return rows[0] ?? null;
}

export async function updatePoints(totalPoints: number): Promise<void> {
  await db
    .update(player)
    .set({ totalPoints, updatedAt: Date.now() })
    .where(eq(player.id, PLAYER_ID));
}

export async function updateRank(rank: string): Promise<void> {
  await db
    .update(player)
    .set({ rank, updatedAt: Date.now() })
    .where(eq(player.id, PLAYER_ID));
}

export async function addPoints(amount: number): Promise<number> {
  const current = await getPlayer();
  const newTotal = (current?.totalPoints ?? 0) + amount;
  await updatePoints(newTotal);
  return newTotal;
}
