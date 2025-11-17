import type { FastifyInstance } from 'fastify';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import { extractFromPNG, validatePNGSize, createCardPNG } from '../utils/png.js';
import { detectSpec, validateV2, validateV3, type CCv2Data, type CCv3Data } from '@card-architect/schemas';
import { config } from '../config.js';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CharxImportService } from '../services/charx-import.service.js';
import { buildCharx, validateCharxBuild } from '../utils/charx-builder.js';

/**
 * Normalize lorebook entry fields to match schema expectations
 * Handles legacy position values (numeric), V3 fields in V2 cards, and other common issues
 */
function normalizeLorebookEntries(dataObj: Record<string, unknown>) {
  if (!dataObj.character_book || typeof dataObj.character_book !== 'object') {
    return;
  }

  const characterBook = dataObj.character_book as Record<string, unknown>;
  if (!Array.isArray(characterBook.entries)) {
    return;
  }

  for (const entry of characterBook.entries) {
    if (!entry || typeof entry !== 'object') continue;

    // Ensure all required V2 fields exist with defaults
    // V2 schema requires: keys, content, enabled, insertion_order, extensions
    if (!('keys' in entry) || !Array.isArray(entry.keys)) {
      entry.keys = [];
    }
    if (!('content' in entry) || typeof entry.content !== 'string') {
      entry.content = '';
    }
    if (!('enabled' in entry) || typeof entry.enabled !== 'boolean') {
      entry.enabled = true; // Default to enabled
    }
    if (!('insertion_order' in entry) || typeof entry.insertion_order !== 'number') {
      entry.insertion_order = 100; // Default order
    }
    if (!('extensions' in entry) || typeof entry.extensions !== 'object' || entry.extensions === null) {
      entry.extensions = {};
    }

    // Normalize position field
    // Some tools use numeric values (0, 1, 2) instead of string enums
    if ('position' in entry) {
      const position = entry.position;

      // Convert numeric position to string enum
      if (typeof position === 'number') {
        // 0 = before_char, 1+ = after_char (common convention)
        entry.position = position === 0 ? 'before_char' : 'after_char';
      }
      // Handle string values that don't match the enum
      else if (typeof position === 'string') {
        const pos = position.toLowerCase();
        if (pos.includes('before') || pos === '0' || pos === 'before') {
          entry.position = 'before_char';
        } else if (pos.includes('after') || pos === '1' || pos === 'after') {
          entry.position = 'after_char';
        } else if (pos !== 'before_char' && pos !== 'after_char') {
          // Invalid value, default to after_char
          entry.position = 'after_char';
        }
      }
      // Handle null/undefined/other types
      else if (position === null || position === undefined) {
        delete entry.position; // Optional field, can be omitted
      }
    }

    // Move V3-specific fields to extensions for V2 compatibility
    // Some cards (like Lilia) have V3 fields in V2 format which can cause issues
    const v3Fields = ['probability', 'depth', 'use_regex', 'scan_frequency', 'role', 'group', 'automation_id', 'selective_logic', 'selectiveLogic'];

    // Move V3 fields into extensions to preserve them
    const extensions = entry.extensions as Record<string, unknown>;
    for (const field of v3Fields) {
      if (field in entry && field !== 'extensions') {
        extensions[field] = entry[field];
        delete entry[field];
      }
    }
  }
}

