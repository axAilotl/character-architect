/**
 * ComfyUI Client Service
 *
 * Manages connections to ComfyUI server, executes workflows,
 * and handles real-time progress updates via WebSocket.
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

// WebSocket message types from ComfyUI
interface ComfyUIStatusMessage {
  type: 'status';
  data: {
    status: {
      exec_info: {
        queue_remaining: number;
      };
    };
    sid?: string;
  };
}

interface ComfyUIProgressMessage {
  type: 'progress';
  data: {
    value: number;
    max: number;
    prompt_id: string;
    node: string;
  };
}

interface ComfyUIExecutingMessage {
  type: 'executing';
  data: {
    node: string | null;
    prompt_id: string;
  };
}

interface ComfyUIExecutedMessage {
  type: 'executed';
  data: {
    node: string;
    output: {
      images?: Array<{
        filename: string;
        subfolder: string;
        type: string;
      }>;
    };
    prompt_id: string;
  };
}

interface ComfyUIExecutionErrorMessage {
  type: 'execution_error';
  data: {
    prompt_id: string;
    node_id: string;
    node_type: string;
    exception_message: string;
    exception_type: string;
  };
}

type ComfyUIMessage =
  | ComfyUIStatusMessage
  | ComfyUIProgressMessage
  | ComfyUIExecutingMessage
  | ComfyUIExecutedMessage
  | ComfyUIExecutionErrorMessage;

export interface GenerationProgress {
  promptId: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  currentNode?: string;
  progress?: { value: number; max: number };
  images?: Array<{ filename: string; subfolder: string; type: string }>;
  error?: string;
}

export interface GenerationResult {
  promptId: string;
  images: Array<{
    filename: string;
    subfolder: string;
    type: string;
    url: string;
    base64?: string;
  }>;
  executionTime: number;
}

export interface ComfyUISystemInfo {
  system: {
    os: string;
    python_version: string;
    pytorch_version?: string;
  };
  devices: Array<{
    name: string;
    type: string;
    vram_total?: number;
    vram_free?: number;
  }>;
}

export class ComfyUIClient extends EventEmitter {
  private serverUrl: string;
  private clientId: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private pendingPrompts: Map<string, {
    resolve: (result: GenerationResult) => void;
    reject: (error: Error) => void;
    startTime: number;
    images: Array<{ filename: string; subfolder: string; type: string }>;
  }> = new Map();

  constructor(serverUrl: string) {
    super();
    // Normalize URL (remove trailing slash)
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.clientId = randomUUID();
  }

  /**
   * Test connection to ComfyUI server
   */
  async testConnection(): Promise<{ connected: boolean; systemInfo?: ComfyUISystemInfo; error?: string }> {
    try {
      const response = await fetch(`${this.serverUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { connected: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const systemInfo = await response.json() as ComfyUISystemInfo;
      return { connected: true, systemInfo };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { connected: false, error: message };
    }
  }

  /**
   * Get available models from ComfyUI
   */
  async getModels(): Promise<{ checkpoints: string[]; loras: string[]; vaes: string[] }> {
    try {
      const response = await fetch(`${this.serverUrl}/object_info/CheckpointLoaderSimple`);
      const data = await response.json();

      const checkpoints = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];

      // Get LoRAs
      const loraResponse = await fetch(`${this.serverUrl}/object_info/LoraLoader`);
      const loraData = await loraResponse.json();
      const loras = loraData?.LoraLoader?.input?.required?.lora_name?.[0] || [];

      // Get VAEs
      const vaeResponse = await fetch(`${this.serverUrl}/object_info/VAELoader`);
      const vaeData = await vaeResponse.json();
      const vaes = vaeData?.VAELoader?.input?.required?.vae_name?.[0] || [];

      return { checkpoints, loras, vaes };
    } catch (error) {
      console.error('[ComfyUI] Failed to get models:', error);
      return { checkpoints: [], loras: [], vaes: [] };
    }
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(): Promise<{ running: number; pending: number }> {
    try {
      const response = await fetch(`${this.serverUrl}/queue`);
      const data = await response.json();

      return {
        running: data.queue_running?.length || 0,
        pending: data.queue_pending?.length || 0,
      };
    } catch {
      return { running: 0, pending: 0 };
    }
  }

  /**
   * Connect WebSocket for real-time updates
   */
  async connect(): Promise<void> {
    if (this.connected && this.ws) {
      return;
    }

    return new Promise((resolve, reject) => {
      const wsUrl = this.serverUrl.replace(/^http/, 'ws');
      this.ws = new WebSocket(`${wsUrl}/ws?clientId=${this.clientId}`);

      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.emit('connected');
        resolve();
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        this.connected = false;
        reject(error);
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const message = JSON.parse(data.toString()) as ComfyUIMessage;
          this.handleMessage(message);
        } catch {
          // Ignore non-JSON messages
        }
      });
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: ComfyUIMessage): void {
    this.emit('message', message);

    switch (message.type) {
      case 'progress': {
        const pending = this.pendingPrompts.get(message.data.prompt_id);
        if (pending) {
          this.emit('progress', {
            promptId: message.data.prompt_id,
            status: 'running',
            currentNode: message.data.node,
            progress: { value: message.data.value, max: message.data.max },
          } as GenerationProgress);
        }
        break;
      }

      case 'executing': {
        if (message.data.node === null) {
          // Execution complete
          const pending = this.pendingPrompts.get(message.data.prompt_id);
          if (pending) {
            this.emit('progress', {
              promptId: message.data.prompt_id,
              status: 'completed',
              images: pending.images,
            } as GenerationProgress);

            // Fetch final images and resolve
            this.fetchHistoryAndResolve(message.data.prompt_id);
          }
        } else {
          this.emit('progress', {
            promptId: message.data.prompt_id,
            status: 'running',
            currentNode: message.data.node,
          } as GenerationProgress);
        }
        break;
      }

      case 'executed': {
        const pending = this.pendingPrompts.get(message.data.prompt_id);
        if (pending && message.data.output?.images) {
          pending.images.push(...message.data.output.images);
        }
        break;
      }

      case 'execution_error': {
        const pending = this.pendingPrompts.get(message.data.prompt_id);
        if (pending) {
          this.emit('progress', {
            promptId: message.data.prompt_id,
            status: 'error',
            error: message.data.exception_message,
          } as GenerationProgress);

          pending.reject(new Error(`${message.data.exception_type}: ${message.data.exception_message}`));
          this.pendingPrompts.delete(message.data.prompt_id);
        }
        break;
      }
    }
  }

  /**
   * Fetch history and resolve pending prompt
   */
  private async fetchHistoryAndResolve(promptId: string): Promise<void> {
    const pending = this.pendingPrompts.get(promptId);
    if (!pending) return;

    try {
      const response = await fetch(`${this.serverUrl}/history/${promptId}`);
      const history = await response.json();

      const outputs = history[promptId]?.outputs || {};
      const images: GenerationResult['images'] = [];

      for (const nodeId in outputs) {
        if (outputs[nodeId]?.images) {
          for (const img of outputs[nodeId].images) {
            images.push({
              filename: img.filename,
              subfolder: img.subfolder || '',
              type: img.type || 'output',
              url: `${this.serverUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${encodeURIComponent(img.type || 'output')}`,
            });
          }
        }
      }

      const executionTime = Date.now() - pending.startTime;

      pending.resolve({
        promptId,
        images,
        executionTime,
      });
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error('Failed to fetch history'));
    } finally {
      this.pendingPrompts.delete(promptId);
    }
  }

  /**
   * Queue a workflow for execution
   */
  async queuePrompt(workflow: Record<string, unknown>): Promise<GenerationResult> {
    // Ensure WebSocket is connected
    if (!this.connected) {
      await this.connect();
    }

    // Queue the prompt
    const response = await fetch(`${this.serverUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: workflow,
        client_id: this.clientId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      // ComfyUI returns errors in various formats
      const errorMessage = typeof errorData === 'string'
        ? errorData
        : errorData.error
          ? (typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error))
          : errorData.node_errors
            ? `Node errors: ${JSON.stringify(errorData.node_errors)}`
            : JSON.stringify(errorData);
      throw new Error(errorMessage || `HTTP ${response.status}`);
    }

    const result = await response.json();
    const promptId = result.prompt_id;

    if (!promptId) {
      throw new Error('No prompt_id returned from server');
    }

    // Create a promise that resolves when execution completes
    return new Promise((resolve, reject) => {
      this.pendingPrompts.set(promptId, {
        resolve,
        reject,
        startTime: Date.now(),
        images: [],
      });

      this.emit('progress', {
        promptId,
        status: 'queued',
      } as GenerationProgress);

      // Timeout after 10 minutes
      setTimeout(() => {
        if (this.pendingPrompts.has(promptId)) {
          this.pendingPrompts.delete(promptId);
          reject(new Error('Generation timeout (10 minutes)'));
        }
      }, 600000);
    });
  }

  /**
   * Get image as base64
   */
  async getImageBase64(filename: string, subfolder = '', type = 'output'): Promise<string> {
    const url = `${this.serverUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  /**
   * Interrupt current execution
   */
  async interrupt(): Promise<void> {
    await fetch(`${this.serverUrl}/interrupt`, { method: 'POST' });
  }

  /**
   * Clear queue
   */
  async clearQueue(): Promise<void> {
    await fetch(`${this.serverUrl}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    });
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get getClientId(): string {
    return this.clientId;
  }
}

