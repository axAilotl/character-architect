import { promises as fs } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import pdfParse from 'pdf-parse';
import type {
  RagDatabase,
  RagDatabaseDetail,
  RagDocumentType,
  RagSnippet,
  RagSource,
} from '../types/index.js';
import { estimateTokensMany } from './tokenizer.js';
import { embedPassages, embedQuery, cosineSimilarity } from './embedding.js';
import { sanitizeFilename } from './path-security.js';

const MANIFEST_FILE = 'db.json';
const CHUNKS_FILE = 'chunks.json';
const SOURCES_DIR = 'sources';

interface RagChunk {
  id: string;
  sourceId: string;
  content: string;
  tokenCount: number;
  embedding: number[];
}

interface CreateDatabaseInput {
  label: string;
  description?: string;
  tags?: string[];
}

interface UpdateDatabaseInput {
  label?: string;
  description?: string;
  tags?: string[];
}

interface AddDocumentInput {
  dbId: string;
  title?: string;
  filename: string;
  buffer: Buffer;
  tags?: string[];
}

interface AddTextInput {
  dbId: string;
  title: string;
  content: string;
  tags?: string[];
}

interface AddLorebookInput {
  dbId: string;
  characterName: string;
  lorebook: any; // CCv2CharacterBook | CCv3CharacterBook
  tags?: string[];
}

interface SearchInput {
  dbId: string;
  query: string;
  topK: number;
  tokenCap: number;
}

async function ensureDir(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

async function readJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJSON(file: string, data: unknown): Promise<void> {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

function toSummary(manifest: RagDatabaseDetail): RagDatabase {
  return {
    id: manifest.id,
    label: manifest.label,
    description: manifest.description,
    tags: manifest.tags,
    sourceCount: manifest.sources.length,
    chunkCount: manifest.chunkCount,
    tokenCount: manifest.tokenCount,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
  };
}

function detectDocType(filename: string): RagDocumentType {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return 'text';
}

async function extractText(buffer: Buffer, type: RagDocumentType): Promise<string> {
  if (type === 'pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  const text = buffer.toString('utf-8');

  if (type === 'json') {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  }

  return text;
}

function chunkText(text: string, maxChars = 1200, overlap = 200): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n+/);
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }
    current = '';
  };

  for (const paraRaw of paragraphs) {
    const para = paraRaw.trim();
    if (!para) continue;

    if (para.length > maxChars) {
      if (current) pushCurrent();
      let index = 0;
      while (index < para.length) {
        const end = Math.min(para.length, index + maxChars);
        chunks.push(para.slice(index, end).trim());
        index = Math.max(end - overlap, index + maxChars);
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxChars && current) {
      pushCurrent();
      current = para;
    } else {
      current = candidate;
    }
  }

  if (current) pushCurrent();
  return chunks.filter((chunk) => chunk.length > 0);
}

async function loadManifest(indexPath: string, dbId: string): Promise<RagDatabaseDetail | null> {
  const dbDir = join(indexPath, dbId);
  const file = join(dbDir, MANIFEST_FILE);
  const manifest = await readJSON<RagDatabaseDetail | null>(file, null);
  if (!manifest) return null;
  manifest.sourceCount = manifest.sources.length;
  return manifest;
}

async function saveManifest(indexPath: string, manifest: RagDatabaseDetail): Promise<void> {
  const dbDir = join(indexPath, manifest.id);
  await ensureDir(dbDir);
  manifest.sourceCount = manifest.sources.length;
  await writeJSON(join(dbDir, MANIFEST_FILE), manifest);
}

async function loadChunks(indexPath: string, dbId: string): Promise<RagChunk[]> {
  const file = join(indexPath, dbId, CHUNKS_FILE);
  return readJSON<RagChunk[]>(file, []);
}

async function saveChunks(indexPath: string, dbId: string, chunks: RagChunk[]): Promise<void> {
  const dir = join(indexPath, dbId);
  await ensureDir(dir);
  const file = join(dir, CHUNKS_FILE);
  await writeJSON(file, chunks);
}

