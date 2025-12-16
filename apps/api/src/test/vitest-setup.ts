import { mkdirSync } from 'fs';
import { createApiTestPaths } from '../../../../testkit/temp-paths';

// Hermetic API tests: never touch developer DB/storage.
const paths = createApiTestPaths();

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_PATH = paths.databasePath;
process.env.STORAGE_PATH = paths.storagePath;

// Some code paths assume storage exists.
mkdirSync(paths.storagePath, { recursive: true });

