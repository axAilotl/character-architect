/**
 * Backup/Restore Routes
 *
 * API endpoints for creating and restoring full database backups.
 */

import type { FastifyInstance } from 'fastify';
import { BackupService } from '../services/backup.service.js';
import { config } from '../config.js';

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

      const zipBuffer = await backupService.createBackup({
        includeVersions,
        includePresets,
      });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `character-architect-backup-${timestamp}.zip`;

      fastify.log.info({
        size: zipBuffer.length,
        filename,
      }, 'Backup created successfully');

      // Return ZIP file
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', zipBuffer.length);

      return reply.send(zipBuffer);
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
      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: 'No file provided' };
      }

      const buffer = await data.toBuffer();
      const mode = request.query.mode || 'merge';
      const skipConflicts = request.query.skipConflicts === 'true';

      if (mode !== 'replace' && mode !== 'merge') {
        reply.code(400);
        return { error: 'Invalid mode. Must be "replace" or "merge"' };
      }

      fastify.log.info({
        filename: data.filename,
        size: buffer.length,
        mode,
        skipConflicts,
      }, 'Starting backup restore');

      const result = await backupService.restoreBackup(buffer, {
        mode,
        skipConflicts,
      });

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

      const buffer = await data.toBuffer();

      fastify.log.info({
        filename: data.filename,
        size: buffer.length,
      }, 'Validating backup');

      const validation = await backupService.validateBackup(buffer);

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

      const buffer = await data.toBuffer();

      fastify.log.info({
        filename: data.filename,
        size: buffer.length,
      }, 'Previewing backup');

      const preview = await backupService.previewBackup(buffer);

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
