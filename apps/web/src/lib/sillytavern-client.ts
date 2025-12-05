/**
 * Client-Side SillyTavern Push Service
 *
 * Pushes character cards directly from the browser to SillyTavern.
 * This works because SillyTavern runs on localhost, so no CORS issues.
 *
 * Benefits:
 * - No server needed for push functionality
 * - Works with static/Cloudflare deployments
 * - Reduces server load
 */

import type { Card } from '@card-architect/schemas';
import { createCardPNG } from '@card-architect/png';

export interface SillyTavernSettings {
  enabled: boolean;
  baseUrl: string;
  importEndpoint: string;
  sessionCookie?: string;
  /** Use client-side push (default: true for localhost) */
  clientSide?: boolean;
}

export interface PushResult {
  success: boolean;
  fileName?: string;
  error?: string;
}

/**
 * Client-side SillyTavern push service
 */
export class SillyTavernClient {
  constructor(private settings: SillyTavernSettings) {}

  /**
   * Get CSRF token from SillyTavern
   */
  private async getCsrfToken(): Promise<string> {
    const baseUrl = this.settings.baseUrl.replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/csrf-token`, {
      credentials: 'include',
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get CSRF token: ${response.status}`);
    }

    const data = await response.json();
    if (!data.token) {
      throw new Error('No CSRF token in response');
    }

    return data.token;
  }

  /**
   * Build headers for SillyTavern requests
   */
  private buildHeaders(): Record<string, string> {
    const baseUrl = this.settings.baseUrl.replace(/\/$/, '');
    const headers: Record<string, string> = {
      Accept: '*/*',
      Origin: baseUrl,
      Referer: baseUrl,
    };

    if (this.settings.sessionCookie) {
      headers.Cookie = this.settings.sessionCookie;
    }

    return headers;
  }

  /**
   * Push a card to SillyTavern
   *
   * @param card - The card data to push
   * @param imageBuffer - The card's avatar image as Uint8Array
   * @returns Push result
   */
  async push(card: Card, imageBuffer: Uint8Array): Promise<PushResult> {
    if (!this.settings.enabled) {
      return { success: false, error: 'SillyTavern integration is disabled' };
    }

    if (!this.settings.baseUrl) {
      return { success: false, error: 'SillyTavern baseUrl is not configured' };
    }

    try {
      // Step 1: Generate PNG with embedded card data
      const pngBuffer = createCardPNG(imageBuffer, card);

      // Step 2: Get CSRF token
      const csrfToken = await this.getCsrfToken();

      // Step 3: Create FormData with PNG
      // Cast to ArrayBuffer to satisfy TypeScript's strict type checking
      const blob = new Blob([pngBuffer as unknown as ArrayBuffer], { type: 'image/png' });
      const formData = new FormData();

      const cardName = (card.data as any)?.name || card.meta?.id || 'character';
      formData.append('avatar', blob, `${cardName}.png`);
      formData.append('file_type', 'png');
      formData.append('preserved_name', card.meta?.id || cardName);

      // Step 4: Upload to SillyTavern
      const baseUrl = this.settings.baseUrl.replace(/\/$/, '');
      const endpoint = this.settings.importEndpoint || '/api/characters/import';

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
          Accept: 'application/json, text/plain, */*',
          Origin: baseUrl,
          Referer: baseUrl,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `SillyTavern returned ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        fileName: result.file_name || `${cardName}.png`,
      };
    } catch (error) {
      // Check for CORS errors (which indicate SillyTavern isn't accessible)
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        return {
          success: false,
          error: `Cannot connect to SillyTavern at ${this.settings.baseUrl}. Is it running?`,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test connection to SillyTavern
   */
  async testConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      await this.getCsrfToken();
      return { connected: true };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}

/**
 * Check if client-side push should be used
 *
 * Client-side push works when:
 * 1. SillyTavern is on localhost (no CORS)
 * 2. User hasn't explicitly disabled it
 */
export function shouldUseClientSidePush(settings: SillyTavernSettings): boolean {
  // If explicitly set, use that
  if (settings.clientSide !== undefined) {
    return settings.clientSide;
  }

  // Default: use client-side for localhost URLs
  try {
    const url = new URL(settings.baseUrl);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
