import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AutoSnapshotSettings {
  enabled: boolean;
  intervalMinutes: number; // 1, 5, 10, 15, 30
}

interface CreatorNotesSettings {
  htmlMode: boolean;
}

interface FeatureFlags {
  blockEditorEnabled: boolean;
  wwwyzzerddEnabled: boolean;
  comfyuiEnabled: boolean;
  sillytavernEnabled: boolean;
  assetsEnabled: boolean;
  focusedEnabled: boolean;
  diffEnabled: boolean;
  webimportEnabled: boolean;
  linkedImageArchivalEnabled: boolean;
  // Dynamic module flags (for auto-discovered modules)
  [key: string]: boolean;
}

interface WwwyzzerddSettings {
  activePromptSetId: string | null;
}

interface AIPromptSettings {
  tagsSystemPrompt: string;
  taglineSystemPrompt: string;
}

interface ComfyUISettings {
  serverUrl: string;
  activeWorkflowId: string | null;
  activePromptId: string | null;
  autoSelectType: boolean;
  autoGenerateFilename: boolean;
  defaultModel: string;
  defaultSampler: string;
  defaultScheduler: string;
  defaultWidth: number;
  defaultHeight: number;
  positivePrefix: string;
  negativePrefix: string;
}

// Theme definitions
export type ThemeId =
  | 'default-dark'
  | 'bisexual'
  | 'necron'
  | 'dracula'
  | 'sakura'
  | 'solarized-light'
  | 'github-light'
  | 'nord-light';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  isDark: boolean;
  colors: {
    bg: string;
    surface: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accentHover: string;
  };
}

