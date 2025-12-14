import { build } from './app.js';
import { config } from './config.js';

async function start() {
  const fastify = await build({
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

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    fastify.log.info('SIGTERM received, shutting down gracefully');
    await fastify.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    fastify.log.info('SIGINT received, shutting down gracefully');
    await fastify.close();
    process.exit(0);
  });

  // Start server
  try {
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`Character Architect API listening on http://${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
