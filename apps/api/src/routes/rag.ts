/**
 * RAG (Retrieval-Augmented Generation) Routes
 * Provides document indexing and semantic search capabilities
 */

import type { FastifyInstance } from 'fastify';
import type { RagSnippet, RagSource } from '@card-architect/schemas';
import { getSettings } from '../utils/settings.js';

/**
 * Simple in-memory RAG implementation
 * Production would use proper vector database (Chroma, Pinecone, etc.)
 */
const ragIndex: Map<string, { content: string; source: string; embedding?: number[] }> = new Map();

export async function ragRoutes(fastify: FastifyInstance) {
  /**
   * Search RAG index
   */
  fastify.get<{
    Querystring: { q: string; k?: string; tokenCap?: string };
  }>('/api/rag/search', async (request, reply) => {
    try {
      const { q, k, tokenCap } = request.query;
      const settings = await getSettings();

      if (!settings.rag.enabled) {
        return reply.send({ snippets: [] });
      }

      const topK = k ? parseInt(k) : settings.rag.topK;
      const maxTokens = tokenCap ? parseInt(tokenCap) : settings.rag.tokenCap;

      // Simple keyword-based search (production would use embeddings + vector similarity)
      const results: RagSnippet[] = [];
      const queryLower = q.toLowerCase();

      for (const [id, doc] of ragIndex.entries()) {
        const contentLower = doc.content.toLowerCase();

        // Simple scoring: count keyword matches
        const keywords = queryLower.split(/\s+/);
        let score = 0;

        for (const keyword of keywords) {
          const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
          score += matches;
        }

        if (score > 0) {
          results.push({
            content: doc.content,
            source: doc.source,
            score,
          });
        }
      }

      // Sort by score and limit
      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, topK);

      // TODO: Enforce token cap by truncating snippets
      reply.send({ snippets: topResults });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Index a document
   */
  fastify.post<{
    Body: { source: RagSource; content: string };
  }>('/api/rag/index', async (request, reply) => {
    try {
      const { source, content } = request.body;

      // Chunk the content (simple line-based chunking)
      const chunks = chunkText(content, 500); // ~500 chars per chunk

      let indexed = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${source.id}-chunk-${i}`;
        ragIndex.set(chunkId, {
          content: chunks[i],
          source: source.title || source.path,
        });
        indexed++;
      }

      reply.send({ success: true, indexed });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Clear RAG index
   */
  fastify.delete('/api/rag/index', async (request, reply) => {
    ragIndex.clear();
    reply.send({ success: true });
  });

  /**
   * Get index stats
   */
  fastify.get('/api/rag/stats', async (request, reply) => {
    reply.send({
      chunks: ragIndex.size,
      sources: new Set([...ragIndex.values()].map((d) => d.source)).size,
    });
  });
}

/**
 * Simple text chunking by paragraphs and max size
 */
function chunkText(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxChars && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
