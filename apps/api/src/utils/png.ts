import { PNG } from 'pngjs';
import { detectSpec } from '@card-architect/schemas';
import type { Card, CCv2Data, CCv3Data } from '@card-architect/schemas';

/**
 * PNG text chunk keys used for character cards
 * Different frontends use different keys
 */
const TEXT_CHUNK_KEYS = {
  v2: ['chara', 'ccv2', 'character'],
  v3: ['ccv3', 'chara_card_v3'],
};

/**
 * Extract character card JSON from PNG tEXt chunks
 */
export async function extractFromPNG(buffer: Buffer): Promise<{ data: CCv2Data | CCv3Data; spec: 'v2' | 'v3' } | null> {
  return new Promise((resolve, reject) => {
    const png = new PNG();

    png.parse(buffer, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      // Look for character card data in text chunks
      const textChunks = (data as PNG & { text?: Record<string, string> }).text || {};
      const availableKeys = Object.keys(textChunks);

      console.log('[PNG Extract] Available text chunks:', availableKeys);

      // Helper function to try parsing JSON (supports plain and base64)
      const tryParseChunk = (chunkData: string): any => {
        // Try direct JSON parse first
        try {
          return JSON.parse(chunkData);
        } catch {
          // Try base64 decode then JSON parse
          try {
            const decoded = Buffer.from(chunkData, 'base64').toString('utf-8');
            return JSON.parse(decoded);
          } catch {
            throw new Error('Not valid JSON or base64-encoded JSON');
          }
        }
      };

      // Try v3 keys first
      for (const key of TEXT_CHUNK_KEYS.v3) {
        if (textChunks[key]) {
          try {
            const json = tryParseChunk(textChunks[key]);
            const spec = detectSpec(json);
            console.log(`[PNG Extract] Found data in chunk '${key}', detected spec: ${spec}`);
            if (spec === 'v3') {
              resolve({ data: json, spec: 'v3' });
              return;
            }
            // Even if spec detection says v2, if we found it in a v3 key, it might still be v3
            if (spec === 'v2' && json.spec === 'chara_card_v3') {
              console.log(`[PNG Extract] Found v3 card with relaxed validation in chunk '${key}'`);
              resolve({ data: json, spec: 'v3' });
              return;
            }
          } catch (e) {
            console.error(`[PNG Extract] Failed to parse data in chunk '${key}':`, e);
            // Continue to next key
          }
        }
      }

      // Try v2 keys
      for (const key of TEXT_CHUNK_KEYS.v2) {
        if (textChunks[key]) {
          try {
            const json = tryParseChunk(textChunks[key]);
            const spec = detectSpec(json);
            console.log(`[PNG Extract] Found data in chunk '${key}', detected spec: ${spec}`);
            if (spec === 'v2') {
              resolve({ data: json, spec: 'v2' });
              return;
            }
            // Fallback: if we found valid JSON with a name field, treat as v2
            if (json && typeof json === 'object' && 'name' in json) {
              console.log(`[PNG Extract] Found v2 card with relaxed validation in chunk '${key}'`);
              resolve({ data: json, spec: 'v2' });
              return;
            }
          } catch (e) {
            console.error(`[PNG Extract] Failed to parse data in chunk '${key}':`, e);
            // Continue to next key
          }
        }
      }

      console.error('[PNG Extract] No valid character card data found. Available chunks:', availableKeys);
      resolve(null);
    });
  });
}

/**
 * Embed character card JSON into PNG tEXt chunk
 */
export async function embedIntoPNG(imageBuffer: Buffer, cardData: CCv2Data | CCv3Data, spec: 'v2' | 'v3'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const png = new PNG();

    png.parse(imageBuffer, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      // Add text chunk with card data
      const key = spec === 'v3' ? 'ccv3' : 'chara';
      const json = JSON.stringify(cardData, null, 0); // Minified for smaller size

      // Create new PNG with text chunk
      const output = new PNG({
        width: data.width,
        height: data.height,
      });

      data.data.copy(output.data);

      // Add text chunk (this is a workaround since pngjs doesn't expose text chunks directly)
      const textData = (output as PNG & { text?: Record<string, string> }).text || {};
      textData[key] = json;
      (output as PNG & { text?: Record<string, string> }).text = textData;

      const chunks: Buffer[] = [];
      output.on('data', (chunk: Buffer) => chunks.push(chunk));
      output.on('end', () => resolve(Buffer.concat(chunks)));
      output.on('error', reject);

      output.pack();
    });
  });
}

/**
 * Create a PNG from card data and base image
 */
export async function createCardPNG(baseImage: Buffer, card: Card): Promise<Buffer> {
  const spec = card.meta.spec;
  return embedIntoPNG(baseImage, card.data, spec);
}

/**
 * Validate PNG size
 */
export function validatePNGSize(buffer: Buffer, limits: { max: number; warn: number }): { valid: boolean; warnings: string[] } {
  const sizeMB = buffer.length / (1024 * 1024);
  const warnings: string[] = [];

  if (sizeMB > limits.max) {
    return {
      valid: false,
      warnings: [`PNG size (${sizeMB.toFixed(2)}MB) exceeds maximum (${limits.max}MB)`],
    };
  }

  if (sizeMB > limits.warn) {
    warnings.push(`PNG size (${sizeMB.toFixed(2)}MB) is large (recommended: <${limits.warn}MB)`);
  }

  return { valid: true, warnings };
}
