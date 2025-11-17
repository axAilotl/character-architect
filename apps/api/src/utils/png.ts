import { PNG } from 'pngjs';
import { detectSpec } from '@card-architect/schemas';
import type { Card, CCv2Data, CCv3Data } from '@card-architect/schemas';

/**
 * PNG text chunk keys used for character cards
 * Different frontends use different keys
 */
const TEXT_CHUNK_KEYS = {
  // Try all possible keys for both v2 and v3
  // Order matters - try more specific keys first
  all: [
    // v3 keys
    'ccv3',
    'chara_card_v3',
    // v2 keys
    'chara',
    'ccv2',
    'character',
    // Alternative/legacy keys used by various tools
    'charactercard',
    'card',
    'CharacterCard',
    'Chara',
  ],
};

/**
 * Manually parse PNG text chunks from buffer
 * pngjs library doesn't reliably read text chunks, so we parse them ourselves
 * Returns array of {keyword, text} to support multiple chunks with same keyword
 */
function parseTextChunks(buffer: Buffer): Array<{keyword: string, text: string}> {
  const textChunks: Array<{keyword: string, text: string}> = [];

  // Verify PNG signature
  const signature = buffer.slice(0, 8);
  if (signature.toString('hex') !== '89504e470d0a1a0a') {
    console.error('[PNG Extract] Invalid PNG signature');
    return textChunks;
  }

  let offset = 8; // Skip PNG signature

  while (offset < buffer.length) {
    // Read chunk length (4 bytes, big-endian)
    if (offset + 4 > buffer.length) break;
    const length = buffer.readUInt32BE(offset);
    offset += 4;

    // Read chunk type (4 bytes ASCII)
    if (offset + 4 > buffer.length) break;
    const type = buffer.slice(offset, offset + 4).toString('ascii');
    offset += 4;

    // Read chunk data
    if (offset + length > buffer.length) break;
    const data = buffer.slice(offset, offset + length);
    offset += length;

    // Skip CRC (4 bytes)
    if (offset + 4 > buffer.length) break;
    offset += 4;

    // Parse tEXt chunks
    if (type === 'tEXt') {
      const nullIndex = data.indexOf(0);
      if (nullIndex !== -1) {
        const keyword = data.slice(0, nullIndex).toString('latin1');
        const text = data.slice(nullIndex + 1).toString('utf8');
        textChunks.push({keyword, text});
        console.log(`[PNG Extract] Found tEXt chunk: "${keyword}" (${text.length} chars)`);
      }
    }

    // Stop after IEND chunk
    if (type === 'IEND') break;
  }

  return textChunks;
}

/**
 * Extract character card JSON from PNG tEXt chunks
 */
export async function extractFromPNG(buffer: Buffer): Promise<{ data: CCv2Data | CCv3Data; spec: 'v2' | 'v3' } | null> {
  return new Promise((resolve, reject) => {
    // Validate PNG format using pngjs
    const png = new PNG();

    png.parse(buffer, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Manually parse text chunks (pngjs doesn't read them reliably)
      const textChunks = parseTextChunks(buffer);
      const availableKeys = [...new Set(textChunks.map(c => c.keyword))];

      console.log('[PNG Extract] Available text chunks:', availableKeys);

      if (textChunks.length === 0) {
        console.error('[PNG Extract] PNG has no text chunks at all - this PNG was not exported with embedded character data');
        resolve(null);
        return;
      }

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

      // Helper function to check if parsed data has lorebook
      const hasLorebook = (json: any): boolean => {
        if (json.data?.character_book?.entries?.length > 0) return true;
        if (json.character_book?.entries?.length > 0) return true;
        return false;
      };

      // Try all known keys, preferring chunks with lorebooks
      let fallbackResult: { data: CCv2Data | CCv3Data; spec: 'v2' | 'v3' } | null = null;

      for (const key of TEXT_CHUNK_KEYS.all) {
        // Find all chunks with this keyword
        const matchingChunks = textChunks.filter(c => c.keyword === key);

        for (const chunk of matchingChunks) {
          try {
            const json = tryParseChunk(chunk.text);
            const spec = detectSpec(json);
            console.log(`[PNG Extract] Found data in chunk '${key}' (${chunk.text.length} chars), detected spec: ${spec}, has lorebook: ${hasLorebook(json)}`);

            if (spec === 'v3' || spec === 'v2') {
              const result = { data: json, spec };

              // Prefer chunks with lorebooks
              if (hasLorebook(json)) {
                console.log(`[PNG Extract] Using chunk with lorebook`);
                resolve(result);
                return;
              }

              // Store as fallback if we don't find one with lorebook
              if (!fallbackResult) {
                fallbackResult = result;
              }
            }

            // If detectSpec failed but we have JSON that looks like a card, try to infer
            if (!spec && json && typeof json === 'object') {
              console.log(`[PNG Extract] Spec detection failed, attempting to infer from structure...`);

              // Check if it's a wrapped v3 card
              if (json.spec === 'chara_card_v3' && json.data && json.data.name) {
                console.log(`[PNG Extract] Inferred v3 from structure in chunk '${key}'`);
                const result = { data: json, spec: 'v3' as const };
                if (hasLorebook(json)) {
                  resolve(result);
                  return;
                }
                if (!fallbackResult) fallbackResult = result;
              }

              // Check if it's a wrapped v2 card
              if (json.spec === 'chara_card_v2' && json.data && json.data.name) {
                console.log(`[PNG Extract] Inferred v2 from structure in chunk '${key}'`);
                const result = { data: json, spec: 'v2' as const };
                if (hasLorebook(json)) {
                  resolve(result);
                  return;
                }
                if (!fallbackResult) fallbackResult = result;
              }

              // Check if it's a legacy v2 card (direct fields)
              if (json.name && (json.description || json.personality || json.scenario)) {
                console.log(`[PNG Extract] Inferred legacy v2 from structure in chunk '${key}'`);
                const result = { data: json, spec: 'v2' as const };
                if (hasLorebook(json)) {
                  resolve(result);
                  return;
                }
                if (!fallbackResult) fallbackResult = result;
              }
            }
          } catch (e) {
            console.error(`[PNG Extract] Failed to parse data in chunk '${key}':`, e);
            // Continue to next chunk
          }
        }
      }

      // If we found a valid card but no lorebook, use the fallback
      if (fallbackResult) {
        console.log(`[PNG Extract] Using fallback result (no lorebook found in any chunk)`);
        resolve(fallbackResult);
        return;
      }

      console.error('[PNG Extract] No valid character card data found in any known text chunk.');
      console.error('[PNG Extract] Available chunks:', availableKeys);
      console.error('[PNG Extract] Expected one of:', TEXT_CHUNK_KEYS.all);
      resolve(null);
    });
  });
}

