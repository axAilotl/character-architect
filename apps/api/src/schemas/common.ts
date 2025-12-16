/**
 * Common Zod schemas shared across routes
 */

import { z } from 'zod';

// Pagination with sane defaults
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Card spec
export const specSchema = z.enum(['v2', 'v3', 'chara_card_v2', 'chara_card_v3', 'collection', 'lorebook']);

// UUID pattern (loose - allows any string for backwards compat)
export const idSchema = z.string().min(1);

// Common string constraints
export const nameSchema = z.string().min(1).max(200);
export const descriptionSchema = z.string().max(5000).optional();

export type Pagination = z.infer<typeof paginationSchema>;
export type Spec = z.infer<typeof specSchema>;
