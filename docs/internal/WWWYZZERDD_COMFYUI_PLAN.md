# wwwyzzerdd Mode & ComfyUI Integration Plan

## Implementation Status

| Feature | Status |
|---------|--------|
| Feature Flags | DONE |
| wwwyzzerdd Backend Routes | DONE |
| wwwyzzerdd Frontend | DONE |
| wwwyzzerdd Settings Tab | DONE |
| ComfyUI Backend Routes | DONE (scaffolding) |
| ComfyUI Frontend | DONE (scaffolding) |
| ComfyUI Settings Tab | DONE |
| AI Tags/Tagline Generation | DONE |
| ELARA VOSS Name Replacement | DONE |

## Overview

This document outlines the implementation plan for two major features:
1. **wwwyzzerdd Mode** - AI-assisted character card creation wizard (IMPLEMENTED)
2. **ComfyUI Integration** - Scaffolding for image generation integration (SCAFFOLDING ONLY)

Both features are optional and hidden behind feature flags in settings.

---

## Architecture Overview

### File Structure
```
apps/api/
├── src/routes/
│   ├── wwwyzzerdd.ts          # wwwyzzerdd prompts/personality API
│   └── comfyui.ts             # ComfyUI workflows/prompts API
├── data/settings/presets/
│   ├── wwwyzzerdd.json        # wwwyzzerdd prompts storage
│   └── comfyui.json           # ComfyUI workflows/prompts storage

apps/web/src/
├── store/
│   ├── wwwyzzerdd-store.ts    # wwwyzzerdd state management
│   └── comfyui-store.ts       # ComfyUI state management
├── features/
│   ├── wwwyzzerdd/
│   │   ├── WwwyzzerddTab.tsx         # Main wizard tab
│   │   ├── WwwyzzerddChat.tsx        # AI chat component
│   │   ├── WwwyzzerddCharForm.tsx    # Character form fields
│   │   └── WwwyzzerddLoreForm.tsx    # Lore form (future)
│   └── comfyui/
│       ├── ComfyUITab.tsx            # Main ComfyUI tab (scaffolding)
│       ├── ComfyUIGeneral.tsx        # General generation panel
│       └── ComfyUIEmotions.tsx       # Emotion sprites panel
├── components/shared/
│   └── SettingsModal.tsx      # Add wwwyzzerdd + ComfyUI tabs
```

---

## Phase 1: Feature Flags & Settings Store

### 1.1 Update settings-store.ts

Add new feature settings:
```typescript
interface FeatureFlags {
  wwwyzzerddEnabled: boolean;
  comfyUIEnabled: boolean;
}

interface WwwyzzerddSettings {
  activePromptSetId: string | null;  // Selected prompt set
}

interface ComfyUISettings {
  serverUrl: string;                 // ComfyUI server URL
  activeWorkflowId: string | null;   // Selected workflow
  autoSelectType: boolean;           // Auto-detect asset type from prompt
  autoGenerateFilename: boolean;     // Auto-generate filenames
}
```

---

## Phase 2: Backend API Routes

### 2.1 wwwyzzerdd Routes (`/api/wwwyzzerdd`)

JSON Storage: `data/settings/presets/wwwyzzerdd.json`

