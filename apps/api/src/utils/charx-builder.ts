/**
 * CHARX Format Builder
 * Handles creating and building .charx (ZIP-based character card) files for export
 */

import yazl from 'yazl';
import type { CCv3Data, CardAssetWithDetails } from '@card-architect/schemas';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface CharxBuildOptions {
  storagePath: string; // Base path where asset files are stored
  includeMetadata?: boolean; // Include x_meta/*.json files
  includeModuleRisum?: boolean; // Include module.risum if available
}

export interface CharxBuildResult {
  buffer: Buffer;
  assetCount: number;
  totalSize: number;
}

function getCharxCategory(mimetype: string): string {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  // TODO: Add l2d, 3d, ai, fonts, code detection if needed
  return 'other';
}

/**
 * Build a CHARX ZIP file from card data and assets
 */
export async function buildCharx(
  card: CCv3Data,
  assets: CardAssetWithDetails[],
  options: CharxBuildOptions
): Promise<CharxBuildResult> {
  console.log('[CHARX Builder] Starting CHARX build...');
  console.log(`[CHARX Builder] Card: ${card.data.name}`);
  console.log(`[CHARX Builder] Assets to bundle: ${assets.length}`);

  const zipfile = new yazl.ZipFile();

  // Transform asset URIs from internal (/storage/...) to embeded:// format
  const transformedCard = transformAssetUris(card, assets);

  // Add card.json
  const cardJson = JSON.stringify(transformedCard, null, 2);
  zipfile.addBuffer(Buffer.from(cardJson, 'utf-8'), 'card.json');
  console.log('[CHARX Builder] Added card.json');

  // Add assets
  let assetCount = 0;
  let totalSize = 0;

  for (const cardAsset of assets) {
    // Only bundle assets that have files (not remote URLs or ccdefault)
    if (cardAsset.asset.url.startsWith('/storage/')) {
      const filename = cardAsset.asset.url.replace('/storage/', '');
      const assetPath = join(options.storagePath, filename);

      try {
        const buffer = await fs.readFile(assetPath);

        // Organize assets by type following CHARX convention
        // Format: assets/{type}/{category}/{name}.{ext}
        const category = getCharxCategory(cardAsset.asset.mimetype);
        
        // Normalize filename: strip ext, replace _/. with -, sanitize
        let safeName = cardAsset.name;
        if (safeName.toLowerCase().endsWith(`.${cardAsset.ext.toLowerCase()}`)) {
            safeName = safeName.substring(0, safeName.length - (cardAsset.ext.length + 1));
        }
        // Replace dots and underscores with hyphens, remove other special chars, collapse dashes
        safeName = safeName.replace(/[._]/g, '-').replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
        if (!safeName) safeName = 'asset';

        const assetZipPath = `assets/${cardAsset.type}/${category}/${safeName}.${cardAsset.ext}`;

        zipfile.addBuffer(buffer, assetZipPath);
        console.log(`[CHARX Builder] Added asset: ${assetZipPath} (${buffer.length} bytes)`);

        assetCount++;
        totalSize += buffer.length;
      } catch (err) {
        console.warn(`[CHARX Builder] Failed to read asset file ${assetPath}:`, err);
      }
    }
  }

  // Finalize the ZIP
  zipfile.end();

  // Collect ZIP data
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    zipfile.outputStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    zipfile.outputStream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      console.log(`[CHARX Builder] Build complete: ${buffer.length} bytes total`);
      console.log(`[CHARX Builder] Assets bundled: ${assetCount}/${assets.length}`);

      resolve({
        buffer,
        assetCount,
        totalSize: buffer.length,
      });
    });

    zipfile.outputStream.on('error', (err) => {
      reject(new Error(`Failed to build CHARX: ${err.message}`));
    });
  });
}

/**
 * Generate the assets array for card.json from the provided DB assets
 * This ensures the JSON metadata matches the actual files in the ZIP
 */
function transformAssetUris(card: CCv3Data, assets: CardAssetWithDetails[]): CCv3Data {
  // Clone the card to avoid mutations
  const transformed: CCv3Data = JSON.parse(JSON.stringify(card));

  // Generate assets array from the DB records
  // This guarantees that every file added to the ZIP has a corresponding metadata entry
  transformed.data.assets = assets.map((cardAsset) => {
    let uri: string;
    
    if (cardAsset.asset.url.startsWith('/storage/')) {
      // Convert to embeded:// format
      // Format: embeded://assets/{type}/{category}/{name}.{ext}
      const category = getCharxCategory(cardAsset.asset.mimetype);
      
      // Normalize filename: strip ext, replace _/. with -, sanitize
      let safeName = cardAsset.name;
      if (safeName.toLowerCase().endsWith(`.${cardAsset.ext.toLowerCase()}`)) {
          safeName = safeName.substring(0, safeName.length - (cardAsset.ext.length + 1));
      }
      // Replace dots and underscores with hyphens, remove other special chars, collapse dashes
      safeName = safeName.replace(/[._]/g, '-').replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
      if (!safeName) safeName = 'asset';

      uri = `embeded://assets/${cardAsset.type}/${category}/${safeName}.${cardAsset.ext}`;
      
      // Update the name to match the safe filename used in ZIP
      return {
        type: cardAsset.type as any,
        uri: uri,
        name: safeName,
        ext: cardAsset.ext,
      };
    } else {
      // Remote or default asset (keep as is if it was in DB, assuming DB stores full URI for remotes)
      // If DB stores 'ccdefault:', use it.
      return {
        type: cardAsset.type as any,
        uri: cardAsset.asset.url,
        name: cardAsset.name,
        ext: cardAsset.ext,
      };
    }
  });

  return transformed;
}

/**
 * Quick validation of CHARX structure before export
 */
export function validateCharxBuild(card: CCv3Data, assets: CardAssetWithDetails[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for CCv3 spec
  if (card.spec !== 'chara_card_v3') {
    errors.push('Card must be CCv3 format for CHARX export');
  }

  // Check for at least one asset
  if (assets.length === 0) {
    errors.push('CHARX files should contain at least one asset');
  }

  // Check for main icon
  const hasMainIcon = assets.some((a) => a.type === 'icon' && a.isMain);
  if (!hasMainIcon) {
    errors.push('CHARX files should have a main icon asset');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
