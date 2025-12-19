import type { FastifyInstance } from 'fastify';
import { AssetRepository, CardRepository, CardAssetRepository } from '../db/repository.js';
import { AssetGraphService } from '../services/asset-graph.service.js';
import sharp from 'sharp';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { generateId } from '@card-architect/import-core';
import { config } from '../config.js';
import type { AssetTransformOptions, AssetTag } from '../types/index.js';
import { detectAnimatedAsset } from '../utils/asset-utils.js';
import { getMimeTypeFromExt } from '../utils/file-handlers.js';

export async function assetRoutes(fastify: FastifyInstance) {
  const assetRepo = new AssetRepository(fastify.db);
  const cardRepo = new CardRepository(fastify.db);
  const cardAssetRepo = new CardAssetRepository(fastify.db);
  const assetGraphService = new AssetGraphService(cardAssetRepo);

  // Ensure storage directory exists
  if (!existsSync(config.storagePath)) {
    await mkdir(config.storagePath, { recursive: true });
  }

  // Upload asset
  fastify.post('/assets', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      return { error: 'No file provided' };
    }

    const buffer = await data.toBuffer();

    // Validate allowed MIME types
    if (
      !data.mimetype.startsWith('image/') &&
      !data.mimetype.startsWith('video/') &&
      !data.mimetype.startsWith('audio/')
    ) {
      fastify.log.warn({ mimetype: data.mimetype }, 'Upload rejected: unsupported file type');
      reply.code(400);
      return { error: 'File must be an image, video, or audio file' };
    }

    // Get image metadata if it is an image
    let width: number | undefined;
    let height: number | undefined;

    if (data.mimetype.startsWith('image/')) {
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (err) {
        // Ignore metadata errors for images (e.g. corrupted or unsupported by sharp)
        fastify.log.warn({ error: err, filename: data.filename }, 'Failed to read image metadata');
      }
    }

    // Save to disk
    const id = generateId();
    const ext = data.filename.split('.').pop()?.toLowerCase() || data.mimetype.split('/')[1] || 'bin';
    const filename = `${id}.${ext}`;
    const filepath = join(config.storagePath, filename);
    
    // Refine mimetype
    const mimetype = (data.mimetype === 'application/octet-stream') 
        ? getMimeTypeFromExt(ext) 
        : data.mimetype;

    await writeFile(filepath, buffer);

    // Save to database
    const asset = assetRepo.create({
      filename: data.filename,
      mimetype: mimetype,
      size: buffer.length,
      width,
      height,
      url: `/storage/${filename}`,
    });

    reply.code(201);
    return asset;
  });

  // Get asset metadata
  fastify.get<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const asset = assetRepo.get(request.params.id);
    if (!asset) {
      reply.code(404);
      return { error: 'Asset not found' };
    }
    return asset;
  });

  // Get asset thumbnail (for UI performance)
  fastify.get<{ Params: { id: string }; Querystring: { size?: string } }>(
    '/assets/:id/thumbnail',
    async (request, reply) => {
      const asset = assetRepo.get(request.params.id);
      if (!asset) {
        reply.code(404);
        return { error: 'Asset not found' };
      }

      // Only generate thumbnails for images
      if (!asset.mimetype.startsWith('image/')) {
        reply.code(400);
        return { error: 'Thumbnails only available for images' };
      }

      const size = parseInt(request.query.size || '128', 10);
      const maxSize = Math.min(size, 512); // Cap at 512px

      const filepath = join(config.storagePath, asset.url.replace('/storage/', ''));

      try {
        const thumbnail = await sharp(filepath)
          .resize(maxSize, maxSize, {
            fit: 'cover',
            position: 'center',
          })
          .png({ quality: 80 })
          .toBuffer();

        reply.header('Content-Type', 'image/png');
        reply.header('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        return thumbnail;
      } catch (err) {
        fastify.log.error({ error: err, assetId: request.params.id }, 'Failed to generate thumbnail');
        reply.code(500);
        return { error: 'Failed to generate thumbnail' };
      }
    }
  );

  // Transform asset (crop/resize/convert)
  fastify.post<{ Params: { id: string } }>('/assets/:id/transform', async (request, reply) => {
    const asset = assetRepo.get(request.params.id);
    if (!asset) {
      reply.code(404);
      return { error: 'Asset not found' };
    }

    const options = request.body as AssetTransformOptions;
    const filepath = join(config.storagePath, asset.url.replace('/storage/', ''));

    // Apply transformations
    let pipeline = sharp(filepath);

    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: options.fit || 'cover',
      });
    }

    if (options.format) {
      if (options.format === 'jpg') {
        pipeline = pipeline.jpeg({ quality: options.quality || 90 });
      } else if (options.format === 'png') {
        pipeline = pipeline.png({ quality: options.quality || 90 });
      } else if (options.format === 'webp') {
        pipeline = pipeline.webp({ quality: options.quality || 90 });
      }
    }

    const buffer = await pipeline.toBuffer();
    const metadata = await sharp(buffer).metadata();

    // Save transformed image
    const newId = generateId();
    const ext = options.format || asset.mimetype.split('/')[1];
    const filename = `${newId}.${ext}`;
    const newFilepath = join(config.storagePath, filename);

    await writeFile(newFilepath, buffer);

    // Create new asset record
    const newAsset = assetRepo.create({
      filename: `transformed_${asset.filename}`,
      mimetype: options.format ? `image/${options.format}` : asset.mimetype,
      size: buffer.length,
      width: metadata.width,
      height: metadata.height,
      url: `/storage/${filename}`,
    });

    reply.code(201);
    return newAsset;
  });

  /**
   * Card-specific asset management endpoints
   */

  // Get asset graph for a card
  fastify.get<{ Params: { id: string } }>(
    '/cards/:id/asset-graph',
    async (request, reply) => {
      const card = cardRepo.get(request.params.id);
      if (!card) {
        reply.code(404);
        return { error: 'Card not found' };
      }

      const graph = await assetGraphService.buildGraph(request.params.id);
      const mainPortrait = assetGraphService.getMainPortrait(graph);
      const mainBackground = assetGraphService.getMainBackground(graph);
      const actors = assetGraphService.listActors(graph);
      const animatedAssets = assetGraphService.listAnimatedAssets(graph);
      const validationErrors = assetGraphService.validateGraph(graph);

      return {
        nodes: graph,
        summary: {
          totalAssets: graph.length,
          actors,
          mainPortrait: mainPortrait ? {
            id: mainPortrait.id,
            name: mainPortrait.name,
            url: mainPortrait.url,
          } : null,
          mainBackground: mainBackground ? {
            id: mainBackground.id,
            name: mainBackground.name,
            url: mainBackground.url,
          } : null,
          animatedCount: animatedAssets.length,
        },
        validation: {
          valid: validationErrors.length === 0,
          errors: validationErrors,
        },
      };
    }
  );

  // Upload asset to card
  fastify.post<{
    Params: { id: string };
    Querystring: {
      type?: string;
      name?: string;
      isMain?: string;
      tags?: string;
    };
  }>('/cards/:id/assets/upload', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: 'No file provided' };
    }

    const buffer = await file.toBuffer();
    const assetType = request.query.type || 'custom';
    const assetName = request.query.name || file.filename || 'untitled';
    const isMain = request.query.isMain === 'true';
    const tags: AssetTag[] = request.query.tags
      ? request.query.tags.split(',').map(t => t.trim() as AssetTag)
      : [];

    const ext = file.filename?.split('.').pop()?.toLowerCase() || 'bin';
    let mimetype = file.mimetype;

    // Fix generic or incorrect mime types using extension
    if (mimetype === 'application/octet-stream' || mimetype === 'application/x-www-form-urlencoded') {
       mimetype = getMimeTypeFromExt(ext);
    }

    // Get image dimensions
    let width: number | undefined;
    let height: number | undefined;
    if (mimetype.startsWith('image/')) {
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (err) {
        fastify.log.warn({ error: err }, 'Failed to read image metadata');
      }
    }

    // Auto-detect animated tag
    const detectedTags = [...tags];
    if (!detectedTags.includes('animated')) {
      const isAnimated = detectAnimatedAsset(buffer, mimetype);
      if (isAnimated) {
        detectedTags.push('animated');
      }
    }

    // Save to card's storage directory
    const assetId = generateId();
    const filename = `${assetId}.${ext}`;
    const cardStorageDir = join(config.storagePath, request.params.id);

    // Ensure card's storage directory exists
    if (!existsSync(cardStorageDir)) {
      await mkdir(cardStorageDir, { recursive: true });
    }

    const assetPath = join(cardStorageDir, filename);
    await writeFile(assetPath, buffer);

    // Create asset record with card-based path
    const assetUrl = `/storage/${request.params.id}/${filename}`;
    const asset = assetRepo.create({
      filename,
      mimetype,
      size: buffer.length,
      width,
      height,
      url: assetUrl,
    });

    // Get next order index
    const existingAssets = cardAssetRepo.listByCard(request.params.id);
    const maxOrder = existingAssets.reduce((max, a) => Math.max(max, a.order), -1);

    // Create card_asset association
    const cardAsset = cardAssetRepo.create({
      cardId: card.meta.id,
      assetId: asset.id,
      type: assetType,
      name: assetName,
      ext,
      order: maxOrder + 1,
      isMain,
      tags: detectedTags as string[],
    });

    fastify.log.info({
      cardId: card.meta.id,
      assetId: asset.id,
      type: assetType,
      name: assetName,
      tags: detectedTags,
    }, 'Asset uploaded to card');

    reply.code(201);
    return { success: true, asset: { ...cardAsset, asset } };
  });

  // Update card asset metadata
  fastify.patch<{
    Params: { id: string; assetId: string };
    Body: {
      name?: string;
      tags?: string[];
      order?: number;
      isMain?: boolean;
    };
  }>('/cards/:id/assets/:assetId', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    const cardAsset = cardAssetRepo.get(request.params.assetId);
    if (!cardAsset || cardAsset.cardId !== request.params.id) {
      reply.code(404);
      return { error: 'Asset not found' };
    }

    const updated = cardAssetRepo.update(request.params.assetId, request.body);
    if (!updated) {
      reply.code(500);
      return { error: 'Failed to update asset' };
    }

    return { success: true, asset: updated };
  });

  // Reorder assets
  fastify.post<{
    Params: { id: string };
    Body: { assetIds: string[] };
  }>('/cards/:id/assets/reorder', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    if (!Array.isArray(request.body.assetIds)) {
      reply.code(400);
      return { error: 'assetIds array is required' };
    }

    const graph = await assetGraphService.buildGraph(request.params.id);
    const reorderedGraph = assetGraphService.reorderAssets(graph, request.body.assetIds);
    await assetGraphService.applyChanges(graph, reorderedGraph);

    return { success: true, message: `Reordered ${request.body.assetIds.length} assets` };
  });

  // Set portrait override
  fastify.post<{ Params: { id: string; assetId: string } }>(
    '/cards/:id/assets/:assetId/set-portrait-override',
    async (request, reply) => {
      const card = cardRepo.get(request.params.id);
      if (!card) {
        reply.code(404);
        return { error: 'Card not found' };
      }

      const cardAsset = cardAssetRepo.get(request.params.assetId);
      if (!cardAsset || cardAsset.cardId !== request.params.id) {
        reply.code(404);
        return { error: 'Asset not found' };
      }

      const graph = await assetGraphService.buildGraph(request.params.id);
      const updatedGraph = assetGraphService.setPortraitOverride(graph, request.params.assetId);
      await assetGraphService.applyChanges(graph, updatedGraph);

      return { success: true, message: 'Portrait override set' };
    }
  );

  // Set main background
  fastify.post<{ Params: { id: string; assetId: string } }>(
    '/cards/:id/assets/:assetId/set-main-background',
    async (request, reply) => {
      const card = cardRepo.get(request.params.id);
      if (!card) {
        reply.code(404);
        return { error: 'Card not found' };
      }

      const cardAsset = cardAssetRepo.get(request.params.assetId);
      if (!cardAsset || cardAsset.cardId !== request.params.id) {
        reply.code(404);
        return { error: 'Asset not found' };
      }

      const graph = await assetGraphService.buildGraph(request.params.id);
      const updatedGraph = assetGraphService.setMainBackground(graph, request.params.assetId);
      await assetGraphService.applyChanges(graph, updatedGraph);

      return { success: true, message: 'Main background set' };
    }
  );

  // Bind asset to actor
  fastify.post<{
    Params: { id: string; assetId: string };
    Body: { actorIndex: number };
  }>('/cards/:id/assets/:assetId/bind-actor', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    const cardAsset = cardAssetRepo.get(request.params.assetId);
    if (!cardAsset || cardAsset.cardId !== request.params.id) {
      reply.code(404);
      return { error: 'Asset not found' };
    }

    if (typeof request.body.actorIndex !== 'number' || request.body.actorIndex < 1) {
      reply.code(400);
      return { error: 'actorIndex must be a positive integer' };
    }

    const graph = await assetGraphService.buildGraph(request.params.id);
    const updatedGraph = assetGraphService.bindToActor(
      graph,
      request.params.assetId,
      request.body.actorIndex
    );
    await assetGraphService.applyChanges(graph, updatedGraph);

    return { success: true, message: `Asset bound to actor ${request.body.actorIndex}` };
  });

  // Unbind asset from actor
  fastify.post<{ Params: { id: string; assetId: string } }>(
    '/cards/:id/assets/:assetId/unbind-actor',
    async (request, reply) => {
      const card = cardRepo.get(request.params.id);
      if (!card) {
        reply.code(404);
        return { error: 'Card not found' };
      }

      const cardAsset = cardAssetRepo.get(request.params.assetId);
      if (!cardAsset || cardAsset.cardId !== request.params.id) {
        reply.code(404);
        return { error: 'Asset not found' };
      }

      const graph = await assetGraphService.buildGraph(request.params.id);
      const updatedGraph = assetGraphService.unbindFromActor(graph, request.params.assetId);
      await assetGraphService.applyChanges(graph, updatedGraph);

      return { success: true, message: 'Asset unbound from actor' };
    }
  );
}
