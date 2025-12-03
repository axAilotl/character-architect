/**
 * Web Import Routes
 *
 * Thin route layer for web import functionality.
 * All business logic is delegated to WebImportService.
 *
 * @see services/web-import/index.ts for implementation
 * @see services/web-import/handlers/ for site-specific handlers
 */

import type { FastifyInstance } from 'fastify';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import { config } from '../config.js';
import {
  WebImportService,
  getSiteList,
  generateUserscript,
  type WebImportSettings,
} from '../services/web-import/index.js';

export async function webImportRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);
  const assetRepo = new AssetRepository(fastify.db);
  const cardAssetRepo = new CardAssetRepository(fastify.db);

  const webImportService = new WebImportService(
    cardRepo,
    assetRepo,
    cardAssetRepo,
    config.storagePath
  );

  /**
   * GET /api/web-import/settings
   * Get current web import settings
   */
  fastify.get('/web-import/settings', async () => {
    return webImportService.getSettings();
  });

  /**
   * PATCH /api/web-import/settings
   * Update web import settings
   */
  fastify.patch<{ Body: Partial<WebImportSettings> }>(
    '/web-import/settings',
    async (request) => {
      return webImportService.updateSettings(request.body);
    }
  );

  /**
   * GET /api/web-import/sites
   * List supported sites with their URL patterns
   */
  fastify.get('/web-import/sites', async () => {
    return { sites: getSiteList() };
  });

  /**
   * GET /api/web-import/userscript
   * Generate and download the userscript with correct server addresses
   */
  fastify.get('/web-import/userscript', async (request, reply) => {
    // Get the request host to determine server address
    const forwarded = request.headers['x-forwarded-host'] as string | undefined;
    const realHost = forwarded || request.headers.host || 'localhost';

    const userscript = generateUserscript(realHost, config.port, config.webPort);

    reply.header('Content-Type', 'text/javascript');
    reply.header(
      'Content-Disposition',
      'attachment; filename="card-architect-import.user.js"'
    );
    return userscript;
  });

  /**
   * POST /api/web-import
   * Import a card from a supported site URL
   *
   * Body:
   * - url: string - URL of the character page
   * - pngData?: string - Base64 PNG data from client (for Wyvern)
   * - clientData?: object - Additional data from client (gallery images, etc.)
   */
  fastify.post<{
    Body: {
      url: string;
      pngData?: string;
      wyvernCardData?: unknown;
      clientData?: unknown;
    };
  }>('/web-import', async (request, reply) => {
    const { url, pngData, wyvernCardData, clientData } = request.body;

    if (!url || typeof url !== 'string') {
      reply.code(400);
      return { success: false, error: 'URL is required' };
    }

    const result = await webImportService.importCard(
      url,
      pngData,
      clientData || wyvernCardData,
      fastify.log
    );

    if (result.success) {
      reply.code(201);
    } else {
      reply.code(500);
    }

    return result;
  });
}
