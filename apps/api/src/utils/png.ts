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

      // Try v3 keys first
      for (const key of TEXT_CHUNK_KEYS.v3) {
        if (textChunks[key]) {
          try {
            const json = JSON.parse(textChunks[key]);
            const spec = detectSpec(json);
            if (spec === 'v3') {
              resolve({ data: json, spec: 'v3' });
              return;
            }
          } catch {
            // Continue to next key
          }
        }
      }

      // Try v2 keys
      for (const key of TEXT_CHUNK_KEYS.v2) {
        if (textChunks[key]) {
          try {
            const json = JSON.parse(textChunks[key]);
            const spec = detectSpec(json);
            if (spec === 'v2') {
              resolve({ data: json, spec: 'v2' });
              return;
            }
          } catch {
            // Continue to next key
          }
        }
      }

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
