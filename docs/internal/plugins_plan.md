# Plugin Architecture Implementation Plan

## Overview

This document outlines the plan to transition Card Architect from a static architecture (hardcoded tabs, fixed features) to a dynamic plugin-based architecture. This enables modular development, lazy loading, and easier feature experimentation.

## Goals

1. **Modularity** - Features can be developed, tested, and deployed independently
2. **Lazy Loading** - Large modules (block editor, ComfyUI) load on-demand, reducing initial bundle
3. **Feature Flags** - Modules can be conditionally enabled/disabled
4. **Consistency** - Core features and plugins use the same registration mechanism
5. **Type Safety** - Full TypeScript support for plugin definitions and APIs

---

## Part 1: Frontend Plugin Registry

### 1.1 Core Types

**File: `apps/web/src/lib/registry/types.ts`**

```typescript
import { ComponentType, LazyExoticComponent } from 'react';

/**
 * Base definition for all plugin contributions
 */
interface PluginContribution {
  id: string;
  order?: number;  // Lower = earlier. Core: 0-99, Plugins: 100+
  condition?: () => boolean;  // Return false to hide
}

/**
 * Editor tab definition
 */
export interface EditorTabDefinition extends PluginContribution {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  // Which editor contexts this tab appears in
  contexts?: ('card' | 'template' | 'all')[];
}

/**
 * Settings panel definition
 */
export interface SettingsPanelDefinition extends PluginContribution {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  component: ComponentType | LazyExoticComponent<ComponentType>;
}

/**
 * Sidebar section definition
 */
export interface SidebarSectionDefinition extends PluginContribution {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  position: 'top' | 'bottom';
}

/**
 * Header action button definition
 */
export interface HeaderActionDefinition extends PluginContribution {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

/**
 * Plugin manifest - what a plugin exports
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;

  // Contributions
  tabs?: EditorTabDefinition[];
  settingsPanels?: SettingsPanelDefinition[];
  sidebarSections?: SidebarSectionDefinition[];
  headerActions?: HeaderActionDefinition[];

  // Lifecycle hooks
  onActivate?: () => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}
```

### 1.2 Registry Implementation

**File: `apps/web/src/lib/registry/index.ts`**

