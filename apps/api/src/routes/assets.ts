import type { FastifyInstance } from 'fastify';
import { AssetRepository } from '../db/repository.js';
import sharp from 'sharp';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { nanoid } from 'nanoid';
import { config } from '../config.js';
import type { AssetTransformOptions } from '@card-architect/schemas';

export async function assetRoutes(fastify: FastifyInstance) {
  const assetRepo = new AssetRepository(fastify.db);

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

    // Validate it's an image
    if (!data.mimetype.startsWith('image/')) {
      reply.code(400);
      return { error: 'File must be an image' };
    }

    // Get image metadata
    const metadata = await sharp(buffer).metadata();

    // Save to disk
    const id = nanoid();
    const ext = data.mimetype.split('/')[1];
    const filename = `${id}.${ext}`;
    const filepath = join(config.storagePath, filename);

    await writeFile(filepath, buffer);

    // Save to database
    const asset = assetRepo.create({
      filename: data.filename,
      mimetype: data.mimetype,
      size: buffer.length,
      width: metadata.width,
      height: metadata.height,
      url: `/storage/${filename}`,
    });

    reply.code(201);
    return asset;
  });

  // Get asset
  fastify.get<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const asset = assetRepo.get(request.params.id);
    if (!asset) {
      reply.code(404);
      return { error: 'Asset not found' };
    }
    return asset;
  });

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
    const newId = nanoid();
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
}