export async function importExportRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);
  const assetRepo = new AssetRepository(fastify.db);
  const cardAssetRepo = new CardAssetRepository(fastify.db);
  const charxImportService = new CharxImportService(cardRepo, assetRepo, cardAssetRepo);

  // Import from JSON, PNG, or CHARX
  fastify.post('/import', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      return { error: 'No file provided' };
    }

    const buffer = await data.toBuffer();
    const warnings: string[] = [];

    // Check for CHARX format (ZIP magic bytes: PK\x03\x04 or .charx extension)
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    const isCharxExt = data.filename?.endsWith('.charx');

    if (isZip || isCharxExt) {
      // Handle CHARX import
      try {
        // Write buffer to temp file (yauzl requires file path)
        const tempPath = join(tmpdir(), `charx-${Date.now()}-${data.filename || 'upload.charx'}`);
        await fs.writeFile(tempPath, buffer);

        try {
          // Import CHARX
          const result = await charxImportService.importFromFile(tempPath, {
            storagePath: config.storagePath,
            preserveTimestamps: true,
            setAsOriginalImage: true,
          });

          warnings.push(...result.warnings);

          fastify.log.info({
            cardId: result.card.meta.id,
            assetsImported: result.assetsImported,
            warnings: result.warnings,
          }, 'Successfully imported CHARX file');

          return {
            success: true,
            card: result.card,
            assetsImported: result.assetsImported,
            warnings,
          };
        } finally {
          // Clean up temp file
          await fs.unlink(tempPath).catch(() => {});
        }
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to import CHARX');
        reply.code(400);
        return {
          error: `Failed to import CHARX: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    let cardData: unknown;
    let spec: 'v2' | 'v3';
    let originalImage: Buffer | undefined;

    // Detect format
    if (data.mimetype === 'application/json') {
      try {
        cardData = JSON.parse(buffer.toString('utf-8'));
        const detectedSpec = detectSpec(cardData);
        if (!detectedSpec) {
          const obj = cardData as Record<string, unknown>;
          fastify.log.error({
            keys: Object.keys(obj).slice(0, 10),
            hasSpec: 'spec' in obj,
            specValue: obj.spec,
            hasSpecVersion: 'spec_version' in obj,
            specVersionValue: obj.spec_version,
            specVersionType: typeof obj.spec_version,
            hasData: 'data' in obj,
            hasName: 'name' in obj,
            dataHasName: obj.data && typeof obj.data === 'object' && 'name' in obj.data,
          }, 'Failed to detect spec for JSON card');
          reply.code(400);
          return {
            error: 'Invalid card format: unable to detect v2 or v3 spec. The JSON structure does not match expected character card formats.',
            details: 'Expected either: (1) v3 format with "spec":"chara_card_v3" and "data" object, (2) v2 format with "spec":"chara_card_v2" and "data" object, or (3) legacy v2 with direct "name" field.'
          };
        }
        spec = detectedSpec;
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to parse JSON');
        reply.code(400);
        return { error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
      }
    } else if (data.mimetype === 'image/png') {
      // Validate PNG size
      const sizeCheck = validatePNGSize(buffer, {
        max: config.limits.maxPngSizeMB,
        warn: config.limits.warnPngSizeMB,
      });

      if (!sizeCheck.valid) {
        fastify.log.warn({ warnings: sizeCheck.warnings }, 'PNG size validation failed');
        reply.code(400);
        return { error: 'PNG too large', warnings: sizeCheck.warnings };
      }

      warnings.push(...sizeCheck.warnings);

      try {
        const extracted = await extractFromPNG(buffer);
        if (!extracted) {
          fastify.log.error('No character card data found in PNG');
          reply.code(400);
          return {
            error: 'No character card data found in PNG',
            details: 'This PNG does not contain embedded character card data in its text chunks. Make sure the PNG was exported from a character card editor that embeds the card data. Common text chunk keys checked: chara, ccv2, ccv3, character, chara_card_v3.'
          };
        }
        cardData = extracted.data;
        spec = extracted.spec;
        originalImage = buffer; // Store the original PNG
        fastify.log.info({ spec }, 'Successfully extracted card from PNG');
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to extract card from PNG');
        reply.code(400);
        return { error: `Failed to extract card from PNG: ${err instanceof Error ? err.message : String(err)}` };
      }
    } else {
      fastify.log.warn({ mimetype: data.mimetype }, 'Unsupported file type');
      reply.code(400);
      return { error: `Unsupported file type: ${data.mimetype}. Only JSON, PNG, and CHARX files are supported.` };
    }

    // Normalize spec values and data BEFORE validation
    if (cardData && typeof cardData === 'object') {
      const obj = cardData as Record<string, unknown>;

      // Fix wrapped v2 cards with non-standard spec values
      if (spec === 'v2' && 'spec' in obj && obj.spec !== 'chara_card_v2') {
        obj.spec = 'chara_card_v2';
        if (!obj.spec_version) {
          obj.spec_version = '2.0';
        }
      }

      // Fix wrapped v3 cards with non-standard spec values
      if (spec === 'v3' && 'spec' in obj && obj.spec !== 'chara_card_v3') {
        obj.spec = 'chara_card_v3';
        if (!obj.spec_version || !String(obj.spec_version).startsWith('3')) {
          obj.spec_version = '3.0';
        }
      }

      // Handle character_book being null - should be undefined or an object
      if ('data' in obj && obj.data && typeof obj.data === 'object') {
        const dataObj = obj.data as Record<string, unknown>;
        if (dataObj.character_book === null) {
          delete dataObj.character_book;
        }
        // Normalize lorebook entries
        normalizeLorebookEntries(dataObj);
      } else if ('character_book' in obj && obj.character_book === null) {
        delete obj.character_book;
      } else if ('character_book' in obj) {
        // Normalize lorebook entries in legacy format
        normalizeLorebookEntries(obj);
      }
    }

    // Validate card data
    const validation = spec === 'v3' ? validateV3(cardData) : validateV2(cardData);
    if (!validation.valid) {
      fastify.log.error({
        spec,
        errors: validation.errors,
        keys: Object.keys(cardData as Record<string, unknown>).slice(0, 10),
      }, 'Card validation failed');
      reply.code(400);
      return { error: 'Card validation failed', errors: validation.errors };
    }

    warnings.push(...validation.errors.filter((e) => e.severity !== 'error').map((e) => e.message));

    // Extract name and prepare card data for storage
    let name = 'Untitled';
    let storageData: CCv2Data | CCv3Data;

    if (cardData && typeof cardData === 'object') {
      // Handle wrapped v2 cards (CharacterHub format)
      if (spec === 'v2' && 'data' in cardData && typeof cardData.data === 'object' && cardData.data) {
        const wrappedData = cardData.data as CCv2Data;
        name = wrappedData.name || 'Untitled';

        // Debug: Check if lorebook is present
        const hasLorebook = wrappedData.character_book &&
          Array.isArray(wrappedData.character_book.entries) &&
          wrappedData.character_book.entries.length > 0;

        fastify.log.info({
          name,
          spec,
          hasLorebook,
          lorebookEntries: hasLorebook ? wrappedData.character_book!.entries.length : 0,
          dataKeys: Object.keys(wrappedData).slice(0, 20),
        }, 'Importing wrapped v2 card');

        // CRITICAL: Store WITH wrapper to preserve exact format for export
        // The spec REQUIRES: { spec: 'chara_card_v2', spec_version: '2.0', data: {...} }
        storageData = cardData as any;
      }
      // Handle legacy v2 cards (direct fields)
      else if (spec === 'v2' && 'name' in cardData && typeof cardData.name === 'string') {
        name = cardData.name;
        const v2Data = cardData as CCv2Data;

        // Debug: Check if lorebook is present
        const hasLorebook = v2Data.character_book &&
          Array.isArray(v2Data.character_book.entries) &&
          v2Data.character_book.entries.length > 0;

        fastify.log.info({
          name,
          spec,
          hasLorebook,
          lorebookEntries: hasLorebook ? v2Data.character_book!.entries.length : 0,
        }, 'Importing legacy v2 card');

        // Legacy v2 (no wrapper) - wrap it for consistency
        storageData = {
          spec: 'chara_card_v2',
          spec_version: '2.0',
          data: v2Data,
        } as any;
      }
      // Handle v3 cards (always wrapped)
      else if (spec === 'v3' && 'data' in cardData && typeof cardData.data === 'object' && cardData.data) {
        const v3Data = cardData as CCv3Data;
        name = v3Data.data.name || 'Untitled';

        // Debug: Check if lorebook is present
        const hasLorebook = v3Data.data.character_book &&
          Array.isArray(v3Data.data.character_book.entries) &&
          v3Data.data.character_book.entries.length > 0;

        fastify.log.info({
          name,
          spec,
          hasLorebook,
          lorebookEntries: hasLorebook ? v3Data.data.character_book!.entries.length : 0,
        }, 'Importing v3 card');

        // Store wrapped v3 data (CCv3Data type includes wrapper)
        storageData = v3Data;
      }
      else {
        // Fallback
        fastify.log.warn({ spec, keys: Object.keys(cardData).slice(0, 10) }, 'Using fallback import path');

        if ('name' in cardData && typeof cardData.name === 'string') {
          name = cardData.name;
        } else if ('data' in cardData && typeof cardData.data === 'object' && cardData.data && 'name' in cardData.data) {
          name = (cardData.data as { name: string }).name;
        }
        storageData = cardData as (CCv2Data | CCv3Data);
      }
    } else {
      storageData = cardData as (CCv2Data | CCv3Data);
    }

    // Create card
    const card = cardRepo.create({
      data: storageData,
      meta: {
        name,
        spec,
        tags: [],
      },
    }, originalImage);

    // Debug: Verify lorebook is in the created card
    const createdCardData = card.data as any;
    const finalHasLorebook = createdCardData.character_book?.entries?.length > 0;

    fastify.log.info({
      cardId: card.meta.id,
      name: card.meta.name,
      spec: card.meta.spec,
      hasLorebookAfterCreate: finalHasLorebook,
      lorebookEntriesAfterCreate: finalHasLorebook ? createdCardData.character_book.entries.length : 0,
    }, 'Card created and ready to return');

    reply.code(201);
    return { card, warnings };
  });

  // Import multiple cards at once
  fastify.post('/import-multiple', async (request, reply) => {
    const files = request.files();

    // Convert AsyncIterableIterator to array
    const fileList: any[] = [];
    for await (const file of files) {
      fileList.push(file);
    }

    if (fileList.length === 0) {
      reply.code(400);
      return { error: 'No files provided' };
    }

    const results: Array<{
      filename: string;
      success: boolean;
      card?: any;
      error?: string;
      warnings?: string[];
    }> = [];

    for (const file of fileList) {
      const filename = file.filename || 'unknown';

      try {
        const buffer = await file.toBuffer();
        const warnings: string[] = [];

        // Check for CHARX format
        const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
        const isCharxExt = filename.endsWith('.charx');

        if (isZip || isCharxExt) {
          // Handle CHARX import
          const tempPath = join(tmpdir(), `charx-${Date.now()}-${filename}`);
          await fs.writeFile(tempPath, buffer);

          try {
            const result = await charxImportService.importFromFile(tempPath, {
              storagePath: config.storagePath,
              preserveTimestamps: true,
              setAsOriginalImage: true,
            });

            results.push({
              filename,
              success: true,
              card: result.card,
              warnings: result.warnings,
            });
          } finally {
            await fs.unlink(tempPath).catch(() => {});
          }
          continue;
        }

        // Regular JSON/PNG import
        let cardData: unknown;
        let spec: 'v2' | 'v3';
        let originalImage: Buffer | undefined;

        if (file.mimetype === 'application/json') {
          cardData = JSON.parse(buffer.toString('utf-8'));
          const detectedSpec = detectSpec(cardData);
          if (!detectedSpec) {
            results.push({
              filename,
              success: false,
              error: 'Invalid card format: unable to detect v2 or v3 spec',
            });
            continue;
          }
          spec = detectedSpec;
        } else if (file.mimetype === 'image/png') {
          const sizeCheck = validatePNGSize(buffer, {
            max: config.limits.maxPngSizeMB,
            warn: config.limits.warnPngSizeMB,
          });

          if (!sizeCheck.valid) {
            results.push({
              filename,
              success: false,
              error: 'PNG too large',
              warnings: sizeCheck.warnings,
            });
            continue;
          }

          warnings.push(...sizeCheck.warnings);

          const extracted = await extractFromPNG(buffer);
          if (!extracted) {
            results.push({
              filename,
              success: false,
              error: 'No character card data found in PNG',
            });
            continue;
          }
          cardData = extracted.data;
          spec = extracted.spec;
          originalImage = buffer;
        } else {
          results.push({
            filename,
            success: false,
            error: `Unsupported file type: ${file.mimetype}`,
          });
          continue;
        }

        // Normalize and validate
        if (cardData && typeof cardData === 'object') {
          const obj = cardData as Record<string, unknown>;

          if (spec === 'v2' && 'spec' in obj && obj.spec !== 'chara_card_v2') {
            obj.spec = 'chara_card_v2';
            if (!obj.spec_version) obj.spec_version = '2.0';
          }

          if (spec === 'v3' && 'spec' in obj && obj.spec !== 'chara_card_v3') {
            obj.spec = 'chara_card_v3';
            if (!obj.spec_version || !String(obj.spec_version).startsWith('3')) {
              obj.spec_version = '3.0';
            }
          }

          if ('data' in obj && obj.data && typeof obj.data === 'object') {
            const dataObj = obj.data as Record<string, unknown>;
            if (dataObj.character_book === null) delete dataObj.character_book;
            normalizeLorebookEntries(dataObj);
          } else if ('character_book' in obj) {
            if (obj.character_book === null) delete obj.character_book;
            else normalizeLorebookEntries(obj);
          }
        }

        const validation = spec === 'v3' ? validateV3(cardData) : validateV2(cardData);
        if (!validation.valid) {
          results.push({
            filename,
            success: false,
            error: 'Card validation failed',
            warnings: validation.errors.map(e => e.message),
          });
          continue;
        }

        warnings.push(...validation.errors.filter((e) => e.severity !== 'error').map((e) => e.message));

        // Extract name and create card
        let name = 'Untitled';
        let storageData: CCv2Data | CCv3Data;

        if (cardData && typeof cardData === 'object') {
          if (spec === 'v2' && 'data' in cardData && typeof cardData.data === 'object' && cardData.data) {
            const wrappedData = cardData.data as CCv2Data;
            name = wrappedData.name || 'Untitled';
            storageData = cardData as any;
          } else if (spec === 'v2' && 'name' in cardData && typeof cardData.name === 'string') {
            name = cardData.name;
            const v2Data = cardData as CCv2Data;
            storageData = {
              spec: 'chara_card_v2',
              spec_version: '2.0',
              data: v2Data,
            } as any;
          } else if (spec === 'v3' && 'data' in cardData && typeof cardData.data === 'object' && cardData.data) {
            const v3DataInner = cardData.data as CCv3Data['data'];
            name = v3DataInner.name || 'Untitled';
            storageData = cardData as CCv3Data;
          } else {
            if ('name' in cardData && typeof cardData.name === 'string') {
              name = cardData.name;
            } else if ('data' in cardData && typeof cardData.data === 'object' && cardData.data && 'name' in cardData.data) {
              name = (cardData.data as { name: string }).name;
            }
            storageData = cardData as (CCv2Data | CCv3Data);
          }
        } else {
          storageData = cardData as (CCv2Data | CCv3Data);
        }

        const card = cardRepo.create({
          data: storageData,
          meta: { name, spec, tags: [] },
        }, originalImage);

        results.push({
          filename,
          success: true,
          card,
          warnings,
        });

      } catch (err) {
        results.push({
          filename,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    fastify.log.info({ successCount, failCount, total: results.length }, 'Multiple card import completed');

    reply.code(201);
    return {
      success: true,
      total: results.length,
      successCount,
      failCount,
      results,
    };
  });

  // Export card as JSON or PNG
  fastify.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/cards/:id/export',
    async (request, reply) => {
      const card = cardRepo.get(request.params.id);
      if (!card) {
        reply.code(404);
        return { error: 'Card not found' };
      }

      const format = request.query.format || 'json';

      if (format === 'json') {
        // Debug logging to verify card.data structure
        fastify.log.info({
          cardId: request.params.id,
          spec: card.meta.spec,
          hasSpec: 'spec' in (card.data as unknown as Record<string, unknown>),
          hasSpecVersion: 'spec_version' in (card.data as unknown as Record<string, unknown>),
          dataKeys: Object.keys(card.data as unknown as Record<string, unknown>),
        }, 'Exporting card as JSON');

        reply.header('Content-Type', 'application/json; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="${card.meta.name}.json"`);

        // Return the card data directly with pretty printing
        const jsonString = JSON.stringify(card.data, null, 2);
        return reply.send(jsonString);
      } else if (format === 'charx') {
        try {
          // CHARX export - get card assets
          const assets = cardAssetRepo.listByCardWithDetails(request.params.id);

          // Validate CHARX structure
          const validation = validateCharxBuild(card.data as CCv3Data, assets);
          if (!validation.valid) {
            fastify.log.warn({ errors: validation.errors }, 'CHARX validation warnings');
            // Continue anyway, just warn
          }

          // Build CHARX ZIP
          const result = await buildCharx(card.data as CCv3Data, assets, {
            storagePath: config.storagePath,
          });

          fastify.log.info({
            cardId: request.params.id,
            assetCount: result.assetCount,
            totalSize: result.totalSize,
          }, 'CHARX export successful');

          // Return the CHARX file
          reply.header('Content-Type', 'application/zip');
          reply.header('Content-Disposition', `attachment; filename="${card.meta.name}.charx"`);
          return result.buffer;
        } catch (err) {
          fastify.log.error({ error: err }, 'Failed to create CHARX export');
          reply.code(500);
          return { error: `Failed to create CHARX export: ${err instanceof Error ? err.message : String(err)}` };
        }
      } else if (format === 'png') {
        try {
          // Try to use the original image first
          let baseImage = cardRepo.getOriginalImage(request.params.id);

          // Fall back to creating a placeholder if no original image exists
          if (!baseImage) {
            fastify.log.info({ cardId: request.params.id }, 'No original image found, creating placeholder');
            baseImage = await sharp({
              create: {
                width: 400,
                height: 600,
                channels: 4,
                background: { r: 100, g: 120, b: 150, alpha: 1 }
              }
            })
            .png()
            .toBuffer();
          } else {
            fastify.log.info({ cardId: request.params.id, imageSize: baseImage.length }, 'Using original image for export');
          }

          // Embed card data into the PNG
          const pngBuffer = await createCardPNG(baseImage, card);

          // Return the PNG with appropriate headers
          reply.header('Content-Type', 'image/png');
          reply.header('Content-Disposition', `attachment; filename="${card.meta.name}.png"`);
          return pngBuffer;
        } catch (err) {
          fastify.log.error({ error: err }, 'Failed to create PNG export');
          reply.code(500);
          return { error: `Failed to create PNG export: ${err instanceof Error ? err.message : String(err)}` };
        }
      } else {
        reply.code(400);
        return { error: 'Invalid export format' };
      }
    }
  );

  // Get card image (for preview)
  fastify.get<{ Params: { id: string } }>('/cards/:id/image', async (request, reply) => {
    const image = cardRepo.getOriginalImage(request.params.id);
    if (!image) {
      reply.code(404);
      return { error: 'No image found for this card' };
    }

    reply.header('Content-Type', 'image/png');
    reply.header('Cache-Control', 'public, max-age=3600');
    return image;
  });

  // Update card image
  fastify.post<{ Params: { id: string } }>('/cards/:id/image', async (request, reply) => {
    const card = cardRepo.get(request.params.id);
    if (!card) {
      reply.code(404);
      return { error: 'Card not found' };
    }

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

    // Convert to PNG if needed
    let pngBuffer = buffer;
    if (data.mimetype !== 'image/png') {
      pngBuffer = await sharp(buffer).png().toBuffer();
    }

    // Update the card's original image
    const success = cardRepo.updateOriginalImage(request.params.id, pngBuffer);
    if (!success) {
      reply.code(500);
      return { error: 'Failed to update image' };
    }

    reply.code(200);
    return { success: true };
  });

  // Convert between v2 and v3
  fastify.post('/convert', async (request, reply) => {
    const body = request.body as { from: string; to: string; card: unknown };

    if (!body.from || !body.to || !body.card) {
      reply.code(400);
      return { error: 'Missing required fields' };
    }

    // Validate input
    const validation = body.from === 'v3' ? validateV3(body.card) : validateV2(body.card);
    if (!validation.valid) {
      reply.code(400);
      return { error: 'Invalid input card', errors: validation.errors };
    }

    // Convert
    if (body.from === 'v2' && body.to === 'v3') {
      // v2 to v3 conversion
      const v2 = body.card as import('@card-architect/schemas').CCv2Data;
      const v3: import('@card-architect/schemas').CCv3Data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: v2.name,
          description: v2.description,
          personality: v2.personality,
          scenario: v2.scenario,
          first_mes: v2.first_mes,
          mes_example: v2.mes_example,
          creator: v2.creator || '',
          character_version: v2.character_version || '1.0',
          tags: v2.tags || [],
          group_only_greetings: [],
          creator_notes: v2.creator_notes,
          system_prompt: v2.system_prompt,
          post_history_instructions: v2.post_history_instructions,
          alternate_greetings: v2.alternate_greetings,
          character_book: v2.character_book,
          extensions: v2.extensions,
        },
      };
      return v3;
    } else if (body.from === 'v3' && body.to === 'v2') {
      // v3 to v2 conversion
      const v3 = body.card as import('@card-architect/schemas').CCv3Data;
      const v2: import('@card-architect/schemas').CCv2Data = {
        name: v3.data.name,
        description: v3.data.description,
        personality: v3.data.personality,
        scenario: v3.data.scenario,
        first_mes: v3.data.first_mes,
        mes_example: v3.data.mes_example,
        creator: v3.data.creator,
        character_version: v3.data.character_version,
        tags: v3.data.tags,
        creator_notes: v3.data.creator_notes,
        system_prompt: v3.data.system_prompt,
        post_history_instructions: v3.data.post_history_instructions,
        alternate_greetings: v3.data.alternate_greetings,
        character_book: v3.data.character_book as import('@card-architect/schemas').CCv2CharacterBook,
        extensions: v3.data.extensions,
      };
      return v2;
    } else {
      reply.code(400);
      return { error: 'Invalid conversion' };
    }
  });
}
