# ComfyUI API Integration Research & Implementation Plan

## Executive Summary

This document provides comprehensive research on integrating ComfyUI with Node.js applications, specifically for the Card Doctor web application. The existing scaffolding in `apps/web/src/modules/comfyui/` provides a solid UI foundation that needs to be connected to actual ComfyUI API functionality.

---

## Local Configuration

### ComfyUI Server Endpoints

| Endpoint | Protocol | Notes |
|----------|----------|-------|
| `https://comfy.local.vega.nyc/` | HTTPS (nginx proxy) | Primary - requires SSL handling |
| `http://purrsephone.local.vega.nyc:8188/` | HTTP (direct) | Fallback - standard ComfyUI port |

Most users will use direct port access like `http://localhost:8188` rather than a reverse proxy setup.

---

## 1. ComfyUI API Architecture Overview

### Core Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ws` | WebSocket | Real-time bidirectional communication for progress updates |
| `/prompt` | POST | Queue workflow for execution, returns `prompt_id` |
| `/prompt` | GET | Queue status and execution info |
| `/history/{prompt_id}` | GET | Retrieve results for completed prompts |
| `/view` | GET | Fetch images by filename, subfolder, and type |
| `/upload/image` | POST | Upload images for img2img workflows |
| `/upload/mask` | POST | Upload masks for inpainting |
| `/queue` | GET | Current execution queue state |
| `/queue` | POST | Clear pending items |
| `/interrupt` | POST | Stop current workflow execution |
| `/object_info` | GET | All available node types and their schemas |
| `/models` | GET | Available model types |
| `/models/{folder}` | GET | Models in specific folder |
| `/system_stats` | GET | System info (Python version, devices, VRAM) |
| `/embeddings` | GET | Available embedding names |
| `/extensions` | GET | Installed extensions |

### WebSocket Message Types

| Type | Purpose |
|------|---------|
| `status` | System status updates (queue length, current prompt) |
| `execution_start` | Prompt execution begins |
| `execution_cached` | Cached results being used |
| `executing` | Node-by-node execution updates (`node: null` = complete) |
| `progress` | Long-running operation progress (step X of Y) |
| `executed` | Node completion with output data |

---

## 2. Workflow JSON Formats

### Two Distinct Formats

**1. Standard Workflow JSON (UI Format)**
- Used by ComfyUI frontend for visual editing
- Contains node positions, visual metadata, link definitions
- Larger file size, human-editable in UI

**2. API Format JSON (Execution Format)**
- Minimal format for programmatic execution
- Contains only node configurations and connections
- Export via "Save (API format)" in ComfyUI settings

