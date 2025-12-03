/**
 * Templates and Snippets Routes
 * JSON file-based storage for templates and snippets
 */

import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import type { Template, Snippet } from '@card-architect/schemas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths for JSON storage
const SETTINGS_DIR = join(__dirname, '../../data/settings/presets');
const TEMPLATES_PATH = join(SETTINGS_DIR, 'templates.json');
const SNIPPETS_PATH = join(SETTINGS_DIR, 'snippets.json');
const ELARA_VOSS_PATH = join(SETTINGS_DIR, 'elara_voss.json');

// Ensure directory exists
function ensureDir() {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

// Default templates
const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tpl-jed-plus',
    name: 'JED+ (Extended)',
    description: 'Comprehensive character template with detailed Q&A sections for appearance, personality, sexuality, and speech patterns',
    category: 'character',
    targetFields: 'all',
    content: {
      description: `# [SETTING]
- Time/Period:
- World Details:
- Main Characters: {{user}}, {{char}}

## LORE


## SCENARIO OVERVIEW


- - -

<{{char}}>

# [{{char}}]

## CHARACTER OVERVIEW


- - -

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
- Privates:

- Appearance Trait:
  ↳ Details:
  ↳ Effect:

### STARTING OUTFIT
- Head:
- Accessories:
- Makeup:
- Neck:
- Top:
- Bottom:
- Legs:
- Shoes:
- Underwear:

<Q&A>
Q: How does {{char}} rate their own attractiveness?
A:
</Q&A>

- - -

## [BASIC_INFO]

### ORIGIN (BACKSTORY)


### RESIDENCE


### CONNECTIONS


### SECRET


### INVENTORY
- Item:
  ↳ Details:

### ABILITIES
- Ability:
  ↳ Details:

- - -

## [PERSONALITY_AND_TRAITS]

### PERSONALITY
- Archetype:
  ↳ Archetype Details:
  ↳ Reasoning:

- Alignment:
  ↳ Alignment Details:
  ↳ Ideals:

- Personality Tags:

- Main Aspiration:
  ↳ Aspiration Details:
  ↳ Aspiration Goals:

- Unique Trait:
  ↳ Effects:

<Q&A>
Q: What does {{char}} do first? Think or act/talk?
A:

Q: What does {{char}} do in free time?
A:

Q: What is {{char}}'s most favorite thing?
A:

Q: What is {{char}}'s most hated thing?
A:

Q: What is {{char}} incredibly good with?
A:

Q: What is {{char}} awfully bad with?
A:

Q: How {{char}} behaves with {{user}}? What is their relationship?
A:

Q: Is {{char}} a likable character? What reputation {{char}} has?
A:

Q: Can {{char}} harm {{user}} and others throughout the story?
A:
</Q&A>

- - -

## [BEHAVIOR_NOTES]
-
-

- - -

## [SEXUALITY]

[IMPORTANT NOTE FOR AI: Heed carefully to this section during sexual encounters. Make sure {{char}} sticks to their sexual role and orientation during the story.]

### GENERAL SEXUAL INFO
- Sexual Orientation:
  ↳ Explanation:
- Role during sex:
  ↳ Explanation:

<Q&A>
Q: Is {{char}} a virgin?
A:

Q: What does {{char}} think about sex in general?
A:

Q: Does {{char}} talk dirty and swear?
A:

Q: Is {{char}} loyal to their partner?
A:
</Q&A>

- - -

## [SPEECH]

### GENERAL SPEECH INFO
- Style:
- Quirks:
- Ticks:

## Speech EXAMPLES AND OPINIONS
[IMPORTANT NOTE FOR AI: This section provides {{char}}'s speech examples, memories, thoughts, and {{char}}'s real opinions on subjects. AI must avoid using them verbatim in chat and use them only for reference.]

<speech_examples>
- ""
- ""
</speech_examples>

- - -

## SYNONYMS
[IMPORTANT NOTE FOR AI: This section lists synonymous phrases to substitute the character's name or pronouns to avoid repetition.]
-

- - -

## PREMADE STORY PLAN
- Milestone 1:
  ↳ Details:

- Milestone 2:
  ↳ Details:

</{{char}}>

- - -

## [PRESCENARIO]

## PREVIOUSLY


## NOTES
- `,
      scenario: '',
      first_mes: '',
      mes_example: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'tpl-jed',
    name: 'JED (Standard)',
    description: 'Clean character template with essential sections for appearance, personality, speech, and sexuality',
    category: 'character',
    targetFields: 'all',
    content: {
      description: `# Setting
- Time Period:
- World Details:
- Main Characters: {{user}}, {{char}}

## Lore


<{{char}}>

# {{char}}

## Overview


## Appearance Details
- Race:
- Height:
- Age:
- Hair:
- Eyes:
- Body:
- Face:
- Features:
- Privates:

## Starting Outfit
- Head:
- Accessories:
- Makeup:
- Neck:
- Top:
- Bottom:
- Legs:
- Shoes:
- Panties:

## Inventory
-
-

## Abilities
-
-

## Origin


## Residence


## Connections


## Goal


## Secret


## Personality
- Archetype:
- Tags:
- Likes:
- Dislikes:
- Deep-Rooted Fears:
- Details:
- When Safe:
- When Alone:
- When Cornered:
- With {{user}}:

## Behaviour and Habits
-
-

## Sexuality
- Sex/Gender:
- Sexual Orientation:
- Kinks/Preferences:

## Sexual Quirks and Habits
-
-

## Speech
- Style:
- Quirks:
- Ticks:

## Speech Examples and Opinions
[Important: This section provides {{char}}'s speech examples, memories, thoughts, and {{char}}'s real opinions on subjects. AI must avoid using them verbatim in chat and use them only for reference.]

Greeting Example:
""

Embarrassed over something:
""

A memory about something:
""

## {{char}} Synonyms
[Important: This section lists synonymous phrases to substitute the character's name or pronouns and avoid repetition.]
-
-

## Notes
-
-

</{{char}}>`,
      scenario: '',
      first_mes: '',
      mes_example: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'tpl-anime-character',
    name: 'Anime Character',
    description: 'Full card template for anime-style characters with expressive personality',
    category: 'character',
    targetFields: 'all',
    content: {
      description: '**Appearance:**\n[Physical description - hair, eyes, height, build, distinguishing features]\n\n**Background:**\n[Character history and origin]\n\n**Occupation:**\n[Role or job]',
      scenario: '{{user}} encounters {{char}} at [location]. [Current situation or conflict].',
      first_mes: '*[Action or expression]* \n\n"[Dialogue introducing themselves]"',
      mes_example: '<START>\n{{user}}: [Example user message]\n{{char}}: *[Action]* "[Response showing personality]"\n\n<START>\n{{user}}: [Another example]\n{{char}}: "[Response with catchphrase or quirk]"',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
];

// Default snippets (JED+ broken down + utility snippets)
const DEFAULT_SNIPPETS: Snippet[] = [
  // JED+ Sections as snippets
  {
    id: 'snip-jed-setting',
    name: 'JED: Setting',
    description: 'JED+ Setting section with time, world, and characters',
    category: 'jed',
    content: `# [SETTING]
- Time/Period:
- World Details:
- Main Characters: {{user}}, {{char}}

## LORE


## SCENARIO OVERVIEW

`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-jed-appearance',
    name: 'JED: Appearance',
    description: 'JED+ Appearance section with details and outfit',
    category: 'jed',
    content: `## [APPEARANCE]

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
- Privates:

- Appearance Trait:
  ↳ Details:
  ↳ Effect:

### STARTING OUTFIT
- Head:
- Accessories:
- Makeup:
- Neck:
- Top:
- Bottom:
- Legs:
- Shoes:
- Underwear:

<Q&A>
Q: How does {{char}} rate their own attractiveness?
A:
</Q&A>
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-jed-basic-info',
    name: 'JED: Basic Info',
    description: 'JED+ Basic info with backstory, residence, inventory, abilities',
    category: 'jed',
    content: `## [BASIC_INFO]

### ORIGIN (BACKSTORY)


### RESIDENCE


### CONNECTIONS


### SECRET


### INVENTORY
- Item:
  ↳ Details:

### ABILITIES
- Ability:
  ↳ Details:
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-jed-personality',
    name: 'JED: Personality',
    description: 'JED+ Personality section with archetype, alignment, and Q&A',
    category: 'jed',
    content: `## [PERSONALITY_AND_TRAITS]

### PERSONALITY
- Archetype:
  ↳ Archetype Details:
  ↳ Reasoning:

- Alignment:
  ↳ Alignment Details:
  ↳ Ideals:

- Personality Tags:

- Main Aspiration:
  ↳ Aspiration Details:
  ↳ Aspiration Goals:

- Unique Trait:
  ↳ Effects:

<Q&A>
Q: What does {{char}} do first? Think or act/talk?
A:

Q: What does {{char}} do in free time?
A:

Q: What is {{char}}'s most favorite thing?
A:

Q: What is {{char}}'s most hated thing?
A:

Q: What is {{char}} incredibly good with?
A:

Q: What is {{char}} awfully bad with?
A:

Q: How {{char}} behaves with {{user}}? What is their relationship?
A:

Q: Is {{char}} a likable character? What reputation {{char}} has?
A:

Q: Can {{char}} harm {{user}} and others throughout the story?
A:
</Q&A>

## [BEHAVIOR_NOTES]
-
-
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-jed-sexuality',
    name: 'JED: Sexuality',
    description: 'JED+ Sexuality section with orientation and Q&A',
    category: 'jed',
    content: `## [SEXUALITY]

[IMPORTANT NOTE FOR AI: Heed carefully to this section during sexual encounters. Make sure {{char}} sticks to their sexual role and orientation during the story.]

### GENERAL SEXUAL INFO
- Sexual Orientation:
  ↳ Explanation:
- Role during sex:
  ↳ Explanation:

<Q&A>
Q: Is {{char}} a virgin?
A:

Q: What does {{char}} think about sex in general?
A:

Q: Does {{char}} talk dirty and swear?
A:

Q: Is {{char}} loyal to their partner?
A:
</Q&A>
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-jed-speech',
    name: 'JED: Speech',
    description: 'JED+ Speech section with style, quirks, and examples',
    category: 'jed',
    content: `## [SPEECH]

### GENERAL SPEECH INFO
- Style:
- Quirks:
- Ticks:

## Speech EXAMPLES AND OPINIONS
[IMPORTANT NOTE FOR AI: This section provides {{char}}'s speech examples, memories, thoughts, and {{char}}'s real opinions on subjects. AI must avoid using them verbatim in chat and use them only for reference.]

<speech_examples>
- ""
- ""
</speech_examples>

## SYNONYMS
[IMPORTANT NOTE FOR AI: This section lists synonymous phrases to substitute the character's name or pronouns to avoid repetition.]
-
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-jed-story-plan',
    name: 'JED: Story Plan',
    description: 'JED+ Story milestones and pre-scenario',
    category: 'jed',
    content: `## PREMADE STORY PLAN
- Milestone 1:
  ↳ Details:

- Milestone 2:
  ↳ Details:

- - -

## [PRESCENARIO]

## PREVIOUSLY


## NOTES
-
`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  // Utility snippets
  {
    id: 'snip-ooc-instruction',
    name: 'OOC Instruction',
    description: 'Out of character instruction format',
    category: 'instruction',
    content: '[OOC: {{char}} will never break character or acknowledge being an AI]',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-char-behavior',
    name: 'Character Behavior Rule',
    description: 'Specify how {{char}} should behave',
    category: 'instruction',
    content: '{{char}} will always [specific behavior or rule]',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-divider',
    name: 'Section Divider',
    description: 'Visual separator for sections',
    category: 'format',
    content: '\n- - -\n',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-qa-block',
    name: 'Q&A Block',
    description: 'JED-style question and answer block',
    category: 'jed',
    content: `<Q&A>
Q: [Question about {{char}}?]
A:
</Q&A>`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-speech-example',
    name: 'Speech Example Block',
    description: 'JED-style speech examples section',
    category: 'jed',
    content: `<speech_examples>
- ""
- ""
</speech_examples>`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snip-char-tags',
    name: 'Character XML Tags',
    description: 'Opening and closing character tags',
    category: 'format',
    content: `<{{char}}>

</{{char}}>`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
];

interface TemplatesFile {
  version: string;
  templates: Template[];
}

interface SnippetsFile {
  version: string;
  snippets: Snippet[];
}

// ELARA VOSS name entry type
export interface ElaraVossName {
  gender: 'male' | 'female' | 'neutral';
  type: 'first' | 'last';
  name: string;
}

function loadTemplates(): Template[] {
  ensureDir();
  if (!existsSync(TEMPLATES_PATH)) {
    // Write defaults on first load
    saveTemplates(DEFAULT_TEMPLATES);
    return DEFAULT_TEMPLATES;
  }
  try {
    const data = readFileSync(TEMPLATES_PATH, 'utf-8');
    const parsed: TemplatesFile = JSON.parse(data);
    return parsed.templates || [];
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function saveTemplates(templates: Template[]) {
  ensureDir();
  const data: TemplatesFile = {
    version: '1.0',
    templates,
  };
  writeFileSync(TEMPLATES_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function loadSnippets(): Snippet[] {
  ensureDir();
  if (!existsSync(SNIPPETS_PATH)) {
    // Write defaults on first load
    saveSnippets(DEFAULT_SNIPPETS);
    return DEFAULT_SNIPPETS;
  }
  try {
    const data = readFileSync(SNIPPETS_PATH, 'utf-8');
    const parsed: SnippetsFile = JSON.parse(data);
    return parsed.snippets || [];
  } catch {
    return DEFAULT_SNIPPETS;
  }
}

function saveSnippets(snippets: Snippet[]) {
  ensureDir();
  const data: SnippetsFile = {
    version: '1.0',
    snippets,
  };
  writeFileSync(SNIPPETS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Default ELARA VOSS names (basic set)
const DEFAULT_ELARA_VOSS_NAMES: ElaraVossName[] = [
  { gender: 'male', type: 'first', name: 'Ace' },
  { gender: 'female', type: 'first', name: 'Nova' },
  { gender: 'neutral', type: 'last', name: 'Vega' },
];

function loadElaraVossNames(): ElaraVossName[] {
  ensureDir();
  if (!existsSync(ELARA_VOSS_PATH)) {
    // Write defaults on first load
    saveElaraVossNames(DEFAULT_ELARA_VOSS_NAMES);
    return DEFAULT_ELARA_VOSS_NAMES;
  }
  try {
    const data = readFileSync(ELARA_VOSS_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    // Handle both array format and object format
    return Array.isArray(parsed) ? parsed : (parsed.names || []);
  } catch {
    return DEFAULT_ELARA_VOSS_NAMES;
  }
}

function saveElaraVossNames(names: ElaraVossName[]) {
  ensureDir();
  writeFileSync(ELARA_VOSS_PATH, JSON.stringify(names, null, 2), 'utf-8');
}

export async function templateRoutes(fastify: FastifyInstance) {
  // Get all templates
  fastify.get('/templates', async () => {
    const templates = loadTemplates();
    return { templates };
  });

  // Get template by ID
  fastify.get<{ Params: { id: string } }>('/templates/:id', async (request, reply) => {
    const templates = loadTemplates();
    const template = templates.find(t => t.id === request.params.id);
    if (!template) {
      reply.code(404);
      return { error: 'Template not found' };
    }
    return { template };
  });

  // Create new template
  fastify.post<{ Body: Partial<Template> }>('/templates', async (request, reply) => {
    const { name, description, category, targetFields, content } = request.body;

    if (!name) {
      reply.code(400);
      return { error: 'Name is required' };
    }

    const templates = loadTemplates();
    const now = new Date().toISOString();
    const newTemplate: Template = {
      id: `tpl-${randomUUID()}`,
      name,
      description: description || '',
      category: category || 'custom',
      targetFields: targetFields || 'all',
      content: content || {},
      createdAt: now,
      updatedAt: now,
      isDefault: false,
    };

    templates.push(newTemplate);
    saveTemplates(templates);

    reply.code(201);
    return { template: newTemplate };
  });

  // Update template
  fastify.patch<{ Params: { id: string }; Body: Partial<Template> }>(
    '/templates/:id',
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const templates = loadTemplates();
      const index = templates.findIndex(t => t.id === id);

      if (index === -1) {
        reply.code(404);
        return { error: 'Template not found' };
      }

      const now = new Date().toISOString();
      templates[index] = {
        ...templates[index],
        ...updates,
        id, // preserve ID
        updatedAt: now,
      };

      saveTemplates(templates);
      return { template: templates[index] };
    }
  );

  // Delete template
  fastify.delete<{ Params: { id: string } }>('/templates/:id', async (request, reply) => {
    const templates = loadTemplates();
    const index = templates.findIndex(t => t.id === request.params.id);

    if (index === -1) {
      reply.code(404);
      return { error: 'Template not found' };
    }

    templates.splice(index, 1);
    saveTemplates(templates);
    return { success: true };
  });

  // Export all templates
  fastify.get('/templates/export/all', async (_request, reply) => {
    const templates = loadTemplates();

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="templates.json"');

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      templates,
    };
  });

  // Import templates
  fastify.post<{ Body: { templates: Template[]; replace?: boolean } }>(
    '/templates/import',
    async (request, reply) => {
      const { templates: importedTemplates, replace } = request.body;

      if (!Array.isArray(importedTemplates)) {
        reply.code(400);
        return { error: 'Invalid import format: templates must be an array' };
      }

      const now = new Date().toISOString();
      const existingTemplates = replace ? [] : loadTemplates();

      const imported: string[] = [];
      for (const tpl of importedTemplates) {
        if (!tpl.name) continue;

        const newTemplate: Template = {
          ...tpl,
          id: tpl.id || `tpl-${randomUUID()}`,
          createdAt: tpl.createdAt || now,
          updatedAt: now,
        };

        // Check for duplicate ID
        const existingIndex = existingTemplates.findIndex(t => t.id === newTemplate.id);
        if (existingIndex >= 0) {
          existingTemplates[existingIndex] = newTemplate;
        } else {
          existingTemplates.push(newTemplate);
        }
        imported.push(newTemplate.id);
      }

      saveTemplates(existingTemplates);

      return {
        success: true,
        imported: imported.length,
      };
    }
  );

  // Reset templates to defaults
  fastify.post('/templates/reset', async () => {
    saveTemplates(DEFAULT_TEMPLATES);
    return { success: true, templates: DEFAULT_TEMPLATES };
  });

  // ========== SNIPPETS ==========

  // Get all snippets
  fastify.get('/snippets', async () => {
    const snippets = loadSnippets();
    return { snippets };
  });

  // Get snippet by ID
  fastify.get<{ Params: { id: string } }>('/snippets/:id', async (request, reply) => {
    const snippets = loadSnippets();
    const snippet = snippets.find(s => s.id === request.params.id);
    if (!snippet) {
      reply.code(404);
      return { error: 'Snippet not found' };
    }
    return { snippet };
  });

  // Create new snippet
  fastify.post<{ Body: Partial<Snippet> }>('/snippets', async (request, reply) => {
    const { name, description, category, content } = request.body;

    if (!name) {
      reply.code(400);
      return { error: 'Name is required' };
    }

    const snippets = loadSnippets();
    const now = new Date().toISOString();
    const newSnippet: Snippet = {
      id: `snip-${randomUUID()}`,
      name,
      description: description || '',
      category: category || 'custom',
      content: content || '',
      createdAt: now,
      updatedAt: now,
      isDefault: false,
    };

    snippets.push(newSnippet);
    saveSnippets(snippets);

    reply.code(201);
    return { snippet: newSnippet };
  });

  // Update snippet
  fastify.patch<{ Params: { id: string }; Body: Partial<Snippet> }>(
    '/snippets/:id',
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const snippets = loadSnippets();
      const index = snippets.findIndex(s => s.id === id);

      if (index === -1) {
        reply.code(404);
        return { error: 'Snippet not found' };
      }

      const now = new Date().toISOString();
      snippets[index] = {
        ...snippets[index],
        ...updates,
        id, // preserve ID
        updatedAt: now,
      };

      saveSnippets(snippets);
      return { snippet: snippets[index] };
    }
  );

  // Delete snippet
  fastify.delete<{ Params: { id: string } }>('/snippets/:id', async (request, reply) => {
    const snippets = loadSnippets();
    const index = snippets.findIndex(s => s.id === request.params.id);

    if (index === -1) {
      reply.code(404);
      return { error: 'Snippet not found' };
    }

    snippets.splice(index, 1);
    saveSnippets(snippets);
    return { success: true };
  });

  // Export all snippets
  fastify.get('/snippets/export/all', async (_request, reply) => {
    const snippets = loadSnippets();

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="snippets.json"');

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      snippets,
    };
  });

  // Import snippets
  fastify.post<{ Body: { snippets: Snippet[]; replace?: boolean } }>(
    '/snippets/import',
    async (request, reply) => {
      const { snippets: importedSnippets, replace } = request.body;

      if (!Array.isArray(importedSnippets)) {
        reply.code(400);
        return { error: 'Invalid import format: snippets must be an array' };
      }

      const now = new Date().toISOString();
      const existingSnippets = replace ? [] : loadSnippets();

      const imported: string[] = [];
      for (const snip of importedSnippets) {
        if (!snip.name) continue;

        const newSnippet: Snippet = {
          ...snip,
          id: snip.id || `snip-${randomUUID()}`,
          createdAt: snip.createdAt || now,
          updatedAt: now,
        };

        // Check for duplicate ID
        const existingIndex = existingSnippets.findIndex(s => s.id === newSnippet.id);
        if (existingIndex >= 0) {
          existingSnippets[existingIndex] = newSnippet;
        } else {
          existingSnippets.push(newSnippet);
        }
        imported.push(newSnippet.id);
      }

      saveSnippets(existingSnippets);

      return {
        success: true,
        imported: imported.length,
      };
    }
  );

  // Reset snippets to defaults
  fastify.post('/snippets/reset', async () => {
    saveSnippets(DEFAULT_SNIPPETS);
    return { success: true, snippets: DEFAULT_SNIPPETS };
  });

  // ========== ELARA VOSS NAMES ==========

  // Get all ELARA VOSS names
  fastify.get('/elara-voss/names', async () => {
    const names = loadElaraVossNames();
    return { names };
  });

  // Get names by gender
  fastify.get<{ Params: { gender: string } }>('/elara-voss/names/:gender', async (request) => {
    const names = loadElaraVossNames();
    const { gender } = request.params;
    const filtered = names.filter(n => n.gender === gender || (gender === 'neutral' && n.type === 'last'));
    return { names: filtered };
  });

  // Import ELARA VOSS names (replace all)
  fastify.post<{ Body: { names: ElaraVossName[]; merge?: boolean } }>(
    '/elara-voss/names/import',
    async (request, reply) => {
      const { names: importedNames, merge } = request.body;

      if (!Array.isArray(importedNames)) {
        reply.code(400);
        return { error: 'Invalid import format: names must be an array' };
      }

      // Validate entries
      const validNames = importedNames.filter(n =>
        n.name &&
        typeof n.name === 'string' &&
        ['male', 'female', 'neutral'].includes(n.gender) &&
        ['first', 'last'].includes(n.type)
      );

      if (validNames.length === 0) {
        reply.code(400);
        return { error: 'No valid names found in import' };
      }

      if (merge) {
        // Merge with existing, avoiding duplicates
        const existing = loadElaraVossNames();
        const existingSet = new Set(existing.map(n => `${n.gender}:${n.type}:${n.name}`));
        const newNames = validNames.filter(n => !existingSet.has(`${n.gender}:${n.type}:${n.name}`));
        saveElaraVossNames([...existing, ...newNames]);
        return {
          success: true,
          imported: newNames.length,
          total: existing.length + newNames.length,
        };
      } else {
        // Replace all
        saveElaraVossNames(validNames);
        return {
          success: true,
          imported: validNames.length,
          total: validNames.length,
        };
      }
    }
  );

  // Export ELARA VOSS names
  fastify.get('/elara-voss/names/export', async (_request, reply) => {
    const names = loadElaraVossNames();

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="elara_voss_names.json"');

    return names;
  });

  // Reset ELARA VOSS names to defaults
  fastify.post('/elara-voss/names/reset', async () => {
    saveElaraVossNames(DEFAULT_ELARA_VOSS_NAMES);
    return { success: true, names: DEFAULT_ELARA_VOSS_NAMES };
  });

  // Get stats about names
  fastify.get('/elara-voss/stats', async () => {
    const names = loadElaraVossNames();
    return {
      total: names.length,
      male: {
        first: names.filter(n => n.gender === 'male' && n.type === 'first').length,
        last: names.filter(n => n.gender === 'male' && n.type === 'last').length,
      },
      female: {
        first: names.filter(n => n.gender === 'female' && n.type === 'first').length,
        last: names.filter(n => n.gender === 'female' && n.type === 'last').length,
      },
      neutral: {
        first: names.filter(n => n.gender === 'neutral' && n.type === 'first').length,
        last: names.filter(n => n.gender === 'neutral' && n.type === 'last').length,
      },
    };
  });
}
