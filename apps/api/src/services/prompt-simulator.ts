import type { CCv2Data, CCv3Data, CharacterBook } from '@character-foundry/character-foundry/schemas';

/**
 * Prompt composition profiles representing different frontend implementations
 */
export type PromptProfile = 'generic-ccv3' | 'strict-ccv3' | 'ccv2-compat';

/**
 * Field ordering and formatting rules for each profile
 */
export interface ProfileConfig {
  name: string;
  description: string;
  fieldOrder: string[];
  separators: {
    fieldSeparator: string;
    loreSeparator: string;
    exampleSeparator: string;
  };
  includeFieldLabels: boolean;
  loreInjectionStrategy: 'before-description' | 'after-description' | 'scan-depth';
}

/**
 * Token budget and drop policy configuration
 */
export interface TokenBudgetConfig {
  maxTokens: number;
  dropPolicy: 'oldest-first' | 'lowest-priority' | 'truncate-end';
  preserveFields: string[]; // Fields that should never be dropped
}

/**
 * Result of prompt composition with token breakdown
 */
export interface PromptComposition {
  profile: PromptProfile;
  fullPrompt: string;
  segments: PromptSegment[];
  totalTokens: number;
  droppedSegments: PromptSegment[];
  withinBudget: boolean;
}

/**
 * Individual segment of the composed prompt
 */
export interface PromptSegment {
  fieldName: string;
  content: string;
  tokens: number;
  priority: number;
  order: number;
  dropped: boolean;
}

/**
 * Profiles configuration
 */
const PROFILES: Record<PromptProfile, ProfileConfig> = {
  'generic-ccv3': {
    name: 'Generic CCv3',
    description: 'Standard CCv3 implementation with common field ordering',
    fieldOrder: [
      'system_prompt',
      'description',
      'personality',
      'scenario',
      'character_book',
      'mes_example',
      'first_mes',
    ],
    separators: {
      fieldSeparator: '\n\n',
      loreSeparator: '\n',
      exampleSeparator: '\n\n',
    },
    includeFieldLabels: false,
    loreInjectionStrategy: 'scan-depth',
  },
  'strict-ccv3': {
    name: 'Strict CCv3',
    description: 'Strict CCv3 with labeled fields and specific ordering',
    fieldOrder: [
      'system_prompt',
      'description',
      'personality',
      'scenario',
      'character_book',
      'first_mes',
      'alternate_greetings',
      'mes_example',
    ],
    separators: {
      fieldSeparator: '\n\n---\n\n',
      loreSeparator: '\n\n',
      exampleSeparator: '\n\n<START>\n',
    },
    includeFieldLabels: true,
    loreInjectionStrategy: 'after-description',
  },
  'ccv2-compat': {
    name: 'CCv2 Compatible',
    description: 'Legacy CCv2 format for backward compatibility',
    fieldOrder: [
      'description',
      'personality',
      'scenario',
      'mes_example',
      'first_mes',
    ],
    separators: {
      fieldSeparator: '\n',
      loreSeparator: '\n',
      exampleSeparator: '\n<START>\n',
    },
    includeFieldLabels: false,
    loreInjectionStrategy: 'before-description',
  },
};

/**
 * Tokenizer function type
 */
export type TokenCounter = (text: string) => number;

/**
 * Prompt Simulator Service
 * Composes prompts exactly as target applications would, with token tracking
 */
export class PromptSimulator {
  private tokenCounter: TokenCounter;

  constructor(tokenCounter: TokenCounter) {
    this.tokenCounter = tokenCounter;
  }

  /**
   * Compose a prompt using the specified profile
   */
  composePrompt(
    card: CCv2Data | CCv3Data,
    profile: PromptProfile,
    budget?: TokenBudgetConfig
  ): PromptComposition {
    const config = PROFILES[profile];
    const segments: PromptSegment[] = [];
    let order = 0;

    // Build segments according to profile's field order
    for (const fieldName of config.fieldOrder) {
      const segment = this.createSegment(card, fieldName, config, order);
      if (segment && segment.content.trim()) {
        segments.push(segment);
        order++;
      }
    }

    // Apply token budget if specified
    let finalSegments = segments;
    let droppedSegments: PromptSegment[] = [];

    if (budget) {
      const result = this.applyBudget(segments, budget);
      finalSegments = result.kept;
      droppedSegments = result.dropped;
    }

    // Compose final prompt
    const fullPrompt = this.assemblePrompt(finalSegments, config);
    const totalTokens = this.tokenCounter(fullPrompt);

    return {
      profile,
      fullPrompt,
      segments: finalSegments,
      totalTokens,
      droppedSegments,
      withinBudget: !budget || totalTokens <= budget.maxTokens,
    };
  }

  /**
   * Create a segment for a specific field
   */
  private createSegment(
    card: CCv2Data | CCv3Data,
    fieldName: string,
    config: ProfileConfig,
    order: number
  ): PromptSegment | null {
    let content = '';
    let priority = this.getFieldPriority(fieldName);

    switch (fieldName) {
      case 'system_prompt':
        content = this.getField(card, 'system_prompt');
        break;
      case 'description':
        content = this.getField(card, 'description');
        break;
      case 'personality':
        content = this.getField(card, 'personality');
        break;
      case 'scenario':
        content = this.getField(card, 'scenario');
        break;
      case 'first_mes':
        content = this.getField(card, 'first_mes');
        break;
      case 'mes_example':
        content = this.getField(card, 'mes_example');
        break;
      case 'alternate_greetings':
        // Only show count, not actual content
        const greetings = this.getField(card, 'alternate_greetings');
        if (Array.isArray(greetings) && greetings.length > 0) {
          content = `[${greetings.length} alternate greetings available]`;
        }
        break;
      case 'character_book':
        content = this.formatCharacterBook(
          this.getField(card, 'character_book'),
          config
        );
        break;
      default:
        content = this.getField(card, fieldName);
    }

    if (!content || !content.trim()) {
      return null;
    }

    const tokens = this.tokenCounter(content);

    return {
      fieldName,
      content,
      tokens,
      priority,
      order,
      dropped: false,
    };
  }

