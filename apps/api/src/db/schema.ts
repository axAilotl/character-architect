/**
 * Database Schema and Initialization
 *
 * Uses the migration system for schema management.
 * The createTables function now delegates to the migration runner.
 */

import { createFavoriteTable } from './favorites.js';
import Database from 'better-sqlite3';
import { dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { runMigrations } from './migrations.js';

export function initDatabase(dbPath: string): Database.Database {
  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

export function createTables(db: Database.Database): void {
  // Run all pending migrations
  runMigrations(db);
  createFavoriteTable(db);
}
