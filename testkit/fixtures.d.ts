export type FixtureTier = 'basic' | 'extended' | 'large' | 'synthetic';
export interface ResolveFixturesOptions {
    allowMissing?: boolean;
}
export declare function resolveFixturesDir(options?: ResolveFixturesOptions): string | null;
export declare function resolveFixturePath(fixturesDir: string, relativePath: string): string;
/**
 * Some fixture JSON files are "wrappers" that include the real character card under `definition`.
 * For parity tests, the canonical baseline is the embedded card, not the wrapper metadata.
 */
export declare function unwrapDefinitionWrapperJson(buffer: Buffer): Buffer;
export declare function listTierFiles(fixturesDir: string, tier: FixtureTier): string[];
//# sourceMappingURL=fixtures.d.ts.map