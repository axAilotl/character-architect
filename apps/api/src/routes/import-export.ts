import type { FastifyInstance } from 'fastify';
import { CardRepository, AssetRepository, CardAssetRepository } from '../db/repository.js';
import { restoreOriginalUrls, convertToEmbeddedUrls } from './image-archival.js';
import {
  extractFromPNG,
  validatePNGSize,
  createCardPNG,
  buildCharx,
  validateCharxBuild,
  buildVoxtaPackage,
  voxtaToStandard,
  standardToVoxta,
  isVoxtaCard,
  convertCardMacros,
  isZipBuffer,
  findZipStart,
} from '../utils/file-handlers.js';
import { validateCharxExport, applyExportFixes } from '../utils/charx-validator.js';
import { detectSpec, type CCv2Data, type CCv3Data } from '@character-foundry/schemas';
import { validateV2, validateV3 } from '../utils/validation.js';
import type { CharxExportSettings } from '../types/index.js';
import { config } from '../config.js';
import { getSettings } from '../utils/settings.js';
import { DEFAULT_CHARX_EXPORT_SETTINGS } from './charx-optimizer.js';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CardImportService } from '../services/card-import.service.js';
import { VoxtaImportService } from '../services/voxta-import.service.js';
import { normalizeCardData, normalizeLorebookEntries } from '../handlers/index.js';

/**
 * Download a file from a URL and determine its type
 */
async function downloadFromURL(url: string): Promise<{
  buffer: Buffer;
  mimetype: string;
  filename: string;
}> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (err) {
    throw new Error('Invalid URL provided');
  }

  // Only allow http and https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }

  // Download the file
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Card-Architect/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  // Get content type
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  // Determine mimetype
  let mimetype = contentType.split(';')[0].trim();

  // Get filename from URL or Content-Disposition header
  let filename = 'download';
  const contentDisposition = response.headers.get('content-disposition');
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, '');
    }
  } else {
    // Extract from URL
    const urlPath = parsedUrl.pathname;
    const urlFilename = urlPath.split('/').pop();
    if (urlFilename && urlFilename.includes('.')) {
      filename = urlFilename;
    }
  }

  // If mimetype is generic, try to determine from file extension
  if (mimetype === 'application/octet-stream' || mimetype === 'binary/octet-stream') {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'png') {
      mimetype = 'image/png';
    } else if (ext === 'json') {
      mimetype = 'application/json';
    } else if (ext === 'charx') {
      mimetype = 'application/zip';
    }
  }

  // Download buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, mimetype, filename };
}

