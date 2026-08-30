import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import { createTables } from '../db/schema.js';
import { AssetRepository, CardAssetRepository, CardRepository } from '../db/repository.js';
import { BackupService } from '../services/backup.service.js';
import type { Card } from '../types/index.js';

describe('BackupService replace restore atomicity', () => {
  let db: Database.Database | undefined;
  let storagePath: string | undefined;

  afterEach(async () => {
    db?.close();
    if (storagePath) await rm(storagePath, { recursive: true, force: true });
  });

  it('keeps existing data when any incoming row cannot be restored', async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createTables(db);
    storagePath = await mkdtemp(join(tmpdir(), 'ca-backup-atomicity-'));

    const repository = new CardRepository(db);
    const existing = repository.create({
      meta: { name: 'Existing', spec: 'v2', tags: [] },
      data: {
        name: 'Existing',
        description: '',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
      },
    });

    const incoming: Card = {
      meta: {
        id: 'incoming-card',
        name: 'Incoming',
        spec: 'v2',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      data: {
        name: 'Incoming',
        description: '',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
      },
    };
    const invalidIncoming: Card = {
      ...incoming,
      meta: {
        ...incoming.meta,
        id: 'invalid-incoming-card',
        name: 'Invalid Incoming',
        rating: 'INVALID' as Card['meta']['rating'],
      },
    };

    const existingAssetPath = join(storagePath, 'incoming-card', 'asset.bin');
    await mkdir(join(storagePath, 'incoming-card'), { recursive: true });
    await writeFile(existingAssetPath, 'original asset bytes');

    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify({
        version: '1.0',
        createdAt: new Date().toISOString(),
        sourceMode: 'full',
        appVersion: 'test',
        counts: { cards: 2, versions: 0, assets: 1 },
      })),
      'cards.json': strToU8(JSON.stringify([incoming, invalidIncoming])),
      'card_assets.json': strToU8(JSON.stringify([{
        id: 'card-asset-id',
        cardId: incoming.meta.id,
        assetId: 'asset-id',
        type: 'custom',
        name: 'asset',
        ext: 'bin',
        order: 0,
        isMain: false,
        tags: [],
        createdAt: incoming.meta.createdAt,
        updatedAt: incoming.meta.updatedAt,
      }])),
      'assets.json': strToU8(JSON.stringify([{
        id: 'asset-id',
        filename: 'asset.bin',
        mimetype: 'application/octet-stream',
        size: 20,
        url: '/storage/incoming-card/asset.bin',
        createdAt: incoming.meta.createdAt,
      }])),
      'assets/asset-id': strToU8('replacement asset bytes'),
      'versions.json': strToU8('[]'),
      'presets.json': strToU8('[]'),
    });

    const result = await new BackupService(db, storagePath).restoreBackup(
      Buffer.from(archive),
      { mode: 'replace' },
    );

    expect(result.success).toBe(false);
    expect(repository.get(existing.meta.id)).not.toBeNull();
    expect(repository.get(incoming.meta.id)).toBeNull();
    expect(await readFile(existingAssetPath, 'utf8')).toBe('original asset bytes');
  });

  it('round-trips settings and mutable files through a staged archive', async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createTables(db);
    storagePath = await mkdtemp(join(tmpdir(), 'ca-backup-roundtrip-'));

    const settingsPath = join(storagePath, 'data', 'settings.json');
    const presetStoragePath = join(storagePath, 'data', 'presets');
    const themeImagesPath = join(storagePath, 'themes');
    const presetPath = join(presetStoragePath, 'custom.json');
    const themePath = join(themeImagesPath, 'custom.png');
    await mkdir(presetStoragePath, { recursive: true });
    await mkdir(themeImagesPath, { recursive: true });
    await writeFile(settingsPath, '{"theme":"original"}');
    await writeFile(presetPath, '{"prompt":"original"}');
    await writeFile(themePath, 'original theme');
    db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      'llm_settings',
      '{"provider":"original"}',
      '2026-01-01T00:00:00.000Z',
    );

    const service = new BackupService(db, storagePath, {
      settingsPath,
      presetStoragePath,
      themeImagesPath,
    });
    const archive = await service.createBackupArchive();
    const archiveBuffer = await readFile(archive.path);

    try {
      await writeFile(settingsPath, '{"theme":"changed"}');
      await writeFile(presetPath, '{"prompt":"changed"}');
      await writeFile(themePath, 'changed theme');
      await writeFile(join(presetStoragePath, 'stale.json'), '{}');
      await writeFile(join(themeImagesPath, 'stale.png'), 'stale');
      db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(
        '{"provider":"changed"}',
        'llm_settings',
      );

      const result = await service.restoreBackup(archiveBuffer, { mode: 'replace' });

      expect(result.success).toBe(true);
      expect(result.imported.settings).toBe(1);
      expect(result.imported.files).toBe(3);
      expect(db.prepare('SELECT value FROM app_settings WHERE key = ?').pluck().get('llm_settings'))
        .toBe('{"provider":"original"}');
      expect(await readFile(settingsPath, 'utf8')).toBe('{"theme":"original"}');
      expect(await readFile(presetPath, 'utf8')).toBe('{"prompt":"original"}');
      expect(await readFile(themePath, 'utf8')).toBe('original theme');
      await expect(stat(join(presetStoragePath, 'stale.json'))).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(stat(join(themeImagesPath, 'stale.png'))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await archive.cleanup();
    }

    await expect(stat(archive.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('fails backup creation instead of emitting metadata for a missing asset file', async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createTables(db);
    storagePath = await mkdtemp(join(tmpdir(), 'ca-backup-missing-asset-'));

    const card = new CardRepository(db).create({
      meta: { name: 'Asset owner', spec: 'v2', tags: [] },
      data: {
        name: 'Asset owner',
        description: '',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
      },
    });
    const asset = new AssetRepository(db).create({
      filename: 'missing.bin',
      mimetype: 'application/octet-stream',
      size: 10,
      url: `/storage/${card.meta.id}/missing.bin`,
    });
    new CardAssetRepository(db).create({
      cardId: card.meta.id,
      assetId: asset.id,
      type: 'custom',
      name: 'missing',
      ext: 'bin',
      order: 0,
      isMain: false,
    });

    await expect(new BackupService(db, storagePath).createBackupArchive())
      .rejects.toThrow(`asset file is unavailable for ${asset.id}`);
  });

  it('rejects strict server merge conflicts before writing', async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    createTables(db);
    storagePath = await mkdtemp(join(tmpdir(), 'ca-backup-strict-merge-'));
    const repository = new CardRepository(db);
    const existing = repository.create({
      meta: { name: 'Existing', spec: 'v2', tags: [] },
      data: {
        name: 'Existing',
        description: '',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
      },
    });
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify({
        version: '1.0',
        createdAt: new Date().toISOString(),
        sourceMode: 'full',
        appVersion: 'test',
        counts: { cards: 1, versions: 0, assets: 0 },
      })),
      'cards.json': strToU8(JSON.stringify([existing])),
      'card_assets.json': strToU8('[]'),
      'assets.json': strToU8('[]'),
      'versions.json': strToU8('[]'),
    });
    const service = new BackupService(db, storagePath);

    const strictResult = await service.restoreBackup(Buffer.from(archive), {
      mode: 'merge',
      skipConflicts: false,
    });
    expect(strictResult.success).toBe(false);
    expect(strictResult.errors.join(' ')).toContain('Merge conflict');
    expect(repository.list('', 1, 10).total).toBe(1);

    const skipResult = await service.restoreBackup(Buffer.from(archive), {
      mode: 'merge',
      skipConflicts: true,
    });
    expect(skipResult.success).toBe(true);
    expect(skipResult.skipped).toBe(1);
    expect(repository.list('', 1, 10).total).toBe(1);
  });

  it('rejects a manifest whose declared counts do not match the archive', async () => {
    db = new Database(':memory:');
    createTables(db);
    storagePath = await mkdtemp(join(tmpdir(), 'ca-backup-counts-'));
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify({
        version: '1.0',
        createdAt: new Date().toISOString(),
        sourceMode: 'full',
        appVersion: 'test',
        counts: { cards: 1, versions: 0, assets: 0 },
      })),
      'cards.json': strToU8('[]'),
      'card_assets.json': strToU8('[]'),
      'assets.json': strToU8('[]'),
      'versions.json': strToU8('[]'),
    });

    const validation = await new BackupService(db, storagePath).validateBackup(Buffer.from(archive));

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('declares 1 cards, but archive contains 0');
  });
});
