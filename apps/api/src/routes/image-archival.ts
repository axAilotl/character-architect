import type { FastifyInstance } from 'fastify';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import { config } from '../config.js';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { join, basename, extname } from 'path';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Extract image URLs from markdown content
 * Matches: ![alt](url) and ![alt](url =widthxheight)
 */
function extractImageUrls(content: string): Array<{ url: string; fullMatch: string }> {
  const images: Array<{ url: string; fullMatch: string }> = [];

  // Match markdown images: ![alt](url) or ![alt](url =dimensions)
  // Also handles angle brackets: ![alt](<url>)
  const mdImageRegex = /!\[([^\]]*)\]\(<?([^>\s)]+)>?(?:\s*=[^)]+)?\)/g;

  let match;
  while ((match = mdImageRegex.exec(content)) !== null) {
    const url = match[2];
    // Only process external URLs (http/https)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      images.push({ url, fullMatch: match[0] });
    }
  }

  // Also match HTML img tags
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlImageRegex.exec(content)) !== null) {
    const url = match[1];
    if (url.startsWith('http://') || url.startsWith('https://')) {
      images.push({ url, fullMatch: match[0] });
    }
  }

  return images;
}

/**
 * Download an image from URL
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Card-Architect/1.0 (image-archival)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const mimeType = contentType.split(';')[0].trim();

  // Determine extension from URL or mime type
  let ext = extname(new URL(url).pathname).replace('.', '').toLowerCase();
  if (!ext || !['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    // Fallback to mime type
    const mimeExt = mimeType.split('/')[1];
    ext = mimeExt === 'jpeg' ? 'jpg' : (mimeExt || 'png');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, mimeType, ext };
}

/**
 * Generate a safe filename for SillyTavern compatibility
 */
function sanitizeFilename(name: string): string {
  // HTML encode and make filesystem-safe
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Slugify a character name for use in paths
 */
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || 'character';
}

/**
 * Restore original URLs in card content for export
 * Used when exporting JSON/PNG to preserve original external URLs
 * Handles both wrapped format (spec/data) and direct fields
 */
export function restoreOriginalUrls(
  cardData: Record<string, unknown>,
  archivedAssets: Array<{ assetId: string; ext: string; originalUrl: string }>,
  characterName: string
): Record<string, unknown> {
  if (archivedAssets.length === 0) {
    return cardData;
  }

  const sluggedName = slugifyName(characterName);

  // Build local path to original URL mapping
  const localToOriginal = new Map<string, string>();
  for (const asset of archivedAssets) {
    // Use assetId which is the nanoid from card_assets, and append .ext
    const localPath = `/user/images/${sluggedName}/${asset.assetId}.${asset.ext}`;
    localToOriginal.set(localPath, asset.originalUrl);
  }

  // Clone the data to avoid mutating the original
  const clonedData = JSON.parse(JSON.stringify(cardData)) as Record<string, unknown>;

  // Handle both wrapped format (spec/data) and direct fields
  const innerData = (clonedData.data as Record<string, unknown>) || clonedData;

  // Replace local paths with original URLs
  let firstMes = (innerData.first_mes as string) || '';
  let alternateGreetings = [...((innerData.alternate_greetings as string[]) || [])];

  for (const [localPath, originalUrl] of localToOriginal) {
    const escapedPath = localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    firstMes = firstMes.replace(new RegExp(escapedPath, 'g'), originalUrl);
    alternateGreetings = alternateGreetings.map(g =>
      g.replace(new RegExp(escapedPath, 'g'), originalUrl)
    );
  }

  // Update the correct location based on data structure
  if (clonedData.data) {
    // Wrapped format
    (clonedData.data as Record<string, unknown>).first_mes = firstMes;
    (clonedData.data as Record<string, unknown>).alternate_greetings = alternateGreetings;
  } else {
    // Direct fields format
    clonedData.first_mes = firstMes;
    clonedData.alternate_greetings = alternateGreetings;
  }

  return clonedData;
}

/**
 * Convert local /user/images/ URLs to embeded:// URLs for CHARX/Voxta export
 * Returns both the modified card data and a list of assets that need to be embedded
 */
