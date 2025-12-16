/**
 * Voxta Parser
 *
 * Wraps @character-foundry/voxta for Voxta package imports
 */

import { readVoxta, voxtaToCCv3 } from '@character-foundry/character-foundry/voxta';
import type {
  ParsedData,
  ParsedCharacter,
  ParsedAsset,
  ParsedCollection,
  ParsedCollectionMember,
  ParsedScenario
} from '../types/index.js';

/**
 * Parse Voxta package file
 */
export function parseVoxta(file: Buffer | Uint8Array): ParsedData {
  // Extract package using foundry library
  const data = readVoxta(file);

  // Determine if this is a collection
  const isCollection = data.characters.length > 1 || data.package !== undefined;

  // Build character-scenario map
  const characterScenarioMap = buildCharacterScenarioMap(data);

  // Parse each character
  const characters: ParsedCharacter[] = data.characters.map((char) => {
    // Map Voxta → CCv3 using canonical mapper
    const books = data.books.map(b => b.data);
    const ccv3Data = voxtaToCCv3(char.data as any, books);

    // Add 'voxta' tag
    const tags = new Set(ccv3Data.data.tags || []);
    tags.add('voxta');

    // Parse character assets
    const assets: ParsedAsset[] = (char.assets || []).map((asset, order) => {
      const parts = asset.path.split('/');
      const filename = parts[parts.length - 1];
      const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
      const mimetype = getMimeType(ext);

      // Determine asset type and tags from path
      const { type, tags: assetTags } = parseVoxtaAssetPath(asset.path, ext);

      return {
        buffer: asset.buffer,
        filename,
        mimetype,
        size: asset.buffer.length,
        link: {
          type,
          name: filename,
          ext,
          order,
          isMain: false,
          tags: assetTags
        }
      };
    });

    return {
      card: {
        meta: {
          name: ccv3Data.data.name,
          spec: 'v3' as const,
          tags: Array.from(tags),
          creator: ccv3Data.data.creator,
          characterVersion: ccv3Data.data.character_version
        },
        data: ccv3Data
      },
      thumbnail: char.thumbnail,
      assets
    };
  });

  // Parse collection if multi-character or has package metadata
  let collection: ParsedCollection | undefined;
  if (isCollection) {
    // Build member list
    const members: ParsedCollectionMember[] = data.characters.map((char, index) => {
      const scenarioIds = characterScenarioMap.get(char.data.Id) || [];
      return {
        voxtaCharacterId: char.data.Id,
        name: char.data.Name || 'Unknown',
        order: index,
        scenarioIds: scenarioIds.length > 0 ? scenarioIds : undefined
      };
    });

    // Build scenario list
    const scenarios: ParsedScenario[] = data.scenarios.map((scenario, index) => {
      const characterIds: string[] = [];
      for (const role of scenario.data.Roles || []) {
        const characterId = (role as any).CharacterId;
        if (characterId && !characterIds.includes(characterId)) {
          characterIds.push(characterId);
        }
      }

      return {
        voxtaScenarioId: scenario.data.Id,
        name: scenario.data.Name,
        description: scenario.data.Description,
        version: scenario.data.Version,
        creator: scenario.data.Creator,
        characterIds,
        order: index,
        explicitContent: scenario.data.ExplicitContent,
        hasThumbnail: !!scenario.data.Thumbnail
      };
    });

    // Get collection thumbnail
    const thumbnail = getPackageThumbnail(data);

    // Build collection data
    const packageData = data.package;
    const fallbackName = members.length > 0
      ? `${members[0].name} Collection`
      : 'Voxta Collection';

    const collectionData = {
      name: packageData?.Name || fallbackName,
      description: packageData?.Description || `Collection of ${members.length} characters`,
      version: packageData?.Version,
      creator: packageData?.Creator,
      voxtaPackageId: packageData?.Id,
      members,
      scenarios: scenarios.length > 0 ? scenarios : undefined,
      explicitContent: packageData?.ExplicitContent,
      dateCreated: packageData?.DateCreated,
      dateModified: packageData?.DateModified
    };

    collection = {
      card: {
        meta: {
          name: collectionData.name,
          spec: 'collection' as const,
          tags: ['Collection', 'voxta'],
          memberCount: members.length
        },
        data: collectionData
      },
      thumbnail,
      members: members,
      scenarios,
      originalPackage: file instanceof Buffer ? file : Buffer.from(file)
    };
  }

  return {
    characters,
    collection,
    isCollection
  };
}

/**
 * Get package thumbnail from ThumbnailResource
 */
function getPackageThumbnail(data: any): Buffer | Uint8Array | undefined {
  const thumbnailResource = data.package?.ThumbnailResource;
  if (!thumbnailResource) {
    return data.characters[0]?.thumbnail;
  }

  const { Kind, Id } = thumbnailResource;

  // Kind 3 = Scenario
  if (Kind === 3) {
    const scenario = data.scenarios.find((s: any) => s.id === Id);
    if (scenario?.thumbnail) {
      return scenario.thumbnail;
    }
  }

  // Kind 1 = Character
  if (Kind === 1) {
    const character = data.characters.find((c: any) => c.id === Id);
    if (character?.thumbnail) {
      return character.thumbnail;
    }
  }

  // Fallback
  return data.characters[0]?.thumbnail;
}

/**
 * Build character ID → scenario IDs map
 */
function buildCharacterScenarioMap(data: any): Map<string, string[]> {
  const map = new Map<string, string[]>();

  // From scenarios: check Roles
  for (const scenario of data.scenarios) {
    const scenarioId = scenario.data.Id;
    const roles = scenario.data.Roles || [];

    for (const role of roles) {
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
 * Parse Voxta asset path to determine type and tags
 * Path format: Characters/{uuid}/Assets/Avatars/Default/{Emotion}_{State}_{Variant}.webp
 * Path format: Characters/{uuid}/Assets/VoiceSamples/{Filename}.wav
 */
function parseVoxtaAssetPath(path: string, _ext: string): { type: any; tags: string[] } {
  const tags: string[] = [];
  let type: any = 'custom';

  if (path.includes('/Avatars/')) {
    type = 'icon';

    // Extract filename without extension
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    const nameNoExt = filename.substring(0, filename.lastIndexOf('.'));
    const nameParts = nameNoExt.split('_');

    if (nameParts.length >= 3) {
      const [emotion, state, variant] = nameParts;
      tags.push(`emotion:${emotion.toLowerCase()}`);
      tags.push(`state:${state.toLowerCase()}`);
      tags.push(`variant:${variant}`);
    } else if (nameParts.length === 2) {
      const [emotion, state] = nameParts;
      tags.push(`emotion:${emotion.toLowerCase()}`);
      tags.push(`state:${state.toLowerCase()}`);
    } else if (nameParts.length === 1) {
      tags.push(`emotion:${nameParts[0].toLowerCase()}`);
    }
  } else if (path.includes('/VoiceSamples/')) {
    type = 'sound';
    tags.push('voice');
  }

  return { type, tags };
}

/**
 * Get MIME type from file extension
 */
function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'wav': return 'audio/wav';
    case 'mp3': return 'audio/mpeg';
    case 'ogg': return 'audio/ogg';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    default: return 'application/octet-stream';
  }
}
