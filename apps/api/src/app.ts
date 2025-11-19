import Fastify, { FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { config } from './config.js';
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
import type Database from 'better-sqlite3';

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
  }
}

export async function build(opts: FastifyServerOptions = {}) {
  const fastify = Fastify(opts);

  // Initialize database
  const db = initDatabase(config.databasePath);
  createTables(db);

  // Make db available to routes
  fastify.decorate('db', db);

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

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

  // Add hook to close database when server closes
  fastify.addHook('onClose', async () => {
    db.close();
  });

  return fastify;
}
