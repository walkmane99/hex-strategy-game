0import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { itemInventory, type ItemInventory } from '@/db/schema';

export async function getAllItems(): Promise<ItemInventory[]> {
  return db.select().from(itemInventory);
}

export async function getItem(itemCode: string): Promise<ItemInventory | null> {
  const rows = await db
    .select()
    .from(itemInventory)
    .where(eq(itemInventory.itemCode, itemCode));
  return rows[0] ?? null;
}

export async function consumeItem(itemCode: string, amount = 1): Promise<boolean> {
  const item = await getItem(itemCode);
  if (!item || item.quantity < amount) return false;

  await db
    .update(itemInventory)
    .set({ quantity: sql`${itemInventory.quantity} - ${amount}` })
    .where(eq(itemInventory.itemCode, itemCode));
  return true;
}

export async function addItem(itemCode: string, amount = 1): Promise<void> {
  const existing = await getItem(itemCode);
  if (existing) {
    await db
      .update(itemInventory)
      .set({ quantity: sql`${itemInventory.quantity} + ${amount}` })
      .where(eq(itemInventory.itemCode, itemCode));
  } else {
    await db.insert(itemInventory).values({ itemCode, quantity: amount });
  }
}