```typescript
import {
  EditorTabDefinition,
  SettingsPanelDefinition,
  SidebarSectionDefinition,
  HeaderActionDefinition,
  PluginManifest
} from './types';

class UIRegistry {
  private tabs = new Map<string, EditorTabDefinition>();
  private settingsPanels = new Map<string, SettingsPanelDefinition>();
  private sidebarSections = new Map<string, SidebarSectionDefinition>();
  private headerActions = new Map<string, HeaderActionDefinition>();
  private plugins = new Map<string, PluginManifest>();
  private listeners = new Set<() => void>();

  // ==================== Tabs ====================

  registerTab(definition: EditorTabDefinition): void {
    if (this.tabs.has(definition.id)) {
      console.warn(`Tab "${definition.id}" already registered, overwriting`);
    }
    this.tabs.set(definition.id, definition);
    this.notifyListeners();
  }

  unregisterTab(id: string): void {
    this.tabs.delete(id);
    this.notifyListeners();
  }

  getTabs(context: 'card' | 'template' | 'all' = 'card'): EditorTabDefinition[] {
    return Array.from(this.tabs.values())
      .filter(tab => {
        // Check condition
        if (tab.condition && !tab.condition()) return false;
        // Check context
        if (tab.contexts && !tab.contexts.includes(context) && !tab.contexts.includes('all')) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  }

  getTab(id: string): EditorTabDefinition | undefined {
    return this.tabs.get(id);
  }

  // ==================== Settings Panels ====================

  registerSettingsPanel(definition: SettingsPanelDefinition): void {
    this.settingsPanels.set(definition.id, definition);
    this.notifyListeners();
  }

  getSettingsPanels(): SettingsPanelDefinition[] {
    return Array.from(this.settingsPanels.values())
      .filter(panel => !panel.condition || panel.condition())
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  }

  // ==================== Sidebar Sections ====================

  registerSidebarSection(definition: SidebarSectionDefinition): void {
    this.sidebarSections.set(definition.id, definition);
    this.notifyListeners();
  }

  getSidebarSections(position?: 'top' | 'bottom'): SidebarSectionDefinition[] {
    return Array.from(this.sidebarSections.values())
      .filter(section => {
        if (section.condition && !section.condition()) return false;
        if (position && section.position !== position) return false;
        return true;
      })
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  }

  // ==================== Header Actions ====================

  registerHeaderAction(definition: HeaderActionDefinition): void {
    this.headerActions.set(definition.id, definition);
    this.notifyListeners();
  }

  getHeaderActions(): HeaderActionDefinition[] {
    return Array.from(this.headerActions.values())
      .filter(action => !action.condition || action.condition())
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  }

  // ==================== Plugin Management ====================

  async registerPlugin(manifest: PluginManifest): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      console.warn(`Plugin "${manifest.id}" already registered`);
      return;
    }

    // Register all contributions
    manifest.tabs?.forEach(tab => this.registerTab(tab));
    manifest.settingsPanels?.forEach(panel => this.registerSettingsPanel(panel));
    manifest.sidebarSections?.forEach(section => this.registerSidebarSection(section));
    manifest.headerActions?.forEach(action => this.registerHeaderAction(action));

    // Call activation hook
    if (manifest.onActivate) {
      await manifest.onActivate();
    }

    this.plugins.set(manifest.id, manifest);
    console.log(`Plugin "${manifest.name}" v${manifest.version} registered`);
  }

  async unregisterPlugin(pluginId: string): Promise<void> {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) return;

    // Call deactivation hook
    if (manifest.onDeactivate) {
      await manifest.onDeactivate();
    }

    // Remove all contributions
    manifest.tabs?.forEach(tab => this.unregisterTab(tab.id));
    // ... similar for other contribution types

    this.plugins.delete(pluginId);
  }

  getPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }

  // ==================== Change Notification ====================

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Singleton instance
export const registry = new UIRegistry();

// Re-export types
export * from './types';
```

### 1.3 React Hook for Registry

**File: `apps/web/src/lib/registry/hooks.ts`**

```typescript
import { useSyncExternalStore, useCallback } from 'react';
import { registry } from './index';
import type { EditorTabDefinition, SettingsPanelDefinition } from './types';

/**
 * Hook to get registered editor tabs with automatic re-render on changes
 */
export function useEditorTabs(context: 'card' | 'template' | 'all' = 'card'): EditorTabDefinition[] {
  const subscribe = useCallback(
    (callback: () => void) => registry.subscribe(callback),
    []
  );

  const getSnapshot = useCallback(
    () => registry.getTabs(context),
    [context]
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Hook to get registered settings panels
 */
export function useSettingsPanels(): SettingsPanelDefinition[] {
  const subscribe = useCallback(
    (callback: () => void) => registry.subscribe(callback),
    []
  );

  const getSnapshot = useCallback(
    () => registry.getSettingsPanels(),
    []
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Hook to get a specific tab by ID
 */
export function useEditorTab(id: string): EditorTabDefinition | undefined {
  const subscribe = useCallback(
    (callback: () => void) => registry.subscribe(callback),
    []
  );

  const getSnapshot = useCallback(
    () => registry.getTab(id),
    [id]
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
```

---

## Part 2: Refactoring Core Editor

### 2.1 Register Core Tabs

**File: `apps/web/src/features/editor/tabs.ts`**

