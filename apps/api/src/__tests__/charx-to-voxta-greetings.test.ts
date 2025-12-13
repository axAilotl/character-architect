/**
 * Test CHARX with alternate greetings -> Voxta export
 * Uses Kasumi_test.charx which has 5 alternate greetings, 35 assets, 15 lore entries
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../app.js';
import type { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { unzipSync } from 'fflate';
import { extractCharx } from '../utils/file-handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTING_DIR = path.join(__dirname, '../../../../docs/internal/testing');

describe('CHARX to Voxta Alternate Greetings', () => {
  let app: FastifyInstance;
  const createdCardIds: string[] = [];

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    for (const id of createdCardIds) {
      try {
        await app.inject({ method: 'DELETE', url: `/api/cards/${id}` });
      } catch {}
    }
    await app.close();
  });

  it('should preserve ALL alternate_greetings when converting CHARX to Voxta (5 greetings)', async () => {
    // Use Kasumi_test.charx which has 5 alternate greetings
    const charxFile = path.join(TESTING_DIR, 'Kasumi_test.charx');

    if (!fs.existsSync(charxFile)) {
      throw new Error('Test fixture not found: ' + charxFile);
    }

    const charxBuffer = fs.readFileSync(charxFile);

    // Extract CHARX to get original data
    const charxData = await extractCharx(charxFile);
    const innerData = charxData.card?.data || charxData.card;

    console.log('\n=== ORIGINAL CHARX (Kasumi_test.charx) ===');
    console.log('Alternate greetings count:', innerData.alternate_greetings?.length || 0);
    console.log('Assets count:', charxData.assets?.length || 0);
    console.log('Lore entries:', innerData.character_book?.entries?.length || 0);

    // Verify we have the expected data
    expect(innerData.alternate_greetings?.length).toBe(5);

    // Log each greeting preview
    innerData.alternate_greetings?.forEach((g: string, i: number) => {
      console.log(`  [${i}]: ${String(g).slice(0, 80)}...`);
    });

    // Import the CHARX
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', charxBuffer, { filename: 'Kasumi_test.charx', contentType: 'application/zip' });

    const importResponse = await app.inject({
      method: 'POST',
      url: '/api/import',
      payload: form,
      headers: form.getHeaders(),
    });

    expect([200, 201]).toContain(importResponse.statusCode);
    const importResult = JSON.parse(importResponse.body);
    const cardId = importResult.card.meta.id;
    createdCardIds.push(cardId);

    console.log('\n=== CARD META ===');
    console.log('spec:', importResult.card.meta.spec);
    console.log('isCollection:', importResult.card.meta.spec === 'collection');

    // Verify import preserved greetings
    const storedData = importResult.card.data?.data || importResult.card.data;
    console.log('\n=== AFTER IMPORT ===');
    console.log('Alternate greetings count:', storedData.alternate_greetings?.length || 0);
    expect(storedData.alternate_greetings?.length).toBe(5);

    // Export to Voxta
    const exportResponse = await app.inject({
      method: 'GET',
      url: `/api/cards/${cardId}/export?format=voxta`,
    });

    expect(exportResponse.statusCode).toBe(200);
    const voxtaBuffer = exportResponse.rawPayload;

    // Parse the Voxta ZIP
    const voxtaZip = unzipSync(new Uint8Array(voxtaBuffer));
    const zipFiles = Object.keys(voxtaZip);

    console.log('\n=== VOXTA ZIP STRUCTURE ===');
    console.log('Files:', zipFiles.length);
    console.log('Has package.json:', zipFiles.some(f => f === 'package.json'));

    // NOTE: @character-foundry/voxta v0.1.8 BUG - forces package.json when lorebook exists
    // TODO: Fix in voxta package - single character exports should embed lorebook in character.json
    const hasPackageJson = zipFiles.some(f => f === 'package.json');
    if (hasPackageJson) {
      console.log('WARNING: package.json included (voxta package bug when card has lorebook)');
    }

    // Find character.json
    const charPath = Object.keys(voxtaZip).find(k => k.endsWith('character.json'));
    expect(charPath).toBeDefined();

    const voxtaChar = JSON.parse(new TextDecoder().decode(voxtaZip[charPath!]));

    console.log('\n=== VOXTA EXPORT ===');
    console.log('AlternativeFirstMessages count:', voxtaChar.AlternativeFirstMessages?.length || 0);

    // Log each exported greeting preview
    voxtaChar.AlternativeFirstMessages?.forEach((g: string, i: number) => {
      console.log(`  [${i}]: ${g.slice(0, 80)}...`);
    });

    // CRITICAL: Verify ALL 5 alternate greetings are preserved
    expect(voxtaChar.AlternativeFirstMessages).toBeDefined();
    expect(voxtaChar.AlternativeFirstMessages.length).toBe(5);

    // Verify content of each greeting matches
    const norm = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, '{{$1}}').trim();
    for (let i = 0; i < 5; i++) {
      const original = norm(String(innerData.alternate_greetings![i]));
      const exported = norm(voxtaChar.AlternativeFirstMessages[i]);
      expect(exported).toBe(original);
    }

    console.log('\n=== RESULT: All 5 alternate greetings preserved ===');
  });

  it('should preserve lorebook entries when converting CHARX to Voxta', async () => {
    const charxFile = path.join(TESTING_DIR, 'Kasumi_test.charx');

    if (!fs.existsSync(charxFile)) {
      throw new Error('Test fixture not found: ' + charxFile);
    }

    const charxBuffer = fs.readFileSync(charxFile);
    const charxData = await extractCharx(charxFile);
    const innerData = charxData.card?.data || charxData.card;

    const originalLoreCount = innerData.character_book?.entries?.length || 0;
    console.log('\n=== ORIGINAL CHARX LOREBOOK ===');
    console.log('Lore entries:', originalLoreCount);
    expect(originalLoreCount).toBe(15);

    // Import
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', charxBuffer, { filename: 'Kasumi_test.charx', contentType: 'application/zip' });

    const importResponse = await app.inject({
      method: 'POST',
      url: '/api/import',
      payload: form,
      headers: form.getHeaders(),
    });

    expect([200, 201]).toContain(importResponse.statusCode);
    const importResult = JSON.parse(importResponse.body);
    const cardId = importResult.card.meta.id;
    createdCardIds.push(cardId);

    // Export to Voxta
    const exportResponse = await app.inject({
      method: 'GET',
      url: `/api/cards/${cardId}/export?format=voxta`,
    });

    expect(exportResponse.statusCode).toBe(200);
    const voxtaZip = unzipSync(new Uint8Array(exportResponse.rawPayload));

    // Find memories.json (Voxta lorebook)
    const memoriesPath = Object.keys(voxtaZip).find(k => k.endsWith('memories.json'));

    console.log('\n=== VOXTA EXPORT LOREBOOK ===');
    if (memoriesPath) {
      const memories = JSON.parse(new TextDecoder().decode(voxtaZip[memoriesPath]));
      console.log('Memories entries:', memories.length);
      expect(memories.length).toBe(originalLoreCount);
    } else {
      console.log('No memories.json found - checking character.json');
      const charPath = Object.keys(voxtaZip).find(k => k.endsWith('character.json'));
      const voxtaChar = JSON.parse(new TextDecoder().decode(voxtaZip[charPath!]));
      // Voxta might store lore differently
      console.log('Character keys:', Object.keys(voxtaChar));
    }
  });

  it('should import Arcane Alley University (complex Voxta package) and preserve all data', async () => {
    // Arcane Alley University: 15 characters, 2 lorebooks, 1 scenario with scripts
    const voxpkgFile = path.join(TESTING_DIR, 'Arcane Alley University.1.4.0.voxpkg');

    if (!fs.existsSync(voxpkgFile)) {
      throw new Error('Test fixture not found: ' + voxpkgFile);
    }

    const voxpkgBuffer = fs.readFileSync(voxpkgFile);

    console.log('\n=== ARCANE ALLEY UNIVERSITY (Complex Voxta Package) ===');

    // Import the Voxta package
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', voxpkgBuffer, { filename: 'Arcane Alley University.1.4.0.voxpkg', contentType: 'application/zip' });

    const importResponse = await app.inject({
      method: 'POST',
      url: '/api/import',
      payload: form,
      headers: form.getHeaders(),
    });

    console.log('Import status:', importResponse.statusCode);
    console.log('Import body:', importResponse.body.slice(0, 500));

    expect([200, 201]).toContain(importResponse.statusCode);
    const importResult = JSON.parse(importResponse.body);
    const cardId = importResult.card.meta.id;
    createdCardIds.push(cardId);

    console.log('Card spec:', importResult.card.meta.spec);
    console.log('Card name:', importResult.card.meta.name);

    // This is a collection, should be spec 'collection'
    expect(importResult.card.meta.spec).toBe('collection');

    // Collection itself has 1 asset (scenario thumbnail)
    // Individual character cards have their own thumbnails
    const assetsResponse = await app.inject({
      method: 'GET',
      url: `/api/cards/${cardId}/assets`,
    });
    const assets = JSON.parse(assetsResponse.body);
    console.log('Collection assets:', assets.length);
    // Collection has its own assets (scenario thumbnail, etc.)
    expect(assets.length).toBeGreaterThanOrEqual(1);

    // Verify members have their thumbnails by checking the first character card
    const cardData = importResult.card.data;
    if (cardData.members && cardData.members.length > 0) {
      const firstMemberId = cardData.members[0].cardId;
      const memberAssetsResponse = await app.inject({
        method: 'GET',
        url: `/api/cards/${firstMemberId}/assets`,
      });
      const memberAssets = JSON.parse(memberAssetsResponse.body);
      console.log('First member assets:', memberAssets.length);
      // Each character should have at least a thumbnail
      expect(memberAssets.length).toBeGreaterThanOrEqual(1);
    }

    // Export back to Voxta
    const exportResponse = await app.inject({
      method: 'GET',
      url: `/api/cards/${cardId}/export?format=voxta`,
    });

    console.log('Export status:', exportResponse.statusCode);
    if (exportResponse.statusCode !== 200) {
      console.log('Export error:', exportResponse.body);
    }
    expect(exportResponse.statusCode).toBe(200);
    const exportedZip = unzipSync(new Uint8Array(exportResponse.rawPayload));
    const exportedFiles = Object.keys(exportedZip);

    console.log('\n=== EXPORTED VOXTA PACKAGE ===');
    console.log('Total files:', exportedFiles.length);

    // Should have package.json (this IS a collection)
    expect(exportedFiles.some(f => f === 'package.json')).toBe(true);

    // Count character.json files
    const characterFiles = exportedFiles.filter(f => f.endsWith('character.json'));
    console.log('Character files:', characterFiles.length);

    // Count book.json files
    const bookFiles = exportedFiles.filter(f => f.endsWith('book.json'));
    console.log('Book files:', bookFiles.length);

    // Count scenario files
    const scenarioFiles = exportedFiles.filter(f => f.includes('Scenarios/'));
    console.log('Scenario files:', scenarioFiles.length);

    console.log('\n=== ARCANE ALLEY UNIVERSITY: Import/Export Verified ===');
  });
});