export function convertToEmbeddedUrls(
  cardData: Record<string, unknown>,
  archivedAssets: Array<{ assetId: string; ext: string; originalUrl: string }>,
  characterName: string
): { cardData: Record<string, unknown>; embeddedAssets: Array<{ assetId: string; ext: string; embedPath: string }> } {
  if (archivedAssets.length === 0) {
    return { cardData, embeddedAssets: [] };
  }

  const sluggedName = slugifyName(characterName);
  const embeddedAssets: Array<{ assetId: string; ext: string; embedPath: string }> = [];

  // Build local path to embedded URL mapping
  const localToEmbedded = new Map<string, string>();
  for (const asset of archivedAssets) {
    const localPath = `/user/images/${sluggedName}/${asset.assetId}.${asset.ext}`;
    const embedPath = `assets/embedded/${asset.assetId}.${asset.ext}`;
    const embeddedUrl = `embeded://${embedPath}`;
    localToEmbedded.set(localPath, embeddedUrl);
    embeddedAssets.push({ assetId: asset.assetId, ext: asset.ext, embedPath });
  }

  // Clone the data to avoid mutating the original
  const clonedData = JSON.parse(JSON.stringify(cardData)) as Record<string, unknown>;

  // Handle both wrapped format (spec/data) and direct fields
  const innerData = (clonedData.data as Record<string, unknown>) || clonedData;

  // Replace local paths with embedded URLs
  let firstMes = (innerData.first_mes as string) || '';
  let alternateGreetings = [...((innerData.alternate_greetings as string[]) || [])];

  for (const [localPath, embeddedUrl] of localToEmbedded) {
    const escapedPath = localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    firstMes = firstMes.replace(new RegExp(escapedPath, 'g'), embeddedUrl);
    alternateGreetings = alternateGreetings.map(g =>
      g.replace(new RegExp(escapedPath, 'g'), embeddedUrl)
    );
  }

  // Update the correct location based on data structure
  if (clonedData.data) {
    (clonedData.data as Record<string, unknown>).first_mes = firstMes;
    (clonedData.data as Record<string, unknown>).alternate_greetings = alternateGreetings;
  } else {
    clonedData.first_mes = firstMes;
    clonedData.alternate_greetings = alternateGreetings;
  }

  return { cardData: clonedData, embeddedAssets };
}

