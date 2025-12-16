import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export type FixtureTier = 'basic' | 'extended' | 'large' | 'synthetic';

export interface ResolveFixturesOptions {
  allowMissing?: boolean;
}

const DEFAULT_FIXTURES_DIR = '/home/vega/ai/character-foundry/fixtures';

export function resolveFixturesDir(options: ResolveFixturesOptions = {}): string | null {
  const envDir = process.env.CF_FIXTURES_DIR?.trim();
  const fixturesDir = envDir || (existsSync(DEFAULT_FIXTURES_DIR) ? DEFAULT_FIXTURES_DIR : null);

  if (!fixturesDir) {
    if (options.allowMissing) return null;
    throw new Error(
      `CF_FIXTURES_DIR is not set and no default fixtures directory exists at ${DEFAULT_FIXTURES_DIR}. ` +
        `Point CF_FIXTURES_DIR at the shared golden fixtures root.`
    );
  }

  if (!existsSync(fixturesDir) || !statSync(fixturesDir).isDirectory()) {
    if (options.allowMissing) return null;
    throw new Error(`CF_FIXTURES_DIR does not exist or is not a directory: ${fixturesDir}`);
  }

  return fixturesDir;
}

export function resolveFixturePath(fixturesDir: string, relativePath: string): string {
  const absPath = join(fixturesDir, relativePath);
  if (!existsSync(absPath)) {
    throw new Error(
      `Fixture not found: ${absPath}\n` +
        `CF_FIXTURES_DIR=${fixturesDir}\n` +
        `relativePath=${relativePath}`
    );
  }
  return absPath;
}

/**
 * Some fixture JSON files are "wrappers" that include the real character card under `definition`.
 * For parity tests, the canonical baseline is the embedded card, not the wrapper metadata.
 */
export function unwrapDefinitionWrapperJson(buffer: Buffer): Buffer {
  try {
    const json = JSON.parse(buffer.toString('utf-8')) as unknown;
    if (!json || typeof json !== 'object') return buffer;
    const def = (json as Record<string, unknown>).definition;
    if (!def || typeof def !== 'object') return buffer;
    const spec = (def as Record<string, unknown>).spec;
    if (spec !== 'chara_card_v3' && spec !== 'chara_card_v2') return buffer;
    return Buffer.from(JSON.stringify(def), 'utf-8');
  } catch {
    return buffer;
  }
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(abs));
      continue;
    }
    if (entry.isFile()) out.push(abs);
  }
  return out;
}

export function listTierFiles(fixturesDir: string, tier: FixtureTier): string[] {
  const tierDir = join(fixturesDir, tier);
  if (!existsSync(tierDir) || !statSync(tierDir).isDirectory()) {
    throw new Error(`Fixture tier directory not found: ${tierDir}`);
  }
  return listFilesRecursive(tierDir);
}
