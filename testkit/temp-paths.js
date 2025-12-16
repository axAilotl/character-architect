import { mkdtempSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
export function createApiTestPaths(prefix = 'card-architect-api-test-') {
    const rootDir = mkdtempSync(join(tmpdir(), prefix));
    const databasePath = join(rootDir, 'cards.db');
    const storagePath = join(rootDir, 'storage');
    mkdirSync(storagePath, { recursive: true });
    return { rootDir, databasePath, storagePath };
}
//# sourceMappingURL=temp-paths.js.map