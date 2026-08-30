/**
 * Backup/Restore Routes
 *
 * API endpoints for creating and restoring full database backups.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { BackupService } from '../services/backup.service.js';
import { config } from '../config.js';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import { tmpdir } from 'os';
import { join } from 'path';

type MultipartUpload = NonNullable<Awaited<ReturnType<FastifyRequest['file']>>>;

interface StagedUpload {
  buffer: Buffer;
  size: number;
  cleanup: () => Promise<void>;
}

async function stageBackupUpload(data: MultipartUpload): Promise<StagedUpload> {
  const temporaryDirectory = await fs.mkdtemp(join(tmpdir(), 'character-architect-upload-'));
  const uploadPath = join(temporaryDirectory, 'backup.zip');
  let size = 0;
  data.file.on('data', (chunk: Buffer | string) => {
    size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
  });

  try {
    await pipeline(data.file, createWriteStream(uploadPath, { mode: 0o600 }));
    if (data.file.truncated || size > config.limits.maxBackupSizeMB * 1024 * 1024) {
      throw new Error(`Backup exceeds ${config.limits.maxBackupSizeMB} MB upload limit`);
    }
    return {
      buffer: await fs.readFile(uploadPath),
      size,
      cleanup: () => fs.rm(temporaryDirectory, { recursive: true, force: true }),
    };
  } catch (error) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

export async function backupRoutes(fastify: FastifyInstance) {
  const backupService = new BackupService(fastify.db, config.storagePath);

  /**
   * POST /api/backup
   * Create a backup ZIP
   *
   * Body: { includeVersions?: boolean, includePresets?: boolean }
   * Response: ZIP file stream with Content-Disposition attachment
   */
  fastify.post<{
    Body: {
      includeVersions?: boolean;
      includePresets?: boolean;
    };
  }>('/backup', async (request, reply) => {
    try {
      const { includeVersions = true, includePresets = true } = request.body || {};

      fastify.log.info({
        includeVersions,
        includePresets,
      }, 'Creating backup');

      const archive = await backupService.createBackupArchive({
        includeVersions,
        includePresets,
      });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `character-architect-backup-${timestamp}.zip`;

      fastify.log.info({
        size: archive.size,
        filename,
      }, 'Backup created successfully');

      // Return ZIP file
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', archive.size);

      const stream = createReadStream(archive.path);
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        void archive.cleanup().catch((error) => fastify.log.warn({ error }, 'Failed to clean up staged backup'));
      };
      stream.once('close', cleanup);
      reply.raw.once('close', cleanup);
      return reply.send(stream);
    } catch (err) {
      fastify.log.error({ error: err }, 'Failed to create backup');
      reply.code(500);
      return {
        error: `Failed to create backup: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  /**
   * POST /api/backup/restore
   * Restore from a backup ZIP
   *
   * Request: multipart/form-data with 'file' field
   * Query: ?mode=replace|merge&skipConflicts=true|false
   * Response: { success: boolean, imported: {...}, errors: [...] }
   */
  fastify.post<{
    Querystring: {
      mode?: 'replace' | 'merge';
      skipConflicts?: string;
    };
  }>('/backup/restore', async (request, reply) => {
    try {
      const mode = request.query.mode || 'merge';
      if (mode !== 'replace' && mode !== 'merge') {
        reply.code(400);
        return { error: 'Invalid mode. Must be "replace" or "merge"' };
      }

      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: 'No file provided' };
      }

      const upload = await stageBackupUpload(data);
      const skipConflicts = request.query.skipConflicts === 'true';

      let result;
      try {
        fastify.log.info({
          filename: data.filename,
          size: upload.size,
          mode,
          skipConflicts,
        }, 'Starting backup restore');

        result = await backupService.restoreBackup(upload.buffer, {
          mode,
          skipConflicts,
        });
      } finally {
        await upload.cleanup();
      }

      fastify.log.info({
        success: result.success,
        imported: result.imported,
        skipped: result.skipped,
        errorCount: result.errors.length,
      }, 'Backup restore completed');

      if (!result.success) {
        reply.code(400);
      }

      return result;
    } catch (err) {
      fastify.log.error({ error: err }, 'Failed to restore backup');
      reply.code(500);
      return {
        success: false,
        error: `Failed to restore backup: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  /**
   * POST /api/backup/validate
   * Validate a backup ZIP without restoring
   *
   * Request: multipart/form-data with 'file' field
   * Response: { valid: boolean, manifest?: {...}, errors: [...] }
   */
  fastify.post('/backup/validate', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: 'No file provided' };
      }

      const upload = await stageBackupUpload(data);

      let validation;
      try {
        fastify.log.info({
          filename: data.filename,
          size: upload.size,
        }, 'Validating backup');

        validation = await backupService.validateBackup(upload.buffer);
      } finally {
        await upload.cleanup();
      }

      fastify.log.info({
        valid: validation.valid,
        errorCount: validation.errors.length,
      }, 'Backup validation completed');

      if (!validation.valid) {
        reply.code(400);
      }

      return validation;
    } catch (err) {
      fastify.log.error({ error: err }, 'Failed to validate backup');
      reply.code(500);
      return {
        valid: false,
        error: `Failed to validate backup: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  /**
   * POST /api/backup/preview
   * Preview backup contents without restoring
   *
   * Request: multipart/form-data with 'file' field
   * Response: { manifest: {...}, cardNames: string[] }
   */
  fastify.post('/backup/preview', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: 'No file provided' };
      }

      const upload = await stageBackupUpload(data);

      let preview;
      try {
        fastify.log.info({
          filename: data.filename,
          size: upload.size,
        }, 'Previewing backup');

        preview = await backupService.previewBackup(upload.buffer);
      } finally {
        await upload.cleanup();
      }

      fastify.log.info({
        cardCount: preview.cardNames.length,
      }, 'Backup preview completed');

      return preview;
    } catch (err) {
      fastify.log.error({ error: err }, 'Failed to preview backup');
      reply.code(400);
      return {
        error: `Failed to preview backup: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
}
