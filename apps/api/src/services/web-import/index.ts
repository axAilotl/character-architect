/**
 * Web Import Service
 *
 * Main entry point for web import functionality.
 * This service coordinates between site handlers, asset processing,
 * and card storage.
 *
 * ## Architecture Overview
 *
 * ```
 * routes/web-import.ts (thin layer)
 *        │
 *        ▼
 * services/web-import/index.ts (this file - orchestration)
 *        │
 *        ├── handlers/*.ts (site-specific fetching)
 *        ├── utils.ts (asset processing)
 *        ├── userscript.ts (client script generation)
 *        ├── types.ts (shared types)
 *        └── constants.ts (default settings)
 * ```
 *
 * ## Adding a New Site
 *
 * 1. Create handler in handlers/mysite.ts
 * 2. Register in handlers/index.ts
 * 3. Add @match pattern in userscript.ts
 * 4. Update docs/CLAUDE.md
 */

// Re-export types for consumers
export type {
  WebImportSettings,
  WebImportAssetSettings,
  WebImportAudioSettings,
  WyvernGallerySettings,
  ChubGallerySettings,
  SiteHandler,
  FetchedCard,
  AssetToImport,
  WebImportResult,
  WebImportError,
  WebImportResponse,
  ProcessedImage,
  ProcessedAudio,
} from './types.js';

// Re-export constants
export { DEFAULT_WEB_IMPORT_SETTINGS } from './constants.js';

// Re-export handlers
export { findSiteHandler, getSiteList, SITE_HANDLERS } from './handlers/index.js';

// Re-export utils
export {
  downloadAndProcessAsset,
  downloadAndProcessImage,
  downloadAndProcessAudio,
  saveAssetToStorage,
  normalizeCardData,
} from './utils.js';

// Re-export userscript generator
export { generateUserscript } from './userscript.js';

// Import for internal use
import type {
  WebImportSettings,
  AssetToImport,
  WebImportResponse,
} from './types.js';
import { DEFAULT_WEB_IMPORT_SETTINGS } from './constants.js';
import { findSiteHandler } from './handlers/index.js';
import {
  downloadAndProcessImage,
  downloadAndProcessAudio,
  saveAssetToStorage,
  normalizeCardData,
} from './utils.js';
import { detectSpec, type CCv2Data, type CCv3Data } from '@card-architect/schemas';
import { CardImportService } from '../card-import.service.js';
import { findZipStart } from '../../utils/file-handlers.js';
import { getSettings, saveSettings } from '../../utils/settings.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';

import type {
  CardRepository,
  AssetRepository,
  CardAssetRepository,
} from '../../db/repository.js';

/**
 * Web Import Service
 *
 * Handles importing character cards from external sites.
 */
export class WebImportService {
  private cardRepo: CardRepository;
  private assetRepo: AssetRepository;
  private cardAssetRepo: CardAssetRepository;
  private cardImportService: CardImportService;
  private storagePath: string;

  constructor(
    cardRepo: CardRepository,
    assetRepo: AssetRepository,
    cardAssetRepo: CardAssetRepository,
    storagePath: string
  ) {
    this.cardRepo = cardRepo;
    this.assetRepo = assetRepo;
    this.cardAssetRepo = cardAssetRepo;
    this.cardImportService = new CardImportService(cardRepo, assetRepo, cardAssetRepo);
    this.storagePath = storagePath;
  }

  /**
   * Get current web import settings
   */
  async getSettings(): Promise<WebImportSettings> {
    const settings = await getSettings();
    return (settings as any).webImport || DEFAULT_WEB_IMPORT_SETTINGS;
  }

  /**
   * Update web import settings
   */
  async updateSettings(updates: Partial<WebImportSettings>): Promise<WebImportSettings> {
    const settings = await getSettings();
    const current: WebImportSettings = (settings as any).webImport || DEFAULT_WEB_IMPORT_SETTINGS;

    const updated: WebImportSettings = {
      icons: { ...current.icons, ...updates.icons },
      emotions: { ...current.emotions, ...updates.emotions },
      skipDefaultEmoji: updates.skipDefaultEmoji ?? current.skipDefaultEmoji,
      audio: { ...current.audio, ...updates.audio },
      wyvernGallery: { ...current.wyvernGallery, ...updates.wyvernGallery },
      chubGallery: { ...current.chubGallery, ...updates.chubGallery },
      relatedLorebooks: { ...current.relatedLorebooks, ...updates.relatedLorebooks },
    };

    (settings as any).webImport = updated;
    await saveSettings(settings);

    return updated;
  }

