import {
  CardRepository,
  CardAssetRepository,
  AssetRepository
} from '../db/repository.js';
import {
  extractVoxtaPackage,
  getMimeTypeFromExt,
  voxtaToCCv3,
  type ExtractedVoxtaCharacter,
  type ExtractedVoxtaAsset,
  type VoxtaData,
} from '../utils/file-handlers.js';
import type { VoxtaScenario } from '@character-foundry/character-foundry/voxta';
import type { AssetTag, AssetType } from '../types/index.js';
import { detectAnimatedAsset } from '../utils/asset-utils.js';
import { nanoid } from 'nanoid';
import { join } from 'path';
import { writeFile, readFile } from 'fs/promises';
import { config } from '../config.js';
import sharp from 'sharp';

/**
 * Collection card data structure
 */
interface CollectionMember {
  cardId: string;
  voxtaCharacterId?: string;
  name: string;
  order: number;
  addedAt: string;
  scenarioIds?: string[];
}

interface CollectionScenario {
  voxtaScenarioId: string;
  name: string;
  description?: string;
  version?: string;
  creator?: string;
  characterIds: string[];
  order: number;
  explicitContent?: boolean;
  hasThumbnail?: boolean;
}

interface CollectionData {
  name: string;
  description?: string;
  version?: string;
  creator?: string;
  voxtaPackageId?: string;
  members: CollectionMember[];
  scenarios?: CollectionScenario[];
  sharedBookIds?: string[];
  explicitContent?: boolean;
  dateCreated?: string;
  dateModified?: string;
}

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

    // Determine if this should be a collection (multi-character, has package metadata, or has scenarios)
    const isCollection = data.characters.length > 1 || data.package !== undefined || data.scenarios.length > 0;

    const now = new Date().toISOString();
    const members: CollectionMember[] = [];

    // Build scenario lookup for character-scenario linking
    const characterScenarioMap = this.buildCharacterScenarioMap(data);

    // 2. Process each character first (packageId will be set after collection is created)
    for (let i = 0; i < data.characters.length; i++) {
      const char = data.characters[i];
      const cardId = await this.importCharacter(char, data);
      createdCardIds.push(cardId);

      // Build member info for collection
      if (isCollection) {
        // Get scenario IDs for this character
        const scenarioIds = characterScenarioMap.get(char.data.Id) || [];

        members.push({
          cardId,
          voxtaCharacterId: char.data.Id,
          name: char.data.Name || 'Unknown',
          order: i,
          addedAt: now,
          scenarioIds: scenarioIds.length > 0 ? scenarioIds : undefined,
        });
      }
    }

    // 3. Process scenarios
    const scenarios: CollectionScenario[] = [];
    for (let i = 0; i < data.scenarios.length; i++) {
      const scenario = data.scenarios[i];
      const scenarioInfo = this.extractScenarioInfo(scenario.data, i);
      scenarios.push(scenarioInfo);

      console.log(`[Voxta Import] Processed scenario: "${scenarioInfo.name}" with ${scenarioInfo.characterIds.length} characters`);
    }

    // 4. Create collection card AFTER characters, using the actual card IDs
    if (isCollection && members.length > 0) {
      const collectionCardId = await this.createCollectionCard(data, members, scenarios, filePath);

      // Update each character card with the collection's packageId
      for (const member of members) {
        this.cardRepo.update(member.cardId, {
          meta: { packageId: collectionCardId } as any,
        });
      }

      // Return collection card first, then all character cards
      return [collectionCardId, ...createdCardIds];
    }

    return createdCardIds;
  }

  /**
   * Get the package thumbnail from ThumbnailResource
   * Kind values: 1 = Character, 2 = Book, 3 = Scenario
   */
  private getPackageThumbnail(data: VoxtaData): Buffer | undefined {
    const thumbnailResource = data.package?.ThumbnailResource;
    if (!thumbnailResource) {
      // No explicit thumbnail, fall back to first character's thumbnail
      return data.characters[0]?.thumbnail;
    }

    const { Kind, Id } = thumbnailResource;

    // Kind 3 = Scenario
    if (Kind === 3) {
      const scenario = data.scenarios.find(s => s.id === Id);
      if (scenario?.thumbnail) {
        console.log(`[Voxta Import] Using scenario thumbnail for package (scenario: ${Id})`);
        return scenario.thumbnail;
      }
    }

    // Kind 1 = Character
    if (Kind === 1) {
      const character = data.characters.find(c => c.id === Id);
      if (character?.thumbnail) {
        console.log(`[Voxta Import] Using character thumbnail for package (character: ${Id})`);
        return character.thumbnail;
      }
    }

    // Fallback to first character's thumbnail
    console.log('[Voxta Import] ThumbnailResource not found, using first character thumbnail');
    return data.characters[0]?.thumbnail;
  }

  /**
   * Build a map of character ID -> scenario IDs
   * Uses both scenario.Roles and character.DefaultScenarios for bidirectional linking
   */
  private buildCharacterScenarioMap(data: VoxtaData): Map<string, string[]> {
    const map = new Map<string, string[]>();

    // From scenarios: check Roles for character references
    for (const scenario of data.scenarios) {
      const scenarioId = scenario.data.Id;
      const roles = scenario.data.Roles || [];

      for (const role of roles) {
        // VoxtaRole has CharacterId field
        const characterId = (role as any).CharacterId;
        if (characterId) {
          const existing = map.get(characterId) || [];
          if (!existing.includes(scenarioId)) {
            existing.push(scenarioId);
            map.set(characterId, existing);
          }
        }
      }
    }

    // From characters: check DefaultScenarios
    for (const char of data.characters) {
      const defaultScenarios = char.data.DefaultScenarios || [];
      for (const scenarioId of defaultScenarios) {
        const existing = map.get(char.data.Id) || [];
        if (!existing.includes(scenarioId)) {
          existing.push(scenarioId);
          map.set(char.data.Id, existing);
        }
      }
    }

    return map;
  }

  /**
   * Extract scenario info for storage in collection
   */
  private extractScenarioInfo(scenario: VoxtaScenario, order: number): CollectionScenario {
    // Get character IDs from Roles
    const characterIds: string[] = [];
    for (const role of scenario.Roles || []) {
      const characterId = (role as any).CharacterId;
      if (characterId && !characterIds.includes(characterId)) {
        characterIds.push(characterId);
      }
    }

    return {
      voxtaScenarioId: scenario.Id,
      name: scenario.Name,
      description: scenario.Description,
      version: scenario.Version,
      creator: scenario.Creator,
      characterIds,
      order,
      explicitContent: scenario.ExplicitContent,
      hasThumbnail: !!scenario.Thumbnail,
    };
  }

  /**
   * Create a collection card for multi-character packages
   */
  private async createCollectionCard(
    data: VoxtaData,
    members: CollectionMember[],
    scenarios: CollectionScenario[],
    originalFilePath: string
  ): Promise<string> {
    const packageData = data.package;
    const fallbackName = members.length > 0
      ? `${members[0].name} Collection`
      : 'Voxta Collection';

    const collectionData: CollectionData = {
      name: packageData?.Name || fallbackName,
      description: packageData?.Description || `Collection of ${members.length} characters`,
      version: packageData?.Version,
      creator: packageData?.Creator,
      voxtaPackageId: packageData?.Id,
      members,
      scenarios: scenarios.length > 0 ? scenarios : undefined,
      explicitContent: packageData?.ExplicitContent,
      dateCreated: packageData?.DateCreated,
      dateModified: packageData?.DateModified,
    };

    // Create the collection card
    const card = this.cardRepo.create({
      meta: {
        name: collectionData.name,
        spec: 'collection' as any, // Collection is a special spec
        tags: ['Collection', 'voxta'],
        memberCount: members.length,
      },
      data: collectionData as any,
    });

    console.log(`[Voxta Import] Created collection card "${collectionData.name}" with ${members.length} members`);

    // Get and save thumbnail using package's ThumbnailResource
    const thumbnail = this.getPackageThumbnail(data);
    if (thumbnail) {
      this.cardRepo.updateImage(card.meta.id, thumbnail);
    }

    // Store the original .voxpkg file as an asset for delta export
    try {
      const originalBytes = await readFile(originalFilePath);
      await this.storeOriginalPackage(card.meta.id, originalBytes);
    } catch (err) {
      console.warn('[Voxta Import] Failed to store original package:', err);
    }

    return card.meta.id;
  }

  /**
   * Store the original .voxpkg bytes as an asset for future delta export
   */
  private async storeOriginalPackage(cardId: string, packageBytes: Buffer): Promise<void> {
    const fileId = nanoid();
    const storageFilename = `${fileId}.voxpkg`;
    const storagePath = join(config.storagePath, storageFilename);

    await writeFile(storagePath, packageBytes);

    // Create Asset Record
    const assetRecord = this.assetRepo.create({
      filename: storageFilename,
      mimetype: 'application/octet-stream',
      size: packageBytes.length,
      url: `/storage/${storageFilename}`,
    });

    // Create Card Asset Link with special type
    this.cardAssetRepo.create({
      cardId,
      assetId: assetRecord.id,
      type: 'package-original' as AssetType,
      name: 'original-package',
      ext: 'voxpkg',
      order: 0,
      isMain: false,
      tags: []
    });

    console.log(`[Voxta Import] Stored original package (${packageBytes.length} bytes) for card ${cardId}`);
  }

  /**
   * Import a single character from the package
   */
  private async importCharacter(
    char: ExtractedVoxtaCharacter,
    fullPackage: VoxtaData
  ): Promise<string> {
    // Map Voxta -> CCv3 using the shared mapper (keeps parity with loader.parseCard)
    const ccv3Data = voxtaToCCv3(char.data as any, fullPackage.books.map((b) => b.data));

    // Add 'voxta' tag
    const tags = new Set(ccv3Data.data.tags || []);
    tags.add('voxta');

    // Create Card in DB
    const card = this.cardRepo.create({
      meta: {
        name: ccv3Data.data.name,
        spec: 'v3',
        tags: Array.from(tags),
        creator: ccv3Data.data.creator,
        characterVersion: ccv3Data.data.character_version,
      },
      data: ccv3Data as any, // Type assertion needed due to schema strictness
    });

    // Import Thumbnail if present - save as card image only
    // Do NOT create asset - main icon asset is only created during CHARX export
    if (char.thumbnail) {
      this.cardRepo.updateImage(card.meta.id, char.thumbnail);
    }

    // Import Assets
    if (char.assets && char.assets.length > 0) {
      const assetDescriptors = await this.importAssets(card.meta.id, char.assets);

      // Update card with assets list so frontend sees them in the JSON blob
      ccv3Data.data.assets = assetDescriptors;
      this.cardRepo.update(card.meta.id, { data: ccv3Data });
    }

    return card.meta.id;
  }

  /**
   * Import Assets for a card
   */
  private async importAssets(cardId: string, assets: ExtractedVoxtaAsset[]): Promise<any[]> {
    let orderCounter = 0;
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
