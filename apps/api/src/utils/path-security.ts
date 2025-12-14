/**
 * Path Security Utilities
 *
 * Sanitizes filenames and paths to prevent path traversal attacks.
 */

import { basename, resolve, relative, isAbsolute } from 'path';

/**
 * Sanitize a filename to prevent path traversal
 * Removes directory components and dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }

  // Get only the base filename (strip directory components)
  let safe = basename(filename);

  // Remove null bytes
  safe = safe.replace(/\0/g, '');

  // Remove path traversal sequences that might survive basename
  safe = safe.replace(/\.\./g, '');

  // Remove leading dots (hidden files)
  safe = safe.replace(/^\.+/, '');

  // Remove dangerous characters
  safe = safe.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');

  // Ensure we have something left
  if (!safe || safe.length === 0) {
    return 'unnamed';
  }

  // Limit length
  if (safe.length > 255) {
    const ext = safe.lastIndexOf('.');
    if (ext > 0) {
      const extension = safe.slice(ext);
      const name = safe.slice(0, 255 - extension.length);
      safe = name + extension;
    } else {
      safe = safe.slice(0, 255);
    }
  }

  return safe;
}

/**
 * Validate that a path is safely contained within a base directory
 * Returns the safe resolved path or null if unsafe
 */
export function safeJoin(baseDir: string, ...paths: string[]): string | null {
  // Resolve the base directory to an absolute path
  const resolvedBase = resolve(baseDir);

  // Sanitize each path component
  const sanitizedPaths = paths.map(p => sanitizeFilename(p));

  // Join and resolve the full path
  const resolvedPath = resolve(resolvedBase, ...sanitizedPaths);

  // Ensure the resolved path is within the base directory
  const relativePath = relative(resolvedBase, resolvedPath);

  // If the relative path starts with '..' or is absolute, it escapes the base
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return null;
  }

  return resolvedPath;
}

/**
 * Check if a filename is safe (no path traversal)
 */
export function isFilenameSafe(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Check for obvious path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    return false;
  }

  // Check for control characters
  if (/[\x00-\x1f]/.test(filename)) {
    return false;
  }

  return true;
}