export async function imageArchivalRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);
  const assetRepo = new AssetRepository(fastify.db);
  const cardAssetRepo = new CardAssetRepository(fastify.db);

  /**
   * Archive linked images from first_mes and alternate_greetings
   * Creates a snapshot backup before making changes
   * Stores original URLs for reverting/export
   */
  fastify.post<{ Params: { id: string } }>('/cards/:id/archive-linked-images', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    // Parse card data - handle both wrapped format (spec/data) and direct fields
    const rawData = card.data as unknown as Record<string, unknown>;
    const innerData = (rawData.data as Record<string, unknown>) || rawData;
    const firstMes = (innerData.first_mes as string) || '';
    const alternateGreetings = (innerData.alternate_greetings as string[]) || [];
    const characterName = (innerData.name as string) || 'character';

    // Extract all image URLs
    const imagesToArchive: Array<{
      url: string;
      fullMatch: string;
      field: 'first_mes' | 'alternate_greetings';
      index?: number;
    }> = [];

    // From first_mes
    for (const img of extractImageUrls(firstMes)) {
      imagesToArchive.push({ ...img, field: 'first_mes' });
    }

    // From alternate_greetings
    alternateGreetings.forEach((greeting, index) => {
      for (const img of extractImageUrls(greeting)) {
        imagesToArchive.push({ ...img, field: 'alternate_greetings', index });
      }
    });

    if (imagesToArchive.length === 0) {
      return {
        success: true,
        message: 'No external images found to archive',
        archived: 0,
        skipped: 0,
        errors: [],
      };
    }

    // Create snapshot backup BEFORE making changes
    fastify.log.info({ cardId: card.meta.id, imageCount: imagesToArchive.length }, 'Creating snapshot before image archival');
    const snapshotStmt = fastify.db.prepare(`
      INSERT INTO versions (id, card_id, version, data, message, created_at)
      SELECT ?, ?, COALESCE(MAX(version), 0) + 1, ?, ?, ?
      FROM versions WHERE card_id = ?
    `);
    const snapshotId = nanoid();
    snapshotStmt.run(
      snapshotId,
      card.meta.id,
      JSON.stringify(card.data),
      '[Auto] Backup before image archival',
      new Date().toISOString(),
      card.meta.id
    );

    // Process each image
    const results: Array<{
      originalUrl: string;
      localPath: string;
      assetId: string;
      success: boolean;
      error?: string;
    }> = [];

    const urlToLocalPath = new Map<string, string>();
    const sluggedName = slugifyName(characterName);

    // Ensure card storage directory exists
    const cardStorageDir = join(config.storagePath, card.meta.id);
    if (!existsSync(cardStorageDir)) {
      await mkdir(cardStorageDir, { recursive: true });
    }

    // Download and save each unique image
    const uniqueUrls = [...new Set(imagesToArchive.map(i => i.url))];

    for (const url of uniqueUrls) {
      try {
        // Download image
        const { buffer, mimeType, ext } = await downloadImage(url);

        // Get image dimensions
        let width: number | undefined;
        let height: number | undefined;
        try {
          const metadata = await sharp(buffer).metadata();
          width = metadata.width;
          height = metadata.height;
        } catch (e) {
          // Non-image or unsupported format
          fastify.log.warn({ url }, 'Could not read image metadata');
        }

        // Generate unique filename
        const assetId = nanoid();
        const filename = `${assetId}.${ext}`;
        const assetPath = join(cardStorageDir, filename);

        // Save to disk
        await writeFile(assetPath, buffer);

        // Create asset record
        const asset = assetRepo.create({
          filename,
          mimetype: mimeType,
          size: buffer.length,
          width,
          height,
          url: `/storage/${card.meta.id}/${filename}`,
        });

        // Get next order index
        const existingAssets = cardAssetRepo.listByCard(card.meta.id);
        const maxOrder = existingAssets.reduce((max, a) => Math.max(max, a.order), -1);

        // Create card_asset association with original URL
        const cardAsset = cardAssetRepo.create({
          cardId: card.meta.id,
          assetId: asset.id,
          type: 'custom',
          name: sanitizeFilename(basename(url, extname(url))),
          ext,
          order: maxOrder + 1,
          isMain: false,
          originalUrl: url, // Store original URL for reverting
        });

        // Build local path for SillyTavern compatibility
        // Format: /user/images/{character-name}/{filename}
        const stLocalPath = `/user/images/${sluggedName}/${filename}`;
        urlToLocalPath.set(url, stLocalPath);

        results.push({
          originalUrl: url,
          localPath: stLocalPath,
          assetId: cardAsset.id,
          success: true,
        });

        fastify.log.info({ url, assetId: cardAsset.id, localPath: stLocalPath }, 'Archived image');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          originalUrl: url,
          localPath: '',
          assetId: '',
          success: false,
          error: errorMsg,
        });
        fastify.log.error({ url, error: err }, 'Failed to archive image');
      }
    }

    // Update card content with local paths
    let updatedFirstMes = firstMes;
    const updatedAlternateGreetings = [...alternateGreetings];

    for (const img of imagesToArchive) {
      const localPath = urlToLocalPath.get(img.url);
      if (!localPath) continue; // Failed to download

      // Replace URL in the full match
      const newMatch = img.fullMatch.replace(img.url, localPath);

      if (img.field === 'first_mes') {
        updatedFirstMes = updatedFirstMes.replace(img.fullMatch, newMatch);
      } else if (img.field === 'alternate_greetings' && img.index !== undefined) {
        updatedAlternateGreetings[img.index] = updatedAlternateGreetings[img.index].replace(
          img.fullMatch,
          newMatch
        );
      }
    }

    // Save updated card - update the inner data while preserving wrapper structure
    let updatedData: typeof card.data;
    if (rawData.data) {
      // Wrapped format - update the inner data object
      updatedData = {
        ...rawData,
        data: {
          ...innerData,
          first_mes: updatedFirstMes,
          alternate_greetings: updatedAlternateGreetings,
        },
      } as typeof card.data;
    } else {
      // Direct fields format
      updatedData = {
        ...rawData,
        first_mes: updatedFirstMes,
        alternate_greetings: updatedAlternateGreetings,
      } as typeof card.data;
    }

    cardRepo.update(card.meta.id, { data: updatedData });

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);

    fastify.log.info({
      cardId: card.meta.id,
      archived: successful,
      failed: failed.length,
      snapshotId,
    }, 'Image archival completed');

    return {
      success: true,
      message: `Archived ${successful} images, ${failed.length} failed`,
      archived: successful,
      skipped: failed.length,
      errors: failed.map(f => ({ url: f.originalUrl, error: f.error })),
      snapshotId,
      results: results.filter(r => r.success).map(r => ({
        originalUrl: r.originalUrl,
        localPath: r.localPath,
        assetId: r.assetId,
      })),
    };
  });


  /**
   * Revert archived images back to original URLs
   */
  fastify.post<{ Params: { id: string } }>('/cards/:id/revert-archived-images', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    // Get all assets with original URLs
    const assets = cardAssetRepo.listByCard(card.meta.id);
    const archivedAssets = assets.filter(a => a.originalUrl);

    if (archivedAssets.length === 0) {
      return {
        success: true,
        message: 'No archived images to revert',
        reverted: 0,
      };
    }

    // Create snapshot before reverting
    const snapshotStmt = fastify.db.prepare(`
      INSERT INTO versions (id, card_id, version, data, message, created_at)
      SELECT ?, ?, COALESCE(MAX(version), 0) + 1, ?, ?, ?
      FROM versions WHERE card_id = ?
    `);
    const snapshotId = nanoid();
    snapshotStmt.run(
      snapshotId,
      card.meta.id,
      JSON.stringify(card.data),
      '[Auto] Backup before image revert',
      new Date().toISOString(),
      card.meta.id
    );

    // Build local path to original URL mapping
    // Handle both wrapped format (spec/data) and direct fields
    const rawData = card.data as unknown as Record<string, unknown>;
    const innerData = (rawData.data as Record<string, unknown>) || rawData;
    const characterName = (innerData.name as string) || 'character';
    const sluggedName = slugifyName(characterName);

    const localToOriginal = new Map<string, string>();
    for (const asset of archivedAssets) {
      const localPath = `/user/images/${sluggedName}/${asset.assetId}.${asset.ext}`;
      localToOriginal.set(localPath, asset.originalUrl!);
    }

    // Revert URLs in card content
    let firstMes = (innerData.first_mes as string) || '';
    let alternateGreetings = [...((innerData.alternate_greetings as string[]) || [])];

    for (const [localPath, originalUrl] of localToOriginal) {
      firstMes = firstMes.replace(new RegExp(localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), originalUrl);
      alternateGreetings = alternateGreetings.map(g =>
        g.replace(new RegExp(localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), originalUrl)
      );
    }

    // Update card - update the inner data while preserving wrapper structure
    let updatedData: typeof card.data;
    if (rawData.data) {
      // Wrapped format - update the inner data object
      updatedData = {
        ...rawData,
        data: {
          ...innerData,
          first_mes: firstMes,
          alternate_greetings: alternateGreetings,
        },
      } as typeof card.data;
    } else {
      // Direct fields format
      updatedData = {
        ...rawData,
        first_mes: firstMes,
        alternate_greetings: alternateGreetings,
      } as typeof card.data;
    }

    cardRepo.update(card.meta.id, { data: updatedData });

    // Optionally delete the archived assets (or keep them for later)
    // For now, we keep them but clear the originalUrl to indicate they're no longer "reverted"
    for (const asset of archivedAssets) {
      cardAssetRepo.update(asset.id, { originalUrl: undefined });
    }

    return {
      success: true,
      message: `Reverted ${archivedAssets.length} images to original URLs`,
      reverted: archivedAssets.length,
      snapshotId,
    };
  });

  /**
   * Get archival status for a card
   */
  fastify.get<{ Params: { id: string } }>('/cards/:id/archive-status', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

    // Count external images in content
    // Handle both wrapped format (spec/data) and direct fields
    const rawData = card.data as unknown as Record<string, unknown>;
    const innerData = (rawData.data as Record<string, unknown>) || rawData;

    const firstMes = (innerData.first_mes as string) || '';
    const alternateGreetings = (innerData.alternate_greetings as string[]) || [];

    let externalImageCount = 0;
    const firstMesImages = extractImageUrls(firstMes);
    externalImageCount += firstMesImages.length;

    for (const greeting of alternateGreetings) {
      const greetingImages = extractImageUrls(greeting);
      externalImageCount += greetingImages.length;
    }

    // Count archived images
    const assets = cardAssetRepo.listByCard(card.meta.id);
    const archivedCount = assets.filter(a => a.originalUrl).length;

    fastify.log.info({
      cardId: card.meta.id,
      firstMesLength: firstMes.length,
      alternateGreetingsCount: alternateGreetings.length,
      externalImageCount,
      archivedCount,
    }, 'Archive status check');

    return {
      externalImages: externalImageCount,
      archivedImages: archivedCount,
      canArchive: externalImageCount > 0,
      canRevert: archivedCount > 0,
    };
  });
}

