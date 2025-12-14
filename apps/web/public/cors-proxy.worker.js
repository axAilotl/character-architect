/**
 * Character Architect CORS Proxy
 *
 * Deploy to Cloudflare Workers for free (100k req/day)
 * Used for: LLM APIs without CORS, web imports from CORS-blocked sites
 *
 * Usage:
 *   POST https://your-worker.workers.dev/?url=https://api.openai.com/v1/chat/completions
 *   Header: x-proxy-headers: {"Authorization": "Bearer sk-..."}
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-proxy-headers, x-api-key',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate target URL (whitelist approach for security)
    const allowed = [
      'api.openai.com',
      'api.anthropic.com',
      'openrouter.ai',
      'api.x.ai',
      'generativelanguage.googleapis.com',
      // Web import sites
      'risu.pages.dev',
      'characterhub.org',
      'www.characterhub.org',
      'wyvern.chat',
      'api.chub.ai',
      'avatars.charhub.io',
    ];

    const targetHost = new URL(targetUrl).hostname;
    if (!allowed.some(h => targetHost === h || targetHost.endsWith('.' + h))) {
      return new Response(JSON.stringify({ error: 'Target not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse custom headers from x-proxy-headers
    let proxyHeaders = {};
    const headerParam = request.headers.get('x-proxy-headers');
    if (headerParam) {
      try {
        proxyHeaders = JSON.parse(headerParam);
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Build request headers
    const requestHeaders = new Headers();

    // Copy safe headers from original request
    const safeHeaders = ['content-type', 'accept', 'user-agent'];
    for (const h of safeHeaders) {
      if (request.headers.has(h)) {
        requestHeaders.set(h, request.headers.get(h));
      }
    }

    // Apply custom headers (these override)
    for (const [key, value] of Object.entries(proxyHeaders)) {
      requestHeaders.set(key, value);
    }

    // Fetch from target
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: requestHeaders,
      body: request.body,
    });

    // Build response with CORS headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', '*');
    responseHeaders.delete('content-security-policy');
    responseHeaders.delete('x-frame-options');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  }
};
