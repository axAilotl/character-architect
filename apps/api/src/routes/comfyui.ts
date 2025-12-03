/**
 * ComfyUI Routes
 * ComfyUI integration - workflows, prompt templates, and image generation
 */

import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getComfyUIClient, injectIntoWorkflow, injectEmotionsIntoWorkflow } from '../services/comfyui-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths for JSON storage
const SETTINGS_DIR = join(__dirname, '../../data/settings/presets');
const COMFYUI_PATH = join(SETTINGS_DIR, 'comfyui.json');
const EMOTIONS_PATH = join(SETTINGS_DIR, 'emotions.json');

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
  injectionMap?: {
    positive_prompt?: string;
    negative_prompt?: string;
    seed?: string;
    hires_seed?: string;
    filename_prefix?: string;
    checkpoint?: string;
    width_height?: string;
  };
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
    description: 'Simple text-to-image workflow with KSampler. Configure your checkpoint in Settings.',
    workflow: {
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
          "ckpt_name": "A_Illustrious/Anime/dreamcake_vaporal/dreamcake_vaporal.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": {
        "inputs": {
          "width": 1024,
          "height": 1536,
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
    injectionMap: {
      positive_prompt: "6",
      negative_prompt: "7",
      seed: "3",
      filename_prefix: "9",
      checkpoint: "4",
      width_height: "5",
    },
    defaultModel: 'A_Illustrious/Anime/dreamcake_vaporal/dreamcake_vaporal.safetensors',
    defaultSampler: 'euler',
    defaultScheduler: 'normal',
    defaultResolution: { width: 1024, height: 1536 },
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
      injectionMap: {
        positive_prompt?: string;
        negative_prompt?: string;
        seed?: string;
        hires_seed?: string;
        filename_prefix?: string;
        checkpoint?: string;
        width_height?: string;
      };
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

  // ========== SERVER CONNECTION ==========

  // Test connection to ComfyUI server
  fastify.post<{
    Body: { serverUrl: string };
  }>('/comfyui/connect', async (request, reply) => {
    const { serverUrl } = request.body;

    if (!serverUrl) {
      reply.code(400);
      return { error: 'serverUrl is required' };
    }

    try {
      const client = getComfyUIClient(serverUrl);
      const result = await client.testConnection();

      if (result.connected) {
        return {
          connected: true,
          systemInfo: result.systemInfo,
          clientId: client.getClientId,
        };
      } else {
        return {
          connected: false,
          error: result.error,
        };
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get available models from ComfyUI
  fastify.post<{
    Body: { serverUrl: string };
  }>('/comfyui/models', async (request, reply) => {
    const { serverUrl } = request.body;

    if (!serverUrl) {
      reply.code(400);
      return { error: 'serverUrl is required' };
    }

    try {
      const client = getComfyUIClient(serverUrl);
      const models = await client.getModels();
      return models;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to get models' };
    }
  });

  // Get queue status
  fastify.post<{
    Body: { serverUrl: string };
  }>('/comfyui/queue', async (request, reply) => {
    const { serverUrl } = request.body;

    if (!serverUrl) {
      reply.code(400);
      return { error: 'serverUrl is required' };
    }

    try {
      const client = getComfyUIClient(serverUrl);
      const status = await client.getQueueStatus();
      return status;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to get queue status' };
    }
  });

  // ========== IMAGE GENERATION ==========

  // Generate image from workflow
  fastify.post<{
    Body: {
      serverUrl: string;
      workflowId?: string;
      workflow?: object;
      injectionMap?: {
        positive_prompt?: string;
        negative_prompt?: string;
        seed?: string;
        hires_seed?: string;
        filename_prefix?: string;
        checkpoint?: string;
        width_height?: string;
      };
      values?: {
        positivePrompt?: string;
        negativePrompt?: string;
        seed?: number;
        filename?: string;
        checkpoint?: string;
        width?: number;
        height?: number;
      };
      includeBase64?: boolean;
    };
  }>('/comfyui/generate', async (request, reply) => {
    const { serverUrl, workflowId, workflow: directWorkflow, injectionMap: providedInjectionMap, values, includeBase64 } = request.body;

    if (!serverUrl) {
      reply.code(400);
      return { error: 'serverUrl is required' };
    }

    // Get workflow either from ID or direct
    let workflow: Record<string, unknown>;
    let injectionMap = providedInjectionMap;

    if (workflowId) {
      const data = loadData();
      const found = data.workflows.find((w) => w.id === workflowId);
      if (!found) {
        reply.code(404);
        return { error: 'Workflow not found' };
      }
      workflow = found.workflow as Record<string, unknown>;
      // Use stored injectionMap if not provided in request
      if (!injectionMap && found.injectionMap) {
        injectionMap = found.injectionMap;
      }
    } else if (directWorkflow) {
      workflow = directWorkflow as Record<string, unknown>;
    } else {
      reply.code(400);
      return { error: 'Either workflowId or workflow is required' };
    }

    // Inject values if injection map exists
    if (injectionMap && values) {
      // Generate random seed if not provided
      const finalValues = {
        ...values,
        seed: values.seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
      };
      workflow = injectIntoWorkflow(workflow, injectionMap, finalValues);
    }

    try {
      const client = getComfyUIClient(serverUrl);
      const result = await client.queuePrompt(workflow);

      // Log what we got back
      console.log('[ComfyUI] Generation result:', {
        promptId: result.promptId,
        imageCount: result.images?.length,
        firstImage: result.images?.[0],
        executionTime: result.executionTime,
      });

      // Optionally include base64 data
      if (includeBase64 && result.images?.length > 0) {
        for (const image of result.images) {
          try {
            image.base64 = await client.getImageBase64(image.filename, image.subfolder, image.type);
            console.log('[ComfyUI] Base64 fetched for:', image.filename, 'length:', image.base64?.length);
          } catch (b64Error) {
            console.error('[ComfyUI] Failed to fetch base64 for', image.filename, b64Error);
            // Continue without base64 - frontend will use proxy URL
          }
        }
      }

      return {
        success: true,
        promptId: result.promptId,
        images: result.images,
        executionTime: result.executionTime,
      };
    } catch (error) {
      console.error('[ComfyUI] Generation error:', error);
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  });

  // Generate emotions batch
  fastify.post<{
    Body: {
      serverUrl: string;
      workflowId: string;
      format: 'sillytavern' | 'voxta';
      totalLimit?: number;
      sourceImage?: string;
      outputPath?: string;
    };
  }>('/comfyui/generate-emotions', async (request, reply) => {
    const { serverUrl, workflowId, format, totalLimit = 0, sourceImage, outputPath } = request.body;

    if (!serverUrl || !workflowId || !format) {
      reply.code(400);
      return { error: 'serverUrl, workflowId, and format are required' };
    }

    // Load workflow
    const data = loadData();
    const workflowData = data.workflows.find((w) => w.id === workflowId);
    if (!workflowData) {
      reply.code(404);
      return { error: 'Workflow not found' };
    }

    // Check for emotion injection map
    const emotionInjectionMap = (workflowData as any).emotionInjectionMap;
    if (!emotionInjectionMap) {
      reply.code(400);
      return { error: 'Workflow does not support emotion injection. Add emotionInjectionMap to workflow.' };
    }

    // Load emotion data
    if (!existsSync(EMOTIONS_PATH)) {
      reply.code(404);
      return { error: 'Emotions preset file not found' };
    }

    const emotionsData = JSON.parse(readFileSync(EMOTIONS_PATH, 'utf-8'));
    const items = emotionsData[format]?.items;

    if (!items || items.length === 0) {
      reply.code(400);
      return { error: `No emotion items found for format: ${format}` };
    }

    // Inject emotions into workflow
    const workflow = injectEmotionsIntoWorkflow(
      workflowData.workflow as Record<string, unknown>,
      emotionInjectionMap,
      items,
      { totalLimit, sourceImage, outputPath }
    );

    const actualCount = totalLimit > 0 ? Math.min(totalLimit, items.length) : items.length;

    try {
      const client = getComfyUIClient(serverUrl);
      const result = await client.queuePrompt(workflow);

      return {
        success: true,
        promptId: result.promptId,
        format,
        totalEmotions: actualCount,
        executionTime: result.executionTime,
        images: result.images,
      };
    } catch (error) {
      console.error('[ComfyUI] Emotion generation error:', error);
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Emotion generation failed',
      };
    }
  });

  // Upload image to ComfyUI input folder
  fastify.post('/comfyui/upload-image', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      return { error: 'No file uploaded' };
    }

    const serverUrl = (request.query as { serverUrl?: string }).serverUrl;
    if (!serverUrl) {
      reply.code(400);
      return { error: 'serverUrl query parameter is required' };
    }

    try {
      const buffer = await data.toBuffer();
      const formData = new FormData();
      formData.append('image', new Blob([new Uint8Array(buffer)]), data.filename);

      const response = await fetch(`${serverUrl}/upload/image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        reply.code(response.status);
        return { error: errorText || `Upload failed: ${response.status}` };
      }

      const result = await response.json();
      return {
        success: true,
        name: result.name,
        subfolder: result.subfolder || '',
        type: result.type || 'input',
      };
    } catch (error) {
      console.error('[ComfyUI] Upload error:', error);
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Upload failed' };
    }
  });

  // Interrupt current generation
  fastify.post<{
    Body: { serverUrl: string };
  }>('/comfyui/interrupt', async (request, reply) => {
    const { serverUrl } = request.body;

    if (!serverUrl) {
      reply.code(400);
      return { error: 'serverUrl is required' };
    }

    try {
      const client = getComfyUIClient(serverUrl);
      await client.interrupt();
      return { success: true };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to interrupt' };
    }
  });

  // Clear queue
  fastify.post<{
    Body: { serverUrl: string };
  }>('/comfyui/clear-queue', async (request, reply) => {
    const { serverUrl } = request.body;

    if (!serverUrl) {
      reply.code(400);
      return { error: 'serverUrl is required' };
    }

    try {
      const client = getComfyUIClient(serverUrl);
      await client.clearQueue();
      return { success: true };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to clear queue' };
    }
  });

  // Get image from ComfyUI
  fastify.get<{
    Querystring: {
      serverUrl: string;
      filename: string;
      subfolder?: string;
      type?: string;
    };
  }>('/comfyui/image', async (request, reply) => {
    const { serverUrl, filename, subfolder = '', type = 'output' } = request.query;

    if (!serverUrl || !filename) {
      reply.code(400);
      return { error: 'serverUrl and filename are required' };
    }

    try {
      const url = `${serverUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
      const response = await fetch(url);

      if (!response.ok) {
        reply.code(response.status);
        return { error: 'Failed to fetch image' };
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=3600');
      return reply.send(Buffer.from(buffer));
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to fetch image' };
    }
  });

  // ========== HISTORY ==========

  // Get generation history from ComfyUI server
  fastify.post<{
    Body: { serverUrl: string; limit?: number };
  }>('/comfyui/history', async (request, reply) => {
    const { serverUrl, limit = 20 } = request.body;

    if (!serverUrl) {
      reply.code(400);
      return { error: 'serverUrl is required' };
    }

    try {
      // Fetch history from ComfyUI
      const response = await fetch(`${serverUrl}/history`);
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status}`);
      }

      const historyData = await response.json() as Record<string, {
        prompt: [number, string, object, object, string[]];
        outputs: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }>;
        status?: { completed?: boolean };
      }>;

      // Transform to our format - most recent first
      const entries = Object.entries(historyData)
        .map(([promptId, data]) => {
          // Extract images from outputs
          const images: Array<{ filename: string; subfolder: string; type: string }> = [];
          for (const nodeOutput of Object.values(data.outputs || {})) {
            if (nodeOutput.images) {
              images.push(...nodeOutput.images);
            }
          }

          // Try to extract prompt text from the workflow
          let positivePrompt = '';
          let negativePrompt = '';
          let seed = 0;

          const workflow = data.prompt?.[2] as Record<string, { inputs?: Record<string, unknown>; class_type?: string }> | undefined;
          if (workflow) {
            for (const node of Object.values(workflow)) {
              if (node.class_type === 'CLIPTextEncode' && node.inputs?.text) {
                const text = String(node.inputs.text);
                // Heuristic: negative prompts usually mention "blurry", "low quality", etc.
                if (text.includes('blurry') || text.includes('low quality') || text.includes('score_6')) {
                  if (!negativePrompt) negativePrompt = text;
                } else {
                  if (!positivePrompt) positivePrompt = text;
                }
              }
              if ((node.class_type === 'KSampler' || node.class_type === 'KSampler (Efficient)') && node.inputs?.seed) {
                seed = Number(node.inputs.seed) || 0;
              }
            }
          }

          return {
            promptId,
            timestamp: data.prompt?.[0] || Date.now(),
            images: images.map(img => ({
              filename: img.filename,
              subfolder: img.subfolder || '',
              type: img.type || 'output',
              // Construct proxy URL through our API
              url: `/api/comfyui/image?serverUrl=${encodeURIComponent(serverUrl)}&filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${encodeURIComponent(img.type || 'output')}`,
            })),
            positivePrompt,
            negativePrompt,
            seed,
          };
        })
        .filter(entry => entry.images.length > 0) // Only entries with images
        .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
        .slice(0, limit);

      return { history: entries };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to fetch history' };
    }
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

  // ========== EMOTIONS ==========

  // Get emotion presets
  fastify.get('/comfyui/emotions', async (_request, reply) => {
    try {
      if (!existsSync(EMOTIONS_PATH)) {
        reply.code(404);
        return { error: 'Emotions preset file not found' };
      }

      const data = readFileSync(EMOTIONS_PATH, 'utf-8');
      const emotions = JSON.parse(data);
      return emotions;
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to load emotions' };
    }
  });

  // Update emotion presets (for import/edit functionality)
  fastify.patch<{
    Body: {
      format: 'sillytavern' | 'voxta';
      items: Array<{ filename: string; prompt: string }>;
    };
  }>('/comfyui/emotions', async (request, reply) => {
    try {
      const { format, items } = request.body;

      if (!format || !items) {
        reply.code(400);
        return { error: 'format and items are required' };
      }

      if (!existsSync(EMOTIONS_PATH)) {
        reply.code(404);
        return { error: 'Emotions preset file not found' };
      }

      const data = readFileSync(EMOTIONS_PATH, 'utf-8');
      const emotions = JSON.parse(data);

      if (!emotions[format]) {
        reply.code(400);
        return { error: `Invalid format: ${format}` };
      }

      emotions[format].items = items;
      emotions[format].count = items.length;

      writeFileSync(EMOTIONS_PATH, JSON.stringify(emotions, null, 2), 'utf-8');

      return { success: true, format, count: items.length };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to update emotions' };
    }
  });
}
