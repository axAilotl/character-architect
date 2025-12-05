import { openDB, type IDBPDatabase } from 'idb';
import type { Card } from '@card-architect/schemas';

const DB_NAME = 'card-architect';
const DB_VERSION = 4;
const DRAFTS_STORE = 'drafts';
const CARDS_STORE = 'cards';
const IMAGES_STORE = 'images';
const VERSIONS_STORE = 'versions';

interface DraftCard {
  id: string;
  card: Card;
  lastSaved: string;
}

interface StoredImage {
  cardId: string;
  type: 'thumbnail' | 'icon' | 'background' | 'asset';
  data: string; // base64 or data URL
}

export interface StoredVersion {
  id: string;
  cardId: string;
  versionNumber: number;
  message?: string;
  data: Card['data'];
  createdAt: string;
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
        // Version 3: images store for card thumbnails/assets
        if (oldVersion < 3 && !db.objectStoreNames.contains(IMAGES_STORE)) {
          const store = db.createObjectStore(IMAGES_STORE, { keyPath: ['cardId', 'type'] });
          store.createIndex('cardId', 'cardId');
        }
        // Version 4: versions store for client-side snapshots
        if (oldVersion < 4 && !db.objectStoreNames.contains(VERSIONS_STORE)) {
          const store = db.createObjectStore(VERSIONS_STORE, { keyPath: 'id' });
          store.createIndex('cardId', 'cardId');
          store.createIndex('cardId_versionNumber', ['cardId', 'versionNumber']);
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

  // Images store (for card thumbnails in client-side mode)
  async saveImage(cardId: string, type: StoredImage['type'], data: string) {
    if (!this.db) await this.init();
    const image: StoredImage = { cardId, type, data };
    await this.db!.put(IMAGES_STORE, image);
  }

  async getImage(cardId: string, type: StoredImage['type']): Promise<string | null> {
    if (!this.db) await this.init();
    const image = await this.db!.get(IMAGES_STORE, [cardId, type]);
    return image?.data || null;
  }

  async deleteCardImages(cardId: string) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(IMAGES_STORE, 'readwrite');
    const index = tx.store.index('cardId');
    const keys = await index.getAllKeys(cardId);
    for (const key of keys) {
      await tx.store.delete(key);
    }
    await tx.done;
  }

  // Versions store (for client-side snapshots)
  async saveVersion(version: StoredVersion) {
    if (!this.db) await this.init();
    await this.db!.put(VERSIONS_STORE, version);
  }

  async getVersion(id: string): Promise<StoredVersion | null> {
    if (!this.db) await this.init();
    return (await this.db!.get(VERSIONS_STORE, id)) || null;
  }

  async getVersionsByCard(cardId: string): Promise<StoredVersion[]> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(VERSIONS_STORE, 'readonly');
    const index = tx.store.index('cardId');
    const versions = await index.getAll(cardId);
    await tx.done;
    // Sort by version number descending (newest first)
    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async getNextVersionNumber(cardId: string): Promise<number> {
    const versions = await this.getVersionsByCard(cardId);
    if (versions.length === 0) return 1;
    return Math.max(...versions.map(v => v.versionNumber)) + 1;
  }

  async deleteVersion(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete(VERSIONS_STORE, id);
  }

  async deleteCardVersions(cardId: string) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(VERSIONS_STORE, 'readwrite');
    const index = tx.store.index('cardId');
    const keys = await index.getAllKeys(cardId);
    for (const key of keys) {
      await tx.store.delete(key);
    }
    await tx.done;
  }
}

export const localDB = new LocalDB();
