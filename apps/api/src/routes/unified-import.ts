/**
 * Unified Import Route
 *
 * Uses UnifiedImportService for all format imports
 */

import type { FastifyInstance } from 'fastify';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import { UnifiedImportService } from '@card-architect/import-core';
import { ServerStorageAdapter } from '../adapters/server-storage.adapter.js';
import { config } from '../config.js';

export default async function unifiedImportRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);
  const assetRepo = new AssetRepository(fastify.db);
  const cardAssetRepo = new CardAssetRepository(fastify.db);

  // Create storage adapter
  const storageAdapter = new ServerStorageAdapter(
    cardRepo,
    assetRepo,
    cardAssetRepo,
    config.storagePath
  );

  // Create unified import service
  const importService = new UnifiedImportService(storageAdapter);

  /**
   * POST /api/unified-import
   * Import a card file (PNG, CHARX, JSON, Voxta)
   */
  fastify.post('/unified-import', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      return { error: 'No file provided' };
    }

    try {
      const buffer = await data.toBuffer();
      const filename = data.filename || 'upload';

      // Use unified import service
      const cardIds = await importService.importFile(buffer, filename);

      if (cardIds.length === 0) {
        throw new Error('No cards imported');
      }

      // Return first card (collection or character)
      const card = cardRepo.get(cardIds[0]);
      if (!card) {
        throw new Error('Failed to retrieve imported card');
      }

      fastify.log.info({
        cardId: card.meta.id,
        totalCards: cardIds.length,
        filename
      }, 'Successfully imported card via unified service');

      return {
        success: true,
        card,
        cardIds,
        warnings: cardIds.length > 1
          ? [`Imported ${cardIds.length} cards (collection)`]
          : []
      };
    } catch (err) {
      fastify.log.error({ error: err, filename: data.filename }, 'Unified import failed');
      reply.code(500);
      return {
        error: `Import failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  });
}
