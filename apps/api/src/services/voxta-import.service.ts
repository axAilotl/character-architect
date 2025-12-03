import {
  CardRepository,
  CardAssetRepository,
  AssetRepository
} from '../db/repository.js';
import {
  extractVoxtaPackage,
  getMimeTypeFromExt,
  type ExtractedVoxtaCharacter,
  type ExtractedVoxtaAsset,
  type VoxtaData,
} from '../utils/file-handlers.js';
import type {
  CCv3Data,
  VoxtaExtensionData,
  VoxtaCharacter,
  AssetTag,
  AssetType
} from '@card-architect/schemas';
import { nanoid } from 'nanoid';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { config } from '../config.js';
import { detectAnimatedAsset } from '@card-architect/schemas';
import sharp from 'sharp';

export class VoxtaImportService {
  constructor(
    private cardRepo: CardRepository,
    private assetRepo: AssetRepository,
    private cardAssetRepo: CardAssetRepository
  ) {}

  /**
   * Import a Voxta package from a file path
   */
  async importPackage(filePath: string): Promise<string[]> {
    // 1. Extract package
    const data = await extractVoxtaPackage(filePath);
    const createdCardIds: string[] = [];

    // 2. Process each character
    for (const char of data.characters) {
      const cardId = await this.importCharacter(char, data);
      createdCardIds.push(cardId);
    }

    return createdCardIds;
  }

  /**
   * Import a single character from the package
   */
  private async importCharacter(
    char: ExtractedVoxtaCharacter, 
    fullPackage: VoxtaData
  ): Promise<string> {
    // Map Voxta -> CCv3
    const ccv3Data = this.mapToCCv3(char.data, fullPackage);
    
    // Add 'voxta' tag
    const tags = new Set(ccv3Data.data.tags || []);
    tags.add('voxta');

    // Create Card in DB
    const card = this.cardRepo.create({
      meta: {
        name: ccv3Data.data.name || char.data.Name || 'Untitled Voxta Import',
        spec: 'v3',
        tags: Array.from(tags),
        creator: ccv3Data.data.creator,
        characterVersion: ccv3Data.data.character_version
      },
      data: ccv3Data as any, // Type assertion needed due to schema strictness
    });

    // Import Thumbnail if present - this becomes the main icon
    if (char.thumbnail) {
      // Save as main card image (for PNG export)
      this.cardRepo.updateImage(card.meta.id, char.thumbnail);

      // Also save as a card asset with isMain: true (for CHARX export)
      await this.importThumbnailAsMainIcon(card.meta.id, char.thumbnail);
    }

    // Import Assets
    if (char.assets && char.assets.length > 0) {
      const assetDescriptors = await this.importAssets(card.meta.id, char.assets, !!char.thumbnail);

      // Update card with assets list so frontend sees them in the JSON blob
      ccv3Data.data.assets = assetDescriptors;
      this.cardRepo.update(card.meta.id, { data: ccv3Data });
    }

    return card.meta.id;
  }

