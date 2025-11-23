import { create } from 'zustand';
import { api } from '../lib/api';
import { extractCardData } from '../lib/card-utils';
import type { Card } from '@card-architect/schemas';

interface TokenCounts {
  [field: string]: number;
  total: number;
}

interface TokenStore {
  tokenCounts: TokenCounts;
  tokenizerModel: string;
  
  updateTokenCounts: (card: Card | null) => Promise<void>;
  setTokenizerModel: (model: string) => void;
}

export const useTokenStore = create<TokenStore>((set, get) => ({
  tokenCounts: { total: 0 },
  tokenizerModel: 'gpt2-bpe-approx',

  updateTokenCounts: async (card) => {
    const { tokenizerModel } = get();
    if (!card) {
        set({ tokenCounts: { total: 0 } });
        return;
    }

    const payload: Record<string, string> = {};

    // Extract card data (handles both wrapped and unwrapped formats)
    const cardData = extractCardData(card);

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
    // Note: Consumer should call updateTokenCounts(card) after this if they have the card
  },
}));