// Singleton instance cache keyed by server URL
const clientCache = new Map<string, ComfyUIClient>();

/**
 * Get or create a ComfyUI client for the given server URL
 */
export function getComfyUIClient(serverUrl: string): ComfyUIClient {
  let client = clientCache.get(serverUrl);
  if (!client) {
    client = new ComfyUIClient(serverUrl);
    clientCache.set(serverUrl, client);
  }
  return client;
}

/**
 * Inject emotion lists into a workflow for batch emotion generation
 */
export function injectEmotionsIntoWorkflow(
  workflow: Record<string, unknown>,
  injectionMap: {
    filename_list?: string;
    prompt_list?: string;
    total_count?: string;
    source_image?: string;
    output_path?: string;
  },
  items: Array<{ filename: string; prompt: string }>,
  options: {
    totalLimit?: number;
    sourceImage?: string;
    outputPath?: string;
  } = {}
): Record<string, unknown> {
  const result = structuredClone(workflow) as Record<string, Record<string, unknown>>;
  const { totalLimit = 0, sourceImage, outputPath } = options;

  // Apply limit if specified
  const limitedItems = totalLimit > 0 ? items.slice(0, totalLimit) : items;
  const count = limitedItems.length;

  // Inject filename list (newline-separated)
  if (injectionMap.filename_list) {
    const node = result[injectionMap.filename_list] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).multiline_text = limitedItems.map(i => i.filename).join('\n');
    }
  }

  // Inject prompt list (newline-separated)
  if (injectionMap.prompt_list) {
    const node = result[injectionMap.prompt_list] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).multiline_text = limitedItems.map(i => i.prompt).join('\n');
    }
  }

  // Inject total count
  if (injectionMap.total_count) {
    const node = result[injectionMap.total_count] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).value = count;
    }
  }

  // Inject source image filename (for LoadImage node)
  if (injectionMap.source_image && sourceImage) {
    const node = result[injectionMap.source_image] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).image = sourceImage;
    }
  }

  // Inject output path
  if (injectionMap.output_path && outputPath) {
    const node = result[injectionMap.output_path] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).output_path = outputPath;
    }
  }

  return result;
}

