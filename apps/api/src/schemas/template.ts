/**
 * Template and Snippet route schemas
 */

import { z } from 'zod';

// Template content structure
const templateContentSchema = z.record(z.string().optional());

// Create template request
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  targetFields: z.union([z.string(), z.array(z.string())]).optional(),
  content: templateContentSchema.optional(),
});

// Update template request
export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  targetFields: z.union([z.string(), z.array(z.string())]).optional(),
  content: templateContentSchema.optional(),
});

// Import templates request
export const importTemplatesSchema = z.object({
  templates: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    category: z.string().max(50).optional(),
    targetFields: z.union([z.string(), z.array(z.string())]).optional(),
    content: templateContentSchema.optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    isDefault: z.boolean().optional(),
  })),
  replace: z.boolean().optional(),
});

// Create snippet request
export const createSnippetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  content: z.string().max(50000).optional(),
});

// Update snippet request
export const updateSnippetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  content: z.string().max(50000).optional(),
});

// Import snippets request
export const importSnippetsSchema = z.object({
  snippets: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    category: z.string().max(50).optional(),
    content: z.string().max(50000).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    isDefault: z.boolean().optional(),
  })),
  replace: z.boolean().optional(),
});

// ELARA VOSS name schema
export const elaraVossNameSchema = z.object({
  gender: z.enum(['male', 'female', 'neutral']),
  type: z.enum(['first', 'last']),
  name: z.string().min(1).max(100),
});

// Import ELARA VOSS names request
export const importElaraVossNamesSchema = z.object({
  names: z.array(elaraVossNameSchema),
  merge: z.boolean().optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ImportTemplatesInput = z.infer<typeof importTemplatesSchema>;
export type CreateSnippetInput = z.infer<typeof createSnippetSchema>;
export type UpdateSnippetInput = z.infer<typeof updateSnippetSchema>;
export type ImportSnippetsInput = z.infer<typeof importSnippetsSchema>;
export type ElaraVossName = z.infer<typeof elaraVossNameSchema>;
export type ImportElaraVossNamesInput = z.infer<typeof importElaraVossNamesSchema>;
