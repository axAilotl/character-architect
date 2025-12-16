/**
 * SSRF Protection Utility
 *
 * Validates URLs to prevent Server-Side Request Forgery attacks.
 * Uses canonical @character-foundry/image-utils implementation.
 */

import { isURLSafe, type SSRFPolicy } from '@character-foundry/character-foundry/image-utils';
import { config } from '../config.js';

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
