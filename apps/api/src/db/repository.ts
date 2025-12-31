import Database from 'better-sqlite3';
import { generateId } from '@card-architect/import-core';
import type { Card, CardMeta, CardUpdate, CardVersion, Spec, CardAsset, CardAssetWithDetails, Asset } from '../types/index.js';

export class CardRepository {
  constructor(private db: Database.Database) {}

  /**
   * List all cards with optional filtering
   */
  list(query?: string, page = 1, limit = 50): { items: Card[]; total: number } {
    // 1. Get total count
    let countSql = 'SELECT COUNT(*) as total FROM cards';
    const countParams: unknown[] = [];

    if (query) {
      countSql += ' WHERE name LIKE ? OR tags LIKE ?';
      countParams.push(`%${query}%`, `%${query}%`);
    }

    const countStmt = this.db.prepare(countSql);
    const { total } = countStmt.get(...countParams) as { total: number };

    // 2. Get paginated items
    let sql = `
      SELECT c.*,
             (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) as asset_count
      FROM cards c
    `;
    const params: unknown[] = [];

    if (query) {
      sql += ' WHERE c.name LIKE ? OR c.tags LIKE ?';
      params.push(`%${query}%`, `%${query}%`);
    }

    sql += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as unknown[];

    return {
      items: rows.map((row) => this.rowToCard(row)),
      total,
    };
  }

  /**
   * Get a card by ID
   */
  get(id: string): Card | null {
    const stmt = this.db.prepare('SELECT * FROM cards WHERE id = ?');
    const row = stmt.get(id);

    return row ? this.rowToCard(row) : null;
  }

