/**
 * CHARX Format Handler
 * Handles reading and parsing .charx (ZIP-based character card) files
 */

import yauzl from 'yauzl';
import type { CharxData, CharxAssetInfo, CharxMetadata, CharxValidationResult, CCv3Data, AssetDescriptor } from '@card-architect/schemas';
import { parseURI } from './uri-utils.js';

export interface CharxExtractionOptions {
  maxFileSize?: number; // Max size for card.json in bytes (default: 10MB)
  maxAssetSize?: number; // Max size for individual assets (default: 50MB)
  maxTotalSize?: number; // Max total size of all assets (default: 200MB)
  allowedAssetTypes?: string[]; // Allowed asset MIME types
}

const DEFAULT_OPTIONS: Required<CharxExtractionOptions> = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxAssetSize: 50 * 1024 * 1024, // 50MB
  maxTotalSize: 200 * 1024 * 1024, // 200MB
  allowedAssetTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',  // Static and animated WebP
    'image/gif',
    'image/avif',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'video/mp4',
    'video/webm',  // WebM video
  ],
};

/**
 * Extract and parse a CHARX file
 */
export async function extractCharx(
  filePath: string,
  options: CharxExtractionOptions = {}
): Promise<CharxData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) {
        return reject(new Error(`Failed to open CHARX file: ${err.message}`));
      }

      if (!zipfile) {
        return reject(new Error('Failed to open CHARX file: no zipfile'));
      }

      let cardJson: CCv3Data | null = null;
      const assets: CharxAssetInfo[] = [];
      const metadata = new Map<number, CharxMetadata>();
      let moduleRisum: Buffer | undefined;
      let totalSize = 0;

      zipfile.on('entry', (entry: yauzl.Entry) => {
        const fileName = entry.fileName;

        // Skip directories
        if (/\/$/.test(fileName)) {
          zipfile.readEntry();
          return;
        }

        // Check file size
        if (entry.uncompressedSize > opts.maxAssetSize) {
          zipfile.close();
          return reject(new Error(`File ${fileName} exceeds maximum asset size`));
        }

        totalSize += entry.uncompressedSize;
        if (totalSize > opts.maxTotalSize) {
          zipfile.close();
          return reject(new Error('Total CHARX file size exceeds maximum allowed size'));
        }

        // Handle card.json
        if (fileName === 'card.json') {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.close();
              return reject(new Error(`Failed to read card.json: ${err.message}`));
            }

            if (!readStream) {
              zipfile.close();
              return reject(new Error('Failed to read card.json: no stream'));
            }

            const chunks: Buffer[] = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              try {
                const content = Buffer.concat(chunks).toString('utf-8');
                cardJson = JSON.parse(content);
                zipfile.readEntry();
              } catch (parseErr) {
                zipfile.close();
                return reject(new Error(`Failed to parse card.json: ${parseErr}`));
              }
            });
            readStream.on('error', (streamErr) => {
              zipfile.close();
              return reject(new Error(`Failed to read card.json stream: ${streamErr.message}`));
            });
          });
          return;
        }

        // Handle x_meta/*.json
        const metaMatch = fileName.match(/^x_meta\/(\d+)\.json$/);
        if (metaMatch) {
          const index = parseInt(metaMatch[1], 10);
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              // Non-critical, just skip
              zipfile.readEntry();
              return;
            }

            if (!readStream) {
              zipfile.readEntry();
              return;
            }

            const chunks: Buffer[] = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              try {
                const content = Buffer.concat(chunks).toString('utf-8');
                const meta = JSON.parse(content);
                metadata.set(index, meta);
              } catch {
                // Ignore invalid metadata
              }
              zipfile.readEntry();
            });
            readStream.on('error', () => {
              zipfile.readEntry();
            });
          });
          return;
        }

        // Handle module.risum
        if (fileName === 'module.risum') {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              // Non-critical, just skip
              zipfile.readEntry();
              return;
            }

            if (!readStream) {
              zipfile.readEntry();
              return;
            }

            const chunks: Buffer[] = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              moduleRisum = Buffer.concat(chunks);
              zipfile.readEntry();
            });
            readStream.on('error', () => {
              zipfile.readEntry();
            });
          });
          return;
        }

        // Handle assets/** files
        if (fileName.startsWith('assets/')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              // Skip problematic assets
              zipfile.readEntry();
              return;
            }

            if (!readStream) {
              zipfile.readEntry();
              return;
            }

            const chunks: Buffer[] = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              const buffer = Buffer.concat(chunks);

              // We'll match this asset to its descriptor later
              // For now, just store the raw asset info
              assets.push({
                path: fileName,
                descriptor: {
                  type: 'unknown', // Will be determined from card.json
                  uri: `embeded://${fileName}`,
                  name: 'unknown',
                  ext: fileName.split('.').pop() || 'bin',
                },
                buffer,
              });

              zipfile.readEntry();
            });
            readStream.on('error', () => {
              zipfile.readEntry();
            });
          });
          return;
        }

        // Unknown file, skip
        zipfile.readEntry();
      });

      zipfile.on('end', () => {
        if (!cardJson) {
          return reject(new Error('CHARX file does not contain card.json'));
        }

        // Validate that it's a CCv3 card
        if (cardJson.spec !== 'chara_card_v3') {
          return reject(new Error(`Invalid card spec: expected "chara_card_v3", got "${cardJson.spec}"`));
        }

        // Match assets to their descriptors from card.json
        const matchedAssets = matchAssetsToDescriptors(assets, cardJson.data.assets || []);

        resolve({
          card: cardJson,
          assets: matchedAssets,
          metadata: metadata.size > 0 ? metadata : undefined,
          moduleRisum,
        });
      });

      zipfile.on('error', (zipErr) => {
        reject(new Error(`ZIP file error: ${zipErr.message}`));
      });

      // Start reading entries
      zipfile.readEntry();
    });
  });
}

