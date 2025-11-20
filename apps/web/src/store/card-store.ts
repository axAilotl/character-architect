import { create } from 'zustand';
import type { Card, CCv2Data, CCv3Data, CardMeta } from '@card-architect/schemas';
import { api } from '../lib/api';
import { localDB } from '../lib/db';

/**
 * Extract actual card data fields from card.data, handling both wrapped and unwrapped formats
 * V2 can be: { spec, spec_version, data: {...} } or just {...}
 * V3 is always: { spec, spec_version, data: {...} }
 */
export function extractCardData(card: Card): CCv2Data | CCv3Data['data'] {
  const isV3 = card.meta.spec === 'v3';

  if (isV3) {
    return (card.data as CCv3Data).data;
  }

  // V2 can be wrapped or unwrapped
  const data = card.data as any;
  if (data.spec === 'chara_card_v2' && 'data' in data) {
    // Wrapped V2
    return data.data as CCv2Data;
  }

  // Unwrapped/legacy V2
  return data as CCv2Data;
}

interface TokenCounts {
  [field: string]: number;
  total: number;
}

interface CardStore {
  // Current card
  currentCard: Card | null;
  isDirty: boolean;
  isSaving: boolean;
  autoSaveTimeout: NodeJS.Timeout | null;

  // Token counts
  tokenCounts: TokenCounts;
  tokenizerModel: string;

  // UI state
  activeTab: 'edit' | 'preview' | 'diff' | 'simulator' | 'redundancy' | 'lore-trigger' | 'focused' | 'assets';
  showAdvanced: boolean;
  specMode: 'v2' | 'v3'; // Current spec mode for editing and export
  showV3Fields: boolean; // Whether to show v3-only fields in the UI

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

  // Token counting
  updateTokenCounts: () => Promise<void>;
  setTokenizerModel: (model: string) => void;

  // UI
  setActiveTab: (
    tab: 'edit' | 'preview' | 'diff' | 'simulator' | 'redundancy' | 'lore-trigger' | 'focused' | 'assets'
  ) => void;
  setShowAdvanced: (show: boolean) => void;
  setSpecMode: (mode: 'v2' | 'v3') => void;
  toggleV3Fields: () => void;
}

