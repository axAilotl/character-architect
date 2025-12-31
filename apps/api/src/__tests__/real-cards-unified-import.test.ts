import { afterAll, beforeAll, describe, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync } from 'fs';
import { promises as fs } from 'fs';
import { basename, join, relative } from 'path';
import { isDeepStrictEqual } from 'node:util';
import FormData from 'form-data';
import sharp from 'sharp';
import { parseCard } from '@character-foundry/character-foundry/loader';
import { normalize } from '@character-foundry/character-foundry/normalizer';
import { convertCardMacros, isVoxtaCard, voxtaToStandard } from '../utils/file-handlers.js';
import { normalizeCardData } from '../handlers/index.js';
import { unwrapDefinitionWrapperJson } from '../../../../testkit/fixtures';

type ExportFormat = 'json' | 'png' | 'charx';

function getMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.json')) return 'application/json';
  // CHARX and VOXPKG are ZIP containers
  if (lower.endsWith('.charx') || lower.endsWith('.voxpkg')) return 'application/zip';
  return 'application/octet-stream';
}

async function createTestPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 120, g: 140, b: 180, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

function normalizeForCompare(card: unknown, specHint?: 'v2' | 'v3'): unknown {
  const copy = JSON.parse(JSON.stringify(card)) as unknown;
  if (specHint) normalizeCardData(copy, specHint);
  return JSON.parse(JSON.stringify(normalize(copy as any)));
}

function parseExportFormats(input: string | undefined): ExportFormat[] {
  const raw = (input || 'json').trim();
  const parts = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const out: ExportFormat[] = [];
  for (const p of parts) {
    if (p === 'json' || p === 'png' || p === 'charx') out.push(p);
  }
  return out.length > 0 ? Array.from(new Set(out)) : ['json'];
}

async function collectCardFiles(rootDir: string, options: {
  includeIssues: boolean;
  includeRisuBulk: boolean;
  risuBulkMax?: number;
  maxFiles?: number;
}): Promise<string[]> {
  const out: string[] = [];
  const supportedExts = new Set(['.png', '.json', '.charx', '.voxpkg']);

  const shouldSkipDir = (dirName: string) => {
    if (dirName === '@eaDir') return true;
    if (!options.includeIssues && dirName.startsWith('!')) return true;
    // Only include risu_bulk_test when explicitly enabled; sampling is handled separately.
    if (!options.includeRisuBulk && dirName === 'risu_bulk_test') return true;
    return false;
  };

  async function walk(absDir: string, relDir: string) {
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = join(absDir, entry.name);
      const rel = relDir ? join(relDir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        await walk(abs, rel);
        continue;
      }

      if (!entry.isFile()) continue;

      const lower = entry.name.toLowerCase();
      const ext = lower.slice(lower.lastIndexOf('.'));
      if (!supportedExts.has(ext)) continue;

      out.push(abs);
    }
  }

  await walk(rootDir, '');

  // Optional risu bulk sampling (include only the first N files for determinism).
  if (options.risuBulkMax && options.risuBulkMax > 0) {
    const bulkDir = join(rootDir, 'risu_bulk_test');
    if (existsSync(bulkDir)) {
      const bulkFiles = (await collectCardFiles(bulkDir, {
        ...options,
        includeRisuBulk: true,
        risuBulkMax: undefined,
        maxFiles: undefined,
      }))
        .sort();
      out.push(...bulkFiles.slice(0, options.risuBulkMax));
    }
  }

  out.sort();

  if (options.maxFiles && options.maxFiles > 0) {
    return out.slice(0, options.maxFiles);
  }

  return out;
}

