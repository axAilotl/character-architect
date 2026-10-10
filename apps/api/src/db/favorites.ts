import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  compareFavoriteStates,
  type FavoriteState,
} from '@character-foundry/character-foundry/integrations';

export function createFavoriteTable(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS card_favorites (
    card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
    favorite INTEGER NOT NULL, updated_at INTEGER NOT NULL, change_id TEXT NOT NULL
  )`);
}

export function getFavorite(db: Database.Database, id: string): FavoriteState {
  const row = db.prepare('SELECT * FROM card_favorites WHERE card_id = ?').get(id) as
    { favorite: number; updated_at: number; change_id: string } | undefined;
  return row
    ? { favorite: !!row.favorite, updatedAt: row.updated_at, changeId: row.change_id }
    : { favorite: false, updatedAt: 0, changeId: '' };
}

export function setFavorite(
  db: Database.Database,
  id: string,
  favorite: boolean,
  incoming?: FavoriteState
): FavoriteState {
  return db.transaction(() => {
    const current = getFavorite(db, id);
    const next = incoming || {
      favorite,
      updatedAt: Math.max(Date.now(), current.updatedAt + 1),
      changeId: randomUUID(),
    };
    if (incoming && compareFavoriteStates(next, current) <= 0) return current;
    db.prepare(
      `INSERT INTO card_favorites VALUES (?, ?, ?, ?) ON CONFLICT(card_id) DO UPDATE SET
      favorite=excluded.favorite, updated_at=excluded.updated_at, change_id=excluded.change_id`
    ).run(id, next.favorite ? 1 : 0, next.updatedAt, next.changeId);
    return next;
  })();
}