### API Format Structure

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 156680208700286,
      "steps": 20,
      "cfg": 8,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    }
  },
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "model.safetensors"
    }
  }
}
```

Key points:
- Node IDs are string keys (e.g., "3", "4")
- `class_type` specifies the node type
- Connections use format: `["source_node_id", output_index]`
- Widget values are inlined in `inputs`
- Primitive nodes don't appear in API format
- `_meta.title` provides human-readable node names (optional)

### Reference Workflow: Illustrious SDXL with HiRes-Fix

This is the base workflow template for character card image generation:

```json
{
  "140": {
    "inputs": {
      "ckpt_name": "A_Illustrious/Anime/dreamcake_vaporal/dreamcake_vaporal.safetensors"
    },
    "class_type": "Checkpoint Loader with Name (Image Saver)",
    "_meta": { "title": "Checkpoint Loader with Name (Image Saver)" }
  },
  "142": {
    "inputs": {
      "resolution": "832x1152 (0.72)",
      "batch_size": 1,
      "width_override": 0,
      "height_override": 0
    },
    "class_type": "SDXLEmptyLatentSizePicker+",
    "_meta": { "title": "🔧 SDXL Empty Latent Size Picker" }
  },
  "192": {
    "inputs": {
      "stop_at_clip_layer": -2,
      "clip": ["140", 1]
    },
    "class_type": "CLIPSetLastLayer",
    "_meta": { "title": "CLIP Set Last Layer" }
  },
  "204": {
    "inputs": {
      "seed": 28763130831001,
      "steps": 30,
      "cfg": 6,
      "sampler_name": "dpmpp_2m_sde",
      "scheduler": "karras",
      "denoise": 1,
      "preview_method": "auto",
      "vae_decode": "true",
      "model": ["140", 0],
      "positive": ["416", 0],
      "negative": ["417", 0],
      "latent_image": ["142", 0],
      "optional_vae": ["140", 2],
      "script": ["423", 0]
    },
    "class_type": "KSampler (Efficient)",
    "_meta": { "title": "KSampler (Efficient)" }
  },
  "222": {
    "inputs": {
      "scale": 0.4,
      "strength": 0.3,
      "saturation": 0.3,
      "toe": 0.02,
      "seed": 286088009832277,
      "image": ["204", 5]
    },
    "class_type": "BetterFilmGrain",
    "_meta": { "title": "Better Film Grain" }
  },
  "416": {
    "inputs": {
      "text": "score_9, score_8_up, score_7_up, masterpiece...",
      "clip": ["192", 0]
    },
    "class_type": "CLIPTextEncode",
    "_meta": { "title": "Positive" }
  },
  "417": {
    "inputs": {
      "text": "score_6, score_5, score_4",
      "clip": ["192", 0]
    },
    "class_type": "CLIPTextEncode",
    "_meta": { "title": "Negative" }
  },
  "422": {
    "inputs": {
      "filename_prefix": "VOXTA_API_",
      "images": ["222", 0]
    },
    "class_type": "SaveImage",
    "_meta": { "title": "Save Image" }
  },
  "423": {
    "inputs": {
      "upscale_type": "both",
      "hires_ckpt_name": "(use same)",
      "latent_upscaler": "nearest-exact",
      "pixel_upscaler": "4x-ClearRealityV1.pth",
      "upscale_by": 1.5,
      "use_same_seed": false,
      "seed": 663849909753402,
      "hires_steps": 20,
      "denoise": 0.6,
      "iterations": 1,
      "use_controlnet": false,
      "control_net_name": "FLUX.1/InstantX-FLUX1-Dev-Union/diffusion_pytorch_model.safetensors",
      "strength": 1,
      "preprocessor": "none",
      "preprocessor_imgs": false
    },
    "class_type": "HighRes-Fix Script",
    "_meta": { "title": "HighRes-Fix Script" }
  }
}
```

#### Workflow Analysis

| Node ID | Type | Purpose |
|---------|------|---------|
| 140 | Checkpoint Loader | Loads Illustrious SDXL model |
| 142 | SDXL Empty Latent | Creates 832x1152 latent (portrait ratio) |
| 192 | CLIP Set Last Layer | CLIP skip -2 for anime style |
| 204 | KSampler (Efficient) | Main generation: 30 steps, CFG 6, dpmpp_2m_sde |
| 222 | Better Film Grain | Post-processing grain effect |
| 416 | CLIP Text Encode | Positive prompt with quality tags |
| 417 | CLIP Text Encode | Negative prompt (quality scores) |
| 422 | Save Image | Output with VOXTA_API_ prefix |
| 423 | HighRes-Fix Script | 1.5x upscale with 4x-ClearRealityV1 |

#### Dynamic Injection Points

For character card generation, these node inputs should be modified dynamically:

| Node | Input | Use |
|------|-------|-----|
| 416 | `text` | Character description + positive prompt |
| 417 | `text` | Negative prompt template |
| 204 | `seed` | Random seed per generation |
| 423 | `seed` | HiRes-Fix seed |
| 422 | `filename_prefix` | Character name or card ID |

---

## 3. Available Node.js Libraries

### Recommended: `@stable-canvas/comfyui-client`

**NPM:** `npm install @stable-canvas/comfyui-client`

**Features:**
- Full REST and WebSocket API coverage
- Works in Node.js and browser
- TypeScript support with type definitions
- Zero external dependencies
- Programmable workflow interface

**Ecosystem Packages:**
| Package | Purpose |
|---------|---------|
| `@stable-canvas/comfyui-client` | Core client library |
| `@stable-canvas/comfyui-client-cli` | Convert workflows to JS code |
| `@stable-canvas/cw-reader` | Extract workflow from images/JSON |
| `@stable-canvas/comfyui-client-transpiler` | AST parsing and codegen |

### Alternative: `@saintno/comfyui-sdk`

**NPM:** `npm install @saintno/comfyui-sdk`

**Key Features:**
- `ComfyApi` - Primary API communication class
- `PromptBuilder` - Fluent workflow construction
- `CallWrapper` - Execution lifecycle management
- `ComfyPool` - Multi-instance load balancing
- Robust reconnection logic with exponential backoff
- Event system for real-time progress

**Usage Pattern:**
```typescript
import { ComfyApi, PromptBuilder, CallWrapper } from '@saintno/comfyui-sdk';