```typescript
import { lazy } from 'react';
import { registry } from '@/lib/registry';

// Eager-loaded core components (small, always needed)
import EditPanel from './components/EditPanel';
import PreviewPanel from './components/PreviewPanel';

// Lazy-loaded components (larger, less frequently used)
const DiffPanel = lazy(() => import('./components/DiffPanel'));
const AssetsPanel = lazy(() => import('./components/AssetsPanel'));
const LorebookEditor = lazy(() => import('./components/LorebookEditor'));
const FocusedEditor = lazy(() => import('./components/FocusedEditor'));
const PromptSimulatorPanel = lazy(() => import('./components/PromptSimulatorPanel'));

/**
 * Register all core editor tabs
 */
export function registerCoreTabs(): void {
  // Edit - Primary editing interface
  registry.registerTab({
    id: 'edit',
    label: 'Edit',
    component: EditPanel,
    order: 0,
    contexts: ['card', 'template'],
  });

  // Preview - Markdown preview
  registry.registerTab({
    id: 'preview',
    label: 'Preview',
    component: PreviewPanel,
    order: 10,
    contexts: ['card'],
  });

  // Diff - Version comparison
  registry.registerTab({
    id: 'diff',
    label: 'Diff',
    component: DiffPanel,
    order: 20,
    contexts: ['card'],
  });

  // Assets - Image/asset management
  registry.registerTab({
    id: 'assets',
    label: 'Assets',
    component: AssetsPanel,
    order: 30,
    contexts: ['card'],
  });

  // Lorebook - Character book editor
  registry.registerTab({
    id: 'lorebook',
    label: 'Lorebook',
    component: LorebookEditor,
    order: 40,
    contexts: ['card'],
  });

  // Focused - Distraction-free editing
  registry.registerTab({
    id: 'focused',
    label: 'Focused',
    component: FocusedEditor,
    order: 50,
    contexts: ['card'],
  });

  // Prompt Simulator
  registry.registerTab({
    id: 'prompt-simulator',
    label: 'Simulator',
    component: PromptSimulatorPanel,
    order: 60,
    contexts: ['card'],
  });
}
```

### 2.2 Refactored EditorTabs Component

**File: `apps/web/src/features/editor/components/EditorTabs.tsx`**

```typescript
import { Suspense } from 'react';
import { useEditorTabs } from '@/lib/registry/hooks';
import { useUIStore } from '@/store/ui-store';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface EditorTabsProps {
  context?: 'card' | 'template' | 'all';
}

export function EditorTabs({ context = 'card' }: EditorTabsProps) {
  const tabs = useEditorTabs(context);
  const { activeTab, setActiveTab } = useUIStore();

  // Default to first tab if current tab not available
  const availableIds = tabs.map(t => t.id);
  const currentTab = availableIds.includes(activeTab) ? activeTab : availableIds[0];

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex border-b border-dark-border bg-dark-surface">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              'hover:bg-dark-border/50',
              currentTab === tab.id
                ? 'text-dark-text border-b-2 border-blue-500'
                : 'text-dark-muted'
            )}
          >
            {tab.icon && <tab.icon className="w-4 h-4 mr-2 inline" />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<TabLoadingSpinner />}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'h-full',
                currentTab === tab.id ? 'block' : 'hidden'
              )}
            >
              <tab.component />
            </div>
          ))}
        </Suspense>
      </div>
    </div>
  );
}

function TabLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-dark-muted" />
    </div>
  );
}
```

### 2.3 Refactored CardEditor Component

**File: `apps/web/src/features/editor/CardEditor.tsx`**

```typescript
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCardStore } from '@/store/card-store';
import { EditorTabs } from './components/EditorTabs';
import { LLMAssistSidebar } from './components/LLMAssistSidebar';
import { useAutoSnapshot } from '@/hooks/useAutoSnapshot';

export function CardEditor() {
  const { id } = useParams<{ id: string }>();
  const { loadCard, currentCard } = useCardStore();

  // Load card on mount or ID change
  useEffect(() => {
    if (id) {
      loadCard(id);
    }
  }, [id, loadCard]);

  // Auto-snapshot hook
  useAutoSnapshot();

  if (!currentCard) {
    return <div className="p-4 text-dark-muted">Loading...</div>;
  }

  return (
    <div className="flex h-full">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        <EditorTabs context="card" />
      </div>

      {/* LLM Assist Sidebar */}
      <LLMAssistSidebar />
    </div>
  );
}
```

