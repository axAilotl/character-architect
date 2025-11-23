/**
 * Voxta Package Handler
 * Handles reading and parsing .voxpkg (ZIP-based) files
 */

import yauzl from 'yauzl';
import type { 
  VoxtaPackage, 
  VoxtaCharacter, 
  VoxtaScenario, 
  VoxtaBook 
} from '@card-architect/schemas';

export interface VoxtaExtractionOptions {
  maxFileSize?: number; // Max size for JSON files (default: 10MB)
  maxAssetSize?: number; // Max size for individual assets (default: 50MB)
  maxTotalSize?: number; // Max total size (default: 500MB)
}

const DEFAULT_OPTIONS: Required<VoxtaExtractionOptions> = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxAssetSize: 50 * 1024 * 1024, // 50MB
  maxTotalSize: 500 * 1024 * 1024, // 500MB - Voxta packages can be large
};

export interface ExtractedVoxtaAsset {
  path: string;     // Full path in zip (e.g. Characters/uuid/Assets/Avatars/...)
  buffer: Buffer;
  characterId?: string; // If asset belongs to a character
}

export interface ExtractedVoxtaCharacter {
  id: string;
  data: VoxtaCharacter;
  thumbnail?: Buffer;
  assets: ExtractedVoxtaAsset[];
}

export interface ExtractedVoxtaScenario {
  id: string;
  data: VoxtaScenario;
  thumbnail?: Buffer;
}

export interface ExtractedVoxtaBook {
  id: string;
  data: VoxtaBook;
}

export interface VoxtaData {
  package?: VoxtaPackage;
  characters: ExtractedVoxtaCharacter[];
  scenarios: ExtractedVoxtaScenario[];
  books: ExtractedVoxtaBook[];
}

/**
 * Extract and parse a Voxta Package (.voxpkg) file
 */