  /**
   * Map Voxta JSON to CCv3 Data Structure
   */
  private mapToCCv3(voxtaChar: VoxtaCharacter, fullPackage: VoxtaData): CCv3Data {
    // 1. Construct Extension Data
    const extensionData: VoxtaExtensionData = {
      id: voxtaChar.Id,
      version: voxtaChar.Version,
      packageId: voxtaChar.PackageId,
      textToSpeech: voxtaChar.TextToSpeech,
      appearance: voxtaChar.Description,
      chatSettings: {
        chatStyle: voxtaChar.ChatStyle,
        enableThinkingSpeech: voxtaChar.EnableThinkingSpeech,
        notifyUserAwayReturn: voxtaChar.NotifyUserAwayReturn,
        timeAware: voxtaChar.TimeAware,
        useMemory: voxtaChar.UseMemory,
        maxTokens: voxtaChar.MaxTokens,
        maxSentences: voxtaChar.MaxSentences,
      },
      scripts: voxtaChar.Scripts,
      original: {
        Creator: voxtaChar.Creator,
        CreatorNotes: voxtaChar.CreatorNotes,
        DateCreated: voxtaChar.DateCreated,
        DateModified: voxtaChar.DateModified
      }
    };

    // 2. Embed Lorebooks
    // CCv3 uses `data.character_book`. We need to find referenced books and embed them.
    let characterBook: any = undefined;
    if (voxtaChar.MemoryBooks && voxtaChar.MemoryBooks.length > 0) {
      const entries: any[] = [];
      for (const bookId of voxtaChar.MemoryBooks) {
        const book = fullPackage.books.find(b => b.id === bookId);
        if (book && book.data.Items) {
          // Convert Voxta Items -> V3 Entries
          const bookEntries = book.data.Items.map((item: any) => ({
            keys: item.Keywords,
            content: item.Text,
            enabled: !item.Deleted,
            insertion_order: item.Weight || 100,
            name: item.Id, // Use ID as name for reference
            priority: 10, // Default
          }));
          entries.push(...bookEntries);
        }
      }
      
      if (entries.length > 0) {
        characterBook = {
          name: "Voxta Memory",
          entries: entries
        };
      }
    }

    // 3. Construct CCv3
    return {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: voxtaChar.Name,
        description: voxtaChar.Profile || '', // Profile -> Description
        personality: voxtaChar.Personality || '',
        scenario: voxtaChar.Scenario || '',
        first_mes: voxtaChar.FirstMessage || '',
        mes_example: voxtaChar.MessageExamples || '',
        creator: voxtaChar.Creator || '',
        creator_notes: voxtaChar.CreatorNotes || '',
        tags: voxtaChar.Tags || [],
        character_version: voxtaChar.Version || '1.0.0',
        system_prompt: '', // Voxta doesn't map directly to this usually
        post_history_instructions: '',
        alternate_greetings: [],
        group_only_greetings: [],
        character_book: characterBook,
        extensions: {
          voxta: extensionData,
          // Preserve other extensions if needed
        }
      }
    };
  }

  /**
   * Import the Voxta thumbnail as the main icon asset
   */
  private async importThumbnailAsMainIcon(cardId: string, thumbnail: Buffer): Promise<void> {
    // Detect format from buffer
    let ext = 'png';
    let mimetype = 'image/png';

    // Check magic bytes for common formats
    if (thumbnail[0] === 0xFF && thumbnail[1] === 0xD8) {
      ext = 'jpg';
      mimetype = 'image/jpeg';
    } else if (thumbnail[0] === 0x52 && thumbnail[1] === 0x49 && thumbnail[2] === 0x46 && thumbnail[3] === 0x46) {
      ext = 'webp';
      mimetype = 'image/webp';
    }

    // Save file to storage
    const fileId = nanoid();
    const storageFilename = `${fileId}.${ext}`;
    const storagePath = join(config.storagePath, storageFilename);

    await writeFile(storagePath, thumbnail);

    // Get dimensions
    let width = 0;
    let height = 0;
    try {
      const meta = await sharp(thumbnail).metadata();
      width = meta.width || 0;
      height = meta.height || 0;
    } catch (e) {
      console.warn('[Voxta Import] Failed to get thumbnail dimensions:', e);
    }

    // Create Asset Record
    const assetRecord = this.assetRepo.create({
      filename: storageFilename,
      mimetype,
      size: thumbnail.length,
      url: `/storage/${storageFilename}`,
      width,
      height
    });

    // Create Card Asset Link - this is the MAIN icon
    this.cardAssetRepo.create({
      cardId,
      assetId: assetRecord.id,
      type: 'icon',
      name: 'main', // Named 'main' for CHARX compatibility
      ext,
      order: 0,
      isMain: true, // This is THE main icon
      tags: ['portrait-override']
    });

    console.log(`[Voxta Import] Imported thumbnail as main icon for card ${cardId}`);
  }

  /**
   * Import Assets for a card
   * @param hasThumbnail - If true, start order at 1 (thumbnail is order 0)
   */
  private async importAssets(cardId: string, assets: ExtractedVoxtaAsset[], hasThumbnail: boolean = false): Promise<any[]> {
    // Start at 1 if thumbnail already imported as order 0
    let orderCounter = hasThumbnail ? 1 : 0;
    const descriptors: any[] = [];

    for (const asset of assets) {
      const tags: AssetTag[] = [];
      let assetType: AssetType = 'custom';

      // Parse path for tags
      // Path format: Characters/{uuid}/Assets/Avatars/Default/{Emotion}_{State}_{Variant}.webp
      // Path format: Characters/{uuid}/Assets/VoiceSamples/{Filename}.wav

      const parts = asset.path.split('/');
      const filename = parts[parts.length - 1];
      const ext = filename.split('.').pop()?.toLowerCase() || 'bin';

      // Determine Type & Tags
      if (asset.path.includes('/Avatars/')) {
        assetType = 'icon';
        
        // Try to parse {Emotion}_{State}_{Variant}
        // Remove extension
        const nameNoExt = filename.substring(0, filename.lastIndexOf('.'));
        const nameParts = nameNoExt.split('_');
        
        if (nameParts.length >= 3) {
          const [emotion, state, variant] = nameParts;
          tags.push(`emotion:${emotion.toLowerCase()}` as AssetTag);
          tags.push(`state:${state.toLowerCase()}` as AssetTag);
          tags.push(`variant:${variant}` as AssetTag);
        } else if (nameParts.length === 2) {
             const [emotion, state] = nameParts;
             tags.push(`emotion:${emotion.toLowerCase()}` as AssetTag);
             tags.push(`state:${state.toLowerCase()}` as AssetTag);
        } else if (nameParts.length === 1) {
             tags.push(`emotion:${nameParts[0].toLowerCase()}` as AssetTag);
        }
        
      } else if (asset.path.includes('/VoiceSamples/')) {
        assetType = 'sound';
        tags.push('voice' as AssetTag);
      } else {
        assetType = 'custom';
      }

      // Determine Animation Status (for WebP/GIF)
      const mimetype = getMimeTypeFromExt(ext);
      if (!tags.includes('animated')) {
         if (detectAnimatedAsset(asset.buffer, mimetype)) {
             tags.push('animated');
         }
      }

      // Save file to storage
      const fileId = nanoid();
      const storageFilename = `${fileId}.${ext}`;
      const storagePath = join(config.storagePath, storageFilename);
      
      await writeFile(storagePath, asset.buffer);

      // Calculate dimensions if image
      let width = 0;
      let height = 0;
      if (mimetype.startsWith('image/')) {
        try {
          const meta = await sharp(asset.buffer).metadata();
          width = meta.width || 0;
          height = meta.height || 0;
        } catch (e) {
          console.warn(`[Voxta Import] Failed to get dimensions for ${filename}:`, e);
        }
      }

      // Create Asset Record
      const assetRecord = this.assetRepo.create({
        filename: storageFilename,
        mimetype,
        size: asset.buffer.length,
        url: `/storage/${storageFilename}`,
        width,
        height
      });

      // Create Card Asset Link
      this.cardAssetRepo.create({
        cardId,
        assetId: assetRecord.id,
        type: assetType,
        name: filename, // Keep original filename as name
        ext,
        order: orderCounter++,
        isMain: false, // Voxta doesn't strictly define a "main" in the file list usually
        tags: tags as string[]
      });

      descriptors.push({
        type: assetType,
        uri: assetRecord.url,
        name: filename,
        ext: ext
      });
    }

    return descriptors;
  }
}