/**
 * Calculate CRC32 checksum for PNG chunks
 */
function calculateCRC32(buffer: Buffer): Buffer {
  const CRC_TABLE = new Uint32Array(256);

  // Build CRC table
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c;
  }

  // Calculate CRC
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  crc = crc ^ 0xFFFFFFFF;

  // Convert to buffer (big-endian)
  const result = Buffer.alloc(4);
  result.writeUInt32BE(crc >>> 0, 0);
  return result;
}

/**
 * Manually inject tEXt chunk into PNG buffer
 * This is necessary because pngjs doesn't reliably write text chunks
 */
function injectTextChunk(pngBuffer: Buffer, keyword: string, text: string): Buffer {
  // Find IEND chunk (marks end of PNG)
  // IEND is always at the end: length(4) + "IEND"(4) + CRC(4) = 12 bytes
  let iendOffset = -1;

  // Search backwards from the end - IEND should be near the end
  for (let i = pngBuffer.length - 12; i >= 8; i--) {
    if (
      pngBuffer[i + 4] === 0x49 && // 'I'
      pngBuffer[i + 5] === 0x45 && // 'E'
      pngBuffer[i + 6] === 0x4E && // 'N'
      pngBuffer[i + 7] === 0x44    // 'D'
    ) {
      // Found "IEND"
      iendOffset = i; // Start of length field
      break;
    }
  }

  if (iendOffset === -1) {
    throw new Error('Invalid PNG: IEND chunk not found');
  }

  // Create tEXt chunk
  const keywordBuffer = Buffer.from(keyword, 'latin1');
  const textBuffer = Buffer.from(text, 'utf8');
  const dataLength = keywordBuffer.length + 1 + textBuffer.length;

  // Build chunk: length + type + data + CRC
  const chunkType = Buffer.from('tEXt', 'ascii');
  const chunkData = Buffer.concat([
    keywordBuffer,
    Buffer.from([0]), // null separator
    textBuffer,
  ]);

  // Calculate CRC32
  const crcData = Buffer.concat([chunkType, chunkData]);
  const crc = calculateCRC32(crcData);

  // Assemble the full chunk
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(dataLength, 0);

  const textChunk = Buffer.concat([lengthBuffer, chunkType, chunkData, crc]);

  // Insert before IEND
  const beforeIend = pngBuffer.slice(0, iendOffset);
  const iendAndAfter = pngBuffer.slice(iendOffset);

  return Buffer.concat([beforeIend, textChunk, iendAndAfter]);
}

/**
 * Embed character card JSON into PNG tEXt chunk
 */
export async function embedIntoPNG(imageBuffer: Buffer, cardData: CCv2Data | CCv3Data): Promise<Buffer> {
  // Use 'chara' key for both V2 and V3 (SillyTavern standard)
  const key = 'chara';
  const json = JSON.stringify(cardData, null, 0); // Minified for smaller size

  // Base64 encode the JSON (standard for SillyTavern and other tools)
  const base64 = Buffer.from(json, 'utf-8').toString('base64');

  // Manually inject the text chunk into the PNG
  return injectTextChunk(imageBuffer, key, base64);
}

/**
 * Create a PNG from card data and base image
 */
export async function createCardPNG(baseImage: Buffer, card: Card): Promise<Buffer> {
  return embedIntoPNG(baseImage, card.data);
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