  /**
   * Create a new card
   */
  create(card: Omit<Card, 'meta'> & { meta: Omit<CardMeta, 'id' | 'createdAt' | 'updatedAt'> }, originalImage?: Buffer): Card {
    const id = generateId();
    const now = new Date().toISOString();

    const meta: CardMeta = {
      id,
      createdAt: now,
      updatedAt: now,
      ...card.meta,
    };

    const stmt = this.db.prepare(`
      INSERT INTO cards (id, name, spec, data, tags, creator, character_version, rating, original_image, created_at, updated_at, package_id, member_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      meta.id,
      meta.name,
      meta.spec,
      JSON.stringify(card.data),
      JSON.stringify(meta.tags),
      meta.creator || null,
      meta.characterVersion || null,
      meta.rating || null,
      originalImage || null,
      meta.createdAt,
      meta.updatedAt,
      meta.packageId || null,
      meta.memberCount || null
    );

    return { meta, data: card.data };
  }

  /**
   * Get the original image for a card
   */
  getOriginalImage(id: string): Buffer | null {
    const stmt = this.db.prepare('SELECT original_image FROM cards WHERE id = ?');
    const row = stmt.get(id) as { original_image: Buffer | null } | undefined;
    return row?.original_image || null;
  }

  /**
   * Update the original image for a card
   */
  updateOriginalImage(id: string, image: Buffer): boolean {
    const stmt = this.db.prepare('UPDATE cards SET original_image = ?, updated_at = ? WHERE id = ?');
    const result = stmt.run(image, new Date().toISOString(), id);
    return result.changes > 0;
  }

  /**
   * Alias for updateOriginalImage to maintain compatibility with services
   */
  updateImage(id: string, image: Buffer): boolean {
    return this.updateOriginalImage(id, image);
  }

  /**
   * Update a card
   */
  update(id: string, updates: CardUpdate): Card | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const meta: CardMeta = {
      ...existing.meta,
      ...updates.meta,
      id,
      updatedAt: now,
    };

    const data = updates.data || existing.data;

    const stmt = this.db.prepare(`
      UPDATE cards
      SET name = ?, spec = ?, data = ?, tags = ?, creator = ?, character_version = ?, rating = ?, updated_at = ?, package_id = ?, member_count = ?
      WHERE id = ?
    `);

    stmt.run(
      meta.name,
      meta.spec,
      JSON.stringify(data),
      JSON.stringify(meta.tags),
      meta.creator || null,
      meta.characterVersion || null,
      meta.rating || null,
      meta.updatedAt,
      meta.packageId || null,
      meta.memberCount || null,
      id
    );

    return { meta, data };
  }

  /**
   * Delete a card
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM cards WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Create a version snapshot
   */
  createVersion(cardId: string, message?: string): CardVersion | null {
    const card = this.get(cardId);
    if (!card) return null;

    // Get next version number
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM versions WHERE card_id = ?');
    const { count } = countStmt.get(cardId) as { count: number };

    const version: CardVersion = {
      id: generateId(),
      cardId,
      version: count + 1,
      data: card.data,
      message,
      createdAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO versions (id, card_id, version, data, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      version.id,
      version.cardId,
      version.version,
      JSON.stringify(version.data),
      version.message || null,
      version.createdAt
    );

    return version;
  }

  /**
   * List versions for a card
   */
  listVersions(cardId: string): CardVersion[] {
    const stmt = this.db.prepare(`
      SELECT * FROM versions
      WHERE card_id = ?
      ORDER BY version DESC
    `);

    const rows = stmt.all(cardId) as unknown[];
    return rows.map((row) => this.rowToVersion(row));
  }

  /**
   * Restore a card from a version
   */
  restoreVersion(cardId: string, versionId: string): Card | null {
    const versionStmt = this.db.prepare('SELECT * FROM versions WHERE id = ? AND card_id = ?');
    const versionRow = versionStmt.get(versionId, cardId);

    if (!versionRow) return null;

    const version = this.rowToVersion(versionRow);
    return this.update(cardId, { data: version.data });
  }

  /**
   * Delete a version
   */
  deleteVersion(cardId: string, versionId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM versions WHERE id = ? AND card_id = ?');
    const result = stmt.run(versionId, cardId);
    return result.changes > 0;
  }

  /**
   * Convert database row to Card
   */
  private rowToCard(row: unknown): Card {
    const r = row as {
      id: string;
      name: string;
      spec: Spec;
      data: string;
      tags: string;
      creator: string | null;
      character_version: string | null;
      rating: 'SFW' | 'NSFW' | null;
      created_at: string;
      updated_at: string;
      asset_count?: number;
      package_id?: string | null;
      member_count?: number | null;
    };

    return {
      meta: {
        id: r.id,
        name: r.name,
        spec: r.spec,
        tags: JSON.parse(r.tags || '[]'),
        creator: r.creator || undefined,
        characterVersion: r.character_version || undefined,
        rating: r.rating || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        assetCount: r.asset_count,
        packageId: r.package_id || undefined,
        memberCount: r.member_count || undefined,
      },
      data: JSON.parse(r.data),
    };
  }

  /**
   * Convert database row to CardVersion
   */
  private rowToVersion(row: unknown): CardVersion {
    const r = row as {
      id: string;
      card_id: string;
      version: number;
      data: string;
      message: string | null;
      created_at: string;
      created_by: string | null;
    };

    return {
      id: r.id,
      cardId: r.card_id,
      version: r.version,
      data: JSON.parse(r.data),
      message: r.message || undefined,
      createdAt: r.created_at,
      createdBy: r.created_by || undefined,
    };
  }
}

export class AssetRepository {
  constructor(private db: Database.Database) {}

  create(asset: Omit<Asset, 'id' | 'createdAt'>): Asset {
    const id = generateId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO assets (id, filename, mimetype, size, width, height, path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      asset.filename,
      asset.mimetype,
      asset.size,
      asset.width || null,
      asset.height || null,
      asset.url,
      now
    );

    return { ...asset, id, createdAt: now };
  }

  get(id: string): Asset | null {
    const stmt = this.db.prepare('SELECT * FROM assets WHERE id = ?');
    const row = stmt.get(id) as unknown;

    if (!row) return null;

    const r = row as {
      id: string;
      filename: string;
      mimetype: string;
      size: number;
      width: number | null;
      height: number | null;
      path: string;
      created_at: string;
    };

    return {
      id: r.id,
      filename: r.filename,
      mimetype: r.mimetype,
      size: r.size,
      width: r.width || undefined,
      height: r.height || undefined,
      url: r.path,
      createdAt: r.created_at,
    };
  }
}

export class CardAssetRepository {
  constructor(private db: Database.Database) {}

  /**
   * Create a card asset association
   */
  create(cardAsset: Omit<CardAsset, 'id' | 'createdAt' | 'updatedAt'>): CardAsset {
    const id = generateId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO card_assets (id, card_id, asset_id, type, name, ext, order_index, is_main, tags, original_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      cardAsset.cardId,
      cardAsset.assetId,
      cardAsset.type,
      cardAsset.name,
      cardAsset.ext,
      cardAsset.order,
      cardAsset.isMain ? 1 : 0,
      cardAsset.tags ? JSON.stringify(cardAsset.tags) : null,
      cardAsset.originalUrl || null,
      now,
      now
    );

    return { ...cardAsset, id, createdAt: now, updatedAt: now };
  }

  /**
   * Get all assets for a card
   */
  listByCard(cardId: string): CardAsset[] {
    const stmt = this.db.prepare(`
      SELECT * FROM card_assets
      WHERE card_id = ?
      ORDER BY order_index ASC, created_at ASC
    `);

    const rows = stmt.all(cardId) as unknown[];
    return rows.map((row) => this.rowToCardAsset(row));
  }

  /**
   * Get all assets for a card with full asset details
   */
  listByCardWithDetails(cardId: string): CardAssetWithDetails[] {
    const stmt = this.db.prepare(`
      SELECT
        ca.*,
        a.filename, a.mimetype, a.size, a.width, a.height, a.path, a.created_at as asset_created_at
      FROM card_assets ca
      JOIN assets a ON ca.asset_id = a.id
      WHERE ca.card_id = ?
      ORDER BY ca.order_index ASC, ca.created_at ASC
    `);

    const rows = stmt.all(cardId) as unknown[];
    return rows.map((row) => this.rowToCardAssetWithDetails(row));
  }

  /**
   * Get assets by type for a card
   */
  listByCardAndType(cardId: string, type: string): CardAsset[] {
    const stmt = this.db.prepare(`
      SELECT * FROM card_assets
      WHERE card_id = ? AND type = ?
      ORDER BY order_index ASC, created_at ASC
    `);

    const rows = stmt.all(cardId, type) as unknown[];
    return rows.map((row) => this.rowToCardAsset(row));
  }

  /**
   * Get the main asset for a card by type
   */
  getMain(cardId: string, type: string): CardAsset | null {
    const stmt = this.db.prepare(`
      SELECT * FROM card_assets
      WHERE card_id = ? AND type = ? AND is_main = 1
      LIMIT 1
    `);

    const row = stmt.get(cardId, type);
    return row ? this.rowToCardAsset(row) : null;
  }

  /**
   * Set an asset as main for its type (unsets previous main)
   */
  setMain(cardId: string, assetId: string): boolean {
    // First, get the type of the asset
    const getStmt = this.db.prepare('SELECT type FROM card_assets WHERE id = ? AND card_id = ?');
    const row = getStmt.get(assetId, cardId) as { type: string } | undefined;

    if (!row) return false;

    // Unset all main flags for this type
    const unsetStmt = this.db.prepare(`
      UPDATE card_assets
      SET is_main = 0, updated_at = ?
      WHERE card_id = ? AND type = ?
    `);
    unsetStmt.run(new Date().toISOString(), cardId, row.type);

    // Set the new main
    const setStmt = this.db.prepare(`
      UPDATE card_assets
      SET is_main = 1, updated_at = ?
      WHERE id = ? AND card_id = ?
    `);
    const result = setStmt.run(new Date().toISOString(), assetId, cardId);

    return result.changes > 0;
  }

  /**
   * Update a card asset
   */
  update(id: string, updates: Partial<Omit<CardAsset, 'id' | 'cardId' | 'assetId' | 'createdAt'>>): CardAsset | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const merged = { ...existing, ...updates, updatedAt: now };

    const stmt = this.db.prepare(`
      UPDATE card_assets
      SET type = ?, name = ?, ext = ?, order_index = ?, is_main = ?, tags = ?, original_url = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.type,
      merged.name,
      merged.ext,
      merged.order,
      merged.isMain ? 1 : 0,
      merged.tags ? JSON.stringify(merged.tags) : null,
      merged.originalUrl || null,
      merged.updatedAt,
      id
    );

    return merged;
  }