---

## Part 3: Module/Plugin Structure

### 3.1 Directory Structure

```
apps/web/src/
├── lib/
│   └── registry/
│       ├── index.ts        # Registry singleton
│       ├── types.ts        # Type definitions
│       └── hooks.ts        # React hooks
│
├── features/               # Core features (always loaded)
│   ├── editor/
│   │   ├── tabs.ts         # Core tab registration
│   │   ├── CardEditor.tsx
│   │   └── components/
│   │       ├── EditPanel.tsx
│   │       ├── PreviewPanel.tsx
│   │       └── ...
│   └── dashboard/
│       └── CardGrid.tsx
│
├── modules/                # Optional modules (lazy loaded)
│   ├── block-editor/
│   │   ├── index.ts        # Plugin manifest & registration
│   │   ├── BlockEditorPanel.tsx
│   │   ├── store.ts        # Module-local Zustand store
│   │   ├── components/
│   │   │   ├── BlockCanvas.tsx
│   │   │   ├── BlockToolbar.tsx
│   │   │   └── BlockPalette.tsx
│   │   └── blocks/
│   │       ├── TextBlock.tsx
│   │       ├── ImageBlock.tsx
│   │       └── registry.ts # Block type registry
│   │
│   ├── wwwyzzerdd/         # Migrate existing feature to module
│   │   ├── index.ts
│   │   ├── WwwyzzerddTab.tsx
│   │   └── store.ts
│   │
│   └── comfyui/            # Migrate existing feature to module
│       ├── index.ts
│       ├── ComfyUITab.tsx
│       └── store.ts
│
└── main.tsx                # Application entry point
```

### 3.2 Example Module: Block Editor

**File: `apps/web/src/modules/block-editor/index.ts`**

```typescript
import { lazy } from 'react';
import { registry, PluginManifest } from '@/lib/registry';
import { useSettingsStore } from '@/store/settings-store';

// Lazy load the main component
const BlockEditorPanel = lazy(() => import('./BlockEditorPanel'));

/**
 * Block Editor Plugin Manifest
 */
const blockEditorPlugin: PluginManifest = {
  id: 'block-editor',
  name: 'Block Editor',
  version: '0.1.0',
  description: 'Visual block-based card editor',
  author: 'Card Architect',

  tabs: [
    {
      id: 'block-editor',
      label: 'Blocks',
      component: BlockEditorPanel,
      order: 15,  // After Edit (0), before Preview (10)? Or adjust as needed
      contexts: ['card'],
      condition: () => {
        // Only show if feature flag enabled
        return useSettingsStore.getState().featureFlags.blockEditor ?? false;
      },
    },
  ],

  settingsPanels: [
    {
      id: 'block-editor-settings',
      label: 'Block Editor',
      component: lazy(() => import('./BlockEditorSettings')),
      order: 60,
      condition: () => useSettingsStore.getState().featureFlags.blockEditor ?? false,
    },
  ],

  onActivate: async () => {
    console.log('Block Editor plugin activated');
    // Initialize any module-level state, load saved preferences, etc.
  },

  onDeactivate: async () => {
    console.log('Block Editor plugin deactivated');
    // Cleanup
  },
};

/**
 * Register the plugin
 */
export function register(): void {
  registry.registerPlugin(blockEditorPlugin);
}

// Auto-register on import
register();
```

**File: `apps/web/src/modules/block-editor/store.ts`**

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface Block {
  id: string;
  type: 'text' | 'image' | 'divider' | 'quote' | 'list';
  content: string;
  metadata?: Record<string, unknown>;
}

interface BlockEditorState {
  blocks: Block[];
  selectedBlockId: string | null;
  isDragging: boolean;

