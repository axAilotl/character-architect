/**
 * Tokenizer utility for token counting
 */

import { tokenizerRegistry } from '@card-architect/tokenizers';
import type { TokenizerAdapter } from '@card-architect/schemas';

/**
 * Get default tokenizer (GPT-2 BPE approximation)
 */
export function getTokenizer(id?: string): TokenizerAdapter {
  const tokenizer = id ? tokenizerRegistry.get(id) : tokenizerRegistry.get('gpt2-bpe-approx');

  if (!tokenizer) {
    throw new Error(`Tokenizer not found: ${id}`);
  }

  return tokenizer;
}

/**
 * Estimate tokens for a single text
 */
export function estimateTokens(text: string, tokenizerId?: string): number {
  const tokenizer = getTokenizer(tokenizerId);
  return tokenizer.estimate(text);
}

/**
 * Estimate tokens for multiple texts
 */
export function estimateTokensMany(texts: string[], tokenizerId?: string): number[] {
  const tokenizer = getTokenizer(tokenizerId);
  return tokenizer.estimateMany(texts);
}
