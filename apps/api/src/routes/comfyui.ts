/**
 * ComfyUI Routes
 *
 * Minimal API for ComfyUI integration - only provides image proxy for CORS bypass.
 * The main ComfyUI interaction happens via iframe with postMessage bridge.
 */

import type { FastifyInstance } from 'fastify';

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
