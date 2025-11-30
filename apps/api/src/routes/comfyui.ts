/**
 * ComfyUI Routes
 * Scaffolding for ComfyUI integration - workflows and prompt templates
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
const COMFYUI_PATH = join(SETTINGS_DIR, 'comfyui.json');

// Ensure directory exists
function ensureDir() {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

// ComfyUI prompt template interface
interface ComfyUIPromptTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'character' | 'scenario' | 'portrait' | 'background' | 'custom';
  prompt: string;
  negativePrompt?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ComfyUI workflow interface
interface ComfyUIWorkflow {
  id: string;
  name: string;
  description?: string;
  workflow: object;
  defaultModel?: string;
  defaultSampler?: string;
  defaultScheduler?: string;
  defaultResolution?: { width: number; height: number };
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Default prompt templates with detailed generation prompts
const DEFAULT_PROMPT_TEMPLATES: ComfyUIPromptTemplate[] = [
  {
    id: 'comfyui-character',
    name: 'Character (Full Body)',
    description: 'Generate a full body portrait of the character',
    type: 'character',
    prompt: `In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}} based on what you know about them. Be sure to include their hair color, eye color, any accessories or outfit they may wear, their body type, and any other relevant details. Also include a subject and medium for the image. Don't explain anything. Do not preface your response with "here is..." or something similar. The purpose of this response is to use it as a prompt for stable diffusion to generate an avatar of {{char}}. DO NOT leave any placeholders or fill-in-the-blank items. Make your best guess based on the genre if the details are not provided, don't ask for more information.`,
    negativePrompt: 'blurry, low quality, deformed, bad anatomy, watermark, signature, text, cropped',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'comfyui-scenario',
    name: 'Scenario (Scene)',
    description: 'Generate a scene illustration with the character',
    type: 'scenario',
    prompt: `Ignore previous instructions and provide a detailed description for all of the following. {{char}}'s personality, appearance, and mannerisms. Their relationship with {{user}}, the first message of the roleplay, the scenario in which the roleplay takes place, and any other relevant details. Everything should be written in a detailed descriptive prose style for a visual illustration. Include visual details about lighting, atmosphere, and composition.`,
    negativePrompt: 'blurry, low quality, empty background, plain background, text, watermark',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'comfyui-portrait',
    name: 'Portrait (Face)',
    description: 'Generate a close-up facial portrait',
    type: 'portrait',
    prompt: `In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}'s face and upper body based on what you know about them. Focus on facial features: eye shape and color, eyebrows, nose, lips, facial structure, skin tone, hair style and color, expression, and any facial accessories. Include lighting and mood keywords. Don't explain anything. The purpose is to generate a portrait with stable diffusion.`,
    negativePrompt: 'blurry, low quality, deformed face, bad anatomy, asymmetric eyes, watermark',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'comfyui-background',
    name: 'Background',
    description: 'Generate a background/environment without characters',
    type: 'background',
    prompt: `Ignore previous instructions and provide a detailed description of {{char}}'s surroundings based on the scenario and setting. Describe the environment, architecture, lighting conditions, time of day, weather, atmosphere, and any notable objects or features. Focus only on the environment - no characters should be present. Write as comma-delimited keywords for stable diffusion.`,
    negativePrompt: 'people, characters, faces, figures, blurry, low quality, text, watermark',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Default workflow (basic txt2img)
const DEFAULT_WORKFLOWS: ComfyUIWorkflow[] = [
  {
    id: 'comfyui-basic-txt2img',
    name: 'Basic Text to Image',
    description: 'Simple text-to-image workflow with KSampler',
    workflow: {
      // This is a minimal placeholder workflow
      // Users should upload their own workflows
      "3": {
        "inputs": {
          "seed": 0,
          "steps": 20,
          "cfg": 7,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "4": {
        "inputs": {
          "ckpt_name": "model.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": {
        "inputs": {
          "width": 512,
          "height": 768,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      "6": {
        "inputs": {
          "text": "positive prompt",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": "negative prompt",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "8": {
        "inputs": {
          "samples": ["3", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": {
          "filename_prefix": "ComfyUI",
          "images": ["8", 0]
        },
        "class_type": "SaveImage"
      }
    },
    defaultModel: '',
    defaultSampler: 'euler',
    defaultScheduler: 'normal',
    defaultResolution: { width: 512, height: 768 },
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface ComfyUIData {
  promptTemplates: ComfyUIPromptTemplate[];
  workflows: ComfyUIWorkflow[];
}

// Load data from file
function loadData(): ComfyUIData {
  ensureDir();
  if (!existsSync(COMFYUI_PATH)) {
    const defaultData: ComfyUIData = {
      promptTemplates: DEFAULT_PROMPT_TEMPLATES,
      workflows: DEFAULT_WORKFLOWS,
    };
    saveData(defaultData);
    return defaultData;
  }
  try {
    const data = readFileSync(COMFYUI_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      promptTemplates: parsed.promptTemplates || [],
      workflows: parsed.workflows || [],
    };
  } catch {
    return {
      promptTemplates: DEFAULT_PROMPT_TEMPLATES,
      workflows: DEFAULT_WORKFLOWS,
    };
  }
}

// Save data to file
function saveData(data: ComfyUIData) {
  ensureDir();
  writeFileSync(COMFYUI_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function comfyuiRoutes(fastify: FastifyInstance) {
  // ========== PROMPT TEMPLATES ==========

  // Get all prompt templates
  fastify.get('/comfyui/prompts', async () => {
    const data = loadData();
    return { promptTemplates: data.promptTemplates };
  });

  // Get single prompt template
  fastify.get<{ Params: { id: string } }>('/comfyui/prompts/:id', async (request, reply) => {
    const data = loadData();
    const template = data.promptTemplates.find((p) => p.id === request.params.id);
    if (!template) {
      reply.code(404);
      return { error: 'Prompt template not found' };
    }
    return { promptTemplate: template };
  });

  // Create prompt template
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      type: 'character' | 'scenario' | 'portrait' | 'background' | 'custom';
      prompt: string;
      negativePrompt?: string;
    };
  }>('/comfyui/prompts', async (request, reply) => {
    const { name, description, type, prompt, negativePrompt } = request.body;

    if (!name || !type || !prompt) {
      reply.code(400);
      return { error: 'Name, type, and prompt are required' };
    }

    const data = loadData();
    const now = new Date().toISOString();

    const newTemplate: ComfyUIPromptTemplate = {
      id: `comfyui-prompt-${randomUUID()}`,
      name,
      description,
      type,
      prompt,
      negativePrompt,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    data.promptTemplates.push(newTemplate);
    saveData(data);

    reply.code(201);
    return { promptTemplate: newTemplate };
  });

  // Update prompt template
  fastify.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      description: string;
      type: 'character' | 'scenario' | 'portrait' | 'background' | 'custom';
      prompt: string;
      negativePrompt: string;
    }>;
  }>('/comfyui/prompts/:id', async (request, reply) => {
    const data = loadData();
    const index = data.promptTemplates.findIndex((p) => p.id === request.params.id);

    if (index === -1) {
      reply.code(404);
      return { error: 'Prompt template not found' };
    }

    const existing = data.promptTemplates[index];
    if (existing.isDefault) {
      reply.code(403);
      return { error: 'Cannot modify default templates. Copy it first.' };
    }

    const updated: ComfyUIPromptTemplate = {
      ...existing,
      ...request.body,
      updatedAt: new Date().toISOString(),
    };

    data.promptTemplates[index] = updated;
    saveData(data);

    return { promptTemplate: updated };
  });

  // Delete prompt template
  fastify.delete<{ Params: { id: string } }>('/comfyui/prompts/:id', async (request, reply) => {
    const data = loadData();
    const index = data.promptTemplates.findIndex((p) => p.id === request.params.id);

    if (index === -1) {
      reply.code(404);
      return { error: 'Prompt template not found' };
    }

    if (data.promptTemplates[index].isDefault) {
      reply.code(403);
      return { error: 'Cannot delete default templates' };
    }

    data.promptTemplates.splice(index, 1);
    saveData(data);

    return { success: true };
  });

  // Copy prompt template
  fastify.post<{ Params: { id: string }; Body: { name?: string } }>(
    '/comfyui/prompts/:id/copy',
    async (request, reply) => {
      const data = loadData();
      const original = data.promptTemplates.find((p) => p.id === request.params.id);

      if (!original) {
        reply.code(404);
        return { error: 'Prompt template not found' };
      }

      const now = new Date().toISOString();
      const newTemplate: ComfyUIPromptTemplate = {
        ...original,
        id: `comfyui-prompt-${randomUUID()}`,
        name: request.body?.name || `${original.name} (Copy)`,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };

      data.promptTemplates.push(newTemplate);
      saveData(data);

      reply.code(201);
      return { promptTemplate: newTemplate };
    }
  );

  // Export all prompt templates
  fastify.get('/comfyui/prompts/export/all', async (_request, reply) => {
    const data = loadData();

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="comfyui-prompts.json"');

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      promptTemplates: data.promptTemplates.map((p) => ({
        name: p.name,
        description: p.description,
        type: p.type,
        prompt: p.prompt,
        negativePrompt: p.negativePrompt,
      })),
    };
  });

  // Import prompt templates
  fastify.post<{
    Body: {
      promptTemplates: Array<{
        name: string;
        description?: string;
        type: 'character' | 'scenario' | 'portrait' | 'background' | 'custom';
        prompt: string;
        negativePrompt?: string;
      }>;
    };
  }>('/comfyui/prompts/import', async (request, reply) => {
    const { promptTemplates: importData } = request.body;

    if (!Array.isArray(importData)) {
      reply.code(400);
      return { error: 'Invalid import format: promptTemplates must be an array' };
    }

    const data = loadData();
    const now = new Date().toISOString();
    let imported = 0;

    for (const item of importData) {
      if (!item.name || !item.type || !item.prompt) {
        continue;
      }

      data.promptTemplates.push({
        id: `comfyui-prompt-${randomUUID()}`,
        name: item.name,
        description: item.description,
        type: item.type,
        prompt: item.prompt,
        negativePrompt: item.negativePrompt,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }

    saveData(data);

    return { success: true, imported };
  });

  // ========== WORKFLOWS ==========

  // Get all workflows
  fastify.get('/comfyui/workflows', async () => {
    const data = loadData();
    return { workflows: data.workflows };
  });

  // Get single workflow
  fastify.get<{ Params: { id: string } }>('/comfyui/workflows/:id', async (request, reply) => {
    const data = loadData();
    const workflow = data.workflows.find((w) => w.id === request.params.id);
    if (!workflow) {
      reply.code(404);
      return { error: 'Workflow not found' };
    }
    return { workflow };
  });

  // Create/upload workflow
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      workflow: object;
      defaultModel?: string;
      defaultSampler?: string;
      defaultScheduler?: string;
      defaultResolution?: { width: number; height: number };
    };
  }>('/comfyui/workflows', async (request, reply) => {
    const { name, description, workflow, defaultModel, defaultSampler, defaultScheduler, defaultResolution } =
      request.body;

    if (!name || !workflow) {
      reply.code(400);
      return { error: 'Name and workflow are required' };
    }

    const data = loadData();
    const now = new Date().toISOString();

    const newWorkflow: ComfyUIWorkflow = {
      id: `comfyui-workflow-${randomUUID()}`,
      name,
      description,
      workflow,
      defaultModel,
      defaultSampler,
      defaultScheduler,
      defaultResolution,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    data.workflows.push(newWorkflow);
    saveData(data);

    reply.code(201);
    return { workflow: newWorkflow };
  });

  // Update workflow
  fastify.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      description: string;
      workflow: object;
      defaultModel: string;
      defaultSampler: string;
      defaultScheduler: string;
      defaultResolution: { width: number; height: number };
    }>;
  }>('/comfyui/workflows/:id', async (request, reply) => {
    const data = loadData();
    const index = data.workflows.findIndex((w) => w.id === request.params.id);

    if (index === -1) {
      reply.code(404);
      return { error: 'Workflow not found' };
    }

    const existing = data.workflows[index];
    if (existing.isDefault) {
      reply.code(403);
      return { error: 'Cannot modify default workflows. Copy it first.' };
    }

    const updated: ComfyUIWorkflow = {
      ...existing,
      ...request.body,
      updatedAt: new Date().toISOString(),
    };

    data.workflows[index] = updated;
    saveData(data);

    return { workflow: updated };
  });

  // Delete workflow
  fastify.delete<{ Params: { id: string } }>('/comfyui/workflows/:id', async (request, reply) => {
    const data = loadData();
    const index = data.workflows.findIndex((w) => w.id === request.params.id);

    if (index === -1) {
      reply.code(404);
      return { error: 'Workflow not found' };
    }

    if (data.workflows[index].isDefault) {
      reply.code(403);
      return { error: 'Cannot delete default workflows' };
    }

    data.workflows.splice(index, 1);
    saveData(data);

    return { success: true };
  });

  // Copy workflow
  fastify.post<{ Params: { id: string }; Body: { name?: string } }>(
    '/comfyui/workflows/:id/copy',
    async (request, reply) => {
      const data = loadData();
      const original = data.workflows.find((w) => w.id === request.params.id);

      if (!original) {
        reply.code(404);
        return { error: 'Workflow not found' };
      }

      const now = new Date().toISOString();
      const newWorkflow: ComfyUIWorkflow = {
        ...original,
        id: `comfyui-workflow-${randomUUID()}`,
        name: request.body?.name || `${original.name} (Copy)`,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };

      data.workflows.push(newWorkflow);
      saveData(data);

      reply.code(201);
      return { workflow: newWorkflow };
    }
  );

  // Export single workflow
  fastify.get<{ Params: { id: string } }>('/comfyui/workflows/export/:id', async (request, reply) => {
    const data = loadData();
    const workflow = data.workflows.find((w) => w.id === request.params.id);

    if (!workflow) {
      reply.code(404);
      return { error: 'Workflow not found' };
    }

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="${workflow.name.replace(/[^a-z0-9]/gi, '_')}.json"`);

    return workflow.workflow;
  });

  // Import workflow
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      workflow: object;
      defaultModel?: string;
      defaultSampler?: string;
      defaultScheduler?: string;
      defaultResolution?: { width: number; height: number };
    };
  }>('/comfyui/workflows/import', async (request, reply) => {
    const { name, description, workflow, defaultModel, defaultSampler, defaultScheduler, defaultResolution } =
      request.body;

    if (!name || !workflow) {
      reply.code(400);
      return { error: 'Name and workflow are required' };
    }

    const data = loadData();
    const now = new Date().toISOString();

    const newWorkflow: ComfyUIWorkflow = {
      id: `comfyui-workflow-${randomUUID()}`,
      name,
      description,
      workflow,
      defaultModel,
      defaultSampler,
      defaultScheduler,
      defaultResolution,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    data.workflows.push(newWorkflow);
    saveData(data);

    reply.code(201);
    return { workflow: newWorkflow };
  });

  // ========== RESET ==========

  // Reset to defaults (keeps user-created, restores defaults)
  fastify.post('/comfyui/reset', async () => {
    const data = loadData();

    // Keep user-created items
    const userPrompts = data.promptTemplates.filter((p) => !p.isDefault);
    const userWorkflows = data.workflows.filter((w) => !w.isDefault);

    const reset: ComfyUIData = {
      promptTemplates: [...DEFAULT_PROMPT_TEMPLATES, ...userPrompts],
      workflows: [...DEFAULT_WORKFLOWS, ...userWorkflows],
    };

    saveData(reset);

    return { success: true, data: reset };
  });
}