  /**
   * Import a card from a supported site URL
   *
   * @param url - URL of the character page
   * @param pngData - Optional base64 PNG data from client (for Wyvern)
   * @param clientData - Optional additional data from client
   * @param logger - Optional logger for structured logging
   */
  async importCard(
    url: string,
    pngData?: string,
    clientData?: unknown,
    logger?: { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void }
  ): Promise<WebImportResponse> {
    const warnings: string[] = [];

    // Find matching handler
    const result = findSiteHandler(url);
    if (!result) {
      return { success: false, error: 'Unsupported site or invalid URL' };
    }

    const { handler, match } = result;
    logger?.info({ url, site: handler.id }, 'Web import started');

    try {
      // Fetch card data from site
      const fetched = await handler.fetchCard(url, match, pngData, clientData);
      warnings.push(...fetched.warnings);

      // Get settings
      const webImportSettings = await this.getSettings();

      // Handle CharX format (Risu Realm)
      if (fetched.charxBuffer) {
        const tempPath = join(tmpdir(), `charx-${Date.now()}.charx`);
        await fs.writeFile(tempPath, findZipStart(fetched.charxBuffer));

        try {
          const result = await this.cardImportService.importCharxFromFile(tempPath, {
            storagePath: this.storagePath,
            preserveTimestamps: true,
            setAsOriginalImage: true,
          });

          warnings.push(...result.warnings);

          logger?.info(
            { cardId: result.card.meta.id, site: handler.id, assetsImported: result.assetsImported },
            'Web import successful (CHARX)'
          );

          return {
            success: true,
            cardId: result.card.meta.id,
            name: result.card.meta.name,
            card: result.card,
            assetsImported: result.assetsImported,
            warnings,
            source: handler.id,
          };
        } finally {
          await fs.unlink(tempPath).catch(() => {});
        }
      }

      // Handle JSON/PNG format
      if (!fetched.cardData) {
        throw new Error('No card data returned from site handler');
      }

      let cardData = fetched.cardData;
      let spec = fetched.spec || detectSpec(cardData) || 'v2';

      // Normalize card structure
      normalizeCardData(cardData, spec);

      // Handle related lorebooks if enabled and present
      // Track lorebooks to save as assets (processed after card creation)
      let lorebooksToSaveAsAssets: typeof fetched.relatedLorebooks = [];

      if (fetched.relatedLorebooks && fetched.relatedLorebooks.length > 0) {
        const relatedSettings = webImportSettings.relatedLorebooks;
        if (relatedSettings?.enabled) {
          const successfulLorebooks = fetched.relatedLorebooks.filter(lb => lb.fetched && lb.entries);

          if (successfulLorebooks.length > 0) {
            logger?.info(
              { count: successfulLorebooks.length, names: successfulLorebooks.map(lb => lb.name) },
              'Processing related lorebooks'
            );

            // Merge entries into card's character_book if enabled
            if (relatedSettings.mergeIntoCard) {
              const obj = cardData as Record<string, any>;
              const dataObj = obj.data || obj;

              // Ensure character_book exists
              if (!dataObj.character_book) {
                dataObj.character_book = {
                  name: '',
                  entries: [],
                  extensions: {},
                };
              }

              const existingEntries = dataObj.character_book.entries || [];
              let maxId = existingEntries.reduce((max: number, e: any) => Math.max(max, e.id || 0), 0);

              for (const lb of successfulLorebooks) {
                if (lb.entries) {
                  for (const entry of lb.entries) {
                    // Assign new unique IDs to avoid conflicts
                    maxId++;
                    const entryExtensions = (entry.extensions && typeof entry.extensions === 'object')
                      ? entry.extensions as Record<string, unknown>
                      : {};
                    const newEntry = {
                      ...entry,
                      id: maxId,
                      // Add source tracking in extensions
                      extensions: {
                        ...entryExtensions,
                        source_lorebook: {
                          id: lb.id,
                          name: lb.name,
                          path: lb.path,
                        },
                      },
                    };
                    existingEntries.push(newEntry);
                  }
                  warnings.push(`Merged ${lb.entries.length} entries from lorebook: ${lb.name || lb.id}`);
                }
              }

              dataObj.character_book.entries = existingEntries;
              logger?.info(
                { totalEntries: existingEntries.length },
                'Merged related lorebook entries'
              );
            }

            // Track lorebooks to save as assets (will be saved after card creation)
            if (relatedSettings.saveAsAsset) {
              lorebooksToSaveAsAssets = successfulLorebooks;
            }
          }
        } else {
          // Just log that we found related lorebooks but didn't process them
          const lorebookNames = fetched.relatedLorebooks.map(lb => lb.name || lb.id).join(', ');
          warnings.push(`Found related lorebooks (disabled): ${lorebookNames}`);
        }
      }

      // Extract name
      let name = 'Untitled';
      const obj = cardData as Record<string, any>;
      logger?.info(
        { spec, hasData: !!obj.data, dataName: obj.data?.name, topName: obj.name },
        'Extracting name'
      );

      if (spec === 'v3' && obj.data?.name) {
        name = obj.data.name;
      } else if (obj.data?.name) {
        name = obj.data.name;
      } else if (obj.name) {
        name = obj.name;
      }
      logger?.info({ extractedName: name }, 'Name extracted');

      // Prepare storage data
      let storageData: CCv2Data | CCv3Data;
      if (spec === 'v2' && 'data' in obj) {
        storageData = obj as any;
      } else if (spec === 'v2') {
        storageData = {
          spec: 'chara_card_v2',
          spec_version: '2.0',
          data: obj,
        } as any;
      } else {
        storageData = obj as CCv3Data;
      }

      // Extract tags
      let tags: string[] = ['web-import', handler.id];
      if (obj.data?.tags && Array.isArray(obj.data.tags)) {
        tags = [...tags, ...obj.data.tags];
      } else if (obj.tags && Array.isArray(obj.tags)) {
        tags = [...tags, ...obj.tags];
      }

      // Create card
      const card = this.cardRepo.create(
        { data: storageData, meta: { name, spec, tags } },
        fetched.pngBuffer
      );

      // Import assets
      let assetsImported = await this.importAssets(
        card.meta.id,
        fetched.assets,
        webImportSettings,
        warnings
      );

      // Save related lorebooks as JSON assets if enabled
      if (lorebooksToSaveAsAssets && lorebooksToSaveAsAssets.length > 0) {
        for (const lb of lorebooksToSaveAsAssets) {
          try {
            // Sanitize name for filename
            const safeName = (lb.name || `lorebook_${lb.id}`)
              .replace(/[^a-zA-Z0-9_-]/g, '_')
              .substring(0, 50);

            // Create lorebook JSON with full data
            const lorebookJson = JSON.stringify(lb.data || { entries: lb.entries }, null, 2);
            const lorebookBuffer = Buffer.from(lorebookJson, 'utf-8');

            // Save to storage
            const assetUrl = await saveAssetToStorage(
              card.meta.id,
              lorebookBuffer,
              'json',
              this.storagePath,
              'lorebooks'
            );

            // Create asset record
            const assetRecord = this.assetRepo.create({
              filename: `${safeName}.json`,
              mimetype: 'application/json',
              size: lorebookBuffer.length,
              width: undefined,
              height: undefined,
              url: assetUrl,
            });

            // Link to card
            const existing = this.cardAssetRepo.listByCard(card.meta.id);
            this.cardAssetRepo.create({
              cardId: card.meta.id,
              assetId: assetRecord.id,
              type: 'lorebook',
              name: lb.name || `Lorebook ${lb.id}`,
              ext: 'json',
              order: existing.length,
              isMain: false,
              tags: ['related-lorebook', `source:${lb.id}`],
            });

            assetsImported++;
            warnings.push(`Saved lorebook as asset: ${lb.name || lb.id}`);
            logger?.info({ lorebookId: lb.id, name: lb.name }, 'Saved related lorebook as asset');
          } catch (err) {
            warnings.push(`Failed to save lorebook ${lb.name || lb.id} as asset: ${err}`);
          }
        }
      }

      logger?.info(
        { cardId: card.meta.id, site: handler.id, assetsImported, warnings: warnings.length },
        'Web import successful'
      );

      return {
        success: true,
        cardId: card.meta.id,
        name: card.meta.name,
        card,
        assetsImported,
        warnings,
        source: handler.id,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      logger?.error({ error: errorMessage, stack: errorStack, url, site: handler.id }, 'Web import failed');

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Import assets for a card
   */
  private async importAssets(
    cardId: string,
    assets: AssetToImport[],
    settings: WebImportSettings,
    warnings: string[]
  ): Promise<number> {
    let assetsImported = 0;

    for (const asset of assets) {
      try {
        // Handle sound assets
        if (asset.type === 'sound') {
          if (!settings.audio.enabled) continue;

          const modelType = asset.name.split('_').pop() || 'example';
          if (!settings.audio.downloadAllModels && modelType !== 'example' && modelType !== 'sample') {
            continue;
          }

          const audioResult = await downloadAndProcessAudio(
            asset.url,
            asset.voiceId || 'unknown',
            asset.name.replace(/_[^_]+$/, ''),
            modelType,
            this.storagePath
          );

          if (!audioResult) {
            warnings.push(`Skipped audio "${asset.name}": download failed`);
            continue;
          }

          const assetUrl = await saveAssetToStorage(
            cardId,
            audioResult.buffer,
            audioResult.ext,
            this.storagePath,
            'audio'
          );

          const assetRecord = this.assetRepo.create({
            filename: audioResult.filename,
            mimetype: audioResult.mimetype,
            size: audioResult.buffer.length,
            width: undefined,
            height: undefined,
            url: assetUrl,
          });

          const existing = this.cardAssetRepo.listByCard(cardId);
          this.cardAssetRepo.create({
            cardId,
            assetId: assetRecord.id,
            type: asset.type,
            name: asset.name,
            ext: audioResult.ext,
            order: existing.length,
            isMain: false,
            tags: asset.isDefaultVoice ? ['default-voice'] : [],
          });

          assetsImported++;
          continue;
        }

        // Handle Chub gallery images
        if (asset.isChubGallery) {
          if (!settings.chubGallery?.enabled) continue;
        }
        // Handle Wyvern gallery images
        else if ((asset.type === 'background' || asset.type === 'custom') && asset.base64Data) {
          if (!settings.wyvernGallery.enabled) continue;
          if (asset.type === 'background' && !settings.wyvernGallery.includeBackground) continue;
          if (asset.type === 'custom' && !settings.wyvernGallery.includeOther) continue;
        }

        // Handle Wyvern avatar icons
        if (asset.type === 'icon' && asset.base64Data && !settings.wyvernGallery.includeAvatar) {
          continue;
        }

        // Process image
        const processed = await downloadAndProcessImage(asset, settings);
        if (!processed) {
          warnings.push(`Skipped ${asset.type} "${asset.name}": placeholder detected`);
          continue;
        }

        // Determine subdirectory
        const subdirMap: Record<string, string | undefined> = {
          icon: undefined,
          emotion: 'emotions',
          background: 'backgrounds',
          custom: 'custom',
        };
        const subdir = subdirMap[asset.type];

        // Save to storage
        const assetUrl = await saveAssetToStorage(
          cardId,
          processed.buffer,
          processed.ext,
          this.storagePath,
          subdir
        );

        // Get dimensions
        const metadata = await sharp(processed.buffer).metadata();

        // Create asset record
        const assetRecord = this.assetRepo.create({
          filename: `${asset.name}.${processed.ext}`,
          mimetype: processed.mimetype,
          size: processed.buffer.length,
          width: metadata.width,
          height: metadata.height,
          url: assetUrl,
        });

        // Link to card
        const existing = this.cardAssetRepo.listByCard(cardId);
        this.cardAssetRepo.create({
          cardId,
          assetId: assetRecord.id,
          type: asset.type,
          name: asset.name,
          ext: processed.ext,
          order: existing.length,
          isMain: asset.isMain || false,
          tags: [],
        });

        assetsImported++;
      } catch (err) {
        warnings.push(`Failed to import ${asset.type} "${asset.name}": ${err}`);
      }
    }

    return assetsImported;
  }
}
