/**
 * Voxta Package Builder
 * Handles creating .voxpkg files from Card data
 */

import yazl from 'yazl';
import type { 
  CCv3Data, 
  CardAssetWithDetails, 
  VoxtaCharacter,
  VoxtaExtensionData
} from '@card-architect/schemas';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface VoxtaBuildOptions {
  storagePath: string;
}

export interface VoxtaBuildResult {
  buffer: Buffer;
  assetCount: number;
  totalSize: number;
}

/**
 * Build a Voxta Package from a Card
 */
export async function buildVoxtaPackage(
  card: CCv3Data,
  assets: CardAssetWithDetails[],
  options: VoxtaBuildOptions
): Promise<VoxtaBuildResult> {
  const zipfile = new yazl.ZipFile();
  const cardData = card.data;
  
  // Get or Generate IDs
  const voxtaExt = cardData.extensions?.voxta as VoxtaExtensionData | undefined;
  const packageId = voxtaExt?.packageId || uuidv4();
  const characterId = voxtaExt?.id || uuidv4();
  const dateNow = new Date().toISOString();

  // 1. Build package.json
  /*
  const packageMeta: VoxtaPackage = {
    $type: 'package',
    Id: packageId,
    Name: cardData.name,
    Version: cardData.character_version || '1.0.0',
    Description: cardData.description,
    Creator: cardData.creator,
    ExplicitContent: true, // Default to true for safety or check tags?
    EntryResource: {
      Kind: 1, // Character
      Id: characterId
    },
    ThumbnailResource: {
      Kind: 1,
      Id: characterId
    },
    DateCreated: voxtaExt?.original?.DateCreated || dateNow,
    DateModified: dateNow
  };
  */

  // Voxta packages should NOT include package.json at root if it's just a character export?
  // The user said "WE DONT NEED PACKAGE DOT JSON IT WILL THINK ITS A PACKAGE AND BREAK IT"
  // Wait, .voxpkg IS a package.
  // But if I include package.json, Voxta might treat it differently than if it just finds characters?
  // The spec says .voxpkg contains package.json.
  // BUT if the user insists "IT WILL THINK ITS A PACKAGE AND BREAK IT", I will remove it.
  // Perhaps they mean they are importing it as a character, not a package?
  // But the file extension IS .voxpkg.
  
  // I will remove it as requested.
  // zipfile.addBuffer(Buffer.from(JSON.stringify(packageMeta, null, 2)), 'package.json');

  // 2. Build character.json
  const character: VoxtaCharacter = {
    $type: 'character',
    Id: characterId,
    PackageId: packageId,
    Name: cardData.name,
    Version: cardData.character_version,
    
    // Core Info
    Description: voxtaExt?.appearance || '', // Physical description from extension
    Personality: cardData.personality,
    Profile: cardData.description, // Profile/Backstory from description field
    Scenario: cardData.scenario,
    FirstMessage: cardData.first_mes,
    MessageExamples: cardData.mes_example,
    
    // Metadata
    Creator: cardData.creator,
    CreatorNotes: cardData.creator_notes,
    Tags: cardData.tags,
    
    // Voxta specifics from extension
    TextToSpeech: voxtaExt?.textToSpeech,
    ChatStyle: voxtaExt?.chatSettings?.chatStyle,
    EnableThinkingSpeech: voxtaExt?.chatSettings?.enableThinkingSpeech,
    NotifyUserAwayReturn: voxtaExt?.chatSettings?.notifyUserAwayReturn,
    TimeAware: voxtaExt?.chatSettings?.timeAware,
    UseMemory: voxtaExt?.chatSettings?.useMemory,
    MaxTokens: voxtaExt?.chatSettings?.maxTokens,
    MaxSentences: voxtaExt?.chatSettings?.maxSentences,
    Scripts: voxtaExt?.scripts,
    
    DateCreated: voxtaExt?.original?.DateCreated || dateNow,
    DateModified: dateNow
  };

  zipfile.addBuffer(
    Buffer.from(JSON.stringify(character, null, 2)), 
    `Characters/${characterId}/character.json`
  );

  // 3. Add Assets
  let assetCount = 0;
  let totalSize = 0;

  // Sort assets to find main thumbnail
  // 1. 'portrait-override'
  // 2. 'icon' type named 'main'
  // 3. First 'icon'
  let mainThumbnail: CardAssetWithDetails | undefined;
  
  // Categorize assets
  for (const cardAsset of assets) {
    if (cardAsset.asset.url.startsWith('/storage/')) {
      const filename = cardAsset.asset.url.replace('/storage/', '');
      const sourcePath = join(options.storagePath, filename);
      
      try {
        const buffer = await fs.readFile(sourcePath);
        
        // Determine Voxta Path
        let voxtaPath = '';
        const tags = cardAsset.tags || [];
        
        // Handle double extension issue
        let safeName = cardAsset.name;
        if (safeName.toLowerCase().endsWith(`.${cardAsset.ext.toLowerCase()}`)) {
            safeName = safeName.substring(0, safeName.length - (cardAsset.ext.length + 1));
        }
        const finalFilename = `${safeName}.${cardAsset.ext}`;
        
        if (cardAsset.type === 'sound' || tags.includes('voice')) {
           // Voice Sample
           voxtaPath = `Characters/${characterId}/Assets/VoiceSamples/${finalFilename}`;
        } else if (cardAsset.type === 'icon' || cardAsset.type === 'emotion') {
           // Avatar (Default folder)
           
           // Check if this is the thumbnail candidate
           if (cardAsset.type === 'icon') {
             if (tags.includes('portrait-override')) {
               mainThumbnail = cardAsset;
             } else if (!mainThumbnail && (cardAsset.name === 'main' || cardAsset.isMain)) {
               mainThumbnail = cardAsset;
             }
           }

           // Use original filename (cleaned)
           voxtaPath = `Characters/${characterId}/Assets/Avatars/Default/${finalFilename}`;
        } else {
           // Misc
           voxtaPath = `Characters/${characterId}/Assets/Misc/${finalFilename}`;
        }

        zipfile.addBuffer(buffer, voxtaPath);
        assetCount++;
        totalSize += buffer.length;

      } catch (err) {
        console.warn(`[Voxta Builder] Failed to read asset ${filename}`, err);
      }
    }
  }

  // 4. Add Thumbnail (root of character folder)
  if (!mainThumbnail && assets.length > 0) {
    // Fallback to first icon
    mainThumbnail = assets.find(a => a.type === 'icon');
  }

  if (mainThumbnail && mainThumbnail.asset.url.startsWith('/storage/')) {
    try {
      const filename = mainThumbnail.asset.url.replace('/storage/', '');
      const buffer = await fs.readFile(join(options.storagePath, filename));
      
      // Add as character thumbnail
      zipfile.addBuffer(buffer, `Characters/${characterId}/thumbnail.png`); // Voxta usually uses PNG/JPG for thumbs, standardizing to PNG name even if content is webp (Voxta handles it)
      
      // Also add as package thumbnail if referenced
      // But package.json references the Character ID as ThumbnailResource, so Voxta looks up the character's thumbnail
    } catch (e) {
      console.warn('Failed to write thumbnail', e);
    }
  }

  // 5. Scenarios (If present in extension)
  if (voxtaExt?.scenario) {
     // Construct a minimal scenario if we have data
     // This assumes we want to export the linked scenario data
     // Implementation detail: We might need a 'scenarioId' in the extension
     // For now, skip to avoid complexity unless requested
  }

  zipfile.end();

  // Collect Output
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    zipfile.outputStream.on('data', chunk => chunks.push(chunk));
    zipfile.outputStream.on('end', () => {
      resolve({
        buffer: Buffer.concat(chunks),
        assetCount,
        totalSize: Buffer.concat(chunks).length
      });
    });
    zipfile.outputStream.on('error', reject);
  });
}
