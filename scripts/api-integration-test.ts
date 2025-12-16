/**
 * API integration smoke (HTTP)
 *
 * Useful for validating a running API instance against the shared golden fixtures
 * (e.g. local dev, staging).
 *
 * Requires:
 * - CF_FIXTURES_DIR (or CF_ALLOW_MISSING_FIXTURES=1 to skip)
 *
 * Optional:
 * - API_BASE (default: http://localhost:3456/api)
 * - CF_TEST_TIER=basic|extended|large
 * - CF_RUN_LARGE_TESTS=1
 */

import { readFileSync } from 'fs';
import { basename } from 'path';
import { parseCard } from '@character-foundry/character-foundry/loader';
import { normalize } from '@character-foundry/character-foundry/normalizer';
import { getFixtureTiersToRun } from '../testkit/tier';
import { resolveFixturePath, resolveFixturesDir } from '../testkit/fixtures';

const API_BASE = process.env.API_BASE || 'http://localhost:3456/api';

interface CardMeta {
  id: string;
  name: string;
  spec: string;
}

interface Card {
  meta: CardMeta;
  data: unknown;
}

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, status: 'PASS', duration: Date.now() - start });
    console.log(`✓ ${name}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'FAIL', duration: Date.now() - start, error: errMsg });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${errMsg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function importFile(absPath: string): Promise<Card[]> {
  const buffer = readFileSync(absPath);
  const filename = basename(absPath);
  const isVoxta = filename.toLowerCase().endsWith('.voxpkg');
  const endpoint = isVoxta ? `${API_BASE}/import-voxta` : `${API_BASE}/import`;

  const formData = new FormData();
  formData.append('file', new Blob([buffer]), filename);

  const response = await fetch(endpoint, { method: 'POST', body: formData });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Import failed: ${response.status} - ${text}`);
  }

  const result = await response.json();
  if (result?.success && Array.isArray(result.cards)) return result.cards;
  if (result?.card) return [result.card];
  if (Array.isArray(result)) return result;
  throw new Error(`Unexpected response format: ${JSON.stringify(result).slice(0, 200)}`);
}

async function exportCard(cardId: string, format: 'json' | 'png' | 'charx' | 'voxta'): Promise<Uint8Array> {
  const response = await fetch(`${API_BASE}/cards/${cardId}/export?format=${format}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Export failed: ${response.status} - ${text}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function deleteCard(cardId: string): Promise<void> {
  await fetch(`${API_BASE}/cards/${cardId}`, { method: 'DELETE' }).catch(() => {});
}

async function run() {
  console.log('\n========================================');
  console.log('API INTEGRATION SMOKE (GOLDEN FIXTURES)');
  console.log('========================================\n');
  console.log(`API_BASE=${API_BASE}`);

  const allowMissing = process.env.CF_ALLOW_MISSING_FIXTURES === '1';
  const fixturesDir = resolveFixturesDir({ allowMissing });
  if (!fixturesDir) {
    results.push({
      name: 'fixtures',
      status: 'SKIP',
      duration: 0,
      error: 'CF_FIXTURES_DIR not set (and CF_ALLOW_MISSING_FIXTURES=1)',
    });
    console.log('Skipping: CF_FIXTURES_DIR not set (CF_ALLOW_MISSING_FIXTURES=1).');
    process.exit(0);
  }

  const tiers = getFixtureTiersToRun();
  const fixtures: Array<{ rel: string; exports: Array<'json' | 'png' | 'charx' | 'voxta'> }> = [];

  if (tiers.includes('basic')) {
    fixtures.push(
      { rel: 'basic/json/v1_unwrapped.json', exports: ['json'] },
      { rel: 'basic/json/hybrid_format_v2.json', exports: ['json'] },
      { rel: 'basic/json/null_character_book_v2.json', exports: ['json'] },
      { rel: 'basic/json/null_character_book_v3.json', exports: ['json'] },
      { rel: 'basic/png/baseline_v3_small.png', exports: ['json', 'png', 'charx', 'voxta'] },
      { rel: 'basic/charx/baseline_v3_small.charx', exports: ['json', 'png', 'charx', 'voxta'] },
      { rel: 'basic/voxta/character_only_small.voxpkg', exports: ['json', 'png', 'charx', 'voxta'] }
    );
  }

  if (tiers.includes('synthetic')) {
    fixtures.push(
      { rel: 'synthetic/generated/valid_v2_card.json', exports: ['json'] },
      { rel: 'synthetic/generated/valid_v3_card.json', exports: ['json'] }
    );
  }

  const createdCardIds: string[] = [];

  for (const fixture of fixtures) {
    await test(`import -> export preserves normalized data: ${fixture.rel}`, async () => {
      const absPath = resolveFixturePath(fixturesDir, fixture.rel);
      const baselineBytes = new Uint8Array(readFileSync(absPath));
      const baselineParsed = parseCard(baselineBytes, { extractAssets: false });
      const baselineNormalized = normalize(baselineParsed.card);

      const importedCards = await importFile(absPath);
      assert(importedCards.length > 0, 'No cards returned from import');

      const target = importedCards.find(c => c?.meta?.spec !== 'collection') || importedCards[0];
      const cardId = target.meta.id;
      createdCardIds.push(cardId);

      for (const format of fixture.exports) {
        const exportedBytes = await exportCard(cardId, format);
        const exportedParsed = parseCard(exportedBytes, { extractAssets: false });
        assert(
          JSON.stringify(normalize(exportedParsed.card)) === JSON.stringify(baselineNormalized),
          `Normalized mismatch for export format=${format}`
        );
      }
    });
  }

  console.log('\nCleaning up cards...');
  for (const id of createdCardIds) await deleteCard(id);

  const failed = results.filter(r => r.status === 'FAIL');
  console.log('\n========================================');
  console.log('RESULTS');
  console.log('========================================');
  console.log(`PASS: ${results.filter(r => r.status === 'PASS').length}`);
  console.log(`FAIL: ${failed.length}`);
  console.log(`SKIP: ${results.filter(r => r.status === 'SKIP').length}`);

  if (failed.length > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

