/**
 * Tokenizer utility for token counting
 */

import { registry, type TokenizerAdapter } from '@character-foundry/character-foundry/tokenizers';

/**
 * Get tokenizer (defaults to GPT-4)
 */
export function getTokenizer(id?: string): TokenizerAdapter {
  return registry.get(id);
}

/**
 * Count tokens for a single text
 */
export function estimateTokens(text: string, tokenizerId?: string): number {
  const tokenizer = getTokenizer(tokenizerId);
  return tokenizer.count(text);
}

/**
 * Count tokens for multiple texts
 */
export function estimateTokensMany(texts: string[], tokenizerId?: string): number[] {
  const tokenizer = getTokenizer(tokenizerId);
  return tokenizer.countMany(texts);
}