  // Actions
  addBlock: (type: Block['type'], afterId?: string) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, content: string) => void;
  moveBlock: (id: string, newIndex: number) => void;
  selectBlock: (id: string | null) => void;
  setDragging: (isDragging: boolean) => void;

  // Conversion
  toMarkdown: () => string;
  fromMarkdown: (markdown: string) => void;
}

export const useBlockEditorStore = create<BlockEditorState>()(
  immer((set, get) => ({
    blocks: [],
    selectedBlockId: null,
    isDragging: false,

    addBlock: (type, afterId) => {
      set((state) => {
        const newBlock: Block = {
          id: crypto.randomUUID(),
          type,
          content: '',
        };

        if (afterId) {
          const index = state.blocks.findIndex(b => b.id === afterId);
          state.blocks.splice(index + 1, 0, newBlock);
        } else {
          state.blocks.push(newBlock);
        }
      });
    },

    removeBlock: (id) => {
      set((state) => {
        state.blocks = state.blocks.filter(b => b.id !== id);
        if (state.selectedBlockId === id) {
          state.selectedBlockId = null;
        }
      });
    },

    updateBlock: (id, content) => {
      set((state) => {
        const block = state.blocks.find(b => b.id === id);
        if (block) {
          block.content = content;
        }
      });
    },

    moveBlock: (id, newIndex) => {
      set((state) => {
        const currentIndex = state.blocks.findIndex(b => b.id === id);
        if (currentIndex === -1) return;

        const [block] = state.blocks.splice(currentIndex, 1);
        state.blocks.splice(newIndex, 0, block);
      });
    },

    selectBlock: (id) => {
      set({ selectedBlockId: id });
    },

    setDragging: (isDragging) => {
      set({ isDragging });
    },

    toMarkdown: () => {
      const { blocks } = get();
      return blocks.map(block => {
        switch (block.type) {
          case 'text':
            return block.content;
          case 'quote':
            return `> ${block.content}`;
          case 'divider':
            return '---';
          case 'list':
            return block.content.split('\n').map(line => `- ${line}`).join('\n');
          case 'image':
            return `![](${block.content})`;
          default:
            return block.content;
        }
      }).join('\n\n');
    },

    fromMarkdown: (markdown) => {
      // Parse markdown into blocks
      // This is a simplified example - real implementation would be more robust
      const paragraphs = markdown.split(/\n\n+/);
      const blocks: Block[] = paragraphs.map(p => {
        const trimmed = p.trim();

        if (trimmed === '---') {
          return { id: crypto.randomUUID(), type: 'divider' as const, content: '' };
        }
        if (trimmed.startsWith('> ')) {
          return { id: crypto.randomUUID(), type: 'quote' as const, content: trimmed.slice(2) };
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split('\n').map(line => line.replace(/^[-*]\s*/, ''));
          return { id: crypto.randomUUID(), type: 'list' as const, content: items.join('\n') };
        }
        if (trimmed.match(/^!\[.*\]\(.*\)$/)) {
          const match = trimmed.match(/^!\[.*\]\((.*)\)$/);
          return { id: crypto.randomUUID(), type: 'image' as const, content: match?.[1] ?? '' };
        }

        return { id: crypto.randomUUID(), type: 'text' as const, content: trimmed };
      });

      set({ blocks, selectedBlockId: null });
    },
  }))
);
```

**File: `apps/web/src/modules/block-editor/BlockEditorPanel.tsx`**

```typescript
import { useEffect } from 'react';
import { useCardStore } from '@/store/card-store';
import { useBlockEditorStore } from './store';
import { BlockCanvas } from './components/BlockCanvas';
import { BlockToolbar } from './components/BlockToolbar';
import { BlockPalette } from './components/BlockPalette';

