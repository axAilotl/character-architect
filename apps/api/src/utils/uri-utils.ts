/**
 * URI utilities for handling different asset URI schemes
 * Supports: embeded://, ccdefault:, https://, http://, data:, file://
 */

export type URIScheme = 'embeded' | 'ccdefault' | 'https' | 'http' | 'data' | 'file' | 'internal' | 'unknown';

export interface ParsedURI {
  scheme: URIScheme;
  originalUri: string;
  path?: string; // For embeded://, file://
  url?: string; // For http://, https://
  data?: string; // For data: URIs
  mimeType?: string; // For data: URIs
  encoding?: string; // For data: URIs (e.g., base64)
}

/**
 * Parse a URI and determine its scheme and components
 */
export function parseURI(uri: string): ParsedURI {
  const trimmed = uri.trim();

  // ccdefault: - use default asset
  if (trimmed === 'ccdefault:' || trimmed.startsWith('ccdefault:')) {
    return {
      scheme: 'ccdefault',
      originalUri: uri,
    };
  }

  // embeded:// - note the typo is intentional for CHARX compatibility
  if (trimmed.startsWith('embeded://')) {
    const path = trimmed.substring('embeded://'.length);
    return {
      scheme: 'embeded',
      originalUri: uri,
      path,
    };
  }

  // https://
  if (trimmed.startsWith('https://')) {
    return {
      scheme: 'https',
      originalUri: uri,
      url: trimmed,
    };
  }

  // http://
  if (trimmed.startsWith('http://')) {
    return {
      scheme: 'http',
      originalUri: uri,
      url: trimmed,
    };
  }

  // data: URIs
  if (trimmed.startsWith('data:')) {
    const parsed = parseDataURI(trimmed);
    return {
      scheme: 'data',
      originalUri: uri,
      ...parsed,
    };
  }

  // file://
  if (trimmed.startsWith('file://')) {
    const path = trimmed.substring('file://'.length);
    return {
      scheme: 'file',
      originalUri: uri,
      path,
    };
  }

  // Internal asset ID (UUID format)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      scheme: 'internal',
      originalUri: uri,
      path: trimmed,
    };
  }

  // Unknown scheme
  return {
    scheme: 'unknown',
    originalUri: uri,
  };
}

/**
 * Parse a data URI into its components
 * Format: data:[<mediatype>][;base64],<data>
 */
function parseDataURI(uri: string): { mimeType?: string; encoding?: string; data?: string } {
  const match = uri.match(/^data:([^;,]+)?(;base64)?,(.*)$/);

  if (!match) {
    return {};
  }

  return {
    mimeType: match[1] || 'text/plain',
    encoding: match[2] ? 'base64' : undefined,
    data: match[3],
  };
}

/**
 * Convert an internal asset ID to a public URL
 */
export function assetIdToURL(assetId: string, baseURL: string = ''): string {
  return `${baseURL}/assets/${assetId}`;
}

/**
 * Convert a CHARX embeded:// path to an internal reference
 */
export function embedToInternal(embedPath: string): string {
  // Remove embeded:// prefix if present
  const path = embedPath.startsWith('embeded://') ? embedPath.substring('embeded://'.length) : embedPath;

  // Extract filename or use the full path as reference
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

/**
 * Convert an internal asset ID to a CHARX embeded:// URI
 */
export function internalToEmbed(_assetId: string, type: string, ext: string, index: number): string {
  // Organize by type following CHARX conventions
  let subdir = 'other';

  if (type === 'icon') {
    subdir = 'icon';
  } else if (type === 'background') {
    subdir = 'background';
  } else if (type === 'emotion') {
    subdir = 'emotion';
  } else if (type === 'user_icon') {
    subdir = 'user_icon';
  }

  // Determine media subdirectory
  const mediaType = isImageExt(ext) ? 'image' : isAudioExt(ext) ? 'audio' : isVideoExt(ext) ? 'video' : 'other';

  return `embeded://assets/${subdir}/${mediaType}/${index}.${ext}`;
}

/**
 * Check if extension is an image format
 */
function isImageExt(ext: string): boolean {
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg'];
  return imageExts.includes(ext.toLowerCase());
}

/**
 * Check if extension is an audio format
 */
function isAudioExt(ext: string): boolean {
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
  return audioExts.includes(ext.toLowerCase());
}

/**
 * Check if extension is a video format
 */
function isVideoExt(ext: string): boolean {
  const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
  return videoExts.includes(ext.toLowerCase());
}

/**
 * Validate if a URI is safe to use
 */
export function isURISafe(uri: string, options: { allowHttp?: boolean; allowFile?: boolean } = {}): boolean {
  const parsed = parseURI(uri);

  switch (parsed.scheme) {
    case 'embeded':
    case 'ccdefault':
    case 'internal':
    case 'data':
    case 'https':
      return true;

    case 'http':
      return options.allowHttp === true;

    case 'file':
      return options.allowFile === true;

    case 'unknown':
    default:
      return false;
  }
}

/**
 * Extract file extension from URI
 */
export function getExtensionFromURI(uri: string): string {
  const parsed = parseURI(uri);

  if (parsed.path) {
    const parts = parsed.path.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }
  }

  if (parsed.url) {
    const urlParts = parsed.url.split('?')[0].split('.');
    if (urlParts.length > 1) {
      return urlParts[urlParts.length - 1].toLowerCase();
    }
  }

  if (parsed.mimeType) {
    // Convert MIME type to extension
    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
      'image/svg+xml': 'svg',
    };
    return mimeToExt[parsed.mimeType] || 'bin';
  }

  return 'unknown';
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExt(ext: string): string {
  const extToMime: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'avif': 'image/avif',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
  };

  return extToMime[ext.toLowerCase()] || 'application/octet-stream';
}
