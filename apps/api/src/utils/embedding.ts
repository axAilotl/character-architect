/**
 * Embedding service using FastEmbed
 * Provides vector embeddings for semantic search in RAG system
 */

import { EmbeddingModel, FlagEmbedding } from 'fastembed';

let embeddingModel: FlagEmbedding | null = null;

/**
 * Initialize the embedding model (lazy loading)
 */
async function ensureModel(): Promise<FlagEmbedding> {
  if (embeddingModel) {
    return embeddingModel;
  }

  // Use BGE Small EN v1.5 as default - good balance of speed and quality
  embeddingModel = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallENV15,
  });

  return embeddingModel;
}

/**
 * Generate embeddings for passages (documents/chunks)
 * @param texts Array of text strings to embed
 * @param batchSize Number of texts to process per batch (default: 32)
 * @returns Array of Float32Array embeddings
 */
export async function embedPassages(texts: string[], batchSize = 32): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  const model = await ensureModel();

  // Prefix passages for better retrieval (recommended by BGE models)
  const prefixedTexts = texts.map(text => `passage: ${text}`);

  const embeddings: Float32Array[] = [];
  const generator = model.embed(prefixedTexts, batchSize);

  for await (const batch of generator) {
    embeddings.push(...batch);
  }

  return embeddings;
}

/**
 * Generate embedding for a single query
 * @param query Query text
 * @returns Float32Array embedding
 */
export async function embedQuery(query: string): Promise<Float32Array> {
  if (!query.trim()) {
    throw new Error('Query cannot be empty');
  }

  const model = await ensureModel();

  // Prefix query for better retrieval
  const embedding = await model.queryEmbed(`query: ${query}`);

  return embedding;
}

/**
 * Calculate cosine similarity between two vectors
 * @param a First vector
 * @param b Second vector
 * @returns Similarity score (0-1, higher is more similar)
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Get model information
 */
export function getModelInfo(): {
  name: string;
  dimensions: number;
  description: string;
} {
  return {
    name: 'BAAI/bge-small-en-v1.5',
    dimensions: 384, // BGE Small produces 384-dimensional embeddings
    description: 'Fast and accurate English embedding model, top performer on MTEB leaderboard',
  };
}
