import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT || '3456', 10),
  host: process.env.HOST || '0.0.0.0',
  databasePath: process.env.DATABASE_PATH || join(__dirname, '../data/cards.db'),
  storagePath: process.env.STORAGE_PATH || join(__dirname, '../storage'),
  limits: {
    maxCardSizeMB: parseInt(process.env.MAX_CARD_SIZE_MB || '20', 10),
    maxPngSizeMB: parseInt(process.env.MAX_PNG_SIZE_MB || '50', 10),
    warnPngSizeMB: parseInt(process.env.WARN_PNG_SIZE_MB || '10', 10),
    warnCardSizeMB: parseInt(process.env.WARN_CARD_SIZE_MB || '5', 10),
  },
};