export const useCardStore = create<CardStore>((set, get) => ({
  // Initial state
  currentCard: null,
  isDirty: false,
  isSaving: false,
  autoSaveTimeout: null,
  tokenCounts: { total: 0 },
  tokenizerModel: 'gpt2-bpe-approx',
  activeTab: 'edit',
  showAdvanced: false,
  specMode: 'v3',
  showV3Fields: true,

  // Set current card
  setCurrentCard: (card) => {
    const specMode = card?.meta.spec || 'v3';
    const showV3Fields = specMode === 'v3';
    set({ currentCard: card, isDirty: false, specMode, showV3Fields });
    if (card) {
      get().updateTokenCounts();
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
    get().updateTokenCounts();

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

  // Save card to API
  saveCard: async () => {
    console.log('[saveCard] ENTRY - function called');
    const { currentCard } = get();
    console.log('[saveCard] currentCard exists?', !!currentCard, 'id:', currentCard?.meta?.id);
    if (!currentCard) {
      console.error('[saveCard] EARLY RETURN - currentCard is null!');
      return;
    }

    console.log('[saveCard] Starting save...', { isDirty: get().isDirty, cardId: currentCard.meta.id });
    set({ isSaving: true });

    try {
      if (currentCard.meta.id) {
        // Update existing card
        console.log('[saveCard] Calling API updateCard...');
        const result = await api.updateCard(currentCard.meta.id, currentCard);
        console.log('[saveCard] API updateCard result:', { error: result.error, hasData: !!result.data });
        if (result.error) {
          throw new Error(result.error);
        }
      } else {
        // Create new card
        const { data, error } = await api.createCard(currentCard);
        if (error) throw new Error(error);
        if (data) set({ currentCard: data });
      }

      console.log('[saveCard] Save successful, setting isDirty=false');
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

  // Load card from API
  loadCard: async (id) => {
    const { data, error } = await api.getCard(id);
    if (error) {
      console.error('Failed to load card:', error);
      return;
    }

    if (data) {
      set({ currentCard: data, isDirty: false });
      get().updateTokenCounts();

      // Check for draft in IndexedDB
      const draft = await localDB.getDraft(id);
      if (draft && draft.lastSaved > data.meta.updatedAt) {
        // Draft is newer, prompt user?
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
    console.log(`[Import] Starting import of ${file.name}...`);
    const { data, error } = await api.importCard(file);
    if (error) {
      console.error('[Import] Failed to import card:', error);
      return null;
    }

    if (data && data.card) {
      const cardData = extractCardData(data.card);
      const cardName = cardData?.name || 'Untitled Card';

      console.log(`[Import] Successfully imported card: ${cardName}`);
      console.log(`[Import] Format: ${data.card.meta.spec.toUpperCase()}`);

      if (data.assetsImported !== undefined) {
        console.log(`[Import] Assets imported: ${data.assetsImported}`);
      }

      if (data.warnings && data.warnings.length > 0) {
        console.warn('[Import] Warnings:', data.warnings);
      }

      set({ currentCard: data.card, isDirty: false });
      get().updateTokenCounts();
      return data.card.meta.id;
    }
    return null;
  },

  // Import Voxta package
  importVoxtaPackage: async (file) => {
    console.log(`[Import] Starting Voxta import of ${file.name}...`);
    const { data, error } = await api.importVoxtaPackage(file);
    if (error) {
      console.error('[Import] Failed to import Voxta package:', error);
      alert(`Failed to import Voxta package: ${error}`);
      return null;
    }

    if (data && data.cards && data.cards.length > 0) {
      const firstCard = data.cards[0];
      console.log(`[Import] Successfully imported ${data.cards.length} cards from Voxta package.`);
      
      // Set the first card as active
      set({ currentCard: firstCard, isDirty: false });
      get().updateTokenCounts();
      
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
    console.log(`[Import] Starting import from URL: ${url}...`);
    const { data, error } = await api.importCardFromURL(url);
    if (error) {
      console.error('[Import] Failed to import card from URL:', error);
      alert(`Failed to import card: ${error}`);
      return null;
    }

    if (data && data.card) {
      const cardData = extractCardData(data.card);
      const cardName = cardData?.name || 'Untitled Card';

      console.log(`[Import] Successfully imported card from URL: ${cardName}`);
      console.log(`[Import] Source: ${data.source}`);
      console.log(`[Import] Format: ${data.card.meta.spec.toUpperCase()}`);

      if (data.warnings && data.warnings.length > 0) {
        console.warn('[Import] Warnings:', data.warnings);
      }

      set({ currentCard: data.card, isDirty: false });
      get().updateTokenCounts();
      return data.card.meta.id;
    }
    return null;
  },

  // Export card
  exportCard: async (format) => {
    const { currentCard } = get();
    if (!currentCard || !currentCard.meta.id) return;

    // CRITICAL: ALWAYS save before exporting to ensure DB has latest data
    console.log('[exportCard] FORCE SAVING before export, format:', format);
    try {
      await get().saveCard();
      // Small delay to ensure database write completes
      await new Promise(resolve => setTimeout(resolve, 150));
      console.log('[exportCard] Save completed, proceeding with export');
    } catch (err) {
      console.error('[exportCard] FAILED to save before export:', err);
      alert(`Failed to save card before export: ${err}`);
      return;
    }

    const { data, error } = await api.exportCard(currentCard.meta.id, format);
    if (error) {
      console.error('Failed to export card:', error);
      return;
    }

    if (data) {
      // Download file
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentCard.meta.name}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  },

  // Update token counts
  updateTokenCounts: async () => {
    const { currentCard, tokenizerModel } = get();
    if (!currentCard) return;

    const payload: Record<string, string> = {};

    // Extract card data (handles both wrapped and unwrapped formats)
    const cardData = extractCardData(currentCard);

    payload.name = cardData.name || '';
    payload.description = cardData.description || '';
    payload.personality = cardData.personality || '';
    payload.scenario = cardData.scenario || '';
    payload.first_mes = cardData.first_mes || '';
    payload.mes_example = cardData.mes_example || '';
    payload.system_prompt = cardData.system_prompt || '';
    payload.post_history_instructions = cardData.post_history_instructions || '';

    if (cardData.alternate_greetings) {
      payload.alternate_greetings = cardData.alternate_greetings.join('\n');
    }

    if (cardData.character_book?.entries) {
      payload.lorebook = cardData.character_book.entries.map((e) => e.content).join('\n');
    }

    const { data, error } = await api.tokenize({ model: tokenizerModel, payload });
    if (error) {
      console.error('Failed to tokenize:', error);
      return;
    }

    if (data) {
      set({ tokenCounts: { ...data.fields, total: data.total } });
    }
  },

  setTokenizerModel: (model) => {
    set({ tokenizerModel: model });
    get().updateTokenCounts();
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setShowAdvanced: (show) => set({ showAdvanced: show }),

  setSpecMode: (mode) => {
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

    set({
      currentCard: updatedCard,
      specMode: mode,
      showV3Fields: mode === 'v3',
      isDirty: true
    });
  },

  toggleV3Fields: () => {
    set((state) => ({ showV3Fields: !state.showV3Fields }));
  },
}));