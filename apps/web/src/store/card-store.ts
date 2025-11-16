import { create } from 'zustand';
import type { Card, CCv2Data, CCv3Data, CardMeta } from '@card-architect/schemas';
import { api } from '../lib/api';
import { localDB } from '../lib/db';

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
  activeTab: 'edit' | 'preview' | 'diff' | 'simulator' | 'redundancy' | 'lore-trigger' | 'focused';
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
  importCard: (file: File) => Promise<void>;
  exportCard: (format: 'json' | 'png' | 'charx') => Promise<void>;

  // Token counting
  updateTokenCounts: () => Promise<void>;
  setTokenizerModel: (model: string) => void;

  // UI
  setActiveTab: (
    tab: 'edit' | 'preview' | 'diff' | 'simulator' | 'redundancy' | 'lore-trigger' | 'focused'
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

    const newData = { ...currentCard.data, ...updates };
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
    const { currentCard } = get();
    if (!currentCard) return;

    set({ isSaving: true });

    try {
      if (currentCard.meta.id) {
        // Update existing card
        await api.updateCard(currentCard.meta.id, currentCard);
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
      console.error('Failed to save card:', err);
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
      return;
    }

    if (data && data.card) {
      const cardData = data.card.meta.spec === 'v3'
        ? (data.card.data as any).data
        : (data.card.data as any);
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
    }
  },

  // Export card
  exportCard: async (format) => {
    const { currentCard } = get();
    if (!currentCard || !currentCard.meta.id) return;

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

    // Extract fields based on spec
    if (currentCard.meta.spec === 'v3') {
      const data = (currentCard.data as CCv3Data).data;
      payload.name = data.name || '';
      payload.description = data.description || '';
      payload.personality = data.personality || '';
      payload.scenario = data.scenario || '';
      payload.first_mes = data.first_mes || '';
      payload.mes_example = data.mes_example || '';
      payload.system_prompt = data.system_prompt || '';
      payload.post_history_instructions = data.post_history_instructions || '';

      if (data.alternate_greetings) {
        payload.alternate_greetings = data.alternate_greetings.join('\n');
      }

      if (data.character_book?.entries) {
        payload.lorebook = data.character_book.entries.map((e) => e.content).join('\n');
      }
    } else {
      const data = currentCard.data as CCv2Data;
      payload.name = data.name || '';
      payload.description = data.description || '';
      payload.personality = data.personality || '';
      payload.scenario = data.scenario || '';
      payload.first_mes = data.first_mes || '';
      payload.mes_example = data.mes_example || '';
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
