/**
 * RAG Settings Schema
 *
 * Zod schemas for RAG configuration forms.
 * Note: Database list, upload handling, and documents list stay manual.
 */

import { z } from 'zod';
import type { UIHints } from '@character-foundry/app-framework';

// RAG config schema
export const ragConfigSchema = z.object({
  enabled: z.boolean().default(false).describe('Enable RAG for LLM Assist'),
  topK: z.number().int().min(1).default(5).describe('Top-K snippets to retrieve'),
  tokenCap: z.number().int().min(200).default(2000).describe('Max tokens for RAG context'),
});

export type RagConfig = z.infer<typeof ragConfigSchema>;

export const ragConfigUiHints: UIHints<RagConfig> = {
  enabled: {
    label: 'Enable RAG for LLM Assist',
    widget: 'switch',
  },
  topK: {
    label: 'Top-K Snippets',
    helperText: 'Number of relevant snippets to retrieve.',
  },
  tokenCap: {
    label: 'Token Cap',
    helperText: 'Maximum tokens for RAG context.',
  },
};

// Create database schema
export const createDatabaseSchema = z.object({
  label: z.string().min(1).describe('Knowledge base name'),
  description: z.string().optional().describe('Optional description'),
});

export type CreateDatabase = z.infer<typeof createDatabaseSchema>;

export const createDatabaseUiHints: UIHints<CreateDatabase> = {
  label: {
    label: 'Name',
    placeholder: 'e.g., Warhammer 40K Lore',
  },
  description: {
    label: 'Description',
    widget: 'textarea',
    placeholder: 'Optional description',
    rows: 3,
  },
};

// Free text entry schema
export const freeTextEntrySchema = z.object({
  title: z.string().min(1).describe('Entry title'),
  content: z.string().min(1).describe('Text content'),
});

export type FreeTextEntry = z.infer<typeof freeTextEntrySchema>;

export const freeTextEntryUiHints: UIHints<FreeTextEntry> = {
  title: {
    label: 'Title',
    placeholder: 'e.g., Writing Guide',
  },
  content: {
    label: 'Content',
    widget: 'textarea',
    placeholder: 'Paste your documentation, notes, or guidelines here...',
    rows: 3,
  },
};
