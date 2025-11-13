import { openDB, type IDBPDatabase } from 'idb';
import type { Card } from '@card-architect/schemas';

const DB_NAME = 'card-architect';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

interface DraftCard {
  id: string;
  card: Card;
  lastSaved: string;
}

class LocalDB {
  private db: IDBPDatabase | null = null;

  async init() {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }

  async saveDraft(id: string, card: Card) {
    if (!this.db) await this.init();

    const draft: DraftCard = {
      id,
      card,
      lastSaved: new Date().toISOString(),
    };

    await this.db!.put(STORE_NAME, draft);
  }

  async getDraft(id: string): Promise<DraftCard | null> {
    if (!this.db) await this.init();
    return (await this.db!.get(STORE_NAME, id)) || null;
  }

  async deleteDraft(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete(STORE_NAME, id);
  }

  async listDrafts(): Promise<DraftCard[]> {
    if (!this.db) await this.init();
    return this.db!.getAll(STORE_NAME);
  }
}

export const localDB = new LocalDB();
