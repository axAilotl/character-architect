import { create } from 'zustand';
import type { Card, CCv2Data, CCv3Data, CardMeta } from '@card-architect/schemas';
import { api } from '../lib/api';
import { localDB } from '../lib/db';
import { extractCardData } from '../lib/card-utils';
import { useTokenStore } from './token-store';
import { getDeploymentConfig } from '../config/deployment';
import { importCardClientSide } from '../lib/client-import';
import { exportCard as exportCardClientSide } from '../lib/client-export';

export { extractCardData };

interface CardStore {
  // Current card
  currentCard: Card | null;
  isDirty: boolean;
  isSaving: boolean;
  autoSaveTimeout: NodeJS.Timeout | null;

  // Actions
  setCurrentCard: (card: Card | null) => void;
  updateCardData: (updates: Partial<CCv2Data | CCv3Data>) => void;
  updateCardMeta: (updates: Partial<CardMeta>) => void;
  saveCard: () => Promise<void>;
  debouncedAutoSave: () => void;
  createSnapshot: (message?: string) => Promise<void>;
  loadCard: (id: string) => Promise<void>;
  createNewCard: () => Promise<void>;
  importCard: (file: File) => Promise<string | null>;
  importVoxtaPackage: (file: File) => Promise<string | null>;
  importCardFromURL: (url: string) => Promise<string | null>;
  exportCard: (format: 'json' | 'png' | 'charx' | 'voxta') => Promise<void>;
  
  // Data mutations
  convertSpec: (mode: 'v2' | 'v3') => void;
}

