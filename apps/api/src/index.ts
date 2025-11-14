import Fastify from 'fastify';
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
import type Database from 'better-sqlite3';
import { join } from 'path';

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
  }
}

async function start() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Initialize database
  const db = initDatabase(config.databasePath);
  createTables(db);

  // Make db available to routes
  fastify.decorate('db', db);

  // Register plugins
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
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
  await fastify.register(cardRoutes);
  await fastify.register(tokenizeRoutes);
  await fastify.register(importExportRoutes);
  await fastify.register(assetRoutes);
  await fastify.register(llmRoutes);
  await fastify.register(ragRoutes);
  await fastify.register(promptSimulatorRoutes);
  await fastify.register(redundancyRoutes);
  await fastify.register(loreTriggerRoutes);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    fastify.log.info('SIGTERM received, shutting down gracefully');
    await fastify.close();
    db.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    fastify.log.info('SIGINT received, shutting down gracefully');
    await fastify.close();
    db.close();
    process.exit(0);
  });

  // Start server
  try {
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`Card Architect API listening on http://${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
