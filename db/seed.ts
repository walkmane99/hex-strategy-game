import { eq } from 'drizzle-orm';
import { db } from './client';
import { player, unitRoster, stageProgress, itemInventory } from './schema';
import { INITIAL_UNITS } from '@/constants/unitStats';

const STAGE_IDS = ['M-01', 'M-02', 'M-03', 'M-04', 'M-05', 'M-06'];

const ITEM_DEFAULTS: { code: string; qty: number }[] = [
  { code: 'FLARE', qty: 3 },
  { code: 'EMP-GRD', qty: 2 },
  { code: 'RESUPPLY', qty: 4 },
  { code: 'CAMO-NET', qty: 1 },
  { code: 'MINE', qty: 2 },
  { code: 'DRONE', qty: 1 },
  { code: 'CARPET', qty: 0 },
  { code: 'SMOKE', qty: 2 },
];

export async function seedInitialData(): Promise<void> {
  const now = Date.now();

  const existingPlayer = await db.select().from(player).where(eq(player.id, 1));
  if (existingPlayer.length === 0) {
    await db.insert(player).values({ id: 1, name: 'MAJ. SAITO', totalPoints: 0, rank: 'E', createdAt: now, updatedAt: now });
  }

  const existingUnits = await db.select().from(unitRoster);
  if (existingUnits.length === 0) {
    await db.insert(unitRoster).values(
      INITIAL_UNITS.map((type, i) => ({
        unitType: type,
        isUnlocked: i < 5,
        level: 1,
        unlockedAt: i < 5 ? now : null,
      }))
    );
  }

  const existingStages = await db.select().from(stageProgress);
  if (existingStages.length === 0) {
    await db.insert(stageProgress).values(
      STAGE_IDS.map(id => ({ stageId: id, isCleared: false, rank: '-', score: 0 }))
    );
  }

  const existingItems = await db.select().from(itemInventory);
  if (existingItems.length === 0) {
    await db.insert(itemInventory).values(
      ITEM_DEFAULTS.map(({ code, qty }) => ({ itemCode: code, quantity: qty }))
    );
  }
}
