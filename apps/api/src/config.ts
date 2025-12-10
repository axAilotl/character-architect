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
  security: {
    // CORS: comma-separated list of allowed origins, or '*' for all (dev only)
    corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173',
    // Rate limiting
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // requests per window
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    // SSRF protection
    ssrfProtectionEnabled: process.env.SSRF_PROTECTION_ENABLED !== 'false',
    // Allowed external hosts for LLM providers (comma-separated)
    allowedLLMHosts: process.env.ALLOWED_LLM_HOSTS || 'api.openai.com,api.anthropic.com,api.together.xyz,openrouter.ai,api.groq.com,localhost,127.0.0.1',
  },
};
