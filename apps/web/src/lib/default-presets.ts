import type { UserPreset } from './types';

const defaultNow = new Date().toISOString();

export const defaultPresets: UserPreset[] = [
  {
    id: 'tighten-200',
    name: 'Tighten (200 tokens)',
    description: 'Reduce text to approximately 200 tokens while preserving meaning',
    instruction: 'Rewrite to approximately 200 tokens. Preserve meaning, voice, and key details. Remove redundancy and filler. Keep formatting rules intact. Output only the rewritten text.',
    category: 'rewrite',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
  {
    id: 'tighten-150',
    name: 'Tighten (150 tokens)',
    description: 'Reduce text to approximately 150 tokens while preserving meaning',
    instruction: 'Rewrite to approximately 150 tokens. Preserve meaning, voice, and key details. Remove redundancy and filler. Keep formatting rules intact. Output only the rewritten text.',
    category: 'rewrite',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
  {
    id: 'convert-structured',
    name: 'Convert to Structured',
    description: 'Reformat into structured style with labeled sections and bullets',
    instruction: 'Reformat into structured style with labeled sections and nested bullets. Do not invent new facts. Keep {{char}}/{{user}} placeholders. Output only the reformatted text.',
    category: 'format',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
  {
    id: 'convert-prose',
    name: 'Convert to Prose',
    description: 'Convert to flowing prose with natural paragraphs',
    instruction: 'Convert to flowing prose style with natural paragraphs. Maintain all information but make it read smoothly. Output only the prose version.',
    category: 'format',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
  {
    id: 'convert-hybrid',
    name: 'Convert to Hybrid',
    description: 'Mix prose paragraphs with bulleted key facts',
    instruction: 'Convert to hybrid style: prose paragraphs for narrative, bullets for key facts. Balance readability with information density. Output only the hybrid format.',
    category: 'format',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
  {
    id: 'enforce-style',
    name: 'Enforce Style Rules',
    description: 'Fix formatting: quoted dialogue, italic actions, consistent tense',
    instruction: 'Enforce consistent formatting:\n- Dialogue: "quoted speech"\n- Actions: *italic actions*\n- Present tense for descriptions\n- Proper {{char}}/{{user}} placeholder usage\nOutput only the corrected text.',
    category: 'format',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
  {
    id: 'format-jed',
    name: 'Format to JED',
    description: 'Reformat character card content to JED template structure',
    instruction: 
      `Reformat the provided character content into the JED (JSON Enhanced Definition) template format. Use these section headers and structure:

# Setting
- Time Period:
- World Details:
- Main Characters: {{user}}, {{char}}

## Lore
[Worldbuilding information]

# {{char}}

## Overview
[Brief character concept]

## Appearance Details
- Race:
- Height:
- Age:
- Hair:
- Eyes:
- Body:
- Face:
- Features:

## Starting Outfit
[Clothing items as bullet list]

## Personality
- Archetype:
- Tags:
- Likes:
- Dislikes:
- Details:
- With {{user}}:

## Behaviour and Habits
[Bullet list of behaviors]

## Speech
- Style:
- Quirks:
- Ticks:

Extract and organize the existing content into these sections. Do not invent new facts. Keep {{char}}/{{user}} placeholders. Output only the reformatted text.`,
    category: 'format',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
  {
    id: 'format-jed-plus',
    name: 'Format to JED+',
    description: 'Reformat character card content to comprehensive JED+ template with Q&A sections',
    instruction: 
      `Reformat the provided character content into the JED+ (Extended JSON Enhanced Definition) template format with Q&A sections. Use this structure:

# [SETTING]
- Time/Period:
- World Details:
- Main Characters: {{user}}, {{char}}

## LORE
[Worldbuilding]

## SCENARIO OVERVIEW
[Main scenario description]

<{{char}}>

# [{{char}}]

## CHARACTER OVERVIEW
[Brief concept]

## [APPEARANCE]

### APPEARANCE DETAILS
- Full Name, Alias:
- Race:
- Sex/Gender:
- Height:
- Age:
- Hair:
- Eyes:
- Body:
- Face:
- Features:

- Appearance Trait:
  ↳ Details:
  ↳ Effect:

### STARTING OUTFIT
[Detailed outfit as nested list]

## [BASIC_INFO]

### ORIGIN (BACKSTORY)
[Character history]

### ABILITIES
- Ability:
  ↳ Details:

## [PERSONALITY_AND_TRAITS]

### PERSONALITY
- Archetype:
  ↳ Archetype Details:
  ↳ Reasoning:

- Personality Tags:

<Q&A>
Q: How {{char}} behaves with {{user}}? What is their relationship?
A: [Answer based on content]

Q: What is {{char}}\'s most favorite thing?
A: [Answer based on content]
</Q&A>

## [BEHAVIOR_NOTES]
[Bullet list]

## [SPEECH]

### GENERAL SPEECH INFO
- Style:
- Quirks:
- Ticks:

</{{char}}>

Extract and organize the existing content into these sections. Add Q&A entries where information is available. Do not invent new facts. Keep {{char}}/{{user}} placeholders. Output only the reformatted text.`,
    category: 'format',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
  {
    id: 'gen-greetings',
    name: 'Generate Alternate Greetings (3)',
    description: 'Create 3 alternate opening messages',
    instruction: 'Create 3 alternate greetings, each a complete opening in the card\'s format. Vary mood, setting, and hook. Keep voice consistent. Return as a JSON array of strings, each greeting on one element. Format: ["greeting 1 text", "greeting 2 text", "greeting 3 text"]',
    category: 'generate',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
  {
    id: 'gen-lorebook',
    name: 'Generate Lorebook Entry',
    description: 'Propose a lorebook entry for this content',
    instruction: 'Propose a lorebook entry for this content. Return as JSON:\n{\n  "keys": ["key1", "key2"],\n  "secondaryKeys": [],\n  "content": "entry content",\n  "priority": 10,\n  "insertionOrder": 100,\n  "position": "after_char"\n}',
    category: 'generate',
    isBuiltIn: true,
    isHidden: false,
    createdAt: defaultNow,
    updatedAt: defaultNow,
  },
];