describe('Real cards (unified import regression)', () => {
  const realDir = process.env.CF_REAL_CARDS_DIR?.trim() || '';
  const exportsToTest = parseExportFormats(process.env.CF_REAL_CARDS_EXPORTS);

  const includeIssues = process.env.CF_REAL_CARDS_INCLUDE_ISSUES === '1';
  const includeRisuBulk = process.env.CF_REAL_CARDS_INCLUDE_RISU_BULK === '1';
  const risuBulkMax = process.env.CF_REAL_CARDS_RISU_BULK_MAX
    ? Number.parseInt(process.env.CF_REAL_CARDS_RISU_BULK_MAX, 10)
    : undefined;
  const maxFiles = process.env.CF_REAL_CARDS_MAX ? Number.parseInt(process.env.CF_REAL_CARDS_MAX, 10) : undefined;

  const shouldRun = Boolean(realDir) && existsSync(realDir);
  const describeWithDir = shouldRun ? describe : describe.skip;

  describeWithDir('import -> export parity (normalized)', () => {
    let app: FastifyInstance;
    let tmpRoot: string;
    let testImage: Buffer;

    beforeAll(async () => {
      // Isolate DB + storage in-workspace so a big run doesn't pollute dev data.
      const now = Date.now();
      tmpRoot = join(process.cwd(), '.tmp', `real-cards-${now}`);
      await fs.mkdir(tmpRoot, { recursive: true });

      process.env.DATABASE_PATH = join(tmpRoot, 'cards.db');
      process.env.STORAGE_PATH = join(tmpRoot, 'storage');
      process.env.RATE_LIMIT_ENABLED = 'false';

      const { build } = await import('../app.js');
      app = await build({ logger: false });
      await app.ready();

      testImage = await createTestPng();
    });

    afterAll(async () => {
      await app?.close();
      if (tmpRoot) {
        await fs.rm(tmpRoot, { recursive: true, force: true });
      }
    });

    it(
      `imports files from CF_REAL_CARDS_DIR and preserves normalized data via export (${exportsToTest.join(',')})`,
      { timeout: 30 * 60 * 1000 },
      async () => {
        const files = await collectCardFiles(realDir, {
          includeIssues,
          includeRisuBulk,
          risuBulkMax,
          maxFiles,
        });

        if (files.length === 0) {
          throw new Error(`No supported card files found in: ${realDir}`);
        }

        const failures: string[] = [];
        let compared = 0;
        let skipped = 0;

        for (const absPath of files) {
          const relPath = relative(realDir, absPath);

          let cardIdsToDelete: string[] = [];
          try {
            const rawBuffer = readFileSync(absPath);
            const baselineBuffer = absPath.toLowerCase().endsWith('.json')
              ? unwrapDefinitionWrapperJson(rawBuffer)
              : rawBuffer;

            let baselineParsed: ReturnType<typeof parseCard>;
            try {
              baselineParsed = parseCard(new Uint8Array(baselineBuffer), { extractAssets: false });
            } catch (err) {
              // Not a valid card container (e.g., plain PNG without embedded card data).
              skipped += 1;
              continue;
            }

            if (baselineParsed.spec !== 'v2' && baselineParsed.spec !== 'v3') {
              // Skip formats the normalizer can't compare (e.g., lorebooks).
              skipped += 1;
              continue;
            }

            const baselineCard = isVoxtaCard(baselineParsed.card)
              ? convertCardMacros(baselineParsed.card as unknown as Record<string, unknown>, voxtaToStandard)
              : baselineParsed.card;
            const baselineNormalized = normalizeForCompare(baselineCard, baselineParsed.spec);

            const form = new FormData();
            form.append('file', rawBuffer, {
              filename: basename(absPath),
              contentType: getMimeType(absPath),
            });

            const importResp = await app.inject({
              method: 'POST',
              url: '/api/unified-import',
              payload: form,
              headers: form.getHeaders(),
            });

            if (![200, 201].includes(importResp.statusCode)) {
              throw new Error(`Import failed (HTTP ${importResp.statusCode}): ${importResp.body.slice(0, 500)}`);
            }

            const importResult = JSON.parse(importResp.body) as {
              success?: boolean;
              cardIds?: unknown;
              error?: string;
            };

            if (!importResult.success) {
              throw new Error(`Import failed: ${importResult.error || 'Unknown error'}`);
            }

            const cardIds = Array.isArray(importResult.cardIds) ? (importResult.cardIds as string[]) : [];
            if (cardIds.length === 0) {
              throw new Error('Import succeeded but returned no cardIds');
            }

            cardIdsToDelete = cardIds;

            // Pick the first non-collection card for parity checks (collections are containers).
            let targetCardId: string | null = null;
            for (const id of cardIds) {
              const getResp = await app.inject({ method: 'GET', url: `/api/cards/${id}` });
              if (getResp.statusCode !== 200) continue;
              const card = JSON.parse(getResp.body) as { meta?: { spec?: string } };
              if (card.meta?.spec !== 'collection') {
                targetCardId = id;
                break;
              }
            }

            if (!targetCardId) {
              // Nothing to compare; still considered a pass for import stability.
              continue;
            }

            compared += 1;

            if (exportsToTest.includes('png') || exportsToTest.includes('charx')) {
              const imageForm = new FormData();
              imageForm.append('file', testImage, { filename: 'test.png', contentType: 'image/png' });
              await app.inject({
                method: 'POST',
                url: `/api/cards/${targetCardId}/image`,
                payload: imageForm,
                headers: imageForm.getHeaders(),
              });
            }

            const runExportCheck = async (format: ExportFormat) => {
              const exportResp = await app.inject({
                method: 'GET',
                url: `/api/cards/${targetCardId}/export?format=${format}`,
              });
              if (exportResp.statusCode !== 200) {
                throw new Error(`Export ${format} failed (HTTP ${exportResp.statusCode})`);
              }

              if (format === 'json') {
                const jsonBytes = new TextEncoder().encode(exportResp.body);
                const parsed = parseCard(jsonBytes, { extractAssets: false });
                const exportedNormalized = normalizeForCompare(parsed.card, parsed.spec);
                if (!isDeepStrictEqual(exportedNormalized, baselineNormalized)) throw new Error(`Export ${format} normalized mismatch`);
                return;
              }

              const parsed = parseCard(new Uint8Array(exportResp.rawPayload), { extractAssets: false });
              const exportedNormalized = normalizeForCompare(parsed.card, parsed.spec);
              if (!isDeepStrictEqual(exportedNormalized, baselineNormalized)) throw new Error(`Export ${format} normalized mismatch`);
            };

            for (const format of exportsToTest) {
              await runExportCheck(format);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            failures.push(`${relPath}: ${message}`);
          } finally {
            if (cardIdsToDelete.length > 0) {
              for (const id of cardIdsToDelete.slice().reverse()) {
                await app
                  .inject({ method: 'DELETE', url: `/api/cards/${id}` })
                  .catch(() => {});
              }
            }
          }
        }

        if (compared === 0) {
          throw new Error(
            `No comparable v2/v3 card files found (total files: ${files.length}, skipped: ${skipped}).`
          );
        }

        if (failures.length > 0) {
          const head = failures.slice(0, 25).join('\n');
          const tail = failures.length > 25 ? `\n... and ${failures.length - 25} more` : '';
          throw new Error(
            `Unified import regression failures (${failures.length}/${compared} compared, ${skipped} skipped, ${files.length} total):\n${head}${tail}`
          );
        }
      }
    );
  });
});
