/**
 * ComfyUI Routes
 *
 * Minimal API for ComfyUI integration - only provides image proxy for CORS bypass.
 * The main ComfyUI interaction happens via iframe with postMessage bridge.
 */

import type { FastifyInstance } from 'fastify';

// Allowed ComfyUI hosts (localhost variants by default)
const ALLOWED_COMFYUI_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

/**
 * Validate ComfyUI server URL
 * Only allows localhost connections by default for security
 */
function isComfyUIUrlAllowed(serverUrl: string): { allowed: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    return { allowed: false, error: 'Invalid URL format' };
  }

  // Only allow http (ComfyUI typically runs on localhost without TLS)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, error: 'Only HTTP/HTTPS protocols allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check against allowed hosts
  if (!ALLOWED_COMFYUI_HOSTS.has(hostname)) {
    // Also check if it's explicitly configured in environment
    const extraHosts = process.env.COMFYUI_ALLOWED_HOSTS?.split(',').map(h => h.trim().toLowerCase()) || [];
    if (!extraHosts.includes(hostname)) {
      return {
        allowed: false,
        error: `ComfyUI server must be localhost. Got: ${hostname}. Set COMFYUI_ALLOWED_HOSTS to allow additional hosts.`
      };
    }
  }

  return { allowed: true };
}

export async function comfyuiRoutes(fastify: FastifyInstance) {
  /**
   * Proxy image from ComfyUI server
   *
   * This route fetches images from the ComfyUI server, bypassing CORS restrictions.
   * Used when the bridge extension sends image filenames to the React app.
   */
  fastify.get<{
    Querystring: {
      serverUrl: string;
      filename: string;
      subfolder?: string;
      type?: string;
    };
  }>('/comfyui/image', async (request, reply) => {
    const { serverUrl, filename, subfolder = '', type = 'output' } = request.query;

    if (!serverUrl || !filename) {
      reply.code(400);
      return { error: 'serverUrl and filename are required' };
    }

    // SSRF Protection: Only allow localhost ComfyUI servers
    const urlCheck = isComfyUIUrlAllowed(serverUrl);
    if (!urlCheck.allowed) {
      reply.code(403);
      return { error: urlCheck.error };
    }

    try {
      const url = `${serverUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
      const response = await fetch(url);

      if (!response.ok) {
        reply.code(response.status);
        return { error: 'Failed to fetch image' };
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=3600');
      return reply.send(Buffer.from(buffer));
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to fetch image' };
    }
  });
}
