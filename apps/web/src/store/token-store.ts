import { create } from 'zustand';
import { api } from '../lib/api';
import { extractCardData } from '../lib/card-utils';
import { getDeploymentConfig } from '../config/deployment';
import { tokenizerRegistry } from '@card-architect/tokenizers';
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
    payload.creator_notes = cardData.creator_notes || '';

    // Extensions: appearance (voxta or visual_description)
    const extensions = (cardData as any).extensions || {};
    const appearance = extensions.voxta?.appearance || extensions.visual_description || '';
    if (appearance) {
      payload.appearance = appearance;
    }

    // Extensions: character_note (depth_prompt.prompt)
    const characterNote = extensions.depth_prompt?.prompt || '';
    if (characterNote) {
      payload.character_note = characterNote;
    }

    // Alternate greetings - tokenize each separately
    if (cardData.alternate_greetings && cardData.alternate_greetings.length > 0) {
      cardData.alternate_greetings.forEach((greeting, index) => {
        payload[`alternate_greeting_${index}`] = greeting || '';
      });
    }

    if (cardData.character_book?.entries) {
      payload.lorebook = cardData.character_book.entries.map((e) => e.content).join('\n');
    }

    const config = getDeploymentConfig();

    // Client-side tokenization for light/static modes
    if (config.mode === 'light' || config.mode === 'static') {
      const tokenizer = tokenizerRegistry.get(tokenizerModel);
      if (!tokenizer) {
        console.error('Tokenizer not found:', tokenizerModel);
        return;
      }

      const fields: Record<string, number> = {};
      let total = 0;

      for (const [key, value] of Object.entries(payload)) {
        const count = tokenizer.estimate(value);
        fields[key] = count;
        total += count;
      }

      set({ tokenCounts: { ...fields, total } });
      return;
    }

    // Server-side tokenization for full mode
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