export const useCardStore = create<CardStore>((set, get) => ({
  // Initial state
  currentCard: null,
  isDirty: false,
  isSaving: false,
  autoSaveTimeout: null,

  // Set current card
  setCurrentCard: (card) => {
    set({ currentCard: card, isDirty: false });
    if (card) {
      useTokenStore.getState().updateTokenCounts(card);
    }
  },

  // Update card data
  updateCardData: (updates) => {
    const { currentCard } = get();
    if (!currentCard) return;

    // Deep merge to preserve spec/spec_version and nested data for both V2 and V3
    // V2 can be wrapped { spec, spec_version, data } or unwrapped (legacy)
    // V3 is always wrapped { spec, spec_version, data }
    let newData;

    if (currentCard.meta.spec === 'v3') {
      const v3Data = currentCard.data as CCv3Data;
      const updatesAsV3 = updates as Partial<CCv3Data>;

      newData = {
        ...v3Data,
        ...updatesAsV3,
        // Deep merge the nested data object
        data: {
          ...v3Data.data,
          ...(updatesAsV3.data || {}),
        },
      } as CCv3Data;
    } else {
      // V2 - handle both wrapped and unwrapped formats
      const v2Data = currentCard.data as any;
      const isWrapped = v2Data.spec === 'chara_card_v2' && 'data' in v2Data;

      if (isWrapped) {
        // Wrapped V2: preserve wrapper structure
        const updatesAsV2 = updates as any;
        newData = {
          spec: 'chara_card_v2',
          spec_version: '2.0',
          data: {
            ...v2Data.data,
            ...(updatesAsV2.data || updatesAsV2),
          },
        };
      } else {
        // Unwrapped/legacy V2
        newData = { ...v2Data, ...updates };
      }
    }

    const newCard = { ...currentCard, data: newData };

    set({ currentCard: newCard, isDirty: true });

    // Autosave to IndexedDB
    if (currentCard.meta.id) {
      localDB.saveDraft(currentCard.meta.id, newCard).catch(console.error);
    }

    // Update token counts
    useTokenStore.getState().updateTokenCounts(newCard);

    // Auto-save to server (debounced)
    if (currentCard.meta.id) {
      get().debouncedAutoSave();
    }
  },

  // Update card metadata
  updateCardMeta: (updates) => {
    const { currentCard } = get();
    if (!currentCard) return;

    const newMeta = { ...currentCard.meta, ...updates };
    const newCard = { ...currentCard, meta: newMeta };

    set({ currentCard: newCard, isDirty: true });

    // Autosave to IndexedDB
    if (currentCard.meta.id) {
      localDB.saveDraft(currentCard.meta.id, newCard).catch(console.error);
    }

    // Auto-save to server (debounced)
    if (currentCard.meta.id) {
      get().debouncedAutoSave();
    }
  },

  // Debounced auto-save
  debouncedAutoSave: () => {
    const { autoSaveTimeout } = get();
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    const timeout = setTimeout(() => {
      get().saveCard();
    }, 2000); // 2 second debounce

    set({ autoSaveTimeout: timeout });
  },

  // Create snapshot (manual versioning)
  createSnapshot: async (message?: string) => {
    const { currentCard } = get();
    if (!currentCard || !currentCard.meta.id) return;

    try {
      // Save current changes first
      await get().saveCard();

      // Create version snapshot
      const { error } = await api.createVersion(currentCard.meta.id, message);
      if (error) {
        console.error('Failed to create snapshot:', error);
        throw new Error(error);
      }
    } catch (err) {
      console.error('Failed to create snapshot:', err);
      throw err;
    }
  },

  // Save card to API or IndexedDB
  saveCard: async () => {
    const { currentCard } = get();
    if (!currentCard) {
      return;
    }

    const config = getDeploymentConfig();
    set({ isSaving: true });

    try {
      // Client-side mode: save to IndexedDB
      if (config.mode === 'light' || config.mode === 'static') {
        const cardToSave = currentCard.meta.id
          ? currentCard
          : { ...currentCard, meta: { ...currentCard.meta, id: crypto.randomUUID() } };

        await localDB.saveCard(cardToSave);

        if (!currentCard.meta.id) {
          set({ currentCard: cardToSave });
        }
        set({ isDirty: false });
        return;
      }

      // Server mode: save via API
      if (currentCard.meta.id) {
        // Update existing card
        const result = await api.updateCard(currentCard.meta.id, currentCard);
        if (result.error) {
          throw new Error(result.error);
        }
      } else {
        // Create new card
        const { data, error } = await api.createCard(currentCard);
        if (error) throw new Error(error);
        if (data) set({ currentCard: data });
      }

      set({ isDirty: false });

      // Clear draft from IndexedDB
      if (currentCard.meta.id) {
        await localDB.deleteDraft(currentCard.meta.id);
      }
    } catch (err) {
      console.error('[saveCard] FAILED to save card:', err);
      throw err; // Re-throw so caller knows it failed
    } finally {
      set({ isSaving: false });
    }
  },

  // Load card from API or IndexedDB
  loadCard: async (id) => {
    const config = getDeploymentConfig();

    // Client-side mode: load from IndexedDB
    if (config.mode === 'light' || config.mode === 'static') {
      const card = await localDB.getCard(id);
      if (card) {
        set({ currentCard: card, isDirty: false });
        useTokenStore.getState().updateTokenCounts(card);
      }
      return;
    }

    // Server mode: load from API
    const { data, error } = await api.getCard(id);
    if (error) {
      console.error('Failed to load card:', error);
      return;
    }

    if (data) {
      set({ currentCard: data, isDirty: false });
      useTokenStore.getState().updateTokenCounts(data);

      // Check for draft in IndexedDB
      const draft = await localDB.getDraft(id);
      if (draft && draft.lastSaved > data.meta.updatedAt) {
        console.log('Found newer draft in IndexedDB');
      }
    }
  },

  // Create new card
  createNewCard: async () => {
    const newCard: Card = {
      meta: {
        id: '',
        name: 'New Character',
        spec: 'v3',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      data: {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'New Character',
          description: '',
          personality: '',
          scenario: '',
          first_mes: '',
          mes_example: '',
          creator: '',
          character_version: '1.0',
          tags: [],
          system_prompt: '',
          post_history_instructions: '',
          alternate_greetings: [],
          group_only_greetings: [],
        },
      } as CCv3Data,
    };

    set({ currentCard: newCard, isDirty: true });

    // Immediately save to API to get a real ID
    await get().saveCard();
  },

  // Import card
  importCard: async (file) => {
    const config = getDeploymentConfig();
    console.log('[importCard] Mode:', config.mode, 'File:', file.name);

    // Use client-side import for light/static modes
    if (config.mode === 'light' || config.mode === 'static') {
      try {
        console.log('[importCard] Using client-side import');
        const result = await importCardClientSide(file);
        const card = result.card;
        console.log('[importCard] Parsed card:', card.meta.name, 'hasImage:', !!result.imageDataUrl);

        // Save to IndexedDB for persistence
        await localDB.saveCard(card);
        console.log('[importCard] Saved card to IndexedDB');

        // Save card image if available
        if (result.imageDataUrl) {
          await localDB.saveImage(card.meta.id, 'thumbnail', result.imageDataUrl);
          console.log('[importCard] Saved thumbnail to IndexedDB, size:', result.imageDataUrl.length);
        } else {
          console.warn('[importCard] No image data available for card');
        }

        set({ currentCard: card, isDirty: false });
        useTokenStore.getState().updateTokenCounts(card);
        return card.meta.id;
      } catch (err) {
        console.error('[importCard] Client-side import failed:', err);
        return null;
      }
    }

    // Use server API for full mode
    const { data, error } = await api.importCard(file);
    if (error) {
      return null;
    }

    if (data && data.card) {
      set({ currentCard: data.card, isDirty: false });
      useTokenStore.getState().updateTokenCounts(data.card);
      return data.card.meta.id;
    }
    return null;
  },

  // Import Voxta package
  importVoxtaPackage: async (file) => {
    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      alert('Voxta package import is not supported in light mode. Please use PNG or JSON imports instead.');
      return null;
    }

    const { data, error } = await api.importVoxtaPackage(file);
    if (error) {
      alert(`Failed to import Voxta package: ${error}`);
      return null;
    }

    if (data && data.cards && data.cards.length > 0) {
      const firstCard = data.cards[0];

      // Set the first card as active
      set({ currentCard: firstCard, isDirty: false });
      useTokenStore.getState().updateTokenCounts(firstCard);

      if (data.cards.length > 1) {
        alert(`Imported ${data.cards.length} characters from Voxta package. "${firstCard.meta.name}" is now active.`);
      }
      return firstCard.meta.id;
    } else {
      alert('Voxta package imported but no characters were found.');
      return null;
    }
  },

  importCardFromURL: async (url) => {
    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      alert('URL import is not supported in light mode. Please use file import or the userscript instead.');
      return null;
    }

    const { data, error } = await api.importCardFromURL(url);
    if (error) {
      alert(`Failed to import card: ${error}`);
      return null;
    }

    if (data && data.card) {
      set({ currentCard: data.card, isDirty: false });
      useTokenStore.getState().updateTokenCounts(data.card);
      return data.card.meta.id;
    }
    return null;
  },

  // Export card
  exportCard: async (format) => {
    const { currentCard } = get();
    if (!currentCard || !currentCard.meta.id) return;

    // Save before exporting to ensure DB has latest data
    try {
      await get().saveCard();
      // Small delay to ensure database write completes
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (err) {
      alert(`Failed to save card before export: ${err}`);
      return;
    }

    const config = getDeploymentConfig();

    // Client-side mode: use client export
    if (config.mode === 'light' || config.mode === 'static') {
      if (format === 'charx' || format === 'voxta') {
        alert(`${format.toUpperCase()} export requires a server. Only JSON and PNG are available in light mode.`);
        return;
      }
      await exportCardClientSide(currentCard, format as 'json' | 'png');
      return;
    }

    // Server mode: use API
    const { data, error } = await api.exportCard(currentCard.meta.id, format);
    if (error) {
      return;
    }

    if (data) {
      // Download file
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;

      let ext: string = format;
      if (format === 'voxta') {
          ext = 'voxpkg';
      }

      a.download = `${currentCard.meta.name}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  },

  convertSpec: (mode) => {
    const { currentCard } = get();
    if (!currentCard) return;

    // Update the card's spec mode
    const updatedCard = {
      ...currentCard,
      meta: {
        ...currentCard.meta,
        spec: mode,
      },
    };

    // Convert data format if needed
    if (mode === 'v3' && currentCard.meta.spec === 'v2') {
      // Convert v2 to v3 format
      const v2Data = currentCard.data as CCv2Data;
      updatedCard.data = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          ...v2Data,
          creator: v2Data.creator || '',
          character_version: v2Data.character_version || '1.0',
          tags: v2Data.tags || [],
        },
      } as CCv3Data;
    } else if (mode === 'v2' && currentCard.meta.spec === 'v3') {
      // Convert v3 to v2 format
      const v3Data = currentCard.data as CCv3Data;
      updatedCard.data = {
        ...v3Data.data,
      } as CCv2Data;
    }

    set({ currentCard: updatedCard, isDirty: true });
  },
}));