  /**
   * Get field value from card (supports both v2 and v3)
   */
  private getField(card: CCv2Data | CCv3Data, fieldName: string): any {
    // Direct field access
    if (fieldName in card) {
      return (card as any)[fieldName];
    }

    // Check in data object for v3
    if ('data' in card && card.data && fieldName in card.data) {
      return (card.data as any)[fieldName];
    }

    return '';
  }

  /**
   * Format character book entries
   */
  private formatCharacterBook(
    characterBook: CharacterBook | undefined,
    config: ProfileConfig
  ): string {
    if (!characterBook || !characterBook.entries || characterBook.entries.length === 0) {
      return '';
    }

    const entries = characterBook.entries
      .filter((entry) => entry.enabled !== false)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0)) // Highest priority first
      .map((entry) => {
        const keywords = Array.isArray(entry.keys) ? entry.keys.join(', ') : '';
        const prefix = config.includeFieldLabels
          ? `[Lore: ${keywords}]\n`
          : '';
        return prefix + entry.content;
      });

    return entries.join(config.separators.loreSeparator);
  }

  /**
   * Get priority for field (higher = more important, less likely to be dropped)
   */
  private getFieldPriority(fieldName: string): number {
    const priorities: Record<string, number> = {
      description: 100,
      first_mes: 90,
      personality: 80,
      scenario: 70,
      character_book: 60,
      mes_example: 50,
      system_prompt: 40,
      alternate_greetings: 10,
    };
    return priorities[fieldName] || 30;
  }

  /**
   * Apply token budget and drop policy
   */
  private applyBudget(
    segments: PromptSegment[],
    budget: TokenBudgetConfig
  ): { kept: PromptSegment[]; dropped: PromptSegment[] } {
    let currentTokens = segments.reduce((sum, seg) => sum + seg.tokens, 0);
    const kept: PromptSegment[] = [...segments];
    const dropped: PromptSegment[] = [];

    // If within budget, return all
    if (currentTokens <= budget.maxTokens) {
      return { kept, dropped };
    }

    // Apply drop policy
    switch (budget.dropPolicy) {
      case 'oldest-first':
        return this.dropOldestFirst(kept, budget);
      case 'lowest-priority':
        return this.dropLowestPriority(kept, budget);
      case 'truncate-end':
        return this.truncateEnd(kept, budget);
      default:
        return { kept, dropped };
    }
  }

  /**
   * Drop oldest segments first (highest order number)
   */
  private dropOldestFirst(
    segments: PromptSegment[],
    budget: TokenBudgetConfig
  ): { kept: PromptSegment[]; dropped: PromptSegment[] } {
    const sorted = [...segments].sort((a, b) => b.order - a.order);
    return this.dropUntilBudget(sorted, budget);
  }

  /**
   * Drop lowest priority segments first
   */
  private dropLowestPriority(
    segments: PromptSegment[],
    budget: TokenBudgetConfig
  ): { kept: PromptSegment[]; dropped: PromptSegment[] } {
    const sorted = [...segments].sort((a, b) => a.priority - b.priority);
    return this.dropUntilBudget(sorted, budget);
  }

  /**
   * Truncate from the end of the prompt
   */
  private truncateEnd(
    segments: PromptSegment[],
    budget: TokenBudgetConfig
  ): { kept: PromptSegment[]; dropped: PromptSegment[] } {
    const kept: PromptSegment[] = [];
    const dropped: PromptSegment[] = [];
    let currentTokens = 0;

    for (const segment of segments) {
      if (currentTokens + segment.tokens <= budget.maxTokens) {
        kept.push(segment);
        currentTokens += segment.tokens;
      } else {
        dropped.push({ ...segment, dropped: true });
      }
    }

    return { kept, dropped };
  }

  /**
   * Drop segments until within budget
   */
  private dropUntilBudget(
    sortedSegments: PromptSegment[],
    budget: TokenBudgetConfig
  ): { kept: PromptSegment[]; dropped: PromptSegment[] } {
    const kept: PromptSegment[] = [];
    const dropped: PromptSegment[] = [];
    let currentTokens = sortedSegments.reduce((sum, seg) => sum + seg.tokens, 0);

    for (const segment of sortedSegments) {
      const canDrop = !budget.preserveFields.includes(segment.fieldName);

      if (currentTokens > budget.maxTokens && canDrop) {
        dropped.push({ ...segment, dropped: true });
        currentTokens -= segment.tokens;
      } else {
        kept.push(segment);
      }
    }

    // Restore original order
    kept.sort((a, b) => a.order - b.order);

    return { kept, dropped };
  }

  /**
   * Assemble final prompt from segments
   */
  private assemblePrompt(segments: PromptSegment[], config: ProfileConfig): string {
    return segments
      .map((segment) => {
        if (config.includeFieldLabels && segment.fieldName !== 'character_book') {
          const label = this.formatFieldLabel(segment.fieldName);
          return `${label}:\n${segment.content}`;
        }
        return segment.content;
      })
      .join(config.separators.fieldSeparator);
  }

  /**
   * Format field name as human-readable label
   */
  private formatFieldLabel(fieldName: string): string {
    return fieldName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get all available profiles
   */
  static getProfiles(): Record<PromptProfile, ProfileConfig> {
    return PROFILES;
  }
}
