export type FixtureTier = 'basic' | 'extended' | 'large' | 'synthetic';
export interface ResolveFixturesOptions {
    /** @deprecated No longer used - fixtures are always optional in CI */
    allowMissing?: boolean;
}
/**
 * Resolve the fixtures directory from CF_FIXTURES_DIR env var.
 * Returns null if not set or directory doesn't exist (CI-friendly).
 */
export declare function resolveFixturesDir(_options?: ResolveFixturesOptions): string | null;
export declare function resolveFixturePath(fixturesDir: string, relativePath: string): string;
/**
 * Some fixture JSON files are "wrappers" that include the real character card under `definition`.
 * For parity tests, the canonical baseline is the embedded card, not the wrapper metadata.
 */
export declare function unwrapDefinitionWrapperJson(buffer: Buffer): Buffer;
export declare function listTierFiles(fixturesDir: string, tier: FixtureTier): string[];
//# sourceMappingURL=fixtures.d.ts.map