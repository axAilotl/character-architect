/**
 * Web Import Handler
 *
 * Processes pending imports from the userscript.
 * The userscript stores data in localStorage, and this handler
 * picks it up and creates the card in IndexedDB using UnifiedImportService.
 */

import { UnifiedImportService } from '@card-architect/import-core';
import { ClientStorageAdapter } from '../adapters/client-storage.adapter';
import { localDB } from './db';

interface PendingImport {
  site: string;
  url: string;
  timestamp: number;
  // PNG with embedded data (all sites should provide this)
  pngBase64?: string;
}

export interface WebImportResult {
  success: boolean;
  cardId?: string;
  name?: string;
  error?: string;
}

/**
 * Convert base64 data URL to Uint8Array
 */
function dataURLToUint8Array(dataURL: string): Uint8Array {
  // Remove data URL prefix if present
  const base64 = dataURL.includes(',') ? dataURL.split(',')[1] : dataURL;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Request import data from opener window via postMessage
 */
function requestImportDataFromOpener(): Promise<PendingImport> {
  return new Promise((resolve, reject) => {
    // Check if we have an opener
    if (!window.opener) {
      reject(new Error('No opener window found. Please use the import button from a character site.'));
      return;
    }

    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Timeout waiting for import data. Please try again.'));
    }, 10000);

    function handler(event: MessageEvent) {
      if (event.data?.type === 'CA_IMPORT_DATA') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);

        if (event.data.error) {
          reject(new Error(event.data.error));
        } else if (event.data.data) {
          resolve(event.data.data);
        } else {
          reject(new Error('Invalid import data received'));
        }
      }
    }

    window.addEventListener('message', handler);

    // Request data from opener
    console.log('[WebImport] Requesting import data from opener...');
    window.opener.postMessage({ type: 'CA_REQUEST_IMPORT_DATA' }, '*');
  });
}

/**
 * Process a pending web import via postMessage from opener
 * Uses UnifiedImportService for consistent processing
 */
export async function processPendingWebImport(): Promise<WebImportResult> {
  let pending: PendingImport;

  try {
    pending = await requestImportDataFromOpener();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get import data' };
  }

  // Check if import is stale (more than 5 minutes old)
  if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
    return { success: false, error: 'Import data expired. Please try again.' };
  }

  try {
    if (!pending.pngBase64) {
      return { success: false, error: 'No card data in import' };
    }

    // Convert data URL to buffer
    const buffer = dataURLToUint8Array(pending.pngBase64);

    // Use unified import service
    const storageAdapter = new ClientStorageAdapter(localDB);
    const importService = new UnifiedImportService(storageAdapter);

    // Import using the unified service (handles PNG parsing, validation, storage)
    const cardIds = await importService.importFile(buffer, 'card.png');

    if (cardIds.length === 0) {
      return { success: false, error: 'Failed to import card' };
    }

    // Get the imported card to return its name
    const card = await localDB.getCard(cardIds[0]);
    if (!card) {
      return { success: false, error: 'Card imported but not found in database' };
    }

    return {
      success: true,
      cardId: card.meta.id,
      name: card.meta.name,
    };

  } catch (err) {
    console.error('[WebImport] Processing failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Import processing failed',
    };
  }
}

/**
 * Check if there's an opener window that could have import data
 */
export function hasOpener(): boolean {
  return !!window.opener && !window.opener.closed;
}
