import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
/**
 * Resolve the fixtures directory from CF_FIXTURES_DIR env var.
 * Returns null if not set or directory doesn't exist (CI-friendly).
 */
export function resolveFixturesDir(_options = {}) {
    const envDir = process.env.CF_FIXTURES_DIR?.trim();
    if (!envDir) {
        return null;
    }
    if (!existsSync(envDir) || !statSync(envDir).isDirectory()) {
        return null;
    }
    return envDir;
}
export function resolveFixturePath(fixturesDir, relativePath) {
    const absPath = join(fixturesDir, relativePath);
    if (!existsSync(absPath)) {
        throw new Error(`Fixture not found: ${absPath}\n` +
            `CF_FIXTURES_DIR=${fixturesDir}\n` +
            `relativePath=${relativePath}`);
    }
    return absPath;
}
/**
 * Some fixture JSON files are "wrappers" that include the real character card under `definition`.
 * For parity tests, the canonical baseline is the embedded card, not the wrapper metadata.
 */
export function unwrapDefinitionWrapperJson(buffer) {
    try {
        const json = JSON.parse(buffer.toString('utf-8'));
        if (!json || typeof json !== 'object')
            return buffer;
        const def = json.definition;
        if (!def || typeof def !== 'object')
            return buffer;
        const spec = def.spec;
        if (spec !== 'chara_card_v3' && spec !== 'chara_card_v2')
            return buffer;
        return Buffer.from(JSON.stringify(def), 'utf-8');
    }
    catch {
        return buffer;
    }
}
function listFilesRecursive(dir) {
    const out = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...listFilesRecursive(abs));
            continue;
        }
        if (entry.isFile())
            out.push(abs);
    }
    return out;
}
export function listTierFiles(fixturesDir, tier) {
    const tierDir = join(fixturesDir, tier);
    if (!existsSync(tierDir) || !statSync(tierDir).isDirectory()) {
        throw new Error(`Fixture tier directory not found: ${tierDir}`);
    }
    return listFilesRecursive(tierDir);
}
//# sourceMappingURL=fixtures.js.map