export default function BlockEditorPanel() {
  const { currentCard, updateCardData } = useCardStore();
  const { blocks, fromMarkdown, toMarkdown } = useBlockEditorStore();

  // Sync from card description to blocks on mount
  useEffect(() => {
    if (currentCard?.data?.description) {
      fromMarkdown(currentCard.data.description);
    }
  }, [currentCard?.meta?.id]);  // Only on card change, not every description update

  // Sync blocks back to card description
  const handleSave = () => {
    const markdown = toMarkdown();
    updateCardData({ description: markdown });
  };

  return (
    <div className="flex h-full">
      {/* Block Palette - Left sidebar */}
      <BlockPalette />

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        <BlockToolbar onSave={handleSave} />
        <BlockCanvas />
      </div>
    </div>
  );
}
```

---

## Part 4: Application Initialization

### 4.1 Module Loader

**File: `apps/web/src/lib/modules.ts`**

```typescript
import { useSettingsStore } from '@/store/settings-store';

/**
 * Dynamically import and register optional modules based on feature flags
 */
export async function loadModules(): Promise<void> {
  const { featureFlags } = useSettingsStore.getState();

  // Always load core features
  const { registerCoreTabs } = await import('@/features/editor/tabs');
  registerCoreTabs();

  // Conditionally load optional modules
  const moduleLoaders: Array<{ flag: keyof typeof featureFlags; loader: () => Promise<void> }> = [
    {
      flag: 'blockEditor',
      loader: async () => {
        await import('@/modules/block-editor');
      },
    },
    {
      flag: 'wwwyzzerdd',
      loader: async () => {
        await import('@/modules/wwwyzzerdd');
      },
    },
    {
      flag: 'comfyui',
      loader: async () => {
        await import('@/modules/comfyui');
      },
    },
  ];

  // Load enabled modules in parallel
  await Promise.all(
    moduleLoaders
      .filter(({ flag }) => featureFlags[flag])
      .map(({ loader }) => loader().catch(err => {
        console.error('Failed to load module:', err);
      }))
  );
}
```

### 4.2 Updated main.tsx

**File: `apps/web/src/main.tsx`**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { loadModules } from './lib/modules';
import './styles/index.css';

async function bootstrap() {
  // Load all modules before rendering
  await loadModules();

  // Render application
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

bootstrap();
```

---

## Part 5: Settings Store Updates

### 5.1 Feature Flags in Settings Store

**File: `apps/web/src/store/settings-store.ts`** (additions)

```typescript
interface FeatureFlags {
  wwwyzzerdd: boolean;
  comfyui: boolean;
  blockEditor: boolean;  // NEW
}

interface SettingsState {
  // ... existing fields ...

  featureFlags: FeatureFlags;

  // Actions
  setFeatureFlag: (flag: keyof FeatureFlags, enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // ... existing state ...

      featureFlags: {
        wwwyzzerdd: false,
        comfyui: false,
        blockEditor: false,
      },

      setFeatureFlag: (flag, enabled) => {
        set((state) => ({
          featureFlags: {
            ...state.featureFlags,
            [flag]: enabled,
          },
        }));

        // Trigger module load/unload
        // Note: Full unloading requires page refresh or more complex logic
        if (enabled) {
          import(`@/modules/${flag}`).catch(console.error);
        }
      },
    }),
    {
      name: 'card-architect-settings',
    }
  )
);
```

---

## Part 6: Migration Plan

### Phase 1: Infrastructure - COMPLETED
1. ~~Create `apps/web/src/lib/registry/` with types, registry class, and hooks~~
2. ~~Create `apps/web/src/lib/modules.ts` module loader~~
3. ~~Update `main.tsx` to use async bootstrap~~

### Phase 2: Core Migration - COMPLETED
1. ~~Create `apps/web/src/features/editor/tabs.ts` to register core tabs~~
2. ~~Refactor `EditorTabs.tsx` to use registry~~
3. ~~Refactor `CardEditor.tsx` to use dynamic tab rendering~~
4. ~~Test that all existing functionality works~~

### Phase 3: Migrate Existing Features - COMPLETED
1. ~~Create `apps/web/src/modules/wwwyzzerdd/` with registration~~
2. ~~Create `apps/web/src/modules/comfyui/` with registration~~
3. ~~Feature flags trigger module loading~~