const api = new ComfyApi("http://localhost:8188").init();

const workflow = new PromptBuilder(workflowJSON, inputKeys, outputKeys)
  .input("prompt", "a beautiful landscape")
  .input("seed", 12345);

new CallWrapper(api, workflow)
  .onProgress((p) => console.log(`Step ${p.value}/${p.max}`))
  .onFinished((images) => handleImages(images))
  .run();
```

### Lightweight: `comfy-ui-client`

**NPM:** `npm install comfy-ui-client`

Simple WebSocket-based client:
```typescript
import { ComfyUIClient } from 'comfy-ui-client';

const client = new ComfyUIClient('127.0.0.1:8188', 'unique-client-id');
await client.connect();
const images = await client.getImages(prompt);
await client.saveImages(images, './output');
await client.disconnect();
```

---

## 4. Implementation Architecture Options

### Option A: Direct WebSocket Integration (Recommended for Card Doctor)

**Pros:**
- Full control over connection lifecycle
- Direct real-time progress updates to UI
- No intermediate server required for simple use cases

**Cons:**
- Browser CORS considerations
- WebSocket connection management complexity

**Architecture:**
```
[React Frontend] <--WebSocket--> [ComfyUI Server]
       |
       +---> REST API calls for /prompt, /history, /view
```

### Option B: API Proxy Pattern

**Pros:**
- Server handles ComfyUI connection lifecycle
- Can add authentication, rate limiting
- Centralized workflow storage

**Cons:**
- Additional latency
- More infrastructure to maintain

**Architecture:**
```
[React Frontend] <--HTTP/WS--> [Node.js API] <--HTTP/WS--> [ComfyUI Server]
```

### Option C: SaladTechnologies comfyui-api Wrapper

**For production scaling:**
- Stateless wrapper around ComfyUI
- Horizontal scaling support
- Multiple storage backends (S3, Azure, HuggingFace)
- Webhook callbacks for async processing

---

## 5. Integration Plan for Card Doctor

### Phase 1: Core Connection Layer

**Files to Create/Modify:**

1. **`apps/api/src/routes/comfyui.ts`** - API routes for ComfyUI integration
   - POST `/api/comfyui/generate` - Queue generation job
   - GET `/api/comfyui/status/:promptId` - Poll status
   - GET `/api/comfyui/models` - List available models
   - POST `/api/comfyui/workflows` - Store workflows
   - GET `/api/comfyui/workflows` - List workflows

2. **`apps/api/src/services/comfyui-client.ts`** - ComfyUI connection service
   - WebSocket connection management
   - Reconnection logic with exponential backoff
   - Event emitter for progress updates
   - Image retrieval and base64 encoding

3. **`packages/comfyui-client/`** (optional) - Shared client package
   - Type definitions for workflows
   - Utility functions for workflow manipulation

### Phase 2: Frontend Integration

**Existing Files to Modify:**

1. **`apps/web/src/features/comfyui/ComfyUITab.tsx`**
   - Connect Generate button to API
   - Display real-time progress via WebSocket
   - Show generated image in preview area
   - Enable Save Asset functionality

2. **`apps/web/src/modules/comfyui/settings/ComfyUISettings.tsx`**
   - Test connection functionality
   - Dynamic model list from server
   - Workflow validation

### Phase 3: WebSocket Real-Time Updates

**Implementation:**

```typescript
// Frontend WebSocket connection
const ws = new WebSocket(`ws://${serverUrl}/ws?clientId=${clientId}`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'progress':
      updateProgress(message.data.value, message.data.max);
      break;
    case 'executing':
      if (message.data.node === null) {
        // Workflow complete, fetch results
        fetchResults(promptId);
      }
      break;
    case 'executed':
      // Node completed with output
      handleNodeOutput(message.data);
      break;
  }
};
```

### Phase 4: Advanced Features

1. **Emotion Sprite Generation**
   - Batch job queuing
   - Multi-image generation with expression prompts
   - Automatic filename generation

2. **Workflow Templates Tab**
   - Store workflows as JSON in settings for easy access and sharing
   - Templates tab in ComfyUI settings panel
   - Import/export workflow JSON files
   - Built-in templates: Text-to-Image, Image-to-Image, Upscaling
   - User templates: Custom workflows with descriptive names

---

## 11. Workflow Template Storage Design

### Storage Architecture

Workflows are stored as JSON in the existing settings database, accessible via the Settings > ComfyUI > Templates tab.

### Database Schema Extension

```sql
-- Existing table from scaffolding (apps/api/data/settings/comfyui/)
CREATE TABLE comfyui_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  workflow_json TEXT NOT NULL,      -- Full API-format workflow
  injection_map TEXT,               -- JSON mapping: { positive: "416", negative: "417", seed: "204" }
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Injection Map Schema