export const THEMES: ThemeDefinition[] = [
  // Dark Themes
  {
    id: 'default-dark',
    name: 'Default Dark',
    isDark: true,
    colors: {
      bg: '#0f172a',
      surface: '#1e293b',
      border: '#334155',
      text: '#e2e8f0',
      muted: '#94a3b8',
      accent: '#3b82f6',
      accentHover: '#2563eb',
    },
  },
  {
    id: 'bisexual',
    name: 'Bisexual',
    isDark: true,
    colors: {
      bg: '#1a1625',
      surface: '#2d2640',
      border: '#4a3d6a',
      text: '#e8e0f0',
      muted: '#a090c0',
      accent: '#d459ab',
      accentHover: '#9b4dca',
    },
  },
  {
    id: 'necron',
    name: 'Necron',
    isDark: true,
    colors: {
      bg: '#0a0f0a',
      surface: '#141a14',
      border: '#1e2e1e',
      text: '#00ff00',
      muted: '#4a7a4a',
      accent: '#00cc00',
      accentHover: '#00aa00',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    isDark: true,
    colors: {
      bg: '#282a36',
      surface: '#44475a',
      border: '#6272a4',
      text: '#f8f8f2',
      muted: '#6272a4',
      accent: '#bd93f9',
      accentHover: '#ff79c6',
    },
  },
  // Light Themes
  {
    id: 'sakura',
    name: 'Sakura',
    isDark: false,
    colors: {
      bg: '#fff5f7',
      surface: '#fff0f3',
      border: '#ffc0cb',
      text: '#4a2c3d',
      muted: '#8b6b7a',
      accent: '#e75480',
      accentHover: '#c94670',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    isDark: false,
    colors: {
      bg: '#fdf6e3',
      surface: '#eee8d5',
      border: '#93a1a1',
      text: '#657b83',
      muted: '#839496',
      accent: '#268bd2',
      accentHover: '#2aa198',
    },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    isDark: false,
    colors: {
      bg: '#ffffff',
      surface: '#f6f8fa',
      border: '#d0d7de',
      text: '#24292f',
      muted: '#57606a',
      accent: '#0969da',
      accentHover: '#0550ae',
    },
  },
  {
    id: 'nord-light',
    name: 'Nord Light',
    isDark: false,
    colors: {
      bg: '#eceff4',
      surface: '#e5e9f0',
      border: '#d8dee9',
      text: '#2e3440',
      muted: '#4c566a',
      accent: '#5e81ac',
      accentHover: '#81a1c1',
    },
  },
];

interface ThemeSettings {
  themeId: ThemeId;
  customCss: string;
  backgroundImage: string;
  useCardAsBackground: boolean;
}

interface EditorSettings {
  showV3Fields: boolean;
  exportSpec: 'v2' | 'v3';
  showExtensionsTab: boolean;
  extendedFocusedFields: {
    personality: boolean;
    appearance: boolean;
    characterNote: boolean;
    exampleDialogue: boolean;
    systemPrompt: boolean;
    postHistory: boolean;
  };
}

interface SettingsStore {
  // Auto-snapshot settings
  autoSnapshot: AutoSnapshotSettings;

  // Creator Notes settings
  creatorNotes: CreatorNotesSettings;

  // Theme settings
  theme: ThemeSettings;

  // Editor settings
  editor: EditorSettings;

  // Feature flags
  features: FeatureFlags;

  // wwwyzzerdd settings
  wwwyzzerdd: WwwyzzerddSettings;

  // ComfyUI settings
  comfyUI: ComfyUISettings;

  // AI prompt settings
  aiPrompts: AIPromptSettings;

  // Actions
  setAutoSnapshotEnabled: (enabled: boolean) => void;
  setAutoSnapshotInterval: (minutes: number) => void;
  setCreatorNotesHtmlMode: (enabled: boolean) => void;

  // Theme actions
  setTheme: (themeId: ThemeId) => void;
  setCustomCss: (css: string) => void;
  setBackgroundImage: (url: string) => void;
  setUseCardAsBackground: (enabled: boolean) => void;

  // Editor actions
  setShowV3Fields: (show: boolean) => void;
  setExportSpec: (spec: 'v2' | 'v3') => void;
  setShowExtensionsTab: (show: boolean) => void;
  setExtendedFocusedField: (field: keyof EditorSettings['extendedFocusedFields'], enabled: boolean) => void;

  // Feature flag actions
  setBlockEditorEnabled: (enabled: boolean) => void;
  setWwwyzzerddEnabled: (enabled: boolean) => void;
  setComfyuiEnabled: (enabled: boolean) => void;
  setSillytavernEnabled: (enabled: boolean) => void;
  setAssetsEnabled: (enabled: boolean) => void;
  setFocusedEnabled: (enabled: boolean) => void;
  setDiffEnabled: (enabled: boolean) => void;
  setWebimportEnabled: (enabled: boolean) => void;
  setLinkedImageArchivalEnabled: (enabled: boolean) => void;
  // Generic setter for dynamic module flags
  setModuleEnabled: (moduleId: string, enabled: boolean) => void;

  // wwwyzzerdd actions
  setWwwyzzerddActivePromptSet: (id: string | null) => void;

  // ComfyUI actions
  setComfyUIServerUrl: (url: string) => void;
  setComfyUIActiveWorkflow: (id: string | null) => void;
  setComfyUIActivePrompt: (id: string | null) => void;
  setComfyUIAutoSelectType: (enabled: boolean) => void;
  setComfyUIAutoGenerateFilename: (enabled: boolean) => void;
  setComfyUIDefaults: (defaults: Partial<Omit<ComfyUISettings, 'serverUrl' | 'activeWorkflowId' | 'activePromptId' | 'autoSelectType' | 'autoGenerateFilename'>>) => void;

  // AI prompt actions
  setTagsSystemPrompt: (prompt: string) => void;
  setTaglineSystemPrompt: (prompt: string) => void;
}

const DEFAULT_AUTO_SNAPSHOT: AutoSnapshotSettings = {
  enabled: false,
  intervalMinutes: 5,
};

const DEFAULT_CREATOR_NOTES: CreatorNotesSettings = {
  htmlMode: false,
};

const DEFAULT_THEME: ThemeSettings = {
  themeId: 'default-dark',
  customCss: '',
  backgroundImage: '',
  useCardAsBackground: false,
};

const DEFAULT_EDITOR: EditorSettings = {
  showV3Fields: true,
  exportSpec: 'v3',
  showExtensionsTab: true,
  extendedFocusedFields: {
    personality: true,
    appearance: true,
    characterNote: true,
    exampleDialogue: true,
    systemPrompt: true,
    postHistory: true,
  },
};

const DEFAULT_FEATURES: FeatureFlags = {
  blockEditorEnabled: true, // Enabled by default
  wwwyzzerddEnabled: false,
  comfyuiEnabled: false,
  sillytavernEnabled: false, // Disabled by default - needs configuration
  assetsEnabled: true, // Enabled by default
  focusedEnabled: true, // Enabled by default
  diffEnabled: true, // Enabled by default
  webimportEnabled: false, // Disabled by default - needs userscript
  linkedImageArchivalEnabled: false, // Disabled by default - destructive operation
};

const DEFAULT_WWWYZZERDD: WwwyzzerddSettings = {
  activePromptSetId: null,
};

const DEFAULT_COMFYUI: ComfyUISettings = {
  serverUrl: 'http://127.0.0.1:8188',
  activeWorkflowId: null,
  activePromptId: null,
  autoSelectType: true,
  autoGenerateFilename: true,
  defaultModel: '',
  defaultSampler: 'euler',
  defaultScheduler: 'normal',
  defaultWidth: 512,
  defaultHeight: 768,
  positivePrefix: '',
  negativePrefix: 'blurry, low quality, deformed, bad anatomy, watermark, signature',
};

const DEFAULT_AI_PROMPTS: AIPromptSettings = {
  tagsSystemPrompt: 'You are a helpful assistant that generates tags for character cards. Output ONLY a JSON array of lowercase single-word tag strings, nothing else. Tags should be relevant descriptors like genre, personality traits, setting, species, etc. Generate 5-10 tags. Each tag must be a single word (use hyphens for compound words like "sci-fi").',
  taglineSystemPrompt: 'You are a helpful assistant that writes short taglines for character cards. Output ONLY the tagline text, nothing else. The tagline should be catchy, intriguing, and under 500 characters. Do not use quotes around it.',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      autoSnapshot: DEFAULT_AUTO_SNAPSHOT,
      creatorNotes: DEFAULT_CREATOR_NOTES,
      theme: DEFAULT_THEME,
      editor: DEFAULT_EDITOR,
      features: DEFAULT_FEATURES,
      wwwyzzerdd: DEFAULT_WWWYZZERDD,
      comfyUI: DEFAULT_COMFYUI,
      aiPrompts: DEFAULT_AI_PROMPTS,

      setAutoSnapshotEnabled: (enabled) =>
        set((state) => ({
          autoSnapshot: { ...state.autoSnapshot, enabled },
        })),

      setAutoSnapshotInterval: (intervalMinutes) =>
        set((state) => ({
          autoSnapshot: { ...state.autoSnapshot, intervalMinutes },
        })),

      setCreatorNotesHtmlMode: (htmlMode) =>
        set((state) => ({
          creatorNotes: { ...state.creatorNotes, htmlMode },
        })),

      setTheme: (themeId) =>
        set((state) => ({
          theme: { ...state.theme, themeId },
        })),

      setCustomCss: (customCss) =>
        set((state) => ({
          theme: { ...state.theme, customCss },
        })),

      setBackgroundImage: (backgroundImage) =>
        set((state) => ({
          theme: { ...state.theme, backgroundImage },
        })),

      setUseCardAsBackground: (useCardAsBackground) =>
        set((state) => ({
          theme: { ...state.theme, useCardAsBackground },
        })),

      setShowV3Fields: (showV3Fields) =>
        set((state) => ({
          editor: { ...state.editor, showV3Fields },
        })),

      setExportSpec: (exportSpec) =>
        set((state) => ({
          editor: { ...state.editor, exportSpec },
        })),

      setShowExtensionsTab: (showExtensionsTab) =>
        set((state) => ({
          editor: { ...state.editor, showExtensionsTab },
        })),

      setExtendedFocusedField: (field, enabled) =>
        set((state) => ({
          editor: {
            ...state.editor,
            extendedFocusedFields: {
              ...state.editor.extendedFocusedFields,
              [field]: enabled,
            },
          },
        })),

      // Feature flag actions
      setBlockEditorEnabled: (enabled) =>
        set((state) => ({
          features: { ...state.features, blockEditorEnabled: enabled },
        })),

      setWwwyzzerddEnabled: (enabled) =>
        set((state) => ({
          features: { ...state.features, wwwyzzerddEnabled: enabled },
        })),

      setComfyuiEnabled: (enabled) =>
        set((state) => ({
          features: { ...state.features, comfyuiEnabled: enabled },
        })),

      setSillytavernEnabled: (enabled) =>
        set((state) => ({
          features: { ...state.features, sillytavernEnabled: enabled },
        })),

      setAssetsEnabled: (enabled) =>
        set((state) => ({
          features: { ...state.features, assetsEnabled: enabled },
        })),

      setFocusedEnabled: (enabled) =>
        set((state) => ({
          features: { ...state.features, focusedEnabled: enabled },
        })),

      setDiffEnabled: (enabled) =>
        set((state) => ({
          features: { ...state.features, diffEnabled: enabled },
        })),

      setWebimportEnabled: async (enabled) => {
        set((state) => ({
          features: { ...state.features, webimportEnabled: enabled },
        }));
        // Dynamically load the module when enabled
        if (enabled) {
          const { reloadModules } = await import('../lib/modules');
          await reloadModules();
        }
      },

      setLinkedImageArchivalEnabled: (enabled) =>
        set((state) => ({
          features: { ...state.features, linkedImageArchivalEnabled: enabled },
        })),

      // Generic setter for dynamic module flags
      setModuleEnabled: async (moduleId, enabled) => {
        const flagName = `${moduleId}Enabled`;
        set((state) => ({
          features: { ...state.features, [flagName]: enabled },
        }));
        // Dynamically load module when enabled
        if (enabled) {
          const { reloadModules } = await import('../lib/modules');
          await reloadModules();
        }
      },

      // wwwyzzerdd actions
      setWwwyzzerddActivePromptSet: (activePromptSetId) =>
        set((state) => ({
          wwwyzzerdd: { ...state.wwwyzzerdd, activePromptSetId },
        })),

      // ComfyUI actions
      setComfyUIServerUrl: (serverUrl) =>
        set((state) => ({
          comfyUI: { ...state.comfyUI, serverUrl },
        })),

      setComfyUIActiveWorkflow: (activeWorkflowId) =>
        set((state) => ({
          comfyUI: { ...state.comfyUI, activeWorkflowId },
        })),

      setComfyUIActivePrompt: (activePromptId) =>
        set((state) => ({
          comfyUI: { ...state.comfyUI, activePromptId },
        })),

      setComfyUIAutoSelectType: (autoSelectType) =>
        set((state) => ({
          comfyUI: { ...state.comfyUI, autoSelectType },
        })),

      setComfyUIAutoGenerateFilename: (autoGenerateFilename) =>
        set((state) => ({
          comfyUI: { ...state.comfyUI, autoGenerateFilename },
        })),

      setComfyUIDefaults: (defaults) =>
        set((state) => ({
          comfyUI: { ...state.comfyUI, ...defaults },
        })),

      // AI prompt actions
      setTagsSystemPrompt: (tagsSystemPrompt) =>
        set((state) => ({
          aiPrompts: { ...state.aiPrompts, tagsSystemPrompt },
        })),

      setTaglineSystemPrompt: (taglineSystemPrompt) =>
        set((state) => ({
          aiPrompts: { ...state.aiPrompts, taglineSystemPrompt },
        })),
    }),
    {
      name: 'card-architect-settings',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SettingsStore>;
        return {
          ...currentState,
          ...persisted,
          // Ensure new properties are properly merged with defaults
          features: { ...currentState.features, ...persisted.features },
          wwwyzzerdd: { ...currentState.wwwyzzerdd, ...persisted.wwwyzzerdd },
          comfyUI: { ...currentState.comfyUI, ...persisted.comfyUI },
          aiPrompts: { ...currentState.aiPrompts, ...persisted.aiPrompts },
          autoSnapshot: { ...currentState.autoSnapshot, ...persisted.autoSnapshot },
          creatorNotes: { ...currentState.creatorNotes, ...persisted.creatorNotes },
          theme: { ...currentState.theme, ...persisted.theme },
          editor: { ...currentState.editor, ...persisted.editor },
        };
      },
    }
  )
);
