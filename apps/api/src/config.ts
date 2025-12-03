import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT || '3456', 10),
  host: process.env.HOST || '0.0.0.0',
  webPort: parseInt(process.env.WEB_PORT || '5173', 10),
  databasePath: process.env.DATABASE_PATH || join(__dirname, '../data/cards.db'),
  storagePath: process.env.STORAGE_PATH || join(__dirname, '../storage'),
  limits: {
    maxCardSizeMB: parseInt(process.env.MAX_CARD_SIZE_MB || '300', 10),
    maxPngSizeMB: parseInt(process.env.MAX_PNG_SIZE_MB || '300', 10),
    warnPngSizeMB: parseInt(process.env.WARN_PNG_SIZE_MB || '100', 10),
    warnCardSizeMB: parseInt(process.env.WARN_CARD_SIZE_MB || '50', 10),
  },
  sillyTavern: {
    enabled: process.env.SILLY_TAVERN_ENABLED === 'true',
    baseUrl: process.env.SILLY_TAVERN_BASE_URL || '',
    importEndpoint: process.env.SILLY_TAVERN_IMPORT_ENDPOINT || '/api/characters/import',
    sessionCookie: process.env.SILLY_TAVERN_SESSION_COOKIE || '',
    csrfToken: process.env.SILLY_TAVERN_CSRF_TOKEN || '',
  },
};