The `injection_map` defines how to inject dynamic values into the workflow:

```typescript
interface InjectionMap {
  // Node ID mappings for common operations
  positive_prompt?: string;      // Node ID for positive CLIP encode (e.g., "416")
  negative_prompt?: string;      // Node ID for negative CLIP encode (e.g., "417")
  seed?: string;                 // Node ID containing seed input (e.g., "204")
  seed_path?: string;            // Input path if not "seed" (e.g., "inputs.seed")
  hires_seed?: string;           // HighRes-Fix seed node (e.g., "423")
  filename_prefix?: string;      // SaveImage node for filename (e.g., "422")
  checkpoint?: string;           // Checkpoint loader node (e.g., "140")
  width_height?: string;         // Latent size picker node (e.g., "142")

  // Custom mappings for non-standard workflows
  custom?: Record<string, {
    nodeId: string;
    inputPath: string;
    description?: string;
  }>;
}
```

### Example Workflow Template Entry

```json
{
  "id": "illustrious-sdxl-hires",
  "name": "Illustrious SDXL + HiRes-Fix",
  "description": "High quality anime/realistic generation with 1.5x upscale",
  "workflow_json": "{ ... full workflow ... }",
  "injection_map": {
    "positive_prompt": "416",
    "negative_prompt": "417",
    "seed": "204",
    "hires_seed": "423",
    "filename_prefix": "422",
    "checkpoint": "140"
  },
  "is_default": true
}
```

### Workflow Injection Function

