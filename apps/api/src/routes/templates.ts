/**
 * Templates and Snippets Routes
 * JSON file-based storage for templates and snippets
 */

import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import type { Template, Snippet } from '../types/index.js';
import { validateBody } from '../middleware/validate.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  importTemplatesSchema,
  createSnippetSchema,
  updateSnippetSchema,
  importSnippetsSchema,
  importElaraVossNamesSchema,
} from '../schemas/index.js';

import { DEFAULT_TEMPLATES, DEFAULT_SNIPPETS } from '@card-architect/defaults';

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
  fastify.post('/templates', async (request, reply) => {
    const validated = validateBody(createTemplateSchema, request.body, reply);
    if (!validated.success) return;

    const templates = loadTemplates();
    const now = new Date().toISOString();
    const newTemplate: Template = {
      id: `tpl-${randomUUID()}`,
      name: validated.data.name,
      description: validated.data.description || '',
      category: validated.data.category || 'custom',
      targetFields: validated.data.targetFields || 'all',
      content: validated.data.content || {},
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
  fastify.patch<{ Params: { id: string } }>(
    '/templates/:id',
    async (request, reply) => {
      const validated = validateBody(updateTemplateSchema, request.body, reply);
      if (!validated.success) return;

      const { id } = request.params;
      const templates = loadTemplates();
      const index = templates.findIndex(t => t.id === id);

      if (index === -1) {
        reply.code(404);
        return { error: 'Template not found' };
      }

      const now = new Date().toISOString();
      templates[index] = {
        ...templates[index],
        ...validated.data,
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
  fastify.post(
    '/templates/import',
    async (request, reply) => {
      const validated = validateBody(importTemplatesSchema, request.body, reply);
      if (!validated.success) return;

      const { templates: importedTemplates, replace } = validated.data;
      const now = new Date().toISOString();
      const existingTemplates = replace ? [] : loadTemplates();

      const imported: string[] = [];
      for (const tpl of importedTemplates) {
        const newTemplate: Template = {
          ...tpl,
          id: tpl.id || `tpl-${randomUUID()}`,
          category: tpl.category || 'custom',
          targetFields: tpl.targetFields || 'all',
          content: tpl.content || {},
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
  fastify.post('/snippets', async (request, reply) => {
    const validated = validateBody(createSnippetSchema, request.body, reply);
    if (!validated.success) return;

    const snippets = loadSnippets();
    const now = new Date().toISOString();
    const newSnippet: Snippet = {
      id: `snip-${randomUUID()}`,
      name: validated.data.name,
      description: validated.data.description || '',
      category: validated.data.category || 'custom',
      content: validated.data.content || '',
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
  fastify.patch<{ Params: { id: string } }>(
    '/snippets/:id',
    async (request, reply) => {
      const validated = validateBody(updateSnippetSchema, request.body, reply);
      if (!validated.success) return;

      const { id } = request.params;
      const snippets = loadSnippets();
      const index = snippets.findIndex(s => s.id === id);

      if (index === -1) {
        reply.code(404);
        return { error: 'Snippet not found' };
      }

      const now = new Date().toISOString();
      snippets[index] = {
        ...snippets[index],
        ...validated.data,
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
  fastify.post(
    '/snippets/import',
    async (request, reply) => {
      const validated = validateBody(importSnippetsSchema, request.body, reply);
      if (!validated.success) return;

      const { snippets: importedSnippets, replace } = validated.data;
      const now = new Date().toISOString();
      const existingSnippets = replace ? [] : loadSnippets();

      const imported: string[] = [];
      for (const snip of importedSnippets) {
        const newSnippet: Snippet = {
          ...snip,
          id: snip.id || `snip-${randomUUID()}`,
          category: snip.category || 'custom',
          content: snip.content || '',
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
  fastify.post(
    '/elara-voss/names/import',
    async (request, reply) => {
      const validated = validateBody(importElaraVossNamesSchema, request.body, reply);
      if (!validated.success) return;

      const { names: validNames, merge } = validated.data;

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
