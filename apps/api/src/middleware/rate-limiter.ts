/**
 * Rate Limiter Middleware
 *
 * Simple in-memory rate limiter for API protection.
 * Uses a sliding window approach per IP address.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (consider Redis for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Get client IP from request
 * Only trusts proxy headers when TRUST_PROXY is configured
 */
function getClientIP(request: FastifyRequest): string {
  // Only trust proxy headers if trustProxy is configured
  const trustProxy = config.security.trustProxy;

  if (trustProxy) {
    // Check X-Forwarded-For header (when behind proxy)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',');
      // If trustProxy is a number, get the IP at that position from the right
      // (the rightmost IP is added by the closest proxy)
      if (typeof trustProxy === 'number' && Array.isArray(ips)) {
        const index = Math.max(0, ips.length - trustProxy);
        return ips[index].trim();
      }
      // Otherwise just use the first IP
      return (Array.isArray(ips) ? ips[0] : ips.split(',')[0]).trim();
    }

    // Check X-Real-IP header
    const realIP = request.headers['x-real-ip'];
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }
  }

  // Fall back to connection IP (always trusted)
  return request.ip;
}

/**
 * Check if request should be rate limited
 */
function isRateLimited(ip: string): { limited: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowMs = config.security.rateLimitWindowMs;
  const maxRequests = config.security.rateLimitMax;

  let entry = rateLimitStore.get(ip);

  // Create new entry or reset if window expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(ip, entry);
    return { limited: false, remaining: maxRequests - 1, resetTime: entry.resetTime };
  }

  // Increment count
  entry.count++;

  if (entry.count > maxRequests) {
    return { limited: true, remaining: 0, resetTime: entry.resetTime };
  }

  return { limited: false, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

/**
 * Register rate limiter as Fastify hook
 */
export async function registerRateLimiter(fastify: FastifyInstance): Promise<void> {
  if (!config.security.rateLimitEnabled) {
    fastify.log.info('Rate limiting is disabled');
    return;
  }

  fastify.log.info({
    maxRequests: config.security.rateLimitMax,
    windowMs: config.security.rateLimitWindowMs,
  }, 'Rate limiter enabled');

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for health checks and static assets
    if (request.url === '/health') {
      return;
    }

    // Skip rate limiting for image/asset requests (high-frequency, low-risk)
    const url = request.url.split('?')[0]; // Remove query params
    if (
      url.startsWith('/storage/') ||
      url.startsWith('/api/assets/') ||
      url.endsWith('/image') ||
      url.endsWith('/thumbnail') ||
      url.startsWith('/api/comfyui/image')
    ) {
      return;
    }

    const ip = getClientIP(request);
    const result = isRateLimited(ip);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', config.security.rateLimitMax.toString());
    reply.header('X-RateLimit-Remaining', result.remaining.toString());
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

    if (result.limited) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      reply.header('Retry-After', retryAfter.toString());

      fastify.log.warn({ ip, url: request.url, retryAfter }, 'Rate limit exceeded');

      reply.code(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    }
  });
}

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): { activeClients: number; totalRequests: number } {
  let totalRequests = 0;
  for (const entry of rateLimitStore.values()) {
    totalRequests += entry.count;
  }
  return {
    activeClients: rateLimitStore.size,
    totalRequests,
  };
}
