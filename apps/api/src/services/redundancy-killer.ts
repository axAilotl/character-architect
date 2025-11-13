import type { CCv2Data, CCv3Data } from '@card-architect/schemas';

/**
 * Redundancy detection result
 */
export interface RedundancyReport {
  redundancies: Redundancy[];
  potentialSavings: number; // Token count
  overallScore: number; // 0-100, lower is better
}

/**
 * Individual redundancy finding
 */
export interface Redundancy {
  id: string;
  type: 'exact-duplicate' | 'semantic-overlap' | 'repeated-phrase';
  severity: 'high' | 'medium' | 'low';
  fields: RedundantField[];
  description: string;
  tokenImpact: number;
  suggestions: ConsolidationSuggestion[];
}

/**
 * A field containing redundant content
 */
export interface RedundantField {
  fieldName: string;
  content: string;
  startIndex: number;
  endIndex: number;
  excerpt: string;
}

/**
 * Suggestion for consolidating redundancy
 */
export interface ConsolidationSuggestion {
  action: 'remove' | 'merge' | 'rewrite';
  targetField: string;
  sourceFields: string[];
  originalContent: Record<string, string>;
  proposedContent: Record<string, string>;
  tokenDelta: number;
  confidence: number; // 0-1
}

/**
 * Tokenizer function type
 */
export type TokenCounter = (text: string) => number;

/**
 * Redundancy Killer Service
 * Detects and suggests fixes for redundant content across card fields
 */
export class RedundancyKiller {
  private tokenCounter: TokenCounter;

  constructor(tokenCounter: TokenCounter) {
    this.tokenCounter = tokenCounter;
  }

  /**
   * Analyze a card for redundancies
   */
  analyzeCard(card: CCv2Data | CCv3Data): RedundancyReport {
    const redundancies: Redundancy[] = [];

    // Extract relevant text fields
    const fields = this.extractFields(card);

    // Check for exact duplicates
    redundancies.push(...this.findExactDuplicates(fields));

    // Check for semantic overlap
    redundancies.push(...this.findSemanticOverlap(fields));

    // Check for repeated phrases
    redundancies.push(...this.findRepeatedPhrases(fields));

    // Calculate potential savings
    const potentialSavings = redundancies.reduce((sum, r) => sum + r.tokenImpact, 0);

    // Calculate overall score (0-100, lower is better)
    const totalTokens = Object.values(fields).reduce(
      (sum, content) => sum + this.tokenCounter(content),
      0
    );
    const overallScore = totalTokens > 0 ? Math.min(100, (potentialSavings / totalTokens) * 200) : 0;

    return {
      redundancies,
      potentialSavings,
      overallScore,
    };
  }

  /**
   * Extract text fields from card
   */
  private extractFields(card: CCv2Data | CCv3Data): Record<string, string> {
    const fields: Record<string, string> = {};

    // Common fields
    const fieldNames = [
      'description',
      'personality',
      'scenario',
      'first_mes',
      'mes_example',
      'system_prompt',
    ];

    for (const fieldName of fieldNames) {
      let value = '';

      // Try direct access
      if (fieldName in card) {
        value = (card as any)[fieldName];
      }
      // Try data object
      else if ('data' in card && card.data && fieldName in card.data) {
        value = (card.data as any)[fieldName];
      }

      if (value && typeof value === 'string' && value.trim()) {
        fields[fieldName] = value.trim();
      }
    }

    return fields;
  }

  /**
   * Find exact duplicate sentences/paragraphs
   */
  private findExactDuplicates(fields: Record<string, string>): Redundancy[] {
    const redundancies: Redundancy[] = [];
    const fieldNames = Object.keys(fields);
    const seenSentences = new Map<string, { field: string; index: number }>();

    for (const fieldName of fieldNames) {
      const content = fields[fieldName];
      const sentences = this.splitIntoSentences(content);

      sentences.forEach((sentence, index) => {
        const normalized = sentence.trim().toLowerCase();

        // Ignore very short sentences
        if (normalized.length < 20) return;

        const existing = seenSentences.get(normalized);
        if (existing && existing.field !== fieldName) {
          // Found a duplicate
          const redundancy: Redundancy = {
            id: `dup-${Date.now()}-${Math.random()}`,
            type: 'exact-duplicate',
            severity: 'high',
            fields: [
              {
                fieldName: existing.field,
                content: sentence,
                startIndex: 0,
                endIndex: sentence.length,
                excerpt: this.createExcerpt(sentence),
              },
              {
                fieldName,
                content: sentence,
                startIndex: 0,
                endIndex: sentence.length,
                excerpt: this.createExcerpt(sentence),
              },
            ],
            description: `Exact duplicate found between ${existing.field} and ${fieldName}`,
            tokenImpact: this.tokenCounter(sentence),
            suggestions: this.generateRemoveSuggestion(fieldName, sentence, existing.field),
          };

          redundancies.push(redundancy);
        } else {
          seenSentences.set(normalized, { field: fieldName, index });
        }
      });
    }

    return redundancies;
  }

