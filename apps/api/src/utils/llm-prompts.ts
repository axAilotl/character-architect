/**
 * LLM Prompt Builder
 * Constructs system and user prompts based on field context and preset operations
 */

import type {
  LLMMessage,
  FieldContext,
  PresetConfig,
  PresetOperation,
} from '@card-architect/schemas';

/**
 * Build system message for LLM
 */
function buildSystemMessage(spec: string): string {
  return `You are an expert CCv${spec === 'v3' ? '3' : '2'} character card editor. Obey style/format rules strictly.
If asked to rewrite, preserve character voice and factual details.
Return only the rewritten text unless otherwise requested.

FORMATTING RULES:
- Respect CCv${spec === 'v3' ? '3' : '2'} format and placeholders {{char}} / {{user}}.
- For dialogue: Use "quoted dialogue" for speech and *italic actions* for actions.
- Keep consistent tense (usually present tense for character descriptions).
- Preserve line breaks and paragraph structure.
- Do not add meta-commentary or explanations unless requested.`;
}

/**
 * Build user prompt based on context and instruction
 */
function buildUserPrompt(
  instruction: string,
  context: FieldContext,
  preset?: PresetConfig
): string {
  let prompt = '';

  // Add preset-specific instructions
  if (preset) {
    const presetInstructions = getPresetInstructions(preset);
    prompt += `${presetInstructions}\n\n`;
  }

  // Add main instruction
  prompt += `TASK: ${instruction}\n\n`;

  // Add field context
  prompt += `TARGET_FIELD: ${context.fieldName}\n`;
  prompt += `SPEC: CCv${context.spec === 'v3' ? '3' : '2'}\n\n`;

  // Add other fields as context if provided
  if (context.otherFields && Object.keys(context.otherFields).length > 0) {
    prompt += `CARD_CONTEXT:\n`;
    for (const [field, value] of Object.entries(context.otherFields)) {
      if (value) {
        const truncated = value.length > 500 ? value.slice(0, 500) + '...' : value;
        prompt += `- ${field}: ${truncated}\n`;
      }
    }
    prompt += '\n';
  }

  // Add lore entries if provided
  if (context.loreEntries && context.loreEntries.length > 0) {
    prompt += `ACTIVE_LORE_ENTRIES:\n`;
    context.loreEntries.forEach((entry, i) => {
      const truncated = entry.length > 300 ? entry.slice(0, 300) + '...' : entry;
      prompt += `${i + 1}. ${truncated}\n`;
    });
    prompt += '\n';
  }

  // Add RAG snippets if provided
  if (context.ragSnippets && context.ragSnippets.length > 0) {
    prompt += `REFERENCE_DOCUMENTATION:\n`;
    context.ragSnippets.forEach((snippet) => {
      prompt += `[Source: ${snippet.source}]\n${snippet.content}\n\n`;
    });
  }

  // Add the text to operate on
  const textToProcess = context.selection || context.currentValue;
  prompt += `TEXT:\n${textToProcess}`;

  return prompt;
}

/**
 * Get preset-specific instructions
 */
function getPresetInstructions(preset: PresetConfig): string {
  const { operation, params } = preset;

  switch (operation) {
    case 'tighten':
      const tokenTarget = params?.tokenTarget || 200;
      return `Rewrite to approximately ${tokenTarget} tokens. Preserve meaning, voice, and key details.
Remove redundancy and filler. Keep formatting rules intact.
Output only the rewritten text.`;

    case 'convert-structured':
      return `Reformat into structured style with labeled sections and nested bullets.
Do not invent new facts. Keep {{char}}/{{user}} placeholders.
Output only the reformatted text.`;

    case 'convert-prose':
      return `Convert to flowing prose style with natural paragraphs.
Maintain all information but make it read smoothly.
Output only the prose version.`;

    case 'convert-hybrid':
      return `Convert to hybrid style: prose paragraphs for narrative, bullets for key facts.
Balance readability with information density.
Output only the hybrid format.`;

    case 'enforce-style':
      return `Enforce consistent formatting:
- Dialogue: "quoted speech"
- Actions: *italic actions*
- Present tense for descriptions
- Proper {{char}}/{{user}} placeholder usage
Output only the corrected text.`;

    case 'generate-alts':
      const count = params?.count || 3;
      return `Create ${count} alternate greetings, each a complete opening in the card's format.
Vary mood, setting, and hook. Keep voice consistent.
Return as a JSON array of strings, each greeting on one element.
Format: ["greeting 1 text", "greeting 2 text", ...]`;

    case 'generate-lore':
      return `Propose a lorebook entry for this content. Return as JSON:
{
  "keys": ["key1", "key2"],
  "secondaryKeys": [],
  "content": "entry content",
  "priority": 10,
  "insertionOrder": 100,
  "position": "after_char"
}`;

    case 'custom':
    default:
      return ''; // No preset instructions
  }
}

/**
 * Build complete prompt for LLM invocation
 */
export function buildPrompt(
  instruction: string,
  context: FieldContext,
  preset?: PresetConfig
): { system: string; messages: LLMMessage[] } {
  const system = buildSystemMessage(context.spec);
  const userPrompt = buildUserPrompt(instruction, context, preset);

  return {
    system,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  };
}

/**
 * Build prompt for token budget estimation
 */
export function buildPromptForTokenEstimate(
  instruction: string,
  context: FieldContext,
  preset?: PresetConfig
): string {
  const { system, messages } = buildPrompt(instruction, context, preset);
  return `${system}\n\n${messages.map((m) => m.content).join('\n\n')}`;
}
