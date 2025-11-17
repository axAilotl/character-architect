import Database from 'better-sqlite3';
import { dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';

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
  // Cards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      spec TEXT NOT NULL CHECK (spec IN ('v2', 'v3')),
      data TEXT NOT NULL,
      tags TEXT,
      creator TEXT,
      character_version TEXT,
      rating TEXT CHECK (rating IN ('SFW', 'NSFW')),
      original_image BLOB,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Versions table for snapshots
  db.exec(`
    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      data TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    )
  `);

  // Assets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Card Assets table (links cards to their assets with CCv3 metadata)
  db.exec(`
    CREATE TABLE IF NOT EXISTS card_assets (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      ext TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_main INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    )
  `);

  // User-defined LLM presets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      instruction TEXT NOT NULL,
      category TEXT CHECK (category IN ('rewrite', 'format', 'generate', 'custom')),
      is_built_in INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
    CREATE INDEX IF NOT EXISTS idx_cards_spec ON cards(spec);
    CREATE INDEX IF NOT EXISTS idx_cards_updated_at ON cards(updated_at);
    CREATE INDEX IF NOT EXISTS idx_versions_card_id ON versions(card_id);
    CREATE INDEX IF NOT EXISTS idx_versions_created_at ON versions(created_at);
    CREATE INDEX IF NOT EXISTS idx_card_assets_card_id ON card_assets(card_id);
    CREATE INDEX IF NOT EXISTS idx_card_assets_asset_id ON card_assets(asset_id);
    CREATE INDEX IF NOT EXISTS idx_card_assets_type ON card_assets(type);
    CREATE INDEX IF NOT EXISTS idx_card_assets_is_main ON card_assets(is_main);
    CREATE INDEX IF NOT EXISTS idx_llm_presets_category ON llm_presets(category);
    CREATE INDEX IF NOT EXISTS idx_llm_presets_is_built_in ON llm_presets(is_built_in);
  `);

  // Migrations - add original_image column if it doesn't exist
  try {
    db.exec(`ALTER TABLE cards ADD COLUMN original_image BLOB`);
  } catch (err) {
    // Column already exists, ignore error
  }
}
