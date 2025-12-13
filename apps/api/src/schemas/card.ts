/**
 * Card route schemas
 */

import { z } from 'zod';
import { specSchema } from './common.js';

// Card meta for creation/updates
const cardMetaSchema = z.object({
  name: z.string().optional(),
  spec: specSchema.optional(),
  tags: z.array(z.string()).optional(),
  creator: z.string().optional(),
  characterVersion: z.string().optional(),
  rating: z.enum(['SFW', 'NSFW']).optional(),
  packageId: z.string().optional(),
  memberCount: z.number().int().nonnegative().optional(),
}).optional();

// Create card request
export const createCardSchema = z.object({
  data: z.record(z.unknown()),
  meta: cardMetaSchema,
});

// Update card request
export const updateCardSchema = z.object({
  data: z.record(z.unknown()).optional(),
  meta: cardMetaSchema,
});

// Create version request
export const createVersionSchema = z.object({
  message: z.string().max(500).optional(),
});

// Query params for list
export const listCardsQuerySchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
export type ListCardsQuery = z.infer<typeof listCardsQuerySchema>;
