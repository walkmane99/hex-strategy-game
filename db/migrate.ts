import { SQLiteDatabase } from 'expo-sqlite';

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS player (
    id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL DEFAULT 'MAJ. SAITO',
    total_points INTEGER NOT NULL DEFAULT 0,
    rank TEXT NOT NULL DEFAULT 'E',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS unit_roster (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    unit_type TEXT NOT NULL,
    is_unlocked INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    unlocked_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS unit_custom_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    unit_roster_id INTEGER NOT NULL REFERENCES unit_roster(id),
    hp INTEGER NOT NULL DEFAULT 10,
    attack INTEGER NOT NULL DEFAULT 10,
    defense INTEGER NOT NULL DEFAULT 10,
    movement INTEGER NOT NULL DEFAULT 10,
    scout INTEGER NOT NULL DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS stage_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    stage_id TEXT NOT NULL UNIQUE,
    is_cleared INTEGER NOT NULL DEFAULT 0,
    rank TEXT NOT NULL DEFAULT '-',
    best_turns INTEGER,
    survival_count INTEGER,
    score INTEGER NOT NULL DEFAULT 0,
    cleared_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS item_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    item_code TEXT NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0
  );
`;

export function runMigrations(rawDb: SQLiteDatabase): void {
  rawDb.execSync(INIT_SQL);
}