### Phase 4: Block Editor Module - COMPLETED
1. ~~Created `apps/web/src/modules/block-editor/` structure~~
2. ~~Implemented block editor store (Zustand) with full CRUD operations~~
3. ~~Implemented BlockEditorPanel, BlockComponent, SortableBaby, SortableListItem components~~
4. ~~Implemented block types: hierarchical blocks with babies (text, flat list, nested list)~~
5. ~~Implemented drag-drop via @dnd-kit~~
6. ~~Added "Apply to Card" to export blocks as markdown to character fields~~
7. ~~Added template system for saving/loading block structures~~

**Implementation based on BeastBox standalone app:**
- Unlimited nested block hierarchy with visual level indicators
- Content babies: text blocks, flat lists, flat-nested lists
- Split header/body support for list items with bold toggle
- Promote/demote between flat and nested lists
- Field mapping to CCv2/CCv3 character card fields
- V2/V3 spec version toggle

---

## Part 7: Backend Considerations

### 7.1 Plugin Metadata Storage

If plugins need to store configuration, add a generic key-value store:

**New Table: `plugin_settings`**

```sql
CREATE TABLE plugin_settings (
  plugin_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,  -- JSON
  updated_at TEXT NOT NULL,
  PRIMARY KEY (plugin_id, key)
);
```

**API Endpoints:**

```
GET    /api/plugins/:pluginId/settings           # Get all settings for plugin
GET    /api/plugins/:pluginId/settings/:key      # Get specific setting
PUT    /api/plugins/:pluginId/settings/:key      # Set setting
DELETE /api/plugins/:pluginId/settings/:key      # Delete setting
```

### 7.2 Backend Plugin Hooks (Future)

For server-side plugins (e.g., custom export formats, validation rules), consider:

```typescript
// apps/api/src/lib/plugin-hooks.ts
interface BackendPluginHooks {
  // Card lifecycle
  beforeCardSave?: (card: Card) => Promise<Card>;
  afterCardSave?: (card: Card) => Promise<void>;
  beforeCardExport?: (card: Card, format: string) => Promise<Card>;

  // Custom export formats
  exportFormats?: {
    [format: string]: (card: Card) => Promise<Buffer>;
  };

  // Custom validation
  validators?: {
    [name: string]: (card: Card) => Promise<ValidationResult>;
  };
}
```

This is out of scope for initial implementation but shows extensibility path.

---

## Summary

### Files to Create
1. `apps/web/src/lib/registry/types.ts`
2. `apps/web/src/lib/registry/index.ts`
3. `apps/web/src/lib/registry/hooks.ts`
4. `apps/web/src/lib/modules.ts`
5. `apps/web/src/features/editor/tabs.ts`
6. `apps/web/src/modules/block-editor/index.ts`
7. `apps/web/src/modules/block-editor/store.ts`
8. `apps/web/src/modules/block-editor/BlockEditorPanel.tsx`
9. `apps/web/src/modules/block-editor/components/*.tsx`

### Files to Modify
1. `apps/web/src/main.tsx` - Async bootstrap with module loading
2. `apps/web/src/features/editor/components/EditorTabs.tsx` - Use registry
3. `apps/web/src/features/editor/CardEditor.tsx` - Simplified, uses EditorTabs
4. `apps/web/src/store/settings-store.ts` - Add blockEditor feature flag
5. `apps/web/src/components/shared/SettingsModal.tsx` - Add block editor toggle

### Estimated Effort
- **Registry Infrastructure**: 3-4 hours
- **Core Tab Migration**: 2-3 hours
- **Module Migration (wwwyzzerdd, comfyui)**: 2-3 hours
- **Block Editor Module**: 8-16 hours (depending on complexity)
- **Total Infrastructure**: ~8-10 hours
- **Block Editor Feature**: ~8-16 hours additional
