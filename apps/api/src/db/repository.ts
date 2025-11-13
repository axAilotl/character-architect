import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { Card, CardMeta, CardVersion, Spec } from '@card-architect/schemas';

export class CardRepository {
  constructor(private db: Database.Database) {}

  /**
   * List all cards with optional filtering
   */
  list(query?: string, page = 1, limit = 50): Card[] {
    let sql = 'SELECT * FROM cards';
    const params: unknown[] = [];

    if (query) {
      sql += ' WHERE name LIKE ? OR tags LIKE ?';
      params.push(`%${query}%`, `%${query}%`);
    }

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as unknown[];

    return rows.map((row) => this.rowToCard(row));
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
  create(card: Omit<Card, 'meta'> & { meta: Omit<CardMeta, 'id' | 'createdAt' | 'updatedAt'> }): Card {
    const id = nanoid();
    const now = new Date().toISOString();

    const meta: CardMeta = {
      id,
      createdAt: now,
      updatedAt: now,
      ...card.meta,
    };

    const stmt = this.db.prepare(`
      INSERT INTO cards (id, name, spec, data, tags, creator, character_version, rating, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      meta.createdAt,
      meta.updatedAt
    );

    return { meta, data: card.data };
  }

  /**
   * Update a card
   */
  update(id: string, updates: Partial<Card>): Card | null {
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
      SET name = ?, spec = ?, data = ?, tags = ?, creator = ?, character_version = ?, rating = ?, updated_at = ?
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
      id: nanoid(),
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

  create(asset: Omit<import('@card-architect/schemas').Asset, 'id' | 'createdAt'>): import('@card-architect/schemas').Asset {
    const id = nanoid();
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

  get(id: string): import('@card-architect/schemas').Asset | null {
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
