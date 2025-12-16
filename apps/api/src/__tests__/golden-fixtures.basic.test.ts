import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { parseCard, type ContainerFormat } from '@character-foundry/character-foundry/loader';
import { resolveFixturePath, resolveFixturesDir } from '../../../../testkit/fixtures';

interface Tier1Entry {
  relPath: string;
  format: string;
  sourceSpec: string;
}

function parseTier1BasicEntries(markdown: string): Tier1Entry[] {
  const lines = markdown.split(/\r?\n/);
  let inTier1 = false;
  const out: Tier1Entry[] = [];

  for (const line of lines) {
    if (line.startsWith('### Tier 1: Basic')) {
      inTier1 = true;
      continue;
    }
    if (inTier1 && line.startsWith('### Tier 2:')) break;
    if (!inTier1) continue;

    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
    if (!match) continue;

    out.push({
      relPath: match[1]!.trim(),
      format: match[2]!.trim(),
      sourceSpec: match[3]!.trim(),
    });
  }

  const seen = new Set<string>();
  return out.filter((e) => {
    if (seen.has(e.relPath)) return false;
    seen.add(e.relPath);
    return true;
  });
}

function expectedContainerFormat(relPath: string): ContainerFormat {
  const lower = relPath.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.charx')) return 'charx';
  if (lower.endsWith('.voxpkg')) return 'voxta';
  return 'unknown';
}

function expectedSpec(sourceSpec: string): 'v2' | 'v3' {
  const normalized = sourceSpec.trim().toLowerCase();
  if (normalized === 'v3') return 'v3';
  // v1 fixtures are normalized by the loader to v2.
  return 'v2';
}

describe('Golden fixtures (Tier 1: Basic manifest)', () => {
  const allowMissing = process.env.CF_ALLOW_MISSING_FIXTURES === '1';
  const fixturesDir = resolveFixturesDir({ allowMissing });
  const describeWithFixtures = fixturesDir ? describe : describe.skip;

  const tier1Entries: Tier1Entry[] = fixturesDir
    ? parseTier1BasicEntries(readFileSync(resolveFixturePath(fixturesDir, 'MANIFEST.md'), 'utf-8'))
    : [];

  describeWithFixtures('parseCard() with asset extraction', () => {
    it('has at least one Tier 1 entry in MANIFEST.md', () => {
      expect(tier1Entries.length).toBeGreaterThan(0);
    });

    for (const entry of tier1Entries) {
      it(`parses: ${entry.relPath}`, () => {
        if (!fixturesDir) throw new Error('CF_FIXTURES_DIR is required');

        const absPath = resolveFixturePath(fixturesDir, entry.relPath);
        const rawBuffer = readFileSync(absPath);
        const result = parseCard(new Uint8Array(rawBuffer), { extractAssets: true });

        expect(result.containerFormat).toBe(expectedContainerFormat(entry.relPath));
        expect(result.spec).toBe(expectedSpec(entry.sourceSpec));

        if (result.containerFormat === 'png' || result.containerFormat === 'charx' || result.containerFormat === 'voxta') {
          expect(result.assets.length).toBeGreaterThan(0);
          expect(result.assets.some((a) => a.type === 'icon' && a.isMain)).toBe(true);
        }
      });
    }
  });
});

