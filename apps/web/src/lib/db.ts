import { openDB, type IDBPDatabase } from 'idb';
import type { Card } from '@card-architect/schemas';

const DB_NAME = 'card-architect';
const DB_VERSION = 2;
const DRAFTS_STORE = 'drafts';
const CARDS_STORE = 'cards';

interface DraftCard {
  id: string;
  card: Card;
  lastSaved: string;
}

class LocalDB {
  private db: IDBPDatabase | null = null;

  async init() {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Version 1: drafts store
        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
        }
        // Version 2: cards store for client-side persistence
        if (oldVersion < 2 && !db.objectStoreNames.contains(CARDS_STORE)) {
          const store = db.createObjectStore(CARDS_STORE, { keyPath: 'meta.id' });
          store.createIndex('name', 'meta.name');
          store.createIndex('updatedAt', 'meta.updatedAt');
        }
      },
    });
  }

  // Cards store (for client-side mode)
  async saveCard(card: Card) {
    if (!this.db) await this.init();
    await this.db!.put(CARDS_STORE, card);
  }

  async getCard(id: string): Promise<Card | null> {
    if (!this.db) await this.init();
    return (await this.db!.get(CARDS_STORE, id)) || null;
  }

  async deleteCard(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete(CARDS_STORE, id);
  }

  async listCards(): Promise<Card[]> {
    if (!this.db) await this.init();
    return this.db!.getAll(CARDS_STORE);
  }

  async saveDraft(id: string, card: Card) {
    if (!this.db) await this.init();

    const draft: DraftCard = {
      id,
      card,
      lastSaved: new Date().toISOString(),
    };

    await this.db!.put(DRAFTS_STORE, draft);
  }

  async getDraft(id: string): Promise<DraftCard | null> {
    if (!this.db) await this.init();
    return (await this.db!.get(DRAFTS_STORE, id)) || null;
  }

  async deleteDraft(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete(DRAFTS_STORE, id);
  }

  async listDrafts(): Promise<DraftCard[]> {
    if (!this.db) await this.init();
    return this.db!.getAll(DRAFTS_STORE);
  }
}

export const localDB = new LocalDB();
