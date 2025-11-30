/**
 * wwwyzzerdd Routes
 * AI-assisted character creation wizard prompts and chat
 */

import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths for JSON storage
const SETTINGS_DIR = join(__dirname, '../../data/settings/presets');
const WWWYZZERDD_PATH = join(SETTINGS_DIR, 'wwwyzzerdd.json');

// Ensure directory exists
function ensureDir() {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

// wwwyzzerdd prompt set interface
interface WwwyzzerddPromptSet {
  id: string;
  name: string;
  description?: string;
  characterPrompt: string;
  lorePrompt: string;
  personality: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Default prompt sets
const DEFAULT_PROMPT_SETS: WwwyzzerddPromptSet[] = [
  {
    id: 'wwwyzzerdd-default',
    name: 'Default Wizard',
    description: 'The classic wwwyzzerdd experience - friendly, creative, and helpful',
    characterPrompt: `You are wwwyzzerdd, a wise and friendly wizard who helps create character cards for roleplay.

Your role is to assist users in developing rich, detailed characters through conversation. Ask questions to understand their vision, make creative suggestions, and help fill in the details.

When the user describes their character, extract and organize information into these categories:
- Name and nicknames
- Physical appearance (age, height, body type, hair, eyes, distinguishing features)
- Personality traits and behaviors
- Background and history
- Relationships and how they interact with others
- Speech patterns and mannerisms
- The setting/world they inhabit

Be encouraging and build upon the user's ideas. Offer alternatives when asked. Use {{char}} to refer to the character and {{user}} for the person they'll interact with.

When you have enough information for a field, offer to fill it in. Present your suggestions clearly so they can be reviewed.`,
    lorePrompt: `You are wwwyzzerdd, helping create lorebook entries for a character's world.

Ask about:
- Important locations and their significance
- Key events and history
- Other characters and relationships
- Rules of the world (magic systems, technology, social structures)
- Cultural elements and customs

Create structured lorebook entries with:
- Clear trigger keywords
- Concise but informative content
- Appropriate insertion settings

Help organize the world's information into digestible, useful entries.`,
    personality: `wwwyzzerdd speaks with warmth and gentle enthusiasm. He occasionally uses wizard-themed expressions like "Ah, splendid!" or "Most intriguing..." but doesn't overdo it.

He's patient when users are unsure, offers multiple options when helpful, and celebrates creative ideas. He asks clarifying questions rather than making assumptions.

He has a knack for seeing potential in rough ideas and helping shape them into something special.`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wwwyzzerdd-concise',
    name: 'Efficient Assistant',
    description: 'Streamlined and direct - for users who know what they want',
    characterPrompt: `You are a character creation assistant. Help users define their character efficiently.

Focus on gathering essential information:
- Core identity (name, appearance, personality)
- Background (brief history, motivations)
- Behavior (how they act, speak, interact)

Be direct and organized. Present information in structured formats when filling fields. Ask one or two questions at a time, prioritizing the most important details first.

Use {{char}} for the character, {{user}} for the interaction partner.`,
    lorePrompt: `Help create lorebook entries efficiently.

For each entry, determine:
- Keywords (primary triggers)
- Content (essential information only)
- Priority and position

Keep entries focused and avoid redundancy. One concept per entry.`,
    personality: `Direct and efficient. Gets to the point without unnecessary flourish. Professional but not cold.`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wwwyzzerdd-creative',
    name: 'Creative Collaborator',
    description: 'Highly imaginative - expands on ideas and suggests unique elements',
    characterPrompt: `You are a creative collaborator helping bring characters to life!

Embrace unusual ideas and help expand them. When given a concept, explore interesting angles:
- What makes this character unique?
- What unexpected traits might they have?
- What internal conflicts could drive them?
- What quirks make them memorable?

Suggest evocative descriptions and vivid details. Help craft characters that surprise and delight.

Use {{char}} for the character, {{user}} for the roleplay partner. Be imaginative but stay true to the user's core vision.`,
    lorePrompt: `Help create rich, atmospheric worldbuilding!

Explore the world's depth:
- Hidden histories and secrets
- Sensory details (sights, sounds, smells)
- Tensions and conflicts
- Unique customs and beliefs

Create lorebook entries that bring the world alive with evocative language and interesting details.`,
    personality: `Enthusiastic and imaginative! Gets excited about creative ideas. Offers unexpected suggestions and "what if" scenarios. Loves finding the unique angle that makes a character special.`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Load prompt sets from file
function loadPromptSets(): WwwyzzerddPromptSet[] {
  ensureDir();
  if (!existsSync(WWWYZZERDD_PATH)) {
    // Initialize with defaults
    savePromptSets(DEFAULT_PROMPT_SETS);
    return DEFAULT_PROMPT_SETS;
  }
  try {
    const data = readFileSync(WWWYZZERDD_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.promptSets || [];
  } catch {
    return DEFAULT_PROMPT_SETS;
  }
}

// Save prompt sets to file
function savePromptSets(promptSets: WwwyzzerddPromptSet[]) {
  ensureDir();
  writeFileSync(WWWYZZERDD_PATH, JSON.stringify({ promptSets }, null, 2), 'utf-8');
}

export async function wwwyzzerddRoutes(fastify: FastifyInstance) {
  // Get all prompt sets
  fastify.get('/wwwyzzerdd/prompts', async () => {
    const promptSets = loadPromptSets();
    return { promptSets };
  });

  // Get single prompt set
  fastify.get<{ Params: { id: string } }>('/wwwyzzerdd/prompts/:id', async (request, reply) => {
    const promptSets = loadPromptSets();
    const promptSet = promptSets.find((p) => p.id === request.params.id);
    if (!promptSet) {
      reply.code(404);
      return { error: 'Prompt set not found' };
    }
    return { promptSet };
  });

  // Create prompt set
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      characterPrompt: string;
      lorePrompt: string;
      personality: string;
    };
  }>('/wwwyzzerdd/prompts', async (request, reply) => {
    const { name, description, characterPrompt, lorePrompt, personality } = request.body;

    if (!name || !characterPrompt || !lorePrompt || !personality) {
      reply.code(400);
      return { error: 'Name, characterPrompt, lorePrompt, and personality are required' };
    }

    const promptSets = loadPromptSets();
    const now = new Date().toISOString();

    const newPromptSet: WwwyzzerddPromptSet = {
      id: `wwwyzzerdd-${randomUUID()}`,
      name,
      description,
      characterPrompt,
      lorePrompt,
      personality,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    promptSets.push(newPromptSet);
    savePromptSets(promptSets);

    reply.code(201);
    return { promptSet: newPromptSet };
  });

  // Update prompt set
  fastify.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      description: string;
      characterPrompt: string;
      lorePrompt: string;
      personality: string;
    }>;
  }>('/wwwyzzerdd/prompts/:id', async (request, reply) => {
    const promptSets = loadPromptSets();
    const index = promptSets.findIndex((p) => p.id === request.params.id);

    if (index === -1) {
      reply.code(404);
      return { error: 'Prompt set not found' };
    }

    const existing = promptSets[index];
    if (existing.isDefault) {
      reply.code(403);
      return { error: 'Cannot modify default prompt sets. Copy it first.' };
    }

    const updated: WwwyzzerddPromptSet = {
      ...existing,
      ...request.body,
      updatedAt: new Date().toISOString(),
    };

    promptSets[index] = updated;
    savePromptSets(promptSets);

    return { promptSet: updated };
  });

  // Delete prompt set
  fastify.delete<{ Params: { id: string } }>('/wwwyzzerdd/prompts/:id', async (request, reply) => {
    const promptSets = loadPromptSets();
    const index = promptSets.findIndex((p) => p.id === request.params.id);

    if (index === -1) {
      reply.code(404);
      return { error: 'Prompt set not found' };
    }

    if (promptSets[index].isDefault) {
      reply.code(403);
      return { error: 'Cannot delete default prompt sets' };
    }

    promptSets.splice(index, 1);
    savePromptSets(promptSets);

    return { success: true };
  });

  // Copy prompt set
  fastify.post<{ Params: { id: string }; Body: { name?: string } }>(
    '/wwwyzzerdd/prompts/:id/copy',
    async (request, reply) => {
      const promptSets = loadPromptSets();
      const original = promptSets.find((p) => p.id === request.params.id);

      if (!original) {
        reply.code(404);
        return { error: 'Prompt set not found' };
      }

      const now = new Date().toISOString();
      const newPromptSet: WwwyzzerddPromptSet = {
        ...original,
        id: `wwwyzzerdd-${randomUUID()}`,
        name: request.body?.name || `${original.name} (Copy)`,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };

      promptSets.push(newPromptSet);
      savePromptSets(promptSets);

      reply.code(201);
      return { promptSet: newPromptSet };
    }
  );

  // Export all prompt sets
  fastify.get('/wwwyzzerdd/prompts/export/all', async (_request, reply) => {
    const promptSets = loadPromptSets();

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="wwwyzzerdd-prompts.json"');

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      promptSets: promptSets.map((p) => ({
        name: p.name,
        description: p.description,
        characterPrompt: p.characterPrompt,
        lorePrompt: p.lorePrompt,
        personality: p.personality,
      })),
    };
  });

  // Import prompt sets
  fastify.post<{
    Body: {
      promptSets: Array<{
        name: string;
        description?: string;
        characterPrompt: string;
        lorePrompt: string;
        personality: string;
      }>;
    };
  }>('/wwwyzzerdd/prompts/import', async (request, reply) => {
    const { promptSets: importData } = request.body;

    if (!Array.isArray(importData)) {
      reply.code(400);
      return { error: 'Invalid import format: promptSets must be an array' };
    }

    const existing = loadPromptSets();
    const now = new Date().toISOString();
    let imported = 0;

    for (const data of importData) {
      if (!data.name || !data.characterPrompt || !data.lorePrompt || !data.personality) {
        continue;
      }

      existing.push({
        id: `wwwyzzerdd-${randomUUID()}`,
        name: data.name,
        description: data.description,
        characterPrompt: data.characterPrompt,
        lorePrompt: data.lorePrompt,
        personality: data.personality,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }

    savePromptSets(existing);

    return { success: true, imported };
  });

  // Reset to defaults
  fastify.post('/wwwyzzerdd/prompts/reset', async () => {
    // Keep user-created, restore defaults
    const existing = loadPromptSets();
    const userCreated = existing.filter((p) => !p.isDefault);

    const reset = [...DEFAULT_PROMPT_SETS, ...userCreated];
    savePromptSets(reset);

    return { success: true, promptSets: reset };
  });
}
