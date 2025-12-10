/**
 * SSRF Protection Utility
 *
 * Validates URLs to prevent Server-Side Request Forgery attacks.
 * Used to validate LLM provider base URLs before making external requests.
 */

import { config } from '../config.js';

// Private IP ranges that should be blocked
const PRIVATE_IP_PATTERNS = [
  /^127\./,                        // Loopback
  /^10\./,                         // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
  /^192\.168\./,                   // Class C private
  /^169\.254\./,                   // Link-local
  /^0\./,                          // "This" network
  /^::1$/,                         // IPv6 loopback
  /^fc00:/i,                       // IPv6 unique local
  /^fe80:/i,                       // IPv6 link-local
];

// Dangerous hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata.aws.internal',
  '169.254.169.254', // AWS/GCP metadata
];

export interface SSRFValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
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

  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: `Blocked protocol: ${url.protocol}` };
  }

  const hostname = url.hostname.toLowerCase();

  // Check against allowed LLM hosts
  const allowedHosts = config.security.allowedLLMHosts.split(',').map(h => h.trim().toLowerCase());

  // If localhost is in allowed hosts, allow it
  const localhostAllowed = allowedHosts.includes('localhost') || allowedHosts.includes('127.0.0.1');

  // Check if hostname is explicitly allowed
  const isExplicitlyAllowed = allowedHosts.some(allowed => {
    // Exact match
    if (hostname === allowed) return true;
    // Subdomain match (e.g., 'api.openai.com' matches 'openai.com')
    if (hostname.endsWith('.' + allowed)) return true;
    return false;
  });

  if (isExplicitlyAllowed) {
    // Even if allowed, block metadata endpoints
    if (BLOCKED_HOSTNAMES.some(blocked =>
      hostname === blocked.toLowerCase() || hostname.includes('metadata')
    )) {
      return { valid: false, error: 'Blocked hostname (metadata endpoint)' };
    }
    return { valid: true, url };
  }

  // Block localhost if not explicitly allowed
  if (!localhostAllowed) {
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1') {
      return { valid: false, error: 'Localhost not allowed' };
    }
  }

  // Block private IPs
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Private IP addresses are blocked' };
    }
  }

  // Block dangerous hostnames
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (hostname === blocked.toLowerCase()) {
      return { valid: false, error: `Blocked hostname: ${blocked}` };
    }
  }

  // URL passed all checks
  return { valid: true, url };
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
  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: `Blocked protocol: ${url.protocol}` };
  }

  const hostname = url.hostname.toLowerCase();

  // Always block metadata endpoints regardless of other settings
  if (hostname === '169.254.169.254' || hostname.includes('metadata')) {
    return { valid: false, error: 'Metadata endpoints are blocked' };
  }

  // Block private IPs in production
  if (config.security.ssrfProtectionEnabled) {
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'Private IP addresses are blocked' };
      }
    }
  }

  return { valid: true, url };
}
