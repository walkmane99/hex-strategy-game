import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const player = sqliteTable('player', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().default('MAJ. SAITO'),
  totalPoints: integer('total_points').notNull().default(0),
  rank: text('rank').notNull().default('E'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const unitRoster = sqliteTable('unit_roster', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  unitType: text('unit_type').notNull(),
  isUnlocked: integer('is_unlocked', { mode: 'boolean' }).notNull().default(false),
  level: integer('level').notNull().default(1),
  unlockedAt: integer('unlocked_at'),
});

export const unitCustomStats = sqliteTable('unit_custom_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  unitRosterId: integer('unit_roster_id').notNull().references(() => unitRoster.id),
  hp: integer('hp').notNull().default(10),
  attack: integer('attack').notNull().default(10),
  defense: integer('defense').notNull().default(10),
  movement: integer('movement').notNull().default(10),
  scout: integer('scout').notNull().default(10),
});

export const stageProgress = sqliteTable('stage_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  stageId: text('stage_id').notNull().unique(),
  isCleared: integer('is_cleared', { mode: 'boolean' }).notNull().default(false),
  rank: text('rank').notNull().default('-'),
  bestTurns: integer('best_turns'),
  survivalCount: integer('survival_count'),
  score: integer('score').notNull().default(0),
  clearedAt: integer('cleared_at'),
});

export const itemInventory = sqliteTable('item_inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemCode: text('item_code').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
});

export type Player = typeof player.$inferSelect;
export type NewPlayer = typeof player.$inferInsert;
export type UnitRoster = typeof unitRoster.$inferSelect;
export type UnitCustomStats = typeof unitCustomStats.$inferSelect;
export type StageProgress = typeof stageProgress.$inferSelect;
export type ItemInventory = typeof itemInventory.$inferSelect;
