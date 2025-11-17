/**
 * RAG (Retrieval-Augmented Generation) Routes
 * Persistent knowledge base management and semantic search
 */

import type { FastifyInstance } from 'fastify';
import { getSettings, saveSettings } from '../utils/settings.js';
import {
  listDatabases,
  createDatabase,
  getDatabase,
  updateDatabase,
  deleteDatabase,
  addDocument,
  addFreeText,
  addLorebook,
  removeDocument,
  searchDocuments,
} from '../utils/rag-store.js';
import type { Multipart } from '@fastify/multipart';

function parseTags(value?: string | string[]): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map((tag) => tag.trim()).filter(Boolean);
  }

  const text = value.trim();
  if (!text) return undefined;

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    // treat as comma-separated string
  }

  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function extractFieldText(field?: Multipart | Multipart[]): string | undefined {
  if (!field) return undefined;
  const target = Array.isArray(field) ? field[0] : field;
  if (!target || target.type !== 'field') return undefined;
  const value = target.value;
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) {
    return value.toString('utf-8');
  }
  return undefined;
}

export async function ragRoutes(fastify: FastifyInstance) {
  /**
   * List databases
   */
  fastify.get('/rag/databases', async (_request, reply) => {
    try {
      const settings = await getSettings();
      const databases = await listDatabases(settings.rag.indexPath);
      reply.send({ databases, activeDatabaseId: settings.rag.activeDatabaseId ?? null });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Create database
   */
  fastify.post<{
    Body: { label: string; description?: string; tags?: string[] };
  }>('/rag/databases', async (request, reply) => {
    try {
      const { label, description, tags } = request.body;
      if (!label?.trim()) {
        return reply.status(400).send({ error: 'Label is required' });
      }

      const settings = await getSettings();
      const database = await createDatabase(settings.rag.indexPath, {
        label: label.trim(),
        description,
        tags,
      });

      // If no active DB set, default to the first created one
      if (!settings.rag.activeDatabaseId) {
        settings.rag.activeDatabaseId = database.id;
        await saveSettings(settings);
      }

      reply.send({ database });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Get database detail
   */
  fastify.get<{
    Params: { dbId: string };
  }>('/rag/databases/:dbId', async (request, reply) => {
    try {
      const settings = await getSettings();
      const database = await getDatabase(settings.rag.indexPath, request.params.dbId);
      if (!database) {
        return reply.status(404).send({ error: 'Database not found' });
      }
      reply.send({ database });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Update database metadata
   */
  fastify.patch<{
    Params: { dbId: string };
    Body: { label?: string; description?: string; tags?: string[] };
  }>('/rag/databases/:dbId', async (request, reply) => {
    try {
      const settings = await getSettings();
      const database = await updateDatabase(settings.rag.indexPath, request.params.dbId, request.body);
      reply.send({ database });
    } catch (error: any) {
      fastify.log.error(error);
      if (error.message === 'Database not found') {
        reply.status(404).send({ error: error.message });
      } else {
        reply.status(500).send({ error: error.message });
      }
    }
  });

  /**
   * Delete database
   */
  fastify.delete<{
    Params: { dbId: string };
  }>('/rag/databases/:dbId', async (request, reply) => {
    try {
      const settings = await getSettings();
      await deleteDatabase(settings.rag.indexPath, request.params.dbId);

      if (settings.rag.activeDatabaseId === request.params.dbId) {
        settings.rag.activeDatabaseId = undefined;
        await saveSettings(settings);
      }

      reply.send({ success: true });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Upload and index document
   */
  fastify.post<{
    Params: { dbId: string };
  }>('/rag/databases/:dbId/documents', async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const settings = await getSettings();
      const buffer = await file.toBuffer();
      const title = extractFieldText(file.fields?.title);
      const tags = parseTags(extractFieldText(file.fields?.tags));

      const result = await addDocument(settings.rag.indexPath, {
        dbId: request.params.dbId,
        title,
        filename: file.filename,
        buffer,
        tags,
      });

      reply.send({ source: result.source, indexedChunks: result.indexedChunks });
    } catch (error: any) {
      fastify.log.error(error);
      if (error.message === 'Database not found') {
        reply.status(404).send({ error: error.message });
      } else {
        reply.status(500).send({ error: error.message });
      }
    }
  });

  /**
   * Add free text entry to database
   */
  fastify.post<{
    Params: { dbId: string };
    Body: { title: string; content: string; tags?: string[] };
  }>('/rag/databases/:dbId/text', async (request, reply) => {
    try {
      const { title, content, tags } = request.body;

      if (!title?.trim()) {
        return reply.status(400).send({ error: 'Title is required' });
      }

      if (!content?.trim()) {
        return reply.status(400).send({ error: 'Content is required' });
      }

      const settings = await getSettings();
      const result = await addFreeText(settings.rag.indexPath, {
        dbId: request.params.dbId,
        title: title.trim(),
        content: content.trim(),
        tags,
      });

      reply.send({ source: result.source, indexedChunks: result.indexedChunks });
    } catch (error: any) {
      fastify.log.error(error);
      if (error.message === 'Database not found') {
        reply.status(404).send({ error: error.message });
      } else {
        reply.status(500).send({ error: error.message });
      }
    }
  });

  /**
   * Import lorebook into database
   */
  fastify.post<{
    Params: { dbId: string };
    Body: { characterName: string; lorebook: any; tags?: string[] };
  }>('/rag/databases/:dbId/lorebook', async (request, reply) => {
    try {
      const { characterName, lorebook, tags } = request.body;

      if (!characterName?.trim()) {
        return reply.status(400).send({ error: 'Character name is required' });
      }

      if (!lorebook || typeof lorebook !== 'object') {
        return reply.status(400).send({ error: 'Valid lorebook object is required' });
      }

      const settings = await getSettings();
      const result = await addLorebook(settings.rag.indexPath, {
        dbId: request.params.dbId,
        characterName: characterName.trim(),
        lorebook,
        tags,
      });

      reply.send({ source: result.source, indexedChunks: result.indexedChunks });
    } catch (error: any) {
      fastify.log.error(error);
      if (error.message === 'Database not found') {
        reply.status(404).send({ error: error.message });
      } else {
        reply.status(500).send({ error: error.message });
      }
    }
  });

  /**
   * Remove document from database
   */
  fastify.delete<{
    Params: { dbId: string; sourceId: string };
  }>('/rag/databases/:dbId/documents/:sourceId', async (request, reply) => {
    try {
      const settings = await getSettings();
      await removeDocument(
        settings.rag.indexPath,
        request.params.dbId,
        request.params.sourceId
      );
      reply.send({ success: true });
    } catch (error: any) {
      fastify.log.error(error);
      if (error.message === 'Database not found' || error.message === 'Document not found') {
        reply.status(404).send({ error: error.message });
      } else {
        reply.status(500).send({ error: error.message });
      }
    }
  });

  /**
   * Search database
   */
  fastify.get<{
    Querystring: { q: string; databaseId: string; k?: string; tokenCap?: string };
  }>('/rag/search', async (request, reply) => {
    try {
      const { q, databaseId, k, tokenCap } = request.query;
      const settings = await getSettings();

      if (!settings.rag.enabled) {
        return reply.send({ snippets: [] });
      }

      if (!q?.trim()) {
        return reply.status(400).send({ error: 'Query is required' });
      }

      if (!databaseId) {
        return reply.status(400).send({ error: 'databaseId is required' });
      }

      const topK = k ? parseInt(k, 10) : settings.rag.topK;
      const maxTokens = tokenCap ? parseInt(tokenCap, 10) : settings.rag.tokenCap;

      const snippets = await searchDocuments(settings.rag.indexPath, {
        dbId: databaseId,
        query: q,
        topK: Number.isFinite(topK) ? topK : settings.rag.topK,
        tokenCap: Number.isFinite(maxTokens) ? maxTokens : settings.rag.tokenCap,
      });

      reply.send({ snippets });
    } catch (error: any) {
      fastify.log.error(error);
      if (error.message === 'Database not found') {
        reply.status(404).send({ error: error.message });
      } else {
        reply.status(500).send({ error: error.message });
      }
    }
  });

  /**
   * Aggregate stats
   */
  fastify.get('/rag/stats', async (_request, reply) => {
    try {
      const settings = await getSettings();
      const databases = await listDatabases(settings.rag.indexPath);
      const totals = databases.reduce(
        (acc, db) => {
          acc.sources += db.sourceCount;
          acc.chunks += db.chunkCount;
          acc.tokens += db.tokenCount;
          return acc;
        },
        { sources: 0, chunks: 0, tokens: 0 }
      );

      reply.send({
        databases: databases.length,
        sources: totals.sources,
        chunks: totals.chunks,
        tokens: totals.tokens,
      });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ error: error.message });
    }
  });
}