export async function importExportRoutes(fastify: FastifyInstance) {
  const cardRepo = new CardRepository(fastify.db);
  const assetRepo = new AssetRepository(fastify.db);
  const cardAssetRepo = new CardAssetRepository(fastify.db);
  const cardImportService = new CardImportService(cardRepo, assetRepo, cardAssetRepo);
  const voxtaImportService = new VoxtaImportService(cardRepo, assetRepo, cardAssetRepo);

  // Import Voxta Package
  fastify.post('/import-voxta', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      return { error: 'No file provided' };
    }

    // Validate extension or mime
    const isVoxPkg = data.filename?.endsWith('.voxpkg') || data.filename?.endsWith('.zip');
    if (!isVoxPkg) {
      reply.code(400);
      return { error: 'File must be a .voxpkg or .zip file' };
    }

    const tempPath = join(tmpdir(), `voxta-${Date.now()}-${data.filename}`);
    await fs.writeFile(tempPath, await data.toBuffer());

    try {
      const cardIds = await voxtaImportService.importPackage(tempPath);

      // Fetch the full card objects to return
      const cards = cardIds.map(id => cardRepo.get(id)).filter(c => c !== undefined);

      fastify.log.info({
        filename: data.filename,
        importedCount: cards.length,
        cardIds
      }, 'Successfully imported Voxta package');

      return {
        success: true,
        cards,
        count: cards.length
      };

    } catch (err) {
      fastify.log.error({ error: err }, 'Failed to import Voxta package');
      reply.code(400);
      return { error: `Failed to import Voxta package: ${err instanceof Error ? err.message : String(err)}` };
    } finally {
      await fs.unlink(tempPath).catch(() => {});
    }
  });

  // Import from URL (JSON, PNG, or CHARX)
  fastify.post<{ Body: { url: string } }>('/import-url', async (request, reply) => {
    const { url } = request.body;

    if (!url || typeof url !== 'string') {
      reply.code(400);
      return { error: 'URL is required' };
    }

    let downloadedFile: { buffer: Buffer; mimetype: string; filename: string };

    try {
      downloadedFile = await downloadFromURL(url);
      fastify.log.info({
        url,
        mimetype: downloadedFile.mimetype,
        filename: downloadedFile.filename,
        size: downloadedFile.buffer.length,
      }, 'Downloaded file from URL');
    } catch (err) {
      fastify.log.error({ error: err, url }, 'Failed to download file from URL');
      reply.code(400);
      return {
        error: `Failed to download file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const { buffer, mimetype, filename } = downloadedFile;
    const warnings: string[] = [];

    // Check for CHARX format (ZIP magic bytes anywhere - supports SFX archives)
    const isZip = isZipBuffer(buffer);
    const isCharxExt = filename.endsWith('.charx');
    const isVoxPkg = filename.endsWith('.voxpkg');

    if (isVoxPkg) {
      // Handle Voxta Import - use findZipStart for SFX archive support
      const tempPath = join(tmpdir(), `voxta-${Date.now()}-${filename}`);
      await fs.writeFile(tempPath, findZipStart(buffer));

      try {
        const cardIds = await voxtaImportService.importPackage(tempPath);
        // We can only return the first card for now as the response format expects a single card
        // TODO: Update response format to support multiple cards
        if (cardIds.length > 0) {
          const card = cardRepo.get(cardIds[0]);
          if (card) {
            return {
              success: true,
              card,
              assetsImported: 0, // TODO: count assets
              warnings: cardIds.length > 1 ? [`Imported ${cardIds.length} cards, but only returning the first one.`] : [],
            };
          }
        }
        throw new Error('No cards found in Voxta package');
      } catch (err) {
        fastify.log.error({ error: err, url }, 'Failed to import Voxta package from URL');
        reply.code(400);
        return {
          error: `Failed to import Voxta package: ${err instanceof Error ? err.message : String(err)}`,
        };
      } finally {
        await fs.unlink(tempPath).catch(() => {});
      }
    }

    if (isZip || isCharxExt) {
      // Handle CHARX import
      try {
        // Write buffer to temp file (yauzl requires file path)
        // Use findZipStart to handle SFX (self-extracting) archives
        const tempPath = join(tmpdir(), `charx-${Date.now()}-${filename}`);
        await fs.writeFile(tempPath, findZipStart(buffer));

        try {
          // Import CHARX
          const result = await cardImportService.importCharxFromFile(tempPath, {
            storagePath: config.storagePath,
            preserveTimestamps: true,
            setAsOriginalImage: true,
          });

          warnings.push(...result.warnings);

          fastify.log.info({
            url,
            cardId: result.card.meta.id,
            assetsImported: result.assetsImported,
            warnings: result.warnings,
          }, 'Successfully imported CHARX from URL');

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
        fastify.log.error({ error: err, url }, 'Failed to import CHARX from URL');
        reply.code(400);
        return {
          error: `Failed to import CHARX: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    let cardData: unknown;
    let spec: 'v2' | 'v3' = 'v2';
    let originalImage: Buffer | undefined;

    // Detect format
    if (mimetype === 'application/json' || mimetype === 'text/json') {
      try {
        cardData = JSON.parse(buffer.toString('utf-8'));
        const detectedSpec = detectSpec(cardData);
        if (!detectedSpec) {
          const obj = cardData as Record<string, unknown>;
          fastify.log.error({
            url,
            keys: Object.keys(obj).slice(0, 10),
            hasSpec: 'spec' in obj,
            specValue: obj.spec,
          }, 'Failed to detect spec for JSON card from URL');
          reply.code(400);
          return {
            error: 'Invalid card format: unable to detect v2 or v3 spec. The JSON structure does not match expected character card formats.',
            details: 'Expected either: (1) v3 format with "spec":"chara_card_v3" and "data" object, (2) v2 format with "spec":"chara_card_v2" and "data" object, or (3) legacy v2 with direct "name" field.'
          };
        }
        spec = detectedSpec;
      } catch (err) {
        fastify.log.error({ error: err, url }, 'Failed to parse JSON from URL');
        reply.code(400);
        return { error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
      }
    } else if (mimetype === 'image/png') {
      // Validate PNG size
      const sizeCheck = validatePNGSize(buffer, {
        max: config.limits.maxPngSizeMB,
        warn: config.limits.warnPngSizeMB,
      });

      if (!sizeCheck.valid) {
        fastify.log.warn({ warnings: sizeCheck.warnings, url }, 'PNG size validation failed');
        reply.code(400);
        return { error: 'PNG too large', warnings: sizeCheck.warnings };
      }

      warnings.push(...sizeCheck.warnings);

      try {
        const extracted = await extractFromPNG(buffer);
        if (!extracted) {
          fastify.log.error({ url }, 'No character card data found in PNG from URL');
          reply.code(400);
          return {
            error: 'No character card data found in PNG',
            details: 'This PNG does not contain embedded character card data in its text chunks. Make sure the PNG was exported from a character card editor that embeds the card data.'
          };
        }
        cardData = extracted.data;
        spec = extracted.spec;
        originalImage = buffer; // Store the original PNG
        
        // Capture extra chunks for asset extraction
        if (extracted.extraChunks) {
            (request as any).extraChunks = extracted.extraChunks;
        }
        
        fastify.log.info({ spec, url }, 'Successfully extracted card from PNG');
      } catch (err) {
        fastify.log.error({ error: err, url }, 'Failed to extract card from PNG');
        reply.code(400);
        return { error: `Failed to extract card from PNG: ${err instanceof Error ? err.message : String(err)}` };
      }
    } else {
      fastify.log.warn({ mimetype, url }, 'Unsupported file type from URL');
      reply.code(400);
      return { error: `Unsupported file type: ${mimetype}. Only JSON, PNG, and CHARX files are supported.` };
    }

    // Normalize spec values and data BEFORE validation
    normalizeCardData(cardData, spec);

    // Validate card data
    const validation = spec === 'v3' ? validateV3(cardData) : validateV2(cardData);
    if (!validation.valid) {
      fastify.log.error({
        spec,
        url,
        errors: validation.errors,
        keys: Object.keys(cardData as Record<string, unknown>).slice(0, 10),
      }, 'Card validation failed for URL import');
      reply.code(400);
      return { error: 'Card validation failed', errors: validation.errors };
    }

    warnings.push(...validation.errors.filter((e) => e.severity !== 'error').map((e) => e.message));

    // Extract name and prepare card data for storage
    let name = 'Untitled';
    let storageData: CCv2Data | CCv3Data;

    if (cardData && typeof cardData === 'object') {
      // ... (existing logic to determine storageData and name) ...
      // Handle wrapped v2 cards (CharacterHub format)
      if (spec === 'v2' && 'data' in cardData && typeof cardData.data === 'object' && cardData.data) {
        const wrappedData = cardData.data as CCv2Data;
        name = wrappedData.name || 'Untitled';
        storageData = cardData as any;
      }
      // Handle legacy v2 cards (direct fields)
      else if (spec === 'v2' && 'name' in cardData && typeof cardData.name === 'string') {
        name = cardData.name;
        const v2Data = cardData as CCv2Data;
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
        storageData = v3Data;
      }
      else {
        // Fallback
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

    // Handle V3 Data URI Asset Extraction
    let assetsImported = 0;
    if (spec === 'v3') {
      try {
        const extraChunks = (request as any).extraChunks;
        const extractionResult = await cardImportService.extractAssetsFromDataURIs(
          storageData as CCv3Data,
          { storagePath: config.storagePath },
          extraChunks
        );
        storageData = extractionResult.data;
        assetsImported = extractionResult.assetsImported;
        if (extractionResult.warnings.length > 0) {
          warnings.push(...extractionResult.warnings);
        }
        if (assetsImported > 0) {
          fastify.log.info({ assetsImported }, 'Extracted assets from Data URIs/Chunks');
        }
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to extract assets from Data URIs');
        warnings.push(`Failed to extract embedded assets: ${err}`);
      }
    }

    // Extract tags from card data
    let tags: string[] = [];
    // ... (existing tag extraction logic) ...

    // Create card
    const card = cardRepo.create({
      data: storageData,
      meta: {
        name,
        spec,
        tags,
      },
    }, originalImage);

    // Link extracted assets to the card
    if (spec === 'v3' && assetsImported > 0) {
      try {
        await cardImportService.linkAssetsToCard(card.meta.id, (storageData as CCv3Data).data);
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to link extracted assets to card');
        warnings.push('Failed to link extracted assets to card record');
      }
    }

    // For PNG imports: Create main icon asset from the PNG container image
    // The PNG container IS the primary character image, not a fallback
    if (originalImage && originalImage.length > 0) {
      try {
        await cardImportService.createMainIconFromPng(card.meta.id, originalImage, {
          storagePath: config.storagePath,
        });
        fastify.log.info({ cardId: card.meta.id }, 'Created main icon asset from PNG container');
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to create main icon from PNG');
        warnings.push('Failed to create main icon from PNG container');
      }
    }

    fastify.log.info({
      url,
      cardId: card.meta.id,
      name: card.meta.name,
      spec: card.meta.spec,
    }, 'Successfully imported card from URL');

    reply.code(201);
    return { card, warnings, source: url };
  });

  // Import from JSON, PNG, or CHARX
  fastify.post('/import', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      return { error: 'No file provided' };
    }

    const buffer = await data.toBuffer();
    const warnings: string[] = [];
    let extraChunks: Array<{keyword: string, text: string}> | undefined;

    // Check for CHARX format (ZIP magic bytes anywhere - supports SFX archives)
    const isZip = isZipBuffer(buffer);
    const isCharxExt = data.filename?.endsWith('.charx');
    const isVoxPkg = data.filename?.endsWith('.voxpkg');

    if (isZip || isCharxExt || isVoxPkg) {
      // Handle CHARX/Voxta import
      try {
        // Write buffer to temp file (yauzl requires file path)
        // Use findZipStart to handle SFX (self-extracting) archives
        const tempPath = join(tmpdir(), `import-${Date.now()}-${data.filename || 'upload.zip'}`);
        await fs.writeFile(tempPath, findZipStart(buffer));

        try {
          // TODO: Add Voxta support here if needed, similar to import-multiple
          
          // Import CHARX
          const result = await cardImportService.importCharxFromFile(tempPath, {
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
        // Log error but fall through to try other formats (in case it's a renamed PNG/JSON)
        fastify.log.warn({ error: err, filename: data.filename }, 'Failed to import as ZIP/CHARX, attempting other formats');
      }
    }

    let cardData: unknown;
    let spec: 'v2' | 'v3' = 'v2';
    let originalImage: Buffer | undefined;

    // Check for PNG format (Magic bytes: 89 50 4E 47)
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

    // Detect format
    if (isPng) {
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
        if (extracted.extraChunks) {
            extraChunks = extracted.extraChunks;
        }
        fastify.log.info({ spec }, 'Successfully extracted card from PNG');
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to extract card from PNG');
        reply.code(400);
        return { error: `Failed to extract card from PNG: ${err instanceof Error ? err.message : String(err)}` };
      }
    } else {
      // Fallback: Try to find embedded JSON in the buffer (works for Text, JPEG w/ Exif, etc.)
      // We search for the characteristic "chara_card" or "name" fields or just the start of a JSON object
      
      try {
        // 1. Try parsing entire buffer as JSON (Text file)
        const text = buffer.toString('utf-8');
        cardData = JSON.parse(text);
      } catch (e) {
        // 2. Greedy Search: Look for JSON object start '{' followed by characteristic keys
        // This is a heuristic to find embedded JSON in binary files (like JPEG Exif or potentially corrupted files)
        // We look for "chara_card_v3" or "chara_card_v2" or just a generic valid JSON structure
        
        const text = buffer.toString('utf-8'); // Converting 5MB to string is costly but necessary for fallback
        let found = false;
        
        // Naive approach: find first '{' and try to parse. 
        // Better approach: Regex for specific keys to find offset.
        
        const patterns = [/"spec"\s*:\s*"chara_card_v3"/, /"spec"\s*:\s*"chara_card_v2"/, /"name"\s*:/];
        let matchIndex = -1;
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match.index !== undefined) {
                // Find the opening brace before this match
                const lastBrace = text.lastIndexOf('{', match.index);
                if (lastBrace !== -1) {
                    matchIndex = lastBrace;
                    break;
                }
            }
        }

        if (matchIndex !== -1) {
            try {
                // Try to parse from here. Note: JSON might be truncated or have trailing data.
                // We need to find the matching closing brace? 
                // JSON.parse will fail if there is trailing garbage unless we trim it.
                // But we don't know where it ends. 
                
                // Attempt: substring from matchIndex
                const substring = text.substring(matchIndex);
                
                // We can try to parse progressively? No, too slow.
                // If it's Tavern-in-JPEG, it's usually null-terminated or in a chunk.
                // Let's just try to find the last '}' and slice?
                const lastBrace = substring.lastIndexOf('}');
                if (lastBrace !== -1) {
                    const jsonCandidate = substring.substring(0, lastBrace + 1);
                    cardData = JSON.parse(jsonCandidate);
                    found = true;
                    fastify.log.info({ matchIndex }, 'Recovered card data using greedy JSON search');
                }
            } catch (parseErr) {
                // Ignore
            }
        }
        
        if (!found) {
             // Final error report
             const headerHex = buffer.slice(0, 8).toString('hex');
             fastify.log.warn({ 
                mimetype: data.mimetype, 
                headerHex,
                isJpeg: buffer[0] === 0xFF && buffer[1] === 0xD8,
                bufferSize: buffer.length 
             }, 'Unsupported file type and greedy search failed');
             
             reply.code(400);
             return { error: `Unsupported file type. Could not find valid card data (JSON/PNG/CHARX/VOXTA). (Header: ${headerHex})` };
        }
      }

      // If we reached here, cardData is set. 
      // We need to set 'spec' for validation
      const detectedSpec = detectSpec(cardData);
      if (!detectedSpec) {
          reply.code(400);
          return { error: 'Found JSON data but could not detect valid card spec.' };
      }
      spec = detectedSpec;
    }

    // Normalize spec values and data BEFORE validation
    normalizeCardData(cardData, spec);

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
      // ... (existing logic to determine storageData and name) ...
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

    // Handle V3 Data URI Asset Extraction
    let assetsImported = 0;
    if (spec === 'v3') {
      try {
        const extractionResult = await cardImportService.extractAssetsFromDataURIs(
          storageData as CCv3Data,
          { storagePath: config.storagePath },
          extraChunks // Pass local variable
        );
        storageData = extractionResult.data;
        assetsImported = extractionResult.assetsImported;
        if (extractionResult.warnings.length > 0) {
          warnings.push(...extractionResult.warnings);
        }
        if (assetsImported > 0) {
          fastify.log.info({ assetsImported }, 'Extracted assets from Data URIs/Chunks');
        }
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to extract assets from Data URIs');
        warnings.push(`Failed to extract embedded assets: ${err}`);
      }
    }

    // Extract tags from card data
    let tags: string[] = [];
    try {
      if (spec === 'v3' && 'data' in storageData && storageData.data && typeof storageData.data === 'object') {
        const extracted = (storageData.data as any).tags;
        tags = Array.isArray(extracted) ? extracted : [];
      } else if (spec === 'v2' && 'data' in storageData && storageData.data && typeof storageData.data === 'object') {
        const extracted = (storageData.data as any).tags;
        tags = Array.isArray(extracted) ? extracted : [];
      } else if (spec === 'v2' && 'tags' in storageData) {
        const extracted = (storageData as any).tags;
        tags = Array.isArray(extracted) ? extracted : [];
      }
    } catch (err) {
      fastify.log.warn({ error: err }, 'Failed to extract tags, using empty array');
      tags = [];
    }

    // Create card
    const card = cardRepo.create({
      data: storageData,
      meta: {
        name,
        spec,
        tags,
      },
    }, originalImage);

    // Link extracted assets to the card
    if (spec === 'v3' && assetsImported > 0) {
      try {
        await cardImportService.linkAssetsToCard(card.meta.id, (storageData as CCv3Data).data);
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to link extracted assets to card');
        warnings.push('Failed to link extracted assets to card record');
      }
    }

    // For PNG imports: Create main icon asset from the PNG container image
    // The PNG container IS the primary character image, not a fallback
    if (originalImage && originalImage.length > 0) {
      try {
        await cardImportService.createMainIconFromPng(card.meta.id, originalImage, {
          storagePath: config.storagePath,
        });
        fastify.log.info({ cardId: card.meta.id }, 'Created main icon asset from PNG container');
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to create main icon from PNG');
        warnings.push('Failed to create main icon from PNG container');
      }
    }

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
    const results: Array<{
      filename: string;
      success: boolean;
      card?: any;
      error?: string;
      warnings?: string[];
    }> = [];

    // Process files as we iterate (don't collect into array first)
    for await (const file of request.files()) {
      const filename = file.filename || 'unknown';

      try {
        const buffer = await file.toBuffer();
        const warnings: string[] = [];

        // Check for ZIP format (CharX or Voxta) - supports SFX archives
        const isZip = isZipBuffer(buffer);
        const isVoxPkg = filename.endsWith('.voxpkg');
        const isCharxExt = filename.endsWith('.charx');

        if (isZip || isVoxPkg || isCharxExt) {
          let archiveSuccess = false;
          // Use findZipStart to handle SFX (self-extracting) archives
          const tempPath = join(tmpdir(), `upload-${Date.now()}-${filename}`);
          await fs.writeFile(tempPath, findZipStart(buffer));

          try {
            if (isVoxPkg) {
               // Handle Voxta Import
               const cardIds = await voxtaImportService.importPackage(tempPath);
               for (const id of cardIds) {
                 const card = cardRepo.get(id);
                 if (card) {
                   results.push({
                     filename, 
                     success: true, 
                     card, 
                     warnings: [],
                   });
                 }
               }
               archiveSuccess = true;
            } else {
               // Handle CharX Import
               const result = await cardImportService.importCharxFromFile(tempPath, {
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
               archiveSuccess = true;
            }
          } catch (err) {
             // Fall through
          } finally {
            await fs.unlink(tempPath).catch(() => {});
          }
          
          if (archiveSuccess) {
            continue;
          }
        }

        // Regular JSON/PNG import
        let cardData: unknown;
        let spec: 'v2' | 'v3' = 'v2';
        let originalImage: Buffer | undefined;

        // Check for PNG format (Magic bytes: 89 50 4E 47)
        const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

        if (isPng) {
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
          
          if (extracted.extraChunks) {
              (request as any).extraChunks = extracted.extraChunks;
          }
        } else {
          // Try JSON
          try {
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
          } catch (err) {
            results.push({
              filename,
              success: false,
              error: `Unsupported file type: ${file.mimetype}`,
            });
            continue;
          }
        }

        // Normalize and validate
        normalizeCardData(cardData, spec);

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

        // Handle V3 Data URI Asset Extraction
        let assetsImported = 0;
        if (spec === 'v3') {
          try {
            const extraChunks = (request as any).extraChunks;
            const extractionResult = await cardImportService.extractAssetsFromDataURIs(
              storageData as CCv3Data,
              { storagePath: config.storagePath },
              extraChunks
            );
            storageData = extractionResult.data;
            assetsImported = extractionResult.assetsImported;
            if (extractionResult.warnings.length > 0) {
              warnings.push(...extractionResult.warnings);
            }
          } catch (err) {
            warnings.push(`Failed to extract embedded assets: ${err}`);
          }
        }

        // Extract tags from card data
        let tags: string[] = [];
        try {
          if (spec === 'v3' && 'data' in storageData && storageData.data && typeof storageData.data === 'object') {
            const extracted = (storageData.data as any).tags;
            tags = Array.isArray(extracted) ? extracted : [];
          } else if (spec === 'v2' && 'data' in storageData && storageData.data && typeof storageData.data === 'object') {
            const extracted = (storageData.data as any).tags;
            tags = Array.isArray(extracted) ? extracted : [];
          } else if (spec === 'v2' && 'tags' in storageData) {
            const extracted = (storageData as any).tags;
            tags = Array.isArray(extracted) ? extracted : [];
          }
        } catch (err) {
          fastify.log.warn({ error: err, filename }, 'Failed to extract tags, using empty array');
          tags = [];
        }

        const card = cardRepo.create({
          data: storageData,
          meta: { name, spec, tags },
        }, originalImage);

        // Link extracted assets to the card
        if (spec === 'v3' && assetsImported > 0) {
          try {
            await cardImportService.linkAssetsToCard(card.meta.id, (storageData as CCv3Data).data);
          } catch (err) {
            warnings.push('Failed to link extracted assets to card record');
          }
        }

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

    if (results.length === 0) {
      reply.code(400);
      return { error: 'No files provided' };
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const failures = results.filter(r => !r.success);

    // Log each failure individually for debugging
    for (const failure of failures) {
      fastify.log.error({
        filename: failure.filename,
        error: failure.error
      }, 'Card import failed');
    }

    fastify.log.info({
      successCount,
      failCount,
      total: results.length,
      failedFiles: failures.map(f => f.filename),
    }, 'Multiple card import completed');

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
          isVoxta: isVoxtaCard(card.data),
        }, 'Exporting card as JSON');

        reply.header('Content-Type', 'application/json; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="${card.meta.name}.json"`);

        // Convert Voxta macros to standard format if this is a Voxta card
        let exportData = card.data as unknown as Record<string, unknown>;
        if (isVoxtaCard(card.data)) {
          exportData = convertCardMacros(exportData, voxtaToStandard);
          fastify.log.info({ cardId: request.params.id }, 'Converted Voxta macros to standard format for JSON export');
        }

        // Restore original URLs for archived images (JSON export should use external URLs)
        const cardAssetsForRestore = cardAssetRepo.listByCardWithDetails(request.params.id);
        const archivedAssets = cardAssetsForRestore
          .filter(a => a.originalUrl)
          .map(a => ({
            assetId: a.assetId,
            ext: a.ext,
            originalUrl: a.originalUrl!,
            filename: a.asset?.filename,
            name: a.name,
          }));

        if (archivedAssets.length > 0) {
          const characterName = (exportData.name as string) ||
            ((exportData.data as Record<string, unknown>)?.name as string) || 'character';
          exportData = restoreOriginalUrls(exportData, archivedAssets, characterName);
          fastify.log.info({ cardId: request.params.id, count: archivedAssets.length }, 'Restored original URLs for JSON export');
        }

        // Return the card data directly with pretty printing
        const jsonString = JSON.stringify(exportData, null, 2);
        return reply.send(jsonString);
      } else if (format === 'charx') {
        try {
          // CHARX export - get card assets
          let assets = cardAssetRepo.listByCardWithDetails(request.params.id);

          // If no main icon asset exists, use the card's uploaded PNG as the icon
          const hasMainIcon = assets.some(a => a.type === 'icon' && a.isMain);
          if (!hasMainIcon) {
            const originalImage = cardRepo.getOriginalImage(request.params.id);
            if (originalImage) {
              // Save the original image to storage temporarily for CHARX build
              const iconFilename = `${request.params.id}-icon.png`;
              const iconPath = join(config.storagePath, request.params.id, iconFilename);

              // Ensure directory exists
              await fs.mkdir(join(config.storagePath, request.params.id), { recursive: true });
              await fs.writeFile(iconPath, originalImage);

              const now = new Date().toISOString();

              // Add as a virtual asset for CHARX build
              assets.push({
                id: `temp-icon-${request.params.id}`,
                cardId: request.params.id,
                assetId: `temp-asset-${request.params.id}`,
                type: 'icon',
                name: 'main',
                ext: 'png',
                order: 0,
                isMain: true,
                createdAt: now,
                updatedAt: now,
                asset: {
                  id: `temp-asset-${request.params.id}`,
                  filename: iconFilename,
                  mimetype: 'image/png',
                  size: originalImage.length,
                  url: `/storage/${request.params.id}/${iconFilename}`,
                  createdAt: now,
                },
              });

              fastify.log.info({ cardId: request.params.id }, 'Using card original image as main icon for CHARX export');
            }
          }

          // CHARX is always V3 - convert if needed
          let charxData: CCv3Data;
          const currentSpec = detectSpec(card.data);

          if (currentSpec === 'v2') {
            // Convert V2 to V3 format
            const v2Data = card.data as unknown as { spec?: string; spec_version?: string; data?: CCv2Data } & CCv2Data;
            const sourceData = v2Data.data || v2Data;

            charxData = {
              spec: 'chara_card_v3',
              spec_version: '3.0',
              data: {
                name: sourceData.name || '',
                description: sourceData.description || '',
                personality: sourceData.personality || '',
                scenario: sourceData.scenario || '',
                first_mes: sourceData.first_mes || '',
                mes_example: sourceData.mes_example || '',
                creator: sourceData.creator || '',
                character_version: sourceData.character_version || '',
                tags: sourceData.tags || [],
                creator_notes: sourceData.creator_notes || '',
                system_prompt: sourceData.system_prompt || '',
                post_history_instructions: sourceData.post_history_instructions || '',
                alternate_greetings: sourceData.alternate_greetings || [],
                group_only_greetings: [],
                character_book: sourceData.character_book as CCv3Data['data']['character_book'],
                extensions: sourceData.extensions,
              },
            } as CCv3Data;
            fastify.log.info({ cardId: request.params.id }, 'Converted V2 card to V3 for CHARX export');
          } else {
            charxData = card.data as CCv3Data;
          }

          // Convert Voxta macros to standard format if this is a Voxta card
          if (isVoxtaCard(card.data)) {
            charxData = convertCardMacros(charxData as unknown as Record<string, unknown>, voxtaToStandard) as unknown as CCv3Data;
            fastify.log.info({ cardId: request.params.id }, 'Converted Voxta macros to standard format for CHARX export');
          }

          // Convert local /user/images/ URLs to embeded:// URLs for archived images
          const cardAssetsForEmbed = cardAssetRepo.listByCardWithDetails(request.params.id);
          const archivedAssetsForEmbed = cardAssetsForEmbed
            .filter(a => a.originalUrl)
            .map(a => ({
              assetId: a.assetId,
              ext: a.ext,
              originalUrl: a.originalUrl!,
              filename: a.asset?.filename,
              name: a.name,
            }));

          if (archivedAssetsForEmbed.length > 0) {
            const characterName = charxData.data?.name || card.meta.name || 'character';
            const { cardData: convertedData, embeddedAssets } = convertToEmbeddedUrls(
              charxData as unknown as Record<string, unknown>,
              archivedAssetsForEmbed,
              characterName
            );
            charxData = convertedData as unknown as CCv3Data;

            // Add embedded archived images to the assets list
            for (const embedded of embeddedAssets) {
              // Find the corresponding asset record
              const cardAsset = cardAssetsForEmbed.find(a => a.assetId === embedded.assetId);
              if (cardAsset) {
                const now = new Date().toISOString();
                // Look up the full asset details
                const fullAsset = assets.find(a => a.assetId === embedded.assetId);
                if (!fullAsset) {
                  // Need to add this archived image as an asset for CHARX
                  const assetRecord = assetRepo.get(embedded.assetId);
                  if (assetRecord) {
                    assets.push({
                      id: cardAsset.id,
                      cardId: request.params.id,
                      assetId: embedded.assetId,
                      type: 'custom', // Archived images go as custom type
                      name: `embedded-${embedded.assetId}`,
                      ext: embedded.ext,
                      order: assets.length,
                      isMain: false,
                      createdAt: now,
                      updatedAt: now,
                      asset: {
                        id: assetRecord.id,
                        filename: assetRecord.filename,
                        mimetype: assetRecord.mimetype,
                        size: assetRecord.size,
                        url: assetRecord.url,
                        createdAt: assetRecord.createdAt,
                      },
                    });
                  }
                }
              }
            }

            fastify.log.info({
              cardId: request.params.id,
              count: archivedAssetsForEmbed.length,
            }, 'Converted archived image URLs to embedded format for CHARX export');
          }

          // Pre-export validation with auto-fixes
          const exportValidation = await validateCharxExport(
            charxData,
            assets,
            config.storagePath
          );

          // Log validation results
          if (exportValidation.errors.length > 0) {
            fastify.log.error({
              cardId: request.params.id,
              errors: exportValidation.errors,
            }, 'CHARX export validation failed');
            reply.code(400);
            return {
              error: 'Cannot export CHARX: validation errors',
              errors: exportValidation.errors,
              warnings: exportValidation.warnings,
            };
          }

          if (exportValidation.warnings.length > 0) {
            fastify.log.warn({
              cardId: request.params.id,
              warnings: exportValidation.warnings,
              fixes: exportValidation.fixes,
            }, 'CHARX export validation warnings (auto-fixed)');
          }

          // Apply auto-fixes (deduplicate names, normalize order)
          if (exportValidation.fixes.length > 0) {
            assets = applyExportFixes(assets);
          }

          // Validate CHARX structure (legacy check)
          const validation = validateCharxBuild(charxData, assets);
          if (!validation.valid) {
            fastify.log.warn({ errors: validation.errors }, 'CHARX build validation warnings');
            // Continue anyway, just warn
          }

          // Get optimization settings
          const settings = await getSettings();
          const charxExportSettings: CharxExportSettings = {
            ...DEFAULT_CHARX_EXPORT_SETTINGS,
            ...(settings.charxExport as CharxExportSettings),
          };

          // Build CHARX ZIP with optimization
          const result = await buildCharx(charxData, assets, {
            storagePath: config.storagePath,
            optimization: {
              enabled: !!(charxExportSettings.convertToWebp || charxExportSettings.convertMp4ToWebm),
              convertToWebp: charxExportSettings.convertToWebp,
              webpQuality: charxExportSettings.webpQuality,
              maxMegapixels: charxExportSettings.maxMegapixels,
              stripMetadata: charxExportSettings.stripMetadata,
              convertMp4ToWebm: charxExportSettings.convertMp4ToWebm,
              webmQuality: charxExportSettings.webmQuality,
              includedAssetTypes: charxExportSettings.includedAssetTypes,
            },
          });

          fastify.log.info({
            cardId: request.params.id,
            assetCount: result.assetCount,
            totalSize: result.totalSize,
            validationWarnings: exportValidation.warnings.length,
            appliedFixes: exportValidation.fixes.length,
            optimization: charxExportSettings.convertToWebp ? 'enabled' : 'disabled',
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
      } else if (format === 'voxta') {
        try {
          let assets = cardAssetRepo.listByCardWithDetails(request.params.id);

          // If no main icon asset exists, use the card's uploaded PNG as the icon (same as CHARX export)
          const hasMainIcon = assets.some(a => a.type === 'icon' && a.isMain);
          if (!hasMainIcon) {
            const originalImage = cardRepo.getOriginalImage(request.params.id);
            if (originalImage) {
              // Save the original image to storage temporarily for Voxta build
              const iconFilename = `${request.params.id}-icon.png`;
              const iconPath = join(config.storagePath, request.params.id, iconFilename);

              // Ensure directory exists
              await fs.mkdir(join(config.storagePath, request.params.id), { recursive: true });
              await fs.writeFile(iconPath, originalImage);

              const now = new Date().toISOString();

              // Add as a virtual asset for Voxta build (will become thumbnail)
              assets.push({
                id: `temp-icon-${request.params.id}`,
                cardId: request.params.id,
                assetId: `temp-asset-${request.params.id}`,
                type: 'icon',
                name: 'main',
                ext: 'png',
                order: 0,
                isMain: true,
                createdAt: now,
                updatedAt: now,
                asset: {
                  id: `temp-asset-${request.params.id}`,
                  filename: iconFilename,
                  mimetype: 'image/png',
                  size: originalImage.length,
                  url: `/storage/${request.params.id}/${iconFilename}`,
                  createdAt: now,
                },
              });

              fastify.log.info({ cardId: request.params.id }, 'Using card original image as main icon for Voxta export');
            }
          }

          // Convert standard macros to Voxta format (add spaces)
          // This applies to all cards being exported to Voxta, not just existing Voxta cards
          let voxtaData = convertCardMacros(
            card.data as unknown as Record<string, unknown>,
            standardToVoxta
          ) as unknown as import('@character-foundry/schemas').CCv3Data;
          fastify.log.info({ cardId: request.params.id }, 'Converted standard macros to Voxta format for Voxta export');

          // Convert local /user/images/ URLs to embeded:// URLs for archived images
          const voxtaCardAssets = cardAssetRepo.listByCardWithDetails(request.params.id);
          const voxtaArchivedAssets = voxtaCardAssets
            .filter(a => a.originalUrl)
            .map(a => ({
              assetId: a.assetId,
              ext: a.ext,
              originalUrl: a.originalUrl!,
              filename: a.asset?.filename,
              name: a.name,
            }));

          if (voxtaArchivedAssets.length > 0) {
            const voxtaObj = voxtaData as unknown as Record<string, unknown>;
            const characterName = voxtaObj.data
              ? (voxtaObj.data as Record<string, unknown>).name as string
              : voxtaObj.name as string
              || card.meta.name || 'character';
            const { cardData: convertedData, embeddedAssets } = convertToEmbeddedUrls(
              voxtaData as unknown as Record<string, unknown>,
              voxtaArchivedAssets,
              characterName
            );
            voxtaData = convertedData as unknown as import('@character-foundry/schemas').CCv3Data;

            // Add embedded archived images to the assets list
            for (const embedded of embeddedAssets) {
              const cardAsset = voxtaCardAssets.find(a => a.assetId === embedded.assetId);
              if (cardAsset) {
                const now = new Date().toISOString();
                const fullAsset = assets.find(a => a.assetId === embedded.assetId);
                if (!fullAsset) {
                  const assetRecord = assetRepo.get(embedded.assetId);
                  if (assetRecord) {
                    assets.push({
                      id: cardAsset.id,
                      cardId: request.params.id,
                      assetId: embedded.assetId,
                      type: 'custom',
                      name: `embedded-${embedded.assetId}`,
                      ext: embedded.ext,
                      order: assets.length,
                      isMain: false,
                      createdAt: now,
                      updatedAt: now,
                      asset: {
                        id: assetRecord.id,
                        filename: assetRecord.filename,
                        mimetype: assetRecord.mimetype,
                        size: assetRecord.size,
                        url: assetRecord.url,
                        createdAt: assetRecord.createdAt,
                      },
                    });
                  }
                }
              }
            }

            fastify.log.info({
              cardId: request.params.id,
              count: voxtaArchivedAssets.length,
            }, 'Converted archived image URLs to embedded format for Voxta export');
          }

          // Get optimization settings
          const voxtaSettings = await getSettings();
          const voxtaExportSettings: CharxExportSettings = {
            ...DEFAULT_CHARX_EXPORT_SETTINGS,
            ...(voxtaSettings.charxExport as CharxExportSettings),
          };

          const result = await buildVoxtaPackage(
            voxtaData,
            assets,
            {
              storagePath: config.storagePath,
              optimization: {
                enabled: !!(voxtaExportSettings.convertToWebp || voxtaExportSettings.convertMp4ToWebm),
                convertToWebp: voxtaExportSettings.convertToWebp,
                webpQuality: voxtaExportSettings.webpQuality,
                maxMegapixels: voxtaExportSettings.maxMegapixels,
                stripMetadata: voxtaExportSettings.stripMetadata,
                convertMp4ToWebm: voxtaExportSettings.convertMp4ToWebm,
                webmQuality: voxtaExportSettings.webmQuality,
                includedAssetTypes: voxtaExportSettings.includedAssetTypes,
              },
            }
          );

          fastify.log.info({
            cardId: request.params.id,
            assetCount: result.assetCount,
            totalSize: result.totalSize,
            optimization: voxtaExportSettings.convertToWebp ? 'enabled' : 'disabled',
          }, 'Voxta export successful');

          reply.header('Content-Type', 'application/zip');
          reply.header('Content-Disposition', `attachment; filename="${card.meta.name}.voxpkg"`);
          return result.buffer;
        } catch (err) {
          fastify.log.error({ error: err }, 'Failed to create Voxta export');
          reply.code(500);
          return { error: `Failed to create Voxta export: ${err instanceof Error ? err.message : String(err)}` };
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

          // Convert Voxta macros to standard format if this is a Voxta card
          let pngCardData = card.data as unknown as Record<string, unknown>;
          if (isVoxtaCard(card.data)) {
            pngCardData = convertCardMacros(pngCardData, voxtaToStandard);
            fastify.log.info({ cardId: request.params.id }, 'Converted Voxta macros to standard format for PNG export');
          }

          // Restore original URLs for archived images (PNG export should use external URLs)
          const pngCardAssets = cardAssetRepo.listByCardWithDetails(request.params.id);
          const pngArchivedAssets = pngCardAssets
            .filter(a => a.originalUrl)
            .map(a => ({
              assetId: a.assetId,
              ext: a.ext,
              originalUrl: a.originalUrl!,
              filename: a.asset?.filename,
              name: a.name,
            }));

          if (pngArchivedAssets.length > 0) {
            const characterName = (pngCardData.name as string) ||
              ((pngCardData.data as Record<string, unknown>)?.name as string) || 'character';
            pngCardData = restoreOriginalUrls(pngCardData, pngArchivedAssets, characterName);
            fastify.log.info({ cardId: request.params.id, count: pngArchivedAssets.length }, 'Restored original URLs for PNG export');
          }

          // Embed card data into the PNG (using modified card with converted data)
          const pngBuffer = await createCardPNG(baseImage, { ...card, data: pngCardData as unknown as typeof card.data });

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

  // Get card thumbnail (optimized for UI display)
  fastify.get<{ Params: { id: string }; Querystring: { size?: string } }>(
    '/cards/:id/thumbnail',
    async (request, reply) => {
      const image = cardRepo.getOriginalImage(request.params.id);
      if (!image) {
        reply.code(404);
        return { error: 'No image found for this card' };
      }

      // Default to 96px for retina displays (48px displayed at 2x)
      const size = parseInt(request.query.size || '96', 10);

      // Create square thumbnail with top-center crop
      const thumbnail = await sharp(image)
        .resize(size, size, {
          fit: 'cover',
          position: 'top',
        })
        .png({ quality: 90 })
        .toBuffer();

      reply.header('Content-Type', 'image/png');
      reply.header('Cache-Control', 'public, max-age=3600');
      return thumbnail;
    }
  );

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
      const v2 = body.card as import('@character-foundry/schemas').CCv2Data;
      const v3: import('@character-foundry/schemas').CCv3Data = {
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
      const v3 = body.card as import('@character-foundry/schemas').CCv3Data;
      const v2: import('@character-foundry/schemas').CCv2Data = {
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
        character_book: v3.data.character_book as import('@character-foundry/schemas').CCv2CharacterBook,
        extensions: v3.data.extensions,
      };
      return v2;
    } else {
      reply.code(400);
      return { error: 'Invalid conversion' };
    }
  });
}

// Re-export for backwards compatibility
export { normalizeCardData, normalizeLorebookEntries };
