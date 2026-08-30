/**
 * SSRF Protection Utility
 *
 * Validates URLs to prevent Server-Side Request Forgery attacks.
 * Uses canonical @character-foundry/image-utils implementation.
 */

import { isURLSafe, type SSRFPolicy } from '@character-foundry/character-foundry/image-utils';
import { config } from '../config.js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface SSRFValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
}

/**
 * Convert Architect config to canonical SSRFPolicy
 */
function getSSRFPolicy(allowedDomainsOverride?: string[]): SSRFPolicy {
  const allowedHosts = config.security.allowedLLMHosts
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(h => h.length > 0);

  // Check if localhost is explicitly allowed in config
  const localhostAllowed = allowedHosts.includes('localhost') ||
                          allowedHosts.includes('127.0.0.1');

  return {
    allowPrivateIPs: !config.security.ssrfProtectionEnabled,
    allowLocalhost: localhostAllowed,
    allowedDomains: allowedDomainsOverride || allowedHosts,
    blockedDomains: [
      'metadata.google.internal',
      'metadata.aws.internal',
      '*.metadata.*',
    ],
  };
}

/**
 * Validate a URL for SSRF attacks
 */
export function validateURL(urlString: string): SSRFValidationResult {
  // Skip validation if disabled
  if (!config.security.ssrfProtectionEnabled) {
    try {
      return { valid: true, url: new URL(urlString) };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  const policy = getSSRFPolicy();
  const check = isURLSafe(urlString, policy);

  if (!check.safe) {
    return { valid: false, error: check.reason };
  }

  try {
    return { valid: true, url: new URL(urlString) };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate an LLM provider base URL
 * Throws an error if the URL is not allowed
 */
export function validateLLMProviderURL(baseURL: string | undefined): void {
  if (!baseURL) return; // No URL to validate

  const result = validateURL(baseURL);
  if (!result.valid) {
    throw new Error(`SSRF protection: ${result.error}`);
  }
}

/**
 * Check if a URL is safe for fetching (less strict than LLM validation)
 * Used for general web fetching operations
 */
export function isURLSafeForFetch(urlString: string): SSRFValidationResult {
  // Policy for general fetching: no allowlist, just block dangerous stuff
  const policy: SSRFPolicy = {
    allowPrivateIPs: !config.security.ssrfProtectionEnabled,
    allowLocalhost: false,
    allowedDomains: [], // No allowlist for general fetching
    blockedDomains: [
      'metadata.google.internal',
      'metadata.aws.internal',
      '*.metadata.*',
      'localhost',
    ],
  };

  const check = isURLSafe(urlString, policy);

  if (!check.safe) {
    return { valid: false, error: check.reason };
  }

  try {
    return { valid: true, url: new URL(urlString) };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Re-validate a URL after following a redirect
 * Ensures redirects don't bypass SSRF protection
 */
export function validateRedirectURL(_originalUrl: string, redirectUrl: string): SSRFValidationResult {
  const result = isURLSafeForFetch(redirectUrl);
  if (!result.valid) {
    return { valid: false, error: `Redirect blocked: ${result.error}` };
  }
  return result;
}

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224;
  }

  if (isIP(address) === 6) {
    const normalized = address.toLowerCase().split('%')[0];
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPrivateAddress(mapped) : false;
  }

  return true;
}

async function validateResolvedTarget(url: URL): Promise<void> {
  const validation = isURLSafeForFetch(url.href);
  if (!validation.valid) throw new Error(`URL blocked: ${validation.error}`);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`URL blocked: unsupported protocol ${url.protocol}`);
  }

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error(`URL blocked: ${url.hostname} resolves to a private or reserved address`);
  }
}

function limitResponseBody(response: Response, maxBytes: number): Response {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Response exceeds ${maxBytes} byte limit`);
  }
  if (!response.body) return response;

  const reader = response.body.getReader();
  let received = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel('response size limit exceeded');
        controller.error(new Error(`Response exceeds ${maxBytes} byte limit`));
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Fetch an untrusted URL with DNS checks, manual redirect validation, and a
 * hard response-body limit. Sensitive headers are removed across origins.
 */
export async function fetchWithSSRFProtection(
  input: string,
  init: RequestInit = {},
  options: { maxBytes?: number; maxRedirects?: number } = {},
): Promise<Response> {
  const maxBytes = options.maxBytes ?? 50 * 1024 * 1024;
  const maxRedirects = options.maxRedirects ?? 5;
  let current = new URL(input);
  const headers = new Headers(init.headers);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    await validateResolvedTarget(current);
    const response = await fetch(current, { ...init, headers, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return limitResponseBody(response, maxBytes);
    }

    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('Redirect response is missing a Location header');
    if (redirectCount === maxRedirects) throw new Error('Too many redirects');
    const next = new URL(location, current);
    if (next.origin !== current.origin) {
      headers.delete('authorization');
      headers.delete('cookie');
      headers.delete('proxy-authorization');
    }
    current = next;
  }

  throw new Error('Too many redirects');
}