/**
 * SillyTavern-compatible image serving routes
 * Registered at root level (not under /api) to match ST's path format
 */
export async function userImagesRoutes(fastify: FastifyInstance) {
  /**
   * Serve images at SillyTavern-compatible paths
   * Route: /user/images/:characterName/:filename
   */
  fastify.get<{ Params: { characterName: string; filename: string } }>(
    '/user/images/:characterName/:filename',
    async (request, reply) => {
      const { characterName, filename } = request.params;

      // Search for the file across all cards (since we don't have card ID in the URL)
      const storagePath = config.storagePath;

      // List all card directories and look for the file
      const { readdir } = await import('fs/promises');

      try {
        const cardDirs = await readdir(storagePath);

        for (const cardDir of cardDirs) {
          const filePath = join(storagePath, cardDir, filename);
          if (existsSync(filePath)) {
            // Found it - serve the file
            const buffer = await readFile(filePath);

            // Determine content type from extension
            const ext = extname(filename).toLowerCase();
            const contentTypes: Record<string, string> = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
              '.svg': 'image/svg+xml',
            };

            reply.header('Content-Type', contentTypes[ext] || 'application/octet-stream');
            reply.header('Cache-Control', 'public, max-age=86400');
            return buffer;
          }
        }

        reply.code(404);
        return { error: 'Image not found', path: `/user/images/${characterName}/${filename}` };
      } catch (err) {
        fastify.log.error({ error: err, characterName, filename }, 'Error serving user image');
        reply.code(500);
        return { error: 'Failed to serve image' };
      }
    }
  );
}