  /**
   * Delete a card asset
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM card_assets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Delete all assets for a card
   */
  deleteByCard(cardId: string): number {
    const stmt = this.db.prepare('DELETE FROM card_assets WHERE card_id = ?');
    const result = stmt.run(cardId);
    return result.changes;
  }

  /**
   * Get a single card asset
   */
  get(id: string): CardAsset | null {
    const stmt = this.db.prepare('SELECT * FROM card_assets WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToCardAsset(row) : null;
  }

  /**
   * Convert database row to CardAsset
   */
  private rowToCardAsset(row: unknown): CardAsset {
    const r = row as {
      id: string;
      card_id: string;
      asset_id: string;
      type: string;
      name: string;
      ext: string;
      order_index: number;
      is_main: number;
      tags: string | null;
      original_url: string | null;
      created_at: string;
      updated_at: string;
    };

    return {
      id: r.id,
      cardId: r.card_id,
      assetId: r.asset_id,
      type: r.type,
      name: r.name,
      ext: r.ext,
      order: r.order_index,
      isMain: r.is_main === 1,
      tags: r.tags ? JSON.parse(r.tags) : undefined,
      originalUrl: r.original_url || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  /**
   * Convert database row to CardAssetWithDetails
   */
  private rowToCardAssetWithDetails(row: unknown): CardAssetWithDetails {
    const r = row as {
      id: string;
      card_id: string;
      asset_id: string;
      type: string;
      name: string;
      ext: string;
      order_index: number;
      is_main: number;
      tags: string | null;
      original_url: string | null;
      created_at: string;
      updated_at: string;
      filename: string;
      mimetype: string;
      size: number;
      width: number | null;
      height: number | null;
      path: string;
      asset_created_at: string;
    };

    const asset: Asset = {
      id: r.asset_id,
      filename: r.filename,
      mimetype: r.mimetype,
      size: r.size,
      width: r.width || undefined,
      height: r.height || undefined,
      url: r.path,
      createdAt: r.asset_created_at,
    };

    return {
      id: r.id,
      cardId: r.card_id,
      assetId: r.asset_id,
      type: r.type,
      name: r.name,
      ext: r.ext,
      order: r.order_index,
      isMain: r.is_main === 1,
      tags: r.tags ? JSON.parse(r.tags) : undefined,
      originalUrl: r.original_url || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      asset,
    };
  }
}
