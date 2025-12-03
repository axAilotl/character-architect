/**
 * Database Migration System
 *
 * Provides versioned, trackable migrations instead of try/catch ALTER TABLE.
 * Each migration has an up() function and a unique version number.
 */

import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, renameSync } from 'fs';
import { join, basename } from 'path';
import { config } from '../config.js';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

/**
 * Get the current schema version from the database
 */
export function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
    return row?.version ?? 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Create the migrations tracking table if it doesn't exist
 */
export function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Record that a migration was applied
 */
export function recordMigration(db: Database.Database, migration: Migration): void {
  db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
    migration.version,
    migration.name
  );
}

/**
 * Check if a column exists in a table
 */
export function columnExists(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some(col => col.name === column);
}

/**
 * Check if a table exists
 */
export function tableExists(db: Database.Database, table: string): boolean {
  const result = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(table);
  return result !== undefined;
}

/**
 * All migrations in order
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      // Cards table
      if (!tableExists(db, 'cards')) {
        db.exec(`
          CREATE TABLE cards (
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
      }

      // Versions table
      if (!tableExists(db, 'versions')) {
        db.exec(`
          CREATE TABLE versions (
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
      }

      // Assets table
      if (!tableExists(db, 'assets')) {
        db.exec(`
          CREATE TABLE assets (
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
      }

      // Card Assets table
      if (!tableExists(db, 'card_assets')) {
        db.exec(`
          CREATE TABLE card_assets (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL,
            asset_id TEXT NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            ext TEXT NOT NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            is_main INTEGER NOT NULL DEFAULT 0,
            tags TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
            FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
          )
        `);
      }

      // LLM Presets table
      if (!tableExists(db, 'llm_presets')) {
        db.exec(`
          CREATE TABLE llm_presets (
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
      }
    },
  },
  {
    version: 2,
    name: 'add_indexes',
    up: (db) => {
      // Create indexes if they don't exist
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
    },
  },
  {
    version: 3,
    name: 'add_original_image_column',
    up: (db) => {
      if (!columnExists(db, 'cards', 'original_image')) {
        db.exec('ALTER TABLE cards ADD COLUMN original_image BLOB');
      }
    },
  },
  {
    version: 4,
    name: 'add_card_assets_tags_column',
    up: (db) => {
      if (!columnExists(db, 'card_assets', 'tags')) {
        db.exec('ALTER TABLE card_assets ADD COLUMN tags TEXT');
      }
    },
  },
  {
    version: 5,
    name: 'restructure_asset_storage',
    up: (db) => {
      // This migration moves assets from flat storage to card-based directories
      // Structure: storage/{card_id}/{asset_filename}

      const storagePath = config.storagePath;
      if (!existsSync(storagePath)) {
        return; // No storage directory, nothing to migrate
      }

      // Get all card assets with their card IDs
      const cardAssets = db.prepare(`
        SELECT ca.card_id, a.id as asset_id, a.path as old_path
        FROM card_assets ca
        JOIN assets a ON ca.asset_id = a.id
      `).all() as Array<{ card_id: string; asset_id: string; old_path: string }>;

      // Group assets by card_id
      const assetsByCard = new Map<string, Array<{ asset_id: string; old_path: string }>>();
      for (const asset of cardAssets) {
        const existing = assetsByCard.get(asset.card_id) || [];
        existing.push({ asset_id: asset.asset_id, old_path: asset.old_path });
        assetsByCard.set(asset.card_id, existing);
      }

      // Move each asset to its card's directory
      for (const [cardId, assets] of assetsByCard) {
        const cardDir = join(storagePath, cardId);

        // Create card directory if it doesn't exist
        if (!existsSync(cardDir)) {
          mkdirSync(cardDir, { recursive: true });
        }

        for (const asset of assets) {
          // Extract filename from old path (e.g., /storage/abc123.png -> abc123.png)
          const filename = basename(asset.old_path.replace('/storage/', ''));
          const oldFilePath = join(storagePath, filename);
          const newFilePath = join(cardDir, filename);
          const newUrlPath = `/storage/${cardId}/${filename}`;

          // Only move if the old file exists and new location doesn't
          if (existsSync(oldFilePath) && !existsSync(newFilePath)) {
            try {
              renameSync(oldFilePath, newFilePath);

              // Update the asset's path in the database
              db.prepare('UPDATE assets SET path = ? WHERE id = ?').run(newUrlPath, asset.asset_id);
            } catch (err) {
              // Log but don't fail migration - file may have been moved already
              console.warn(`[Migration] Could not move asset ${filename}: ${err}`);
            }
          } else if (existsSync(newFilePath)) {
            // File already in new location, just update DB path
            db.prepare('UPDATE assets SET path = ? WHERE id = ?').run(newUrlPath, asset.asset_id);
          }
        }
      }

      // Handle orphan assets (assets not linked to any card)
      // These stay in the root storage directory but we should note them
      const orphanAssets = db.prepare(`
        SELECT a.id, a.path
        FROM assets a
        LEFT JOIN card_assets ca ON a.id = ca.asset_id
        WHERE ca.id IS NULL
      `).all() as Array<{ id: string; path: string }>;

      if (orphanAssets.length > 0) {
        console.log(`[Migration] Found ${orphanAssets.length} orphan assets (not linked to any card)`);
        // Create orphans directory for unlinked assets
        const orphansDir = join(storagePath, '_orphans');
        if (!existsSync(orphansDir)) {
          mkdirSync(orphansDir, { recursive: true });
        }

        for (const asset of orphanAssets) {
          const filename = basename(asset.path.replace('/storage/', ''));
          const oldFilePath = join(storagePath, filename);
          const newFilePath = join(orphansDir, filename);
          const newUrlPath = `/storage/_orphans/${filename}`;

          if (existsSync(oldFilePath) && !existsSync(newFilePath)) {
            try {
              renameSync(oldFilePath, newFilePath);
              db.prepare('UPDATE assets SET path = ? WHERE id = ?').run(newUrlPath, asset.id);
            } catch (err) {
              console.warn(`[Migration] Could not move orphan asset ${filename}: ${err}`);
            }
          }
        }
      }
    },
  },
  {
    version: 6,
    name: 'add_card_assets_original_url',
    up: (db) => {
      // Add original_url column to track the original URL of archived linked images
      // This allows reverting the conversion and exporting with original URLs for JSON/PNG
      if (!columnExists(db, 'card_assets', 'original_url')) {
        db.exec('ALTER TABLE card_assets ADD COLUMN original_url TEXT');
      }
    },
  },
];

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database.Database): void {
  ensureMigrationsTable(db);

  const currentVersion = getSchemaVersion(db);
  const pendingMigrations = migrations.filter(m => m.version > currentVersion);

  if (pendingMigrations.length === 0) {
    return;
  }

  console.log(`[Migrations] Running ${pendingMigrations.length} pending migrations...`);

  for (const migration of pendingMigrations) {
    console.log(`[Migrations] Applying migration ${migration.version}: ${migration.name}`);

    // Run migration in a transaction
    const transaction = db.transaction(() => {
      migration.up(db);
      recordMigration(db, migration);
    });

    transaction();

    console.log(`[Migrations] Completed migration ${migration.version}`);
  }

  console.log('[Migrations] All migrations applied successfully');
}