  /**
   * Find semantic overlap (similar meaning, different words)
   */
  private findSemanticOverlap(fields: Record<string, string>): Redundancy[] {
    const redundancies: Redundancy[] = [];
    const fieldNames = Object.keys(fields);

    // Check specific field pairs that commonly overlap
    const checkPairs = [
      ['description', 'personality'],
      ['description', 'scenario'],
      ['personality', 'scenario'],
      ['scenario', 'first_mes'],
    ];

    for (const [field1, field2] of checkPairs) {
      if (!fields[field1] || !fields[field2]) continue;

      const overlap = this.detectPhraseOverlap(fields[field1], fields[field2]);

      if (overlap.score > 0.3) {
        // Threshold for semantic overlap
        const redundancy: Redundancy = {
          id: `overlap-${Date.now()}-${Math.random()}`,
          type: 'semantic-overlap',
          severity: overlap.score > 0.6 ? 'high' : 'medium',
          fields: [
            {
              fieldName: field1,
              content: fields[field1],
              startIndex: 0,
              endIndex: fields[field1].length,
              excerpt: this.createExcerpt(fields[field1], 100),
            },
            {
              fieldName: field2,
              content: fields[field2],
              startIndex: 0,
              endIndex: fields[field2].length,
              excerpt: this.createExcerpt(fields[field2], 100),
            },
          ],
          description: `${field1} and ${field2} have ${Math.round(overlap.score * 100)}% semantic overlap`,
          tokenImpact: Math.floor(overlap.overlapTokens),
          suggestions: this.generateMergeSuggestion(field1, field2, fields),
        };

        redundancies.push(redundancy);
      }
    }

    return redundancies;
  }

  /**
   * Find repeated phrases across fields
   */
  private findRepeatedPhrases(fields: Record<string, string>): Redundancy[] {
    const redundancies: Redundancy[] = [];
    const fieldNames = Object.keys(fields);

    // Extract significant phrases (3+ words)
    const phraseMap = new Map<string, Array<{ field: string; phrase: string }>>();

    for (const fieldName of fieldNames) {
      const content = fields[fieldName];
      const phrases = this.extractPhrases(content, 3, 8); // 3-8 word phrases

      for (const phrase of phrases) {
        const normalized = phrase.toLowerCase().trim();

        if (!phraseMap.has(normalized)) {
          phraseMap.set(normalized, []);
        }

        phraseMap.get(normalized)!.push({ field: fieldName, phrase });
      }
    }

    // Find phrases that appear in multiple fields
    for (const [phraseKey, occurrences] of phraseMap.entries()) {
      if (occurrences.length > 1) {
        const uniqueFields = new Set(occurrences.map((o) => o.field));

        // Only report if appears in different fields
        if (uniqueFields.size > 1) {
          const phrase = occurrences[0].phrase;
          const redundancy: Redundancy = {
            id: `phrase-${Date.now()}-${Math.random()}`,
            type: 'repeated-phrase',
            severity: 'low',
            fields: occurrences.map((occ) => ({
              fieldName: occ.field,
              content: occ.phrase,
              startIndex: 0,
              endIndex: occ.phrase.length,
              excerpt: this.createExcerpt(occ.phrase),
            })),
            description: `Phrase "${phrase}" repeated across ${uniqueFields.size} fields`,
            tokenImpact: this.tokenCounter(phrase) * (occurrences.length - 1),
            suggestions: [],
          };

          redundancies.push(redundancy);
        }
      }
    }

    return redundancies;
  }

  /**
   * Detect phrase-level overlap between two texts
   */
  private detectPhraseOverlap(text1: string, text2: string): { score: number; overlapTokens: number } {
    const phrases1 = new Set(this.extractPhrases(text1, 3, 6).map((p) => p.toLowerCase()));
    const phrases2 = new Set(this.extractPhrases(text2, 3, 6).map((p) => p.toLowerCase()));

    let overlapCount = 0;
    let overlapTokens = 0;

    for (const phrase of phrases1) {
      if (phrases2.has(phrase)) {
        overlapCount++;
        overlapTokens += this.tokenCounter(phrase);
      }
    }

    const totalPhrases = phrases1.size + phrases2.size;
    const score = totalPhrases > 0 ? (2 * overlapCount) / totalPhrases : 0;

    return { score, overlapTokens };
  }

  /**
   * Extract n-word phrases from text
   */
  private extractPhrases(text: string, minWords: number, maxWords: number): string[] {
    const words = text.split(/\s+/);
    const phrases: string[] = [];

    for (let len = minWords; len <= maxWords; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');

        // Filter out phrases with too much punctuation or special chars
        if (phrase.match(/[a-zA-Z]/g)?.length ?? 0 > phrase.length * 0.7) {
          phrases.push(phrase);
        }
      }
    }

    return phrases;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Create excerpt for display
   */
  private createExcerpt(text: string, maxLength = 150): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Generate suggestion to remove duplicate
   */
  private generateRemoveSuggestion(
    targetField: string,
    content: string,
    sourceField: string
  ): ConsolidationSuggestion[] {
    return [
      {
        action: 'remove',
        targetField,
        sourceFields: [sourceField],
        originalContent: { [targetField]: content },
        proposedContent: { [targetField]: '' },
        tokenDelta: -this.tokenCounter(content),
        confidence: 0.95,
      },
    ];
  }

  /**
   * Generate suggestion to merge overlapping content
   */
  private generateMergeSuggestion(
    field1: string,
    field2: string,
    fields: Record<string, string>
  ): ConsolidationSuggestion[] {
    // Simple heuristic: keep content in the earlier field (description > personality > scenario)
    const fieldPriority = ['description', 'personality', 'scenario', 'first_mes', 'mes_example'];
    const priority1 = fieldPriority.indexOf(field1);
    const priority2 = fieldPriority.indexOf(field2);

    const keepField = priority1 < priority2 ? field1 : field2;
    const reduceField = priority1 < priority2 ? field2 : field1;

    return [
      {
        action: 'merge',
        targetField: keepField,
        sourceFields: [field1, field2],
        originalContent: {
          [field1]: fields[field1],
          [field2]: fields[field2],
        },
        proposedContent: {
          [keepField]: fields[keepField],
          [reduceField]: '', // Would need smarter logic to actually merge
        },
        tokenDelta: -this.tokenCounter(fields[reduceField]),
        confidence: 0.6,
      },
    ];
  }
}
