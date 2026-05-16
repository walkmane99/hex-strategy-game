import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';
import { runMigrations } from './migrate';

const rawDb = openDatabaseSync('hexstrategy.db', { enableChangeListener: true });

runMigrations(rawDb);

export const db = drizzle(rawDb, { schema });
export type DB = typeof db;
