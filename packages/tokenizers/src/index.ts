import type { TokenizerAdapter } from '@card-architect/schemas';

/**
 * Simple BPE-style tokenizer estimate (GPT-2 approximation)
 * This is a rough estimate - real implementation would use HF tokenizers via WASM
 */
class SimpleBPETokenizer implements TokenizerAdapter {
  id = 'gpt2-bpe-approx';

  estimate(text: string): number {
    if (!text) return 0;

    // Rough approximation: ~4 chars per token for English text
    // This is simplified; real BPE is more complex
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const charCount = text.length;

    // Average: 1 token per 4 characters, but words count as tokens
    return Math.ceil(charCount / 4 + words.length * 0.3);
  }

  estimateMany(texts: string[]): number[] {
    return texts.map((t) => this.estimate(t));
  }
}

/**
 * LLaMA-style tokenizer estimate (SentencePiece approximation)
 */
class SimpleLLaMATokenizer implements TokenizerAdapter {
  id = 'llama-sp-approx';

  estimate(text: string): number {
    if (!text) return 0;

    // LLaMA tends to be slightly more efficient than GPT-2
    const charCount = text.length;
    return Math.ceil(charCount / 4.5);
  }

  estimateMany(texts: string[]): number[] {
    return texts.map((t) => this.estimate(t));
  }
}

/**
 * Generic tokenizer registry
 */
export class TokenizerRegistry {
  private tokenizers = new Map<string, TokenizerAdapter>();

  constructor() {
    // Register default tokenizers
    this.register(new SimpleBPETokenizer());
    this.register(new SimpleLLaMATokenizer());
  }

  register(tokenizer: TokenizerAdapter): void {
    this.tokenizers.set(tokenizer.id, tokenizer);
  }

  get(id: string): TokenizerAdapter | undefined {
    return this.tokenizers.get(id);
  }

  list(): TokenizerAdapter[] {
    return Array.from(this.tokenizers.values());
  }
}

// Export singleton instance
export const tokenizerRegistry = new TokenizerRegistry();

// Export types
export type { TokenizerAdapter };
