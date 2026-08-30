import { describe, expect, it } from 'vitest';
import { LocalDB, type RestoreData } from './db';
import type { Card } from './types';

function keyFor(store: string, value: unknown): string {
  const record = value as Record<string, unknown>;
  if (store === 'cards') return String((record.meta as Record<string, unknown>).id);
  if (store === 'images') return JSON.stringify([record.cardId, record.type]);
  return String(record.id);
}

function createFailingDatabase(existing: Card) {
  const committed = new Map<string, Map<string, unknown>>([
    ['cards', new Map([[existing.meta.id, existing]])],
    ['images', new Map()],
    ['versions', new Map()],
    ['assets', new Map()],
    ['drafts', new Map()],
  ]);

  return {
    committed,
    async get(store: string, key: IDBValidKey) {
      return committed.get(store)?.get(JSON.stringify(key)) ?? committed.get(store)?.get(String(key));
    },
    transaction(storeNames: string[]) {
      const staged = new Map(storeNames.map((name) => [name, new Map(committed.get(name))]));
      return {
        objectStore(store: string) {
          const records = staged.get(store)!;
          return {
            async clear() { records.clear(); },
            async get(key: IDBValidKey) { return records.get(JSON.stringify(key)) ?? records.get(String(key)); },
            async put(value: unknown) {
              if (store === 'cards' && keyFor(store, value) === 'bad-card') {
                throw new Error('injected IndexedDB write failure');
              }
              records.set(keyFor(store, value), value);
            },
          };
        },
        get done() {
          for (const [name, records] of staged) committed.set(name, new Map(records));
          return Promise.resolve();
        },
      };
    },
  };
}

describe('LocalDB restore atomicity', () => {
  it('does not commit replace clears when an incoming write fails', async () => {
    const existing = {
      meta: { id: 'existing-card', name: 'Existing', spec: 'v2', tags: [], createdAt: '', updatedAt: '' },
      data: { name: 'Existing' },
    } as Card;
    const invalid = {
      meta: { ...existing.meta, id: 'bad-card', name: 'Bad' },
      data: { name: 'Bad' },
    } as Card;
    const fakeDatabase = createFailingDatabase(existing);
    const database = new LocalDB();
    (database as unknown as { db: unknown }).db = fakeDatabase;

    const payload: RestoreData = { cards: [invalid], images: [], versions: [], assets: [] };
    await expect(database.restoreAll(payload, 'replace')).rejects.toThrow('injected IndexedDB write failure');

    expect(fakeDatabase.committed.get('cards')?.get(existing.meta.id)).toEqual(existing);
    expect(fakeDatabase.committed.get('cards')?.has('bad-card')).toBe(false);
  });

  it('rejects strict merge conflicts before opening a write transaction', async () => {
    const existing = {
      meta: { id: 'existing-card', name: 'Existing', spec: 'v2', tags: [], createdAt: '', updatedAt: '' },
      data: { name: 'Existing' },
    } as Card;
    const fakeDatabase = createFailingDatabase(existing);
    let transactionOpened = false;
    const originalTransaction = fakeDatabase.transaction;
    fakeDatabase.transaction = (...args: Parameters<typeof originalTransaction>) => {
      transactionOpened = true;
      return originalTransaction(...args);
    };
    const database = new LocalDB();
    (database as unknown as { db: unknown }).db = fakeDatabase;

    const payload: RestoreData = { cards: [existing], images: [], versions: [], assets: [] };
    await expect(database.restoreAll(payload, 'merge', false)).rejects.toThrow('Merge conflict');

    expect(transactionOpened).toBe(false);
    expect(fakeDatabase.committed.get('cards')?.get(existing.meta.id)).toEqual(existing);
  });
});