/**
 * Inject values into a workflow based on an injection map
 */
export function injectIntoWorkflow(
  workflow: Record<string, unknown>,
  injectionMap: {
    positive_prompt?: string;
    negative_prompt?: string;
    seed?: string;
    hires_seed?: string;
    filename_prefix?: string;
    checkpoint?: string;
    width_height?: string;
  },
  values: {
    positivePrompt?: string;
    negativePrompt?: string;
    seed?: number;
    filename?: string;
    checkpoint?: string;
    width?: number;
    height?: number;
  }
): Record<string, unknown> {
  const result = structuredClone(workflow) as Record<string, Record<string, unknown>>;

  // Inject positive prompt
  if (injectionMap.positive_prompt && values.positivePrompt) {
    const node = result[injectionMap.positive_prompt] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).text = values.positivePrompt;
    }
  }

  // Inject negative prompt
  if (injectionMap.negative_prompt && values.negativePrompt) {
    const node = result[injectionMap.negative_prompt] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).text = values.negativePrompt;
    }
  }

  // Inject seed
  if (injectionMap.seed && values.seed !== undefined) {
    const node = result[injectionMap.seed] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).seed = values.seed;
    }
  }

  // Inject HiRes-Fix seed (use seed + 1 for variation)
  if (injectionMap.hires_seed && values.seed !== undefined) {
    const node = result[injectionMap.hires_seed] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).seed = values.seed + 1;
    }
  }

  // Inject filename prefix
  if (injectionMap.filename_prefix && values.filename) {
    const node = result[injectionMap.filename_prefix] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).filename_prefix = values.filename;
    }
  }

  // Inject checkpoint
  if (injectionMap.checkpoint && values.checkpoint) {
    const node = result[injectionMap.checkpoint] as Record<string, unknown>;
    if (node?.inputs) {
      (node.inputs as Record<string, unknown>).ckpt_name = values.checkpoint;
    }
  }

  // Inject width/height
  if (injectionMap.width_height && (values.width || values.height)) {
    const node = result[injectionMap.width_height] as Record<string, unknown>;
    if (node?.inputs) {
      if (values.width) (node.inputs as Record<string, unknown>).width = values.width;
      if (values.height) (node.inputs as Record<string, unknown>).height = values.height;
    }
  }

  return result;
}