export async function listDatabases(indexPath: string): Promise<RagDatabase[]> {
  await ensureDir(indexPath);
  const entries = await fs.readdir(indexPath, { withFileTypes: true });
  const summaries: RagDatabase[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifest = await loadManifest(indexPath, entry.name);
    if (manifest) {
      summaries.push(toSummary(manifest));
    }
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDatabase(indexPath: string, dbId: string): Promise<RagDatabaseDetail | null> {
  await ensureDir(indexPath);
  return loadManifest(indexPath, dbId);
}

export async function createDatabase(
  indexPath: string,
  input: CreateDatabaseInput
): Promise<RagDatabaseDetail> {
  await ensureDir(indexPath);
  const id = nanoid(10);
  const now = new Date().toISOString();

  const manifest: RagDatabaseDetail = {
    id,
    name: input.label,
    label: input.label,
    description: input.description,
    tags: input.tags,
    sourceCount: 0,
    chunkCount: 0,
    tokenCount: 0,
    createdAt: now,
    updatedAt: now,
    sources: [],
  };

  await saveManifest(indexPath, manifest);
  await saveChunks(indexPath, id, []);

  return manifest;
}

export async function updateDatabase(
  indexPath: string,
  dbId: string,
  updates: UpdateDatabaseInput
): Promise<RagDatabaseDetail> {
  const manifest = await loadManifest(indexPath, dbId);
  if (!manifest) {
    throw new Error('Database not found');
  }

  if (typeof updates.label === 'string') {
    manifest.label = updates.label;
  }

  if (typeof updates.description === 'string') {
    manifest.description = updates.description;
  }

  if (Array.isArray(updates.tags)) {
    manifest.tags = updates.tags;
  }

  manifest.updatedAt = new Date().toISOString();
  await saveManifest(indexPath, manifest);
  return manifest;
}

export async function deleteDatabase(indexPath: string, dbId: string): Promise<void> {
  const dbDir = join(indexPath, dbId);
  await fs.rm(dbDir, { recursive: true, force: true });
}

export async function addDocument(
  indexPath: string,
  input: AddDocumentInput
): Promise<{ source: RagSource; indexedChunks: number }> {
  const manifest = await loadManifest(indexPath, input.dbId);
  if (!manifest) {
    throw new Error('Database not found');
  }

  const dbDir = join(indexPath, manifest.id);
  await ensureDir(join(dbDir, SOURCES_DIR));

  const type = detectDocType(input.filename);
  const text = await extractText(input.buffer, type);
  if (!text.trim()) {
    throw new Error('Document is empty after parsing');
  }

  const chunkTexts = chunkText(text);
  const tokenEstimates = estimateTokensMany(chunkTexts);

  // Generate embeddings for all chunks
  const embeddings = await embedPassages(chunkTexts);

  const sourceId = nanoid(12);
  const now = new Date().toISOString();
  const chunkRecords: RagChunk[] = chunkTexts.map((content, idx) => ({
    id: `${sourceId}-${idx}`,
    sourceId,
    content,
    tokenCount: tokenEstimates[idx] || 0,
    embedding: Array.from(embeddings[idx]),
  }));

  const existingChunks = await loadChunks(indexPath, manifest.id);
  const updatedChunks = [...existingChunks, ...chunkRecords];
  await saveChunks(indexPath, manifest.id, updatedChunks);

  const totalTokens = chunkRecords.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

  // Sanitize filename to prevent path traversal
  const safeFilename = sanitizeFilename(input.filename);
  const storedPath = join(SOURCES_DIR, sourceId, safeFilename);
  const relativePath = storedPath.replace(/\\/g, '/');
  await ensureDir(join(dbDir, SOURCES_DIR, sourceId));
  await fs.writeFile(join(dbDir, storedPath), input.buffer);

  const source: RagSource = {
    id: sourceId,
    databaseId: manifest.id,
    name: safeFilename,
    title: input.title || safeFilename,
    filename: safeFilename,
    path: relativePath,
    type,
    size: input.buffer.length,
    createdAt: now,
    indexed: true,
    indexedAt: now,
    chunkCount: chunkRecords.length,
    tokenCount: totalTokens,
    tags: input.tags,
  };

  manifest.sources.push(source);
  manifest.chunkCount += chunkRecords.length;
  manifest.tokenCount = (manifest.tokenCount ?? 0) + totalTokens;
  manifest.updatedAt = now;

  await saveManifest(indexPath, manifest);

  return { source, indexedChunks: chunkRecords.length };
}

export async function removeDocument(
  indexPath: string,
  dbId: string,
  sourceId: string
): Promise<void> {
  const manifest = await loadManifest(indexPath, dbId);
  if (!manifest) {
    throw new Error('Database not found');
  }

  const source = manifest.sources.find((s) => s.id === sourceId);
  if (!source) {
    throw new Error('Document not found');
  }

  const chunks = await loadChunks(indexPath, dbId);
  const remaining = chunks.filter((chunk) => chunk.sourceId !== sourceId);
  await saveChunks(indexPath, dbId, remaining);

  manifest.sources = manifest.sources.filter((s) => s.id !== sourceId);
  manifest.chunkCount = Math.max(0, manifest.chunkCount - (source.chunkCount ?? 0));
  manifest.tokenCount = Math.max(0, (manifest.tokenCount ?? 0) - (source.tokenCount ?? 0));
  manifest.updatedAt = new Date().toISOString();

  await saveManifest(indexPath, manifest);

  const sourceDir = join(indexPath, dbId, SOURCES_DIR, sourceId);
  await fs.rm(sourceDir, { recursive: true, force: true });
}

export async function searchDocuments(
  indexPath: string,
  input: SearchInput
): Promise<RagSnippet[]> {
  const manifest = await loadManifest(indexPath, input.dbId);
  if (!manifest) {
    throw new Error('Database not found');
  }

  const chunks = await loadChunks(indexPath, input.dbId);
  const query = input.query.trim();
  if (!query) return [];

  // Generate embedding for the query
  const queryEmbedding = await embedQuery(query);

  // Calculate cosine similarity between query and all chunks
  const scored = chunks
    .map((chunk) => {
      // Convert stored embedding array back to Float32Array
      const chunkEmbedding = new Float32Array(chunk.embedding);
      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

      return {
        chunk,
        score: similarity,
      };
    })
    .filter((entry) => entry.score > 0);

  // Sort by similarity score (descending)
  scored.sort((a, b) => b.score - a.score);

  const snippets: RagSnippet[] = [];
  let tokenBudget = 0;

  for (const entry of scored) {
    if (snippets.length >= input.topK) break;

    const source = manifest.sources.find((s) => s.id === entry.chunk.sourceId);
    if (!source) continue;

    if (tokenBudget + entry.chunk.tokenCount > input.tokenCap && snippets.length > 0) {
      break;
    }

    tokenBudget += entry.chunk.tokenCount;
    snippets.push({
      id: entry.chunk.id,
      databaseId: manifest.id,
      sourceId: source.id,
      sourceName: source.name,
      sourceTitle: source.title,
      content: entry.chunk.content,
      tokenCount: entry.chunk.tokenCount,
      score: entry.score,
    });
  }

  return snippets;
}

/**
 * Add free text entry to database
 * @param indexPath RAG index path
 * @param input Text entry input
 * @returns Source record and chunk count
 */
export async function addFreeText(
  indexPath: string,
  input: AddTextInput
): Promise<{ source: RagSource; indexedChunks: number }> {
  const manifest = await loadManifest(indexPath, input.dbId);
  if (!manifest) {
    throw new Error('Database not found');
  }

  const content = input.content.trim();
  if (!content) {
    throw new Error('Content cannot be empty');
  }

  const dbDir = join(indexPath, manifest.id);
  await ensureDir(join(dbDir, SOURCES_DIR));

  const chunkTexts = chunkText(content);
  const tokenEstimates = estimateTokensMany(chunkTexts);

  // Generate embeddings for all chunks
  const embeddings = await embedPassages(chunkTexts);

  const sourceId = nanoid(12);
  const now = new Date().toISOString();
  const chunkRecords: RagChunk[] = chunkTexts.map((chunkContent, idx) => ({
    id: `${sourceId}-${idx}`,
    sourceId,
    content: chunkContent,
    tokenCount: tokenEstimates[idx] || 0,
    embedding: Array.from(embeddings[idx]),
  }));

  const existingChunks = await loadChunks(indexPath, manifest.id);
  const updatedChunks = [...existingChunks, ...chunkRecords];
  await saveChunks(indexPath, manifest.id, updatedChunks);

  const totalTokens = chunkRecords.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

  // Store the original text content
  const filename = `${input.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
  const storedPath = join(SOURCES_DIR, sourceId, filename);
  const relativePath = storedPath.replace(/\\/g, '/');
  await ensureDir(join(dbDir, SOURCES_DIR, sourceId));
  await fs.writeFile(join(dbDir, storedPath), content, 'utf-8');

  const source: RagSource = {
    id: sourceId,
    databaseId: manifest.id,
    name: filename,
    title: input.title,
    filename,
    path: relativePath,
    type: 'freetext',
    size: Buffer.byteLength(content, 'utf-8'),
    createdAt: now,
    indexed: true,
    indexedAt: now,
    chunkCount: chunkRecords.length,
    tokenCount: totalTokens,
    tags: input.tags,
  };

  manifest.sources.push(source);
  manifest.chunkCount += chunkRecords.length;
  manifest.tokenCount = (manifest.tokenCount ?? 0) + totalTokens;
  manifest.updatedAt = now;

  await saveManifest(indexPath, manifest);

  return { source, indexedChunks: chunkRecords.length };
}

/**
 * Import lorebook entries into database
 * @param indexPath RAG index path
 * @param input Lorebook input
 * @returns Source record and chunk count
 */
export async function addLorebook(
  indexPath: string,
  input: AddLorebookInput
): Promise<{ source: RagSource; indexedChunks: number }> {
  const manifest = await loadManifest(indexPath, input.dbId);
  if (!manifest) {
    throw new Error('Database not found');
  }

  const { lorebook, characterName } = input;

  // Extract entries from both V2 and V3 formats
  const entries = lorebook.entries || [];
  if (entries.length === 0) {
    throw new Error('Lorebook has no entries to import');
  }

  const dbDir = join(indexPath, manifest.id);
  await ensureDir(join(dbDir, SOURCES_DIR));

  // Convert each lorebook entry to a structured text chunk
  const entryTexts: string[] = entries.map((entry: any, idx: number) => {
    const keys = Array.isArray(entry.keys) ? entry.keys.join(', ') : String(entry.keys || '');
    const secondaryKeys = entry.secondary_keys ? ` | Secondary: ${entry.secondary_keys.join(', ')}` : '';
    const content = entry.content || entry.value || '';

    return `# ${characterName} - Lorebook Entry ${idx + 1}\n\nKeywords: ${keys}${secondaryKeys}\n\n${content}`;
  });

  const allText = entryTexts.join('\n\n---\n\n');
  const chunkTexts = chunkText(allText);
  const tokenEstimates = estimateTokensMany(chunkTexts);

  // Generate embeddings for all chunks
  const embeddings = await embedPassages(chunkTexts);

  const sourceId = nanoid(12);
  const now = new Date().toISOString();
  const chunkRecords: RagChunk[] = chunkTexts.map((chunkContent, idx) => ({
    id: `${sourceId}-${idx}`,
    sourceId,
    content: chunkContent,
    tokenCount: tokenEstimates[idx] || 0,
    embedding: Array.from(embeddings[idx]),
  }));

  const existingChunks = await loadChunks(indexPath, manifest.id);
  const updatedChunks = [...existingChunks, ...chunkRecords];
  await saveChunks(indexPath, manifest.id, updatedChunks);

  const totalTokens = chunkRecords.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

  // Store the lorebook as JSON
  const filename = `${characterName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lorebook.json`;
  const storedPath = join(SOURCES_DIR, sourceId, filename);
  const relativePath = storedPath.replace(/\\/g, '/');
  await ensureDir(join(dbDir, SOURCES_DIR, sourceId));
  await writeJSON(join(dbDir, storedPath), lorebook);

  const source: RagSource = {
    id: sourceId,
    databaseId: manifest.id,
    name: filename,
    title: `${characterName} - Lorebook (${entries.length} entries)`,
    filename,
    path: relativePath,
    type: 'lorebook',
    size: JSON.stringify(lorebook).length,
    createdAt: now,
    indexed: true,
    indexedAt: now,
    chunkCount: chunkRecords.length,
    tokenCount: totalTokens,
    tags: input.tags,
  };

  manifest.sources.push(source);
  manifest.chunkCount += chunkRecords.length;
  manifest.tokenCount = (manifest.tokenCount ?? 0) + totalTokens;
  manifest.updatedAt = now;

  await saveManifest(indexPath, manifest);

  return { source, indexedChunks: chunkRecords.length };
}