```typescript
interface WwwyzzerddPromptSet {
  id: string;
  name: string;
  description?: string;
  characterPrompt: string;     // System prompt for character creation
  lorePrompt: string;          // System prompt for lore creation
  personality: string;         // wwwyzzerdd's personality/voice
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Endpoints:**
- `GET /api/wwwyzzerdd/prompts` - List all prompt sets
- `GET /api/wwwyzzerdd/prompts/:id` - Get single prompt set
- `POST /api/wwwyzzerdd/prompts` - Create prompt set
- `PATCH /api/wwwyzzerdd/prompts/:id` - Update prompt set
- `DELETE /api/wwwyzzerdd/prompts/:id` - Delete prompt set
- `GET /api/wwwyzzerdd/prompts/export/all` - Export all as JSON
- `POST /api/wwwyzzerdd/prompts/import` - Import from JSON
- `POST /api/wwwyzzerdd/prompts/reset` - Reset to defaults

- `POST /api/wwwyzzerdd/chat` - Send message to AI (uses LLM integration)

### 2.2 ComfyUI Routes (`/api/comfyui`)

JSON Storage: `data/settings/presets/comfyui.json`

```typescript
interface ComfyUIPromptTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'character' | 'scenario' | 'portrait' | 'background' | 'custom';
  prompt: string;              // The prompt template with {{char}} placeholders
  negativePrompt?: string;     // Default negative prompt
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ComfyUIWorkflow {
  id: string;
  name: string;
  description?: string;
  workflow: object;            // ComfyUI workflow JSON
  defaultModel?: string;
  defaultSampler?: string;
  defaultScheduler?: string;
  defaultResolution?: { width: number; height: number };
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Endpoints:**
- `GET /api/comfyui/prompts` - List prompt templates
- `POST /api/comfyui/prompts` - Create prompt template
- `PATCH /api/comfyui/prompts/:id` - Update prompt template
- `DELETE /api/comfyui/prompts/:id` - Delete prompt template
- `GET /api/comfyui/prompts/export/all` - Export prompts
- `POST /api/comfyui/prompts/import` - Import prompts

- `GET /api/comfyui/workflows` - List workflows
- `POST /api/comfyui/workflows` - Create/upload workflow
- `PATCH /api/comfyui/workflows/:id` - Update workflow
- `DELETE /api/comfyui/workflows/:id` - Delete workflow
- `GET /api/comfyui/workflows/export/:id` - Export single workflow
- `POST /api/comfyui/workflows/import` - Import workflow

---

## Phase 3: Frontend Components

### 3.1 wwwyzzerdd Tab Component

**Location:** After "Focused" tab in EditorTabs

**Layout:** Two-column (50/50 or adjustable)

**Left Column - Character Form:**
```
┌─────────────────────────────────────┐
│ [Image Upload - Centered]           │
├─────────────────────────────────────┤
│ Name: [________] Nickname: [______] │
├─────────────────────────────────────┤
│ Tags: [__________________________]  │
├─────────────────────────────────────┤
│ Creator: [______] Version: [______] │
├─────────────────────────────────────┤
│ Description:                        │
│ [_________________________________] │
│ [_________________________________] │
├─────────────────────────────────────┤
│ Scenario:                           │
│ [_________________________________] │
├─────────────────────────────────────┤
│ Appearance:                         │
│ [_________________________________] │
├─────────────────────────────────────┤
│ First Message:                      │
│ [_________________________________] │
│ [_________________________________] │
└─────────────────────────────────────┘
```

**Right Column - AI Chat:**
```
┌─────────────────────────────────────┐
│ wwwyzzerdd                          │
│ ─────────────────────────────────── │
│ [Chat messages scroll area]         │
│                                     │
│ 🧙 "Tell me about your character..."│
│                                     │
│ 👤 "She's a warrior princess..."    │
│                                     │
│ 🧙 "Interesting! Let me help..."    │
│                                     │
├─────────────────────────────────────┤
│ [Message input________________] [▶] │
└─────────────────────────────────────┘
```

**AI can:**
- Read all form fields
- Populate/update form fields
- Suggest improvements
- Generate content based on user descriptions

### 3.2 ComfyUI Tab Component (Scaffolding)

**Sub-tabs:** General | Emotion Images

**General Tab:**
```
┌─────────────────────────┬───────────────────────────────┐
│ [Generated Image]       │ Workflow: [dropdown______▾]  │
│                         │ Model: [dropdown__________▾] │
│                         │ Sampler: [________________▾] │
│ □ Auto-select type      │ Scheduler: [______________▾] │
│ [Save Asset] Type: [▾]  │ Resolution: [___] x [___]    │
│                         │ Seed: [_______________] [🎲] │
│ □ Auto-generate name    │                               │
│ Filename: [__________]  │ Prompt Type: [dropdown____▾] │
│                         │ ▼ Advanced                    │
│                         │ Positive prefix: [________]  │
│                         │ Negative prefix: [________]  │
│                         ├───────────────────────────────┤
│                         │ [Generate]                    │
└─────────────────────────┴───────────────────────────────┘
```

**Emotion Images Tab:**
```
┌─────────────────────────────────────────────────────────┐
│ Source Asset: [Select from card assets ▾] [Upload]     │
│ Format: [SillyTavern (28) ▾] [Voxta (8) ▾]            │
│ Cards per expression: [1]                              │
│ [Generate All]                                         │
├─────────────────────────────────────────────────────────┤
│ Results:                                               │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐          │
│ │happy│sad  │angry│...  │     │     │     │          │
│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┘          │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Settings Modal Tabs

**Add to Settings:**

1. **General Tab** - Add feature toggles:
   - ☐ Enable wwwyzzerdd Mode
   - ☐ Enable ComfyUI Integration

2. **wwwyzzerdd Tab** (visible only if enabled):
   - Prompt Set selector
   - Character Prompt editor
   - Lore Prompt editor
   - wwwyzzerdd's Personality editor
   - Import/Export buttons
   - Reset to defaults

3. **ComfyUI Tab** (visible only if enabled):
   - Server URL configuration
   - Workflow management (list, upload, delete, export)
   - Prompt template management
   - Default settings (model, sampler, scheduler)

---

## Phase 4: Default Prompts

### 4.1 Default wwwyzzerdd Prompts

```javascript
const DEFAULT_WWWYZZERDD_PROMPT_SET = {
  name: 'Default',
  characterPrompt: `You are wwwyzzerdd, a helpful AI assistant specializing in creating character cards for roleplay.
Help the user develop their character by asking questions and making suggestions.
When you have enough information, offer to fill in specific fields.
Be creative but stay true to the user's vision.
Use {{char}} and {{user}} placeholders appropriately.`,

  lorePrompt: `You are wwwyzzerdd, helping create lorebook entries.
Ask about world details, character relationships, and important facts.
Create structured lorebook entries with appropriate keywords.`,

  personality: `Friendly, creative, and encouraging. Uses wizard-themed language occasionally.
Makes helpful suggestions without being pushy. Asks clarifying questions.`
};
```

### 4.2 Default ComfyUI Prompt Templates

```javascript
const DEFAULT_COMFYUI_PROMPTS = [
  {
    name: 'Character (Full Body)',
    type: 'character',
    prompt: `full body portrait, {{char}}, detailed character design,
standing pose, high quality, detailed features`,
    negativePrompt: 'blurry, low quality, deformed, bad anatomy'
  },
  {
    name: 'Scenario (Scene)',
    type: 'scenario',
    prompt: `scene illustration, {{char}} in environment,
detailed background, atmospheric lighting, story moment`,
    negativePrompt: 'blurry, low quality, empty background'
  },
  {
    name: 'Portrait (Face)',
    type: 'portrait',
    prompt: `close up facial portrait, {{char}}, detailed face,
expressive eyes, high quality, detailed features`,
    negativePrompt: 'blurry, low quality, deformed face, bad anatomy'
  },
  {
    name: 'Background',
    type: 'background',
    prompt: `background, environment, detailed scene,
atmospheric, no characters, empty scene`,
    negativePrompt: 'people, characters, faces, blurry'
  }
];
```

---

## Phase 5: Tagline AI Summarize

Add AI icon next to "Short Description" field that:
1. Reads the description field
2. Sends to LLM with prompt: "Summarize this character in 1-2 sentences for a tagline"
3. Populates the short description/creator_notes field

---

## Implementation Order

1. **Feature Flags** - Add to settings-store.ts - DONE
2. **Backend Routes** - Create wwwyzzerdd.ts and comfyui.ts - DONE
3. **UI Store Updates** - Add 'wwwyzzerdd' and 'comfyui' to activeTab type - DONE
4. **Settings Modal** - Add feature toggles and new tabs - DONE
5. **wwwyzzerdd Tab** - Create full wizard interface - DONE
6. **ComfyUI Tab** - Create scaffolding (not connected) - DONE
7. **Tagline AI** - Add summarize button - DONE (AI generation buttons)
8. **Testing & Polish** - DONE

---

## Additional Features Implemented

### ELARA VOSS Name Replacement
- Located in Edit panel as new tab
- Gender selection: male, female, femboy, futa
- Random name generation from `/public/elara_voss.json`
- Auto-snapshot before replacement
- Replaces in all text fields + lorebook entries

### AI Generation Buttons
- Tags: sparkle icon button next to Tags field
- Tagline: sparkle icon button next to Tagline field
- Configurable prompts in Settings > LLM Presets
- Tags output: 5-10 single-word slugs (hyphens for compounds)
- Tagline output: up to 500 characters

### wwwyzzerdd Enhancements
- JED formatting by default for descriptions
- Card type question (CC vs Voxta)
- Image gen type question (booru tags vs natural language)
- Appearance field with "Image Gen" badge
- Personality field with "Voxta Only" badge (deprecated for CC)
- Persistent chat using module-level state
- Stop button for LLM requests

---

## Notes

- ComfyUI integration is SCAFFOLDING ONLY - no actual connection to ComfyUI server
- wwwyzzerdd uses existing LLM infrastructure (providers, RAG, etc.)
- All prompts/workflows stored in JSON files for easy backup/sharing
- Feature flags persist in localStorage with other settings
- wwwyzzerdd chat persists across tab switches (module-level variables)
