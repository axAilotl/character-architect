/**
 * Database singleton for shared access
 */

import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function setDatabase(database: Database.Database): void {
  db = database;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call setDatabase() first.');
  }
  return db;
}
