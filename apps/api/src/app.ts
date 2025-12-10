import Fastify, { FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { config } from './config.js';
import { registerRateLimiter } from './middleware/rate-limiter.js';
import { initDatabase, createTables } from './db/schema.js';
import { cardRoutes } from './routes/cards.js';
import { tokenizeRoutes } from './routes/tokenize.js';
import { importExportRoutes } from './routes/import-export.js';
import { assetRoutes } from './routes/assets.js';
import { promptSimulatorRoutes } from './routes/prompt-simulator.js';
import { redundancyRoutes } from './routes/redundancy.js';
import { loreTriggerRoutes } from './routes/lore-trigger.js';
import { llmRoutes } from './routes/llm.js';
import { ragRoutes } from './routes/rag.js';
import { presetRoutes } from './routes/presets.js';
import { sillyTavernRoutes } from './routes/sillytavern.js';
import { settingsRoutes } from './routes/settings.js';
import { templateRoutes } from './routes/templates.js';
import { wwwyzzerddRoutes } from './routes/wwwyzzerdd.js';
import { comfyuiRoutes } from './routes/comfyui.js';
import { webImportRoutes } from './routes/web-import.js';
import { imageArchivalRoutes, userImagesRoutes } from './routes/image-archival.js';
import { charxOptimizerRoutes } from './routes/charx-optimizer.js';
import { federationRoutes } from './routes/federation.js';
import type Database from 'better-sqlite3';

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
  }
}

export async function build(opts: FastifyServerOptions = {}) {
  const fastify = Fastify({
    ...opts,
    bodyLimit: 50 * 1024 * 1024, // 50MB for base64 PNG uploads
  });

  // Initialize database
  const db = initDatabase(config.databasePath);
  createTables(db);

  // Make db available to routes
  fastify.decorate('db', db);

  // Register plugins - Hardened CORS configuration
  const corsOrigins = config.security.corsOrigins;
  const corsConfig = corsOrigins === '*'
    ? { origin: true, credentials: true }  // Dev mode: allow all
    : {
        origin: corsOrigins.split(',').map(o => o.trim()),
        credentials: true,
      };

  await fastify.register(cors, corsConfig);

  // Register rate limiter
  await registerRateLimiter(fastify);

  await fastify.register(multipart, {
    limits: {
      fileSize: config.limits.maxPngSizeMB * 1024 * 1024,
    },
  });

  await fastify.register(staticPlugin, {
    root: config.storagePath,
    prefix: '/storage/',
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  const apiPrefix = { prefix: '/api' };
  await fastify.register(cardRoutes, apiPrefix);
  await fastify.register(tokenizeRoutes, apiPrefix);
  await fastify.register(importExportRoutes, apiPrefix);
  await fastify.register(assetRoutes, apiPrefix);
  await fastify.register(llmRoutes, apiPrefix);
  await fastify.register(ragRoutes, apiPrefix);
  await fastify.register(presetRoutes, apiPrefix);
  await fastify.register(promptSimulatorRoutes, apiPrefix);
  await fastify.register(redundancyRoutes, apiPrefix);
  await fastify.register(loreTriggerRoutes, apiPrefix);
  await fastify.register(sillyTavernRoutes, apiPrefix);
  await fastify.register(settingsRoutes, apiPrefix);
  await fastify.register(templateRoutes, apiPrefix);
  await fastify.register(wwwyzzerddRoutes, apiPrefix);
  await fastify.register(comfyuiRoutes, apiPrefix);
  await fastify.register(webImportRoutes, apiPrefix);
  await fastify.register(imageArchivalRoutes, apiPrefix);
  await fastify.register(charxOptimizerRoutes, apiPrefix);

  // Register user images route at root level (SillyTavern compatibility)
  // This serves archived images at /user/images/:characterName/:filename
  await fastify.register(userImagesRoutes);

  // Federation routes (no prefix - routes define their own /api/federation paths)
  await fastify.register(federationRoutes);

  // Add hook to close database when server closes
  fastify.addHook('onClose', async () => {
    db.close();
  });

  return fastify;
}
