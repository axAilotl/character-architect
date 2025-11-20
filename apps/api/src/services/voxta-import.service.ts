import { 
  CardRepository, 
  CardAssetRepository, 
  AssetRepository 
} from '../db/repository.js';
import { 
  extractVoxtaPackage, 
  type ExtractedVoxtaCharacter, 
  type ExtractedVoxtaAsset,
  type VoxtaData 
} from '../utils/voxta-handler.js';
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

    // Import Thumbnail if present
    if (char.thumbnail) {
      // We can save this as the main image or just store it
      // For now, let's update the card with this image blob
      this.cardRepo.updateImage(card.meta.id, char.thumbnail);
    }

    // Import Assets
    if (char.assets && char.assets.length > 0) {
      await this.importAssets(card.meta.id, char.assets);
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
          const bookEntries = book.data.Items.map((item, idx) => ({
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
   * Import Assets for a card
   */
  private async importAssets(cardId: string, assets: ExtractedVoxtaAsset[]) {
    let orderCounter = 0;

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
        tags.push('voice');
      } else {
        assetType = 'custom';
      }

      // Determine Animation Status (for WebP/GIF)
      const mimetype = this.getMimeType(ext);
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

      // Create Asset Record
      const assetRecord = this.assetRepo.create({
        filename: storageFilename,
        mimetype,
        size: asset.buffer.length,
        url: `/storage/${storageFilename}`,
        width: 0, // Would need sharp to get dimensions, skipping for perf
        height: 0
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
    }
  }

  private getMimeType(ext: string): string {
    switch (ext) {
      case 'png': return 'image/png';
      case 'jpg': case 'jpeg': return 'image/jpeg';
      case 'webp': return 'image/webp';
      case 'gif': return 'image/gif';
      case 'wav': return 'audio/wav';
      case 'mp3': return 'audio/mpeg';
      default: return 'application/octet-stream';
    }
  }
}
