import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { parseCard } from '@character-foundry/character-foundry/loader';
import { normalize } from '@character-foundry/character-foundry/normalizer';
import { importCardClientSide } from '../lib/client-import';
import { exportCardAsJSON } from '../lib/client-export';
import { getFixtureTiersToRun } from '../../../../testkit/tier';
import { resolveFixturePath, resolveFixturesDir, unwrapDefinitionWrapperJson } from '../../../../testkit/fixtures';

function toUint8(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function sanitizeCardForNormalization(card: any, spec: 'v2' | 'v3'): any {
  const copy = JSON.parse(JSON.stringify(card)) as any;

  if (spec === 'v3') {
    const data = copy?.data;
    if (data && typeof data === 'object') {
      const nullableOptionalFields = [
        'assets',
        'creator_notes_multilingual',
        'source',
        'creation_date',
        'modification_date',
      ];

      for (const field of nullableOptionalFields) {
        if (data[field] === null) delete data[field];
      }

      if (data.character_book === null) delete data.character_book;

      const requiredStrings = [
        'name',
        'description',
        'personality',
        'scenario',
        'first_mes',
        'mes_example',
        'creator',
        'character_version',
      ];

      for (const field of requiredStrings) {
        if (!(field in data) || data[field] === null || data[field] === undefined) {
          data[field] = '';
        }
      }

      if (!Array.isArray(data.tags)) data.tags = [];
      if (!Array.isArray(data.group_only_greetings)) data.group_only_greetings = [];
      if (!Array.isArray(data.alternate_greetings)) data.alternate_greetings = [];
    }

    // Ensure wrapper fields
    if (copy.spec !== 'chara_card_v3') copy.spec = 'chara_card_v3';
    if (typeof copy.spec_version !== 'string' || !copy.spec_version.startsWith('3')) copy.spec_version = '3.0';
    return copy;
  }

  // v2 (wrapped or legacy)
  const data = (copy && typeof copy === 'object' && 'data' in copy && copy.data && typeof copy.data === 'object')
    ? copy.data
    : copy;

  const requiredStrings = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'];
  for (const field of requiredStrings) {
    if (!(field in data) || data[field] === null || data[field] === undefined) {
      data[field] = '';
    }
  }

  if ('alternate_greetings' in data && data.alternate_greetings !== undefined && !Array.isArray(data.alternate_greetings)) {
    data.alternate_greetings = [];
  }

  if ('tags' in data && data.tags !== undefined && !Array.isArray(data.tags)) {
    data.tags = [];
  }

  if (copy && typeof copy === 'object' && 'spec' in copy) {
    if (copy.spec !== 'chara_card_v2') copy.spec = 'chara_card_v2';
    if (typeof copy.spec_version !== 'string' || !copy.spec_version.startsWith('2')) copy.spec_version = '2.0';
  }

  return copy;
}

function normalizeForCompare(card: any, spec: 'v2' | 'v3'): unknown {
  const sanitized = sanitizeCardForNormalization(card, spec);
  return JSON.parse(JSON.stringify(normalize(sanitized)));
}

async function readBlobText(blob: Blob): Promise<string> {
  // jsdom's Blob may not implement .text(); FileReader is reliable in this environment.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('Web client import/export (golden JSON fixtures)', () => {
  const allowMissing = process.env.CF_ALLOW_MISSING_FIXTURES === '1';
  const fixturesDir = resolveFixturesDir({ allowMissing });
  const describeWithFixtures = fixturesDir ? describe : describe.skip;

  describeWithFixtures('importCardClientSide + exportCardAsJSON', () => {
    const tiers = getFixtureTiersToRun();
    const fixtures: string[] = [];

    if (tiers.includes('basic')) {
      fixtures.push(
        'basic/json/v1_unwrapped.json',
        'basic/json/hybrid_format_v2.json',
        'basic/json/null_character_book_v2.json',
        'basic/json/null_character_book_v3.json'
      );
    }

    if (tiers.includes('synthetic')) {
      fixtures.push(
        'synthetic/generated/valid_v2_card.json',
        'synthetic/generated/valid_v3_card.json',
        'synthetic/generated/hybrid_chubai_format.json'
      );
    }

    for (const rel of fixtures) {
      it(`imports and re-exports JSON without changing normalized data: ${rel}`, async () => {
        if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

        const absPath = resolveFixturePath(fixturesDir, rel);
        const rawBuffer = readFileSync(absPath);
        const baselineBuffer = unwrapDefinitionWrapperJson(rawBuffer);
        const baselineParsed = parseCard(toUint8(baselineBuffer), { extractAssets: false });
        const baselineNormalized = normalizeForCompare(baselineParsed.card, baselineParsed.spec);

        const file = new File([rawBuffer], rel.split('/').pop() || 'fixture.json', {
          type: 'application/json',
        });

        const imported = await importCardClientSide(file);
        expect(imported.card).toBeDefined();

        // Normalize imported data via the shared loader/normalizer to avoid shape mismatches.
        const importedBytes = new TextEncoder().encode(JSON.stringify(imported.card.data));
        const importedParsed = parseCard(importedBytes, { extractAssets: false });
        expect(normalizeForCompare(importedParsed.card, importedParsed.spec)).toEqual(baselineNormalized);

        const exportedBlob = exportCardAsJSON(imported.card);
        const exportedText = await readBlobText(exportedBlob);
        const exportedBytes = new TextEncoder().encode(exportedText);
        const exportedParsed = parseCard(exportedBytes, { extractAssets: false });
        expect(normalizeForCompare(exportedParsed.card, exportedParsed.spec)).toEqual(baselineNormalized);
      });
    }
  });
});