export async function extractVoxtaPackage(
  filePath: string,
  options: VoxtaExtractionOptions = {}
): Promise<VoxtaData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) {
        return reject(new Error(`Failed to open Voxta package: ${err.message}`));
      }

      if (!zipfile) {
        return reject(new Error('Failed to open Voxta package: no zipfile'));
      }

      const result: VoxtaData = {
        characters: [],
        scenarios: [],
        books: []
      };

      // Temporary maps to aggregate data parts
      const charMap = new Map<string, Partial<ExtractedVoxtaCharacter>>();
      const scenarioMap = new Map<string, Partial<ExtractedVoxtaScenario>>();
      const bookMap = new Map<string, Partial<ExtractedVoxtaBook>>();
      
      let totalSize = 0;

      zipfile.on('entry', (entry: yauzl.Entry) => {
        const fileName = entry.fileName;

        // Skip directories
        if (/\/$/.test(fileName)) {
          zipfile.readEntry();
          return;
        }

        // Size check
        totalSize += entry.uncompressedSize;
        if (totalSize > opts.maxTotalSize) {
          zipfile.close();
          return reject(new Error('Total Voxta package size exceeds maximum allowed size'));
        }

        // 1. Package Metadata
        if (fileName === 'package.json') {
          readJsonEntry(zipfile, entry, (data: VoxtaPackage) => {
            result.package = data;
            zipfile.readEntry();
          }, reject);
          return;
        }

        // 2. Characters
        // Path: Characters/{uuid}/character.json
        const charMatch = fileName.match(/^Characters\/([^\/]+)\/(.+)$/);
        if (charMatch) {
          const [, charId, subPath] = charMatch;
          
          // Ensure map entry exists
          if (!charMap.has(charId)) {
            charMap.set(charId, { id: charId, assets: [] });
          }
          const charEntry = charMap.get(charId)!;

          if (subPath === 'character.json') {
            readJsonEntry(zipfile, entry, (data: VoxtaCharacter) => {
              charEntry.data = data;
              zipfile.readEntry();
            }, reject);
          } else if (subPath === 'thumbnail.png' || subPath === 'thumbnail.jpg' || subPath === 'thumbnail.webp') {
             readBufferEntry(zipfile, entry, (buffer) => {
               charEntry.thumbnail = buffer;
               zipfile.readEntry();
             }, reject);
          } else if (subPath.startsWith('Assets/')) {
             // Capture assets
             readBufferEntry(zipfile, entry, (buffer) => {
               charEntry.assets!.push({
                 path: subPath,
                 buffer,
                 characterId: charId
               });
               zipfile.readEntry();
             }, reject);
          } else {
            // Unknown file in character folder
            zipfile.readEntry();
          }
          return;
        }

        // 3. Scenarios
        // Path: Scenarios/{uuid}/scenario.json
        const scenarioMatch = fileName.match(/^Scenarios\/([^\/]+)\/(.+)$/);
        if (scenarioMatch) {
          const [, scenarioId, subPath] = scenarioMatch;

          if (!scenarioMap.has(scenarioId)) {
            scenarioMap.set(scenarioId, { id: scenarioId });
          }
          const scenarioEntry = scenarioMap.get(scenarioId)!;

          if (subPath === 'scenario.json') {
            readJsonEntry(zipfile, entry, (data: VoxtaScenario) => {
              scenarioEntry.data = data;
              zipfile.readEntry();
            }, reject);
          } else if (subPath.startsWith('thumbnail.')) {
            readBufferEntry(zipfile, entry, (buffer) => {
              scenarioEntry.thumbnail = buffer;
              zipfile.readEntry();
            }, reject);
          } else {
            zipfile.readEntry();
          }
          return;
        }

        // 4. Books
        // Path: Books/{uuid}/book.json
        const bookMatch = fileName.match(/^Books\/([^\/]+)\/(.+)$/);
        if (bookMatch) {
           const [, bookId, subPath] = bookMatch;
           
           if (!bookMap.has(bookId)) {
             bookMap.set(bookId, { id: bookId });
           }
           const bookEntry = bookMap.get(bookId)!;

           if (subPath === 'book.json') {
             readJsonEntry(zipfile, entry, (data: VoxtaBook) => {
               bookEntry.data = data;
               zipfile.readEntry();
             }, reject);
           } else {
             zipfile.readEntry();
           }
           return;
        }

        // Unknown file
        zipfile.readEntry();
      });

      zipfile.on('end', () => {
        // Assemble final results
        
        // Filter incomplete characters (must have data)
        for (const [, char] of charMap) {
          if (char.data) {
            result.characters.push(char as ExtractedVoxtaCharacter);
          }
        }

        // Filter incomplete scenarios
        for (const [, scenario] of scenarioMap) {
          if (scenario.data) {
            result.scenarios.push(scenario as ExtractedVoxtaScenario);
          }
        }

        // Filter incomplete books
        for (const [, book] of bookMap) {
          if (book.data) {
            result.books.push(book as ExtractedVoxtaBook);
          }
        }

        resolve(result);
      });

      zipfile.on('error', (err) => {
        reject(new Error(`ZIP file error: ${err.message}`));
      });

      zipfile.readEntry();
    });
  });
}

// Helper to read JSON entry
function readJsonEntry(
  zipfile: yauzl.ZipFile, 
  entry: yauzl.Entry, 
  callback: (data: any) => void,
  reject: (err: Error) => void
) {
  zipfile.openReadStream(entry, (err, stream) => {
    if (err || !stream) {
      zipfile.close();
      return reject(new Error(`Failed to read entry ${entry.fileName}: ${err?.message}`));
    }
    
    const chunks: Buffer[] = [];
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => {
      try {
        const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        callback(json);
      } catch (e) {
        zipfile.close();
        reject(new Error(`Failed to parse JSON from ${entry.fileName}: ${e}`));
      }
    });
    stream.on('error', e => {
      zipfile.close();
      reject(new Error(`Stream error for ${entry.fileName}: ${e.message}`));
    });
  });
}

// Helper to read Buffer entry
function readBufferEntry(
  zipfile: yauzl.ZipFile, 
  entry: yauzl.Entry, 
  callback: (data: Buffer) => void,
  reject: (err: Error) => void
) {
  zipfile.openReadStream(entry, (err, stream) => {
    if (err || !stream) {
      zipfile.close();
      return reject(new Error(`Failed to read entry ${entry.fileName}: ${err?.message}`));
    }
    
    const chunks: Buffer[] = [];
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => {
      callback(Buffer.concat(chunks));
    });
    stream.on('error', e => {
      zipfile.close();
      reject(new Error(`Stream error for ${entry.fileName}: ${e.message}`));
    });
  });
}
