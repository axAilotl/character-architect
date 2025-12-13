/**
 * Zod validation middleware for Fastify routes
 *
 * Usage:
 * ```typescript
 * import { validateBody } from '../middleware/validate.js';
 * import { createCardSchema, type CreateCardInput } from '../schemas/index.js';
 *
 * fastify.post('/cards', async (request, reply) => {
 *   const result = validateBody(createCardSchema, request.body, reply);
 *   if (!result.success) return; // Reply already sent
 *   const { data, meta } = result.data;
 *   // ...
 * });
 * ```
 */

import type { FastifyReply } from 'fastify';
import type { ZodSchema, ZodError } from 'zod';

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate request body against a Zod schema.
 * On failure, sends a 400 response and returns { success: false }.
 * On success, returns { success: true, data: validated }.
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown,
  reply: FastifyReply
): ValidationResult<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    const formatted = formatZodError(result.error);
    reply.status(400).send({
      error: 'Validation failed',
      details: formatted,
    });
    return { success: false };
  }

  return { success: true, data: result.data };
}

/**
 * Validate query params against a Zod schema.
 * Same behavior as validateBody but for query strings.
 */
export function validateQuery<T>(
  schema: ZodSchema<T>,
  query: unknown,
  reply: FastifyReply
): ValidationResult<T> {
  const result = schema.safeParse(query);

  if (!result.success) {
    const formatted = formatZodError(result.error);
    reply.status(400).send({
      error: 'Invalid query parameters',
      details: formatted,
    });
    return { success: false };
  }

  return { success: true, data: result.data };
}

/**
 * Format Zod error into a more readable structure
 */
function formatZodError(error: ZodError): {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
} {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (path) {
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    } else {
      formErrors.push(issue.message);
    }
  }

  return { fieldErrors, formErrors };
}