```typescript
function injectIntoWorkflow(
  workflow: Record<string, any>,
  injectionMap: InjectionMap,
  values: {
    positivePrompt?: string;
    negativePrompt?: string;
    seed?: number;
    filename?: string;
    checkpoint?: string;
  }
): Record<string, any> {
  const result = structuredClone(workflow);

  // Inject positive prompt
  if (injectionMap.positive_prompt && values.positivePrompt) {
    result[injectionMap.positive_prompt].inputs.text = values.positivePrompt;
  }

  // Inject negative prompt
  if (injectionMap.negative_prompt && values.negativePrompt) {
    result[injectionMap.negative_prompt].inputs.text = values.negativePrompt;
  }

  // Inject seed (regenerate for each generation)
  if (injectionMap.seed && values.seed !== undefined) {
    result[injectionMap.seed].inputs.seed = values.seed;
  }

  // Inject HiRes-Fix seed
  if (injectionMap.hires_seed && values.seed !== undefined) {
    result[injectionMap.hires_seed].inputs.seed = values.seed + 1;
  }

  // Inject filename prefix
  if (injectionMap.filename_prefix && values.filename) {
    result[injectionMap.filename_prefix].inputs.filename_prefix = values.filename;
  }

  return result;
}
```

### Templates UI Features

1. **Template List**: Browse saved workflows with name/description
2. **Import Button**: Upload workflow JSON exported from ComfyUI
3. **Export Button**: Download workflow JSON for sharing
4. **Edit Mappings**: Configure injection points via form
5. **Test Template**: Execute with test values to verify
6. **Set Default**: Mark one template as default for quick generation

---

## 6. Key Implementation Considerations

### Connection Management

```typescript
class ComfyUIService {
  private ws: WebSocket | null = null;
  private clientId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private backoffBase = 1000;

  async connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://${serverUrl}/ws?clientId=${this.clientId}`);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onclose = () => {
        this.handleReconnect();
      };

      this.ws.onerror = (err) => {
        reject(err);
      };
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.backoffBase * Math.pow(2, this.reconnectAttempts);
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect(this.serverUrl);
      }, delay);
    }
  }
}
```

### Workflow Execution Flow

```typescript
async function executeWorkflow(workflow: object, serverUrl: string): Promise<string[]> {
  const clientId = crypto.randomUUID();

  // 1. Queue the prompt
  const queueResponse = await fetch(`${serverUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: workflow,
      client_id: clientId
    })
  });

  const { prompt_id } = await queueResponse.json();

  // 2. Wait for completion via WebSocket
  await waitForCompletion(serverUrl, clientId, prompt_id);

  // 3. Fetch results
  const historyResponse = await fetch(`${serverUrl}/history/${prompt_id}`);
  const history = await historyResponse.json();

  // 4. Extract and return image URLs
  const outputs = history[prompt_id].outputs;
  const images: string[] = [];

  for (const nodeId in outputs) {
    if (outputs[nodeId].images) {
      for (const img of outputs[nodeId].images) {
        const imageUrl = `${serverUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
        images.push(imageUrl);
      }
    }
  }

  return images;
}
```

### Error Handling Patterns

```typescript
interface ComfyUIError {
  type: 'connection' | 'execution' | 'validation';
  message: string;
  nodeId?: string;
  details?: object;
}

function handleComfyUIError(error: ComfyUIError): void {
  switch (error.type) {
    case 'connection':
      // Trigger reconnection logic
      // Update UI to show disconnected state
      break;
    case 'execution':
      // Show error in specific node
      // Allow retry from failed point
      break;
    case 'validation':
      // Highlight invalid workflow configuration
      // Provide fix suggestions
      break;
  }
}
```

---

## 7. Production Scaling Considerations

### Single ComfyUI Instance
- Simple setup, sufficient for individual use
- ~5 second generation time per image
- Queue builds up under load

### Multi-Instance Pool

Using `ComfyPool` from `@saintno/comfyui-sdk`:

```typescript
import { ComfyApi, ComfyPool, EQueueMode } from '@saintno/comfyui-sdk';

const pool = new ComfyPool([
  new ComfyApi("http://gpu1:8188"),
  new ComfyApi("http://gpu2:8188"),
  new ComfyApi("http://gpu3:8188")
], EQueueMode.PICK_ZERO);

pool.on("add_job", (job) => console.log("Job queued:", job.id));

