import { create } from 'zustand';
import type { Card, CCv2Data, CCv3Data } from '@card-architect/schemas';
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

  // Token counts
  tokenCounts: TokenCounts;
  tokenizerModel: string;

  // UI state
  activeTab: 'edit' | 'preview' | 'json' | 'diff' | 'simulator' | 'redundancy' | 'lore-trigger';
  showAdvanced: boolean;

  // Actions
  setCurrentCard: (card: Card | null) => void;
  updateCardData: (updates: Partial<CCv2Data | CCv3Data>) => void;
  saveCard: () => Promise<void>;
  loadCard: (id: string) => Promise<void>;
  createNewCard: () => void;
  importCard: (file: File) => Promise<void>;
  exportCard: (format: 'json' | 'png') => Promise<void>;

  // Token counting
  updateTokenCounts: () => Promise<void>;
  setTokenizerModel: (model: string) => void;

  // UI
  setActiveTab: (tab: 'edit' | 'preview' | 'json' | 'diff' | 'simulator' | 'redundancy' | 'lore-trigger') => void;
  setShowAdvanced: (show: boolean) => void;
}

export const useCardStore = create<CardStore>((set, get) => ({
  // Initial state
  currentCard: null,
  isDirty: false,
  isSaving: false,
  tokenCounts: { total: 0 },
  tokenizerModel: 'gpt2-bpe-approx',
  activeTab: 'edit',
  showAdvanced: false,

  // Set current card
  setCurrentCard: (card) => {
    set({ currentCard: card, isDirty: false });
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
  createNewCard: () => {
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
        },
      } as CCv3Data,
    };

    set({ currentCard: newCard, isDirty: true });
  },

  // Import card
  importCard: async (file) => {
    const { data, error } = await api.importCard(file);
    if (error) {
      console.error('Failed to import card:', error);
      return;
    }

    if (data && data.card) {
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
}));
