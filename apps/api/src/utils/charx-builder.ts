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
        // Format: assets/{type}/{subtype}/{name}.{ext}
        const subtype = cardAsset.asset.mimetype.split('/')[1] || 'bin';
        const safeName = cardAsset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const assetZipPath = `assets/${cardAsset.type}/${subtype}/${safeName}.${cardAsset.ext}`;

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
 * Transform internal asset URIs to embeded:// format for CHARX export
 */
function transformAssetUris(card: CCv3Data, assets: CardAssetWithDetails[]): CCv3Data {
  // Clone the card to avoid mutations
  const transformed: CCv3Data = JSON.parse(JSON.stringify(card));

  if (!transformed.data.assets || transformed.data.assets.length === 0) {
    return transformed;
  }

  // Create a mutable copy of assets to handle duplicates (consume as we go)
  const availableAssets = [...assets];

  // Map internal asset URLs to embeded:// URIs
  transformed.data.assets = transformed.data.assets.map((descriptor) => {
    // Find the matching card asset
    // We check against name OR _originalName (if it was renamed during fix)
    const assetIndex = availableAssets.findIndex(
      (a) => a.type === descriptor.type && 
             (a.name === descriptor.name || (a as any)._originalName === descriptor.name)
    );

    if (assetIndex !== -1) {
      const cardAsset = availableAssets[assetIndex];
      // Remove from available assets so subsequent duplicates match the next one
      availableAssets.splice(assetIndex, 1);

      if (cardAsset.asset.url.startsWith('/storage/')) {
        // Convert to embeded:// format
        // Format: embeded://assets/{type}/{subtype}/{name}.{ext}
        const subtype = cardAsset.asset.mimetype.split('/')[1] || 'bin';
        const safeName = cardAsset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const embedUri = `embeded://assets/${cardAsset.type}/${subtype}/${safeName}.${cardAsset.ext}`;

        return {
          ...descriptor,
          name: safeName, // Update name to match unique filename
          uri: embedUri,
          // Inject metadata from DB if available
          width: cardAsset.asset.width || undefined,
          height: cardAsset.asset.height || undefined,
          size: cardAsset.asset.size || undefined,
        };
      }
    }

    // Keep original URI for remote/default assets
    return descriptor;
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