// Jobs automatically distributed across instances
await pool.batch([
  async (api) => generateImage(api, prompt1),
  async (api) => generateImage(api, prompt2),
  async (api) => generateImage(api, prompt3)
]);
```

### Modal/Serverless Scaling

- Auto-scales based on queue depth
- ~20s cold start for new containers
- Cost: ~$0.18/min for 10 A10G GPUs at full utilization
- Use `min_containers` for warm pool

---

## 8. Security Considerations

1. **Server URL Validation** - Only allow connections to configured servers
2. **CORS Configuration** - ComfyUI needs `--enable-cors-header` flag
3. **Rate Limiting** - Prevent queue flooding
4. **Input Sanitization** - Validate workflow JSON before submission
5. **Output Validation** - Verify images before serving to clients

---

## 9. Recommended Implementation Approach

### For Card Doctor Integration:

1. **Use `@saintno/comfyui-sdk`** for its TypeScript support, event system, and pool management
2. **Implement proxy in API server** to handle CORS and add app-specific logic
3. **Store workflows in database** (SQLite via existing infrastructure)
4. **Use WebSocket bridge** for real-time progress (frontend -> API -> ComfyUI)
5. **Add workflow templates** for common character card generation use cases

### Dependencies to Add:

```json
{
  "dependencies": {
    "@saintno/comfyui-sdk": "^1.x.x"
  }
}
```

---

## 10. References

- [ComfyUI Official Routes Documentation](https://docs.comfy.org/development/comfyui-server/comms_routes)
- [ComfyUI Workflow JSON Spec](https://docs.comfy.org/specs/workflow_json)
- [Hosting ComfyUI as API - 9elements](https://9elements.com/blog/hosting-a-comfyui-workflow-via-api/)
- [Building Production-Ready ComfyUI API](https://www.viewcomfy.com/blog/building-a-production-ready-comfyui-api)
- [WebSockets & ComfyUI - DEV](https://dev.to/worldlinetech/websockets-comfyui-building-interactive-ai-applications-1j1g)
- [@stable-canvas/comfyui-client - GitHub](https://github.com/StableCanvas/comfyui-client)
- [@saintno/comfyui-sdk - GitHub](https://github.com/comfy-addons/comfyui-sdk)
- [comfy-ui-client - GitHub](https://github.com/itsKaynine/comfy-ui-client)
- [SaladTechnologies comfyui-api - GitHub](https://github.com/SaladTechnologies/comfyui-api)
- [Modal Scaling ComfyUI Guide](https://modal.com/blog/scaling-comfyui)
- [Type-Safe Node.js SDK Article](https://dev.to/zand/from-chaos-to-comfy-super-charging-comfyui-workflows-with-a-type-safe-nodejs-sdk-179d)

---

## 12. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Add `@saintno/comfyui-sdk` to API dependencies
- [ ] Create `apps/api/src/services/comfyui-client.ts` with connection management
- [ ] Add `/api/comfyui/connect` endpoint for testing connection
- [ ] Add `/api/comfyui/generate` endpoint for queuing prompts
- [ ] Store server URL in settings (already in settings-store)

### Phase 2: Workflow Templates
- [ ] Extend database schema for workflow storage with injection maps
- [ ] Create `/api/comfyui/workflows` CRUD endpoints
- [ ] Add Templates sub-tab to ComfyUI settings panel
- [ ] Implement workflow import/export (JSON files)
- [ ] Add injection point editor UI

### Phase 3: Frontend Integration
- [ ] Connect Generate button in ComfyUITab to API
- [ ] Implement WebSocket progress display (progress bar, step counter)
- [ ] Display generated image in preview area
- [ ] Enable Save Asset button to store to card assets

### Phase 4: Character Integration
- [ ] Build prompt from character description + appearance
- [ ] Auto-generate seed per generation
- [ ] Filename from character name + timestamp
- [ ] Queue emotion sprite batch generation

### Phase 5: Polish
- [ ] Connection status indicator in header/tab
- [ ] Error handling with retry UI
- [ ] Model dropdown populated from `/api/comfyui/models`
- [ ] Workflow preview/visualization
