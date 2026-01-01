import Fastify, { FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { config } from './config.js';
import { registerRateLimiter } from './middleware/rate-limiter.js';
import { initDatabase, createTables } from './db/schema.js';
import { setDatabase } from './db/index.js';
import { cardRoutes } from './routes/cards.js';
import { tokenizeRoutes } from './routes/tokenize.js';
import { importExportRoutes } from './routes/import-export.js';
import unifiedImportRoutes from './routes/unified-import.js';
import { assetRoutes } from './routes/assets.js';
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
import { backupRoutes } from './routes/backup.js';
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
    bodyLimit: 500 * 1024 * 1024, // 500MB for large Voxta packages
  });

  // Initialize database
  const db = initDatabase(config.databasePath);
  createTables(db);
  setDatabase(db); // Make db available globally for settings

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

  // Global error handler - standardizes error responses
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;

    // Log the error (skip 4xx client errors at error level)
    if (statusCode >= 500) {
      fastify.log.error({ err: error, url: request.url }, 'Server error');
    } else {
      fastify.log.warn({ err: error, url: request.url }, 'Client error');
    }

    // Standardized error response
    reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
      statusCode,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
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
  await fastify.register(unifiedImportRoutes, apiPrefix); // NEW: Unified import service
  await fastify.register(assetRoutes, apiPrefix);
  await fastify.register(llmRoutes, apiPrefix);
  await fastify.register(ragRoutes, apiPrefix);
  await fastify.register(presetRoutes, apiPrefix);
  await fastify.register(sillyTavernRoutes, apiPrefix);
  await fastify.register(settingsRoutes, apiPrefix);
  await fastify.register(templateRoutes, apiPrefix);
  await fastify.register(wwwyzzerddRoutes, apiPrefix);
  await fastify.register(comfyuiRoutes, apiPrefix);
  if (config.webImport.enabled) {
    await fastify.register(webImportRoutes, apiPrefix);
  }
  await fastify.register(imageArchivalRoutes, apiPrefix);
  await fastify.register(charxOptimizerRoutes, apiPrefix);
  await fastify.register(backupRoutes, apiPrefix);

  // Register user images route at root level (SillyTavern compatibility)
  // This serves archived images at /user/images/:characterName/:filename
  await fastify.register(userImagesRoutes);

  // Federation routes (no prefix - routes define their own /api/federation paths)
  if (config.security.federation.enabled) {
    await fastify.register(federationRoutes);
  }

  // Add hook to close database when server closes
  fastify.addHook('onClose', async () => {
    db.close();
  });

  return fastify;
}