/**
 * Match extracted asset files to their descriptors from card.json
 */
function matchAssetsToDescriptors(
  extractedAssets: CharxAssetInfo[],
  descriptors: AssetDescriptor[]
): CharxAssetInfo[] {
  const matched: CharxAssetInfo[] = [];

  for (const descriptor of descriptors) {
    const parsed = parseURI(descriptor.uri);

    if (parsed.scheme === 'embeded' && parsed.path) {
      // Find the matching asset file
      const asset = extractedAssets.find((a) => a.path === parsed.path);

      if (asset) {
        matched.push({
          ...asset,
          descriptor,
        });
      } else {
        // Asset referenced but not found in ZIP
        matched.push({
          path: parsed.path,
          descriptor,
          buffer: undefined, // Missing
        });
      }
    } else if (parsed.scheme === 'ccdefault') {
      // Default asset, no file needed
      matched.push({
        path: 'ccdefault:',
        descriptor,
        buffer: undefined,
      });
    } else if (parsed.scheme === 'https' || parsed.scheme === 'http') {
      // Remote asset, no file needed
      matched.push({
        path: descriptor.uri,
        descriptor,
        buffer: undefined,
      });
    } else if (parsed.scheme === 'data') {
      // Data URI, extract the data
      if (parsed.data && parsed.encoding === 'base64') {
        const buffer = Buffer.from(parsed.data, 'base64');
        matched.push({
          path: 'data:',
          descriptor,
          buffer,
        });
      } else {
        matched.push({
          path: 'data:',
          descriptor,
          buffer: undefined,
        });
      }
    }
  }

  return matched;
}

/**
 * Validate a CHARX structure
 */
export function validateCharx(data: CharxData): CharxValidationResult {
  const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' | 'info' }> = [];

  // Check for main icon
  const hasMainIcon = data.card.data.assets?.some(
    (a) => a.type === 'icon' && a.name === 'main'
  ) ?? false;

  if (!hasMainIcon) {
    errors.push({
      field: 'assets',
      message: 'No main icon asset found. At least one asset with type="icon" and name="main" is recommended.',
      severity: 'warning',
    });
  }

  // Count assets
  const assetCount = data.card.data.assets?.length ?? 0;

  // Calculate total size
  const totalSize = data.assets.reduce((sum, asset) => {
    return sum + (asset.buffer?.length ?? 0);
  }, 0);

  // Find missing assets
  const missingAssets = data.assets
    .filter((a) => a.descriptor.uri.startsWith('embeded://') && !a.buffer)
    .map((a) => a.path);

  if (missingAssets.length > 0) {
    errors.push({
      field: 'assets',
      message: `Missing ${missingAssets.length} asset(s): ${missingAssets.join(', ')}`,
      severity: 'error',
    });
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    hasMainIcon,
    assetCount,
    totalSize,
    missingAssets,
  };
}

/**
 * Extract just the card.json from a CHARX file (quick validation)
 */
export async function extractCardJsonOnly(filePath: string): Promise<CCv3Data> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) {
        return reject(new Error(`Failed to open CHARX file: ${err.message}`));
      }

      if (!zipfile) {
        return reject(new Error('Failed to open CHARX file: no zipfile'));
      }

      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName === 'card.json') {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.close();
              return reject(new Error(`Failed to read card.json: ${err.message}`));
            }

            if (!readStream) {
              zipfile.close();
              return reject(new Error('Failed to read card.json: no stream'));
            }

            const chunks: Buffer[] = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              try {
                const content = Buffer.concat(chunks).toString('utf-8');
                const cardJson = JSON.parse(content);
                zipfile.close();
                resolve(cardJson);
              } catch (parseErr) {
                zipfile.close();
                return reject(new Error(`Failed to parse card.json: ${parseErr}`));
              }
            });
            readStream.on('error', (streamErr) => {
              zipfile.close();
              return reject(new Error(`Failed to read card.json stream: ${streamErr.message}`));
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        reject(new Error('card.json not found in CHARX file'));
      });

      zipfile.on('error', (zipErr) => {
        reject(new Error(`ZIP file error: ${zipErr.message}`));
      });

      zipfile.readEntry();
    });
  });
}
