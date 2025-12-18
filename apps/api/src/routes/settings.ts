import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join, dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { isFilenameSafe, sanitizeFilename } from '../utils/path-security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to store settings JSON
const SETTINGS_PATH = join(__dirname, '../../data/settings.json');
// Path to store theme images
const THEME_IMAGES_PATH = join(__dirname, '../../themes/images');

interface Settings {
  sillyTavern?: {
    enabled: boolean;
    baseUrl: string;
    importEndpoint: string;
    sessionCookie: string;
  };
}

function loadSettings(): Settings {
  if (!existsSync(SETTINGS_PATH)) {
    return {};
  }
  try {
    const data = readFileSync(SETTINGS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function saveSettings(settings: Settings) {
  const dir = dirname(SETTINGS_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get all settings
  fastify.get('/settings', async () => {
    const settings = loadSettings();
    return { settings };
  });

  // Update SillyTavern settings
  fastify.patch<{
    Body: {
      sillyTavern?: {
        enabled: boolean;
        baseUrl: string;
        importEndpoint: string;
        sessionCookie: string;
      };
    };
  }>('/settings/sillytavern', async (request) => {
    const settings = loadSettings();

    if (request.body.sillyTavern) {
      settings.sillyTavern = request.body.sillyTavern;
      saveSettings(settings);
    }

    return { success: true, settings: settings.sillyTavern };
  });

  // Get SillyTavern settings specifically
  fastify.get('/settings/sillytavern', async () => {
    const settings = loadSettings();
    return { settings: settings.sillyTavern || { enabled: false, baseUrl: '', importEndpoint: '/api/characters/import', sessionCookie: '' } };
  });

  // Theme image upload
  fastify.post('/settings/theme/background', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      return { error: 'No file uploaded' };
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(data.mimetype)) {
      reply.code(400);
      return { error: 'Invalid file type. Allowed: PNG, JPEG, WebP, GIF' };
    }

    // Ensure directory exists
    if (!existsSync(THEME_IMAGES_PATH)) {
      mkdirSync(THEME_IMAGES_PATH, { recursive: true });
    }

    // Generate unique filename
    const ext = extname(data.filename) || `.${data.mimetype.split('/')[1]}`;
    const filename = `bg-${randomUUID()}${ext}`;
    const filepath = join(THEME_IMAGES_PATH, filename);

    // Save file
    const buffer = await data.toBuffer();
    writeFileSync(filepath, buffer);

    // Return the URL path to access the image
    return {
      success: true,
      filename,
      url: `/api/settings/theme/images/${filename}`
    };
  });

  // Serve theme images
  fastify.get<{ Params: { filename: string } }>('/settings/theme/images/:filename', async (request, reply) => {
    const { filename } = request.params;

    // Path traversal protection
    if (!isFilenameSafe(filename)) {
      reply.code(400);
      return { error: 'Invalid filename' };
    }

    const safeFilename = sanitizeFilename(filename);
    const filepath = join(THEME_IMAGES_PATH, safeFilename);

    // Verify the path is within THEME_IMAGES_PATH
    const resolvedPath = resolve(filepath);
    const resolvedBase = resolve(THEME_IMAGES_PATH);
    if (!resolvedPath.startsWith(resolvedBase)) {
      reply.code(400);
      return { error: 'Invalid filename' };
    }

    if (!existsSync(filepath)) {
      reply.code(404);
      return { error: 'Image not found' };
    }

    // Determine content type
    const ext = extname(safeFilename).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    const buffer = readFileSync(filepath);

    reply.type(contentType);
    return reply.send(buffer);
  });

  // Delete theme background image
  fastify.delete<{ Params: { filename: string } }>('/settings/theme/images/:filename', async (request, reply) => {
    const { filename } = request.params;

    // Path traversal protection
    if (!isFilenameSafe(filename)) {
      reply.code(400);
      return { error: 'Invalid filename' };
    }

    const safeFilename = sanitizeFilename(filename);
    const filepath = join(THEME_IMAGES_PATH, safeFilename);

    // Verify the path is within THEME_IMAGES_PATH
    const resolvedPath = resolve(filepath);
    const resolvedBase = resolve(THEME_IMAGES_PATH);
    if (!resolvedPath.startsWith(resolvedBase)) {
      reply.code(400);
      return { error: 'Invalid filename' };
    }

    if (!existsSync(filepath)) {
      reply.code(404);
      return { error: 'Image not found' };
    }

    try {
      unlinkSync(filepath);
      return { success: true };
    } catch (err) {
      reply.code(500);
      return { error: 'Failed to delete image' };
    }
  });

  // List all theme images
  fastify.get('/settings/theme/images', async () => {
    if (!existsSync(THEME_IMAGES_PATH)) {
      return { images: [] };
    }

    const files = readdirSync(THEME_IMAGES_PATH);
    const images = files
      .filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f))
      .map(f => ({
        filename: f,
        url: `/api/settings/theme/images/${f}`,
      }));

    return { images };
  });
}
