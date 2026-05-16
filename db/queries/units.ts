import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { unitRoster, unitCustomStats, type UnitRoster, type UnitCustomStats } from '@/db/schema';

export async function getAllUnits(): Promise<UnitRoster[]> {
  return db.select().from(unitRoster);
}

export async function getUnlockedUnits(): Promise<UnitRoster[]> {
  return db.select().from(unitRoster).where(eq(unitRoster.isUnlocked, true));
}

export async function unlockUnit(unitType: string): Promise<void> {
  await db
    .update(unitRoster)
    .set({ isUnlocked: true, unlockedAt: Date.now() })
    .where(eq(unitRoster.unitType, unitType));
}

export async function levelUpUnit(unitType: string): Promise<void> {
  const rows = await db.select().from(unitRoster).where(eq(unitRoster.unitType, unitType));
  if (rows[0]) {
    await db
      .update(unitRoster)
      .set({ level: rows[0].level + 1 })
      .where(eq(unitRoster.unitType, unitType));
  }
}

export async function getUnitCustomStats(unitRosterId: number): Promise<UnitCustomStats | null> {
  const rows = await db
    .select()
    .from(unitCustomStats)
    .where(eq(unitCustomStats.unitRosterId, unitRosterId));
  return rows[0] ?? null;
}

export async function upsertUnitCustomStats(
  unitRosterId: number,
  stats: { hp: number; attack: number; defense: number; movement: number; scout: number }
): Promise<void> {
  const existing = await getUnitCustomStats(unitRosterId);
  if (existing) {
    await db
      .update(unitCustomStats)
      .set(stats)
      .where(eq(unitCustomStats.unitRosterId, unitRosterId));
  } else {
    await db.insert(unitCustomStats).values({ unitRosterId, ...stats });
  }
}
