/**
 * Deployment Configuration
 *
 * This file defines what features are available in different deployment modes.
 * The mode is determined by the VITE_DEPLOYMENT_MODE environment variable.
 *
 * Modes:
 * - 'full': All features enabled (local/self-hosted)
 * - 'light': Minimal server, most features client-side (cheap VPS)
 * - 'static': No server at all (Cloudflare Pages, GitHub Pages)
 */

export type DeploymentMode = 'full' | 'light' | 'static';

export interface DeploymentConfig {
  mode: DeploymentMode;

  /** Features that require a server backend */
  serverFeatures: {
    /** Web import via userscript (still works - client fetches, server processes) */
    webImport: boolean;
    /** Server-side RAG (if false, use client-side Transformers.js) */
    serverRag: boolean;
    /** Server-side LLM proxy (if false, use direct browser calls) */
    serverLlm: boolean;
    /** ComfyUI integration (requires local ComfyUI server) */
    comfyui: boolean;
    /** Server-side image optimization with Sharp */
    serverImageOptimization: boolean;
  };

  /** Features that can run client-side */
  clientFeatures: {
    /** SillyTavern push (works client-side for localhost) */
    sillyTavernPush: boolean;
    /** Client-side RAG with Transformers.js + WebGPU */
    clientRag: boolean;
    /** Direct LLM calls (OpenRouter, Anthropic with CORS header) */
    clientLlm: boolean;
    /** Client-side image processing (Canvas API) */
    clientImageOptimization: boolean;
  };

  /** Module defaults - which modules are enabled by default */
  moduleDefaults: {
    blockEditor: boolean;
    wwwyzzerdd: boolean;
    comfyui: boolean;
    sillytavern: boolean;
    webimport: boolean;
    charxOptimizer: boolean;
    federation: boolean;
  };
}

/**
 * Full deployment - all features, self-hosted
 */
const FULL_CONFIG: DeploymentConfig = {
  mode: 'full',
  serverFeatures: {
    webImport: true,
    serverRag: true,
    serverLlm: true,
    comfyui: true,
    serverImageOptimization: true,
  },
  clientFeatures: {
    sillyTavernPush: true,
    clientRag: true,
    clientLlm: true,
    clientImageOptimization: true,
  },
  moduleDefaults: {
    blockEditor: true,
    wwwyzzerdd: true,
    comfyui: true,
    sillytavern: true,
    webimport: true,
    charxOptimizer: true,
    federation: true,
  },
};

/**
 * Light deployment - cheap VPS, minimal server
 * Server-only modules (requiresServer: true) are disabled and hidden in this mode.
 */
const LIGHT_CONFIG: DeploymentConfig = {
  mode: 'light',
  serverFeatures: {
    webImport: false, // Requires server processing - disabled in light mode
    serverRag: false, // Use client-side
    serverLlm: false, // Use direct browser calls
    comfyui: false, // No ComfyUI on VPS
    serverImageOptimization: false, // Use Canvas API
  },
  clientFeatures: {
    sillyTavernPush: true,
    clientRag: true,
    clientLlm: true,
    clientImageOptimization: true,
  },
  moduleDefaults: {
    blockEditor: true,
    wwwyzzerdd: true,
    // Server-only modules (requiresServer: true) - disabled in light mode
    comfyui: false,
    sillytavern: false,
    webimport: false,
    charxOptimizer: false,
    federation: false,
  },
};

/**
 * Static deployment - no server, Cloudflare/GitHub Pages
 * Server-only modules (requiresServer: true) are disabled and hidden in this mode.
 */
const STATIC_CONFIG: DeploymentConfig = {
  mode: 'static',
  serverFeatures: {
    webImport: false, // No server to process
    serverRag: false,
    serverLlm: false,
    comfyui: false,
    serverImageOptimization: false,
  },
  clientFeatures: {
    sillyTavernPush: true, // Works for localhost ST
    clientRag: true, // Transformers.js
    clientLlm: true, // OpenRouter/Anthropic direct
    clientImageOptimization: true,
  },
  moduleDefaults: {
    blockEditor: true,
    wwwyzzerdd: false, // Needs LLM which may not be configured
    // Server-only modules (requiresServer: true) - disabled in static mode
    comfyui: false,
    sillytavern: false,
    webimport: false,
    charxOptimizer: false,
    federation: false,
  },
};

/**
 * Check if hostname is a private/LAN address (RFC1918 or localhost)
 */
function isPrivateNetwork(hostname: string): boolean {
  // Localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

  // .local mDNS domains (ONLY if it ends with .local, not subdomains like foo.local.example.com)
  // mDNS domains are things like "mycomputer.local", not "foo.local.example.com"
  if (hostname.endsWith('.local')) return true;

  // RFC1918 private IP ranges
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
  }

  return false;
}

/**
 * Get deployment configuration based on environment
 */
export function getDeploymentConfig(): DeploymentConfig {
  // Check for explicit mode setting
  const explicitMode = import.meta.env.VITE_DEPLOYMENT_MODE as DeploymentMode;

  // If no explicit mode, auto-detect: if running on a static host (not localhost with API), use light mode
  let mode: DeploymentMode;
  if (explicitMode) {
    mode = explicitMode;
  } else {
    // Auto-detect: check if we're on localhost/LAN (likely dev with server) or a static host
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalDev = isPrivateNetwork(hostname);
    mode = isLocalDev ? 'full' : 'light';
  }

  switch (mode) {
    case 'light':
      return LIGHT_CONFIG;
    case 'static':
      return STATIC_CONFIG;
    case 'full':
    default:
      return FULL_CONFIG;
  }
}

/**
 * Check if a server feature is available
 */
export function isServerFeatureAvailable(feature: keyof DeploymentConfig['serverFeatures']): boolean {
  return getDeploymentConfig().serverFeatures[feature];
}

/**
 * Check if a client feature is available
 */
export function isClientFeatureAvailable(feature: keyof DeploymentConfig['clientFeatures']): boolean {
  return getDeploymentConfig().clientFeatures[feature];
}

/**
 * Get default module enabled state
 */
export function getModuleDefault(moduleId: string): boolean {
  const config = getDeploymentConfig();
  const key = moduleId.replace(/-/g, '') as keyof typeof config.moduleDefaults;
  return config.moduleDefaults[key] ?? true;
}

/**
 * Export the current config for debugging
 */
export const deploymentConfig = getDeploymentConfig();
