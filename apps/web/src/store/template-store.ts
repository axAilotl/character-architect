import { create } from 'zustand';
import type { Template, Snippet, UUID } from '@card-architect/schemas';
import { api } from '../lib/api';
import { getDeploymentConfig } from '../config/deployment';

const TEMPLATES_STORAGE_KEY = 'ca-templates';
const SNIPPETS_STORAGE_KEY = 'ca-snippets';

// Default templates for light mode
const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'default-persona',
    name: 'Basic Persona',
    description: 'A simple character persona template',
    category: 'character',
    targetFields: ['description'],
    content: {
      description: '{{char}} is a [age] year old [gender] [species/race]. They have [physical description]. Their personality is [traits]. They speak in a [speech pattern] manner.',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'default-scenario',
    name: 'Basic Scenario',
    description: 'A simple scenario template',
    category: 'scenario',
    targetFields: ['scenario'],
    content: {
      scenario: '{{user}} and {{char}} are [relationship/situation]. The setting is [location/time]. [Additional context about the situation].',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
];

// Default snippets for light mode
const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: 'snippet-char',
    name: '{{char}}',
    description: 'Character name placeholder',
    category: 'instruction',
    content: '{{char}}',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snippet-user',
    name: '{{user}}',
    description: 'User name placeholder',
    category: 'instruction',
    content: '{{user}}',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: 'snippet-asterisk-action',
    name: '*action*',
    description: 'Action/emote format',
    category: 'format',
    content: '*{{char}} [action]*',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
];

interface TemplateStore {
  templates: Template[];
  snippets: Snippet[];
  isLoading: boolean;
  error: string | null;

  // Load from API
  loadTemplates: () => Promise<void>;
  loadSnippets: () => Promise<void>;

  // Template operations
  getTemplate: (id: UUID) => Template | undefined;
  createTemplate: (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Template | null>;
  updateTemplate: (id: UUID, updates: Partial<Omit<Template, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteTemplate: (id: UUID) => Promise<void>;

  // Snippet operations
  getSnippet: (id: UUID) => Snippet | undefined;
  createSnippet: (snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Snippet | null>;
  updateSnippet: (id: UUID, updates: Partial<Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteSnippet: (id: UUID) => Promise<void>;

  // Import/Export
  exportTemplates: () => Promise<void>;
  exportSnippets: () => Promise<void>;
  importTemplates: (file: File, replace?: boolean) => Promise<{ success: boolean; imported?: number; error?: string }>;
  importSnippets: (file: File, replace?: boolean) => Promise<{ success: boolean; imported?: number; error?: string }>;

  // Reset to defaults
  resetTemplates: () => Promise<void>;
  resetSnippets: () => Promise<void>;
}

export const useTemplateStore = create<TemplateStore>()((set, get) => ({
  templates: [],
  snippets: [],
  isLoading: false,
  error: null,

  // Load templates
  loadTemplates: async () => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    set({ isLoading: true, error: null });

    if (isLightMode) {
      // Load from localStorage in light mode
      try {
        const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
        if (stored) {
          const templates = JSON.parse(stored);
          set({ templates, isLoading: false });
        } else {
          // Initialize with defaults
          localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
          set({ templates: DEFAULT_TEMPLATES, isLoading: false });
        }
      } catch (error) {
        console.error('Failed to load templates from localStorage:', error);
        set({ templates: DEFAULT_TEMPLATES, isLoading: false });
      }
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/templates`);
      if (!response.ok) throw new Error('Failed to load templates');
      const data = await response.json();
      set({ templates: data.templates || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Load snippets
  loadSnippets: async () => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    set({ isLoading: true, error: null });

    if (isLightMode) {
      // Load from localStorage in light mode
      try {
        const stored = localStorage.getItem(SNIPPETS_STORAGE_KEY);
        if (stored) {
          const snippets = JSON.parse(stored);
          set({ snippets, isLoading: false });
        } else {
          // Initialize with defaults
          localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(DEFAULT_SNIPPETS));
          set({ snippets: DEFAULT_SNIPPETS, isLoading: false });
        }
      } catch (error) {
        console.error('Failed to load snippets from localStorage:', error);
        set({ snippets: DEFAULT_SNIPPETS, isLoading: false });
      }
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/snippets`);
      if (!response.ok) throw new Error('Failed to load snippets');
      const data = await response.json();
      set({ snippets: data.snippets || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Template operations
  getTemplate: (id) => {
    return get().templates.find((t) => t.id === id);
  },

  createTemplate: async (template) => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    const now = new Date().toISOString();
    const newTemplate: Template = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    if (isLightMode) {
      // Save to localStorage
      const templates = [...get().templates, newTemplate];
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
      set({ templates });
      return newTemplate;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!response.ok) throw new Error('Failed to create template');
      const data = await response.json();
      set((state) => ({
        templates: [...state.templates, data.template],
      }));
      return data.template;
    } catch (error) {
      console.error('Failed to create template:', error);
      return null;
    }
  },

  updateTemplate: async (id, updates) => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      // Update in localStorage
      const templates = get().templates.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      );
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
      set({ templates });
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update template');
      const data = await response.json();
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? data.template : t)),
      }));
    } catch (error) {
      console.error('Failed to update template:', error);
    }
  },

  deleteTemplate: async (id) => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      // Delete from localStorage
      const templates = get().templates.filter((t) => t.id !== id);
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
      set({ templates });
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/templates/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete template');
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  },

  // Snippet operations
  getSnippet: (id) => {
    return get().snippets.find((s) => s.id === id);
  },

  createSnippet: async (snippet) => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    const now = new Date().toISOString();
    const newSnippet: Snippet = {
      ...snippet,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    if (isLightMode) {
      // Save to localStorage
      const snippets = [...get().snippets, newSnippet];
      localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
      set({ snippets });
      return newSnippet;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/snippets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snippet),
      });
      if (!response.ok) throw new Error('Failed to create snippet');
      const data = await response.json();
      set((state) => ({
        snippets: [...state.snippets, data.snippet],
      }));
      return data.snippet;
    } catch (error) {
      console.error('Failed to create snippet:', error);
      return null;
    }
  },

  updateSnippet: async (id, updates) => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      // Update in localStorage
      const snippets = get().snippets.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      );
      localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
      set({ snippets });
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/snippets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update snippet');
      const data = await response.json();
      set((state) => ({
        snippets: state.snippets.map((s) => (s.id === id ? data.snippet : s)),
      }));
    } catch (error) {
      console.error('Failed to update snippet:', error);
    }
  },

  deleteSnippet: async (id) => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      // Delete from localStorage
      const snippets = get().snippets.filter((s) => s.id !== id);
      localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
      set({ snippets });
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/snippets/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete snippet');
      set((state) => ({
        snippets: state.snippets.filter((s) => s.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete snippet:', error);
    }
  },

  // Export templates as JSON download
  exportTemplates: async () => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      // Export from localStorage
      const templates = get().templates;
      const blob = new Blob([JSON.stringify({ templates }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'templates.json';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/templates/export/all`);
      if (!response.ok) throw new Error('Failed to export templates');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'templates.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export templates:', error);
    }
  },

  // Export snippets as JSON download
  exportSnippets: async () => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      // Export from localStorage
      const snippets = get().snippets;
      const blob = new Blob([JSON.stringify({ snippets }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'snippets.json';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/snippets/export/all`);
      if (!response.ok) throw new Error('Failed to export snippets');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'snippets.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export snippets:', error);
    }
  },

  // Import templates from JSON file
  importTemplates: async (file, replace = false) => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedTemplates = parsed.templates || parsed;

      if (isLightMode) {
        // Import to localStorage
        const now = new Date().toISOString();
        const newTemplates = importedTemplates.map((t: any) => ({
          ...t,
          id: t.id || crypto.randomUUID(),
          createdAt: t.createdAt || now,
          updatedAt: now,
        }));

        const existing = replace ? [] : get().templates;
        const templates = [...existing, ...newTemplates];
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
        set({ templates });
        return { success: true, imported: newTemplates.length };
      }

      // Server mode
      const response = await fetch(`${api.baseURL}/templates/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: importedTemplates, replace }),
      });

      if (!response.ok) throw new Error('Failed to import templates');
      const data = await response.json();

      // Reload templates
      await get().loadTemplates();

      return { success: true, imported: data.imported };
    } catch (error: any) {
      console.error('Failed to import templates:', error);
      return { success: false, error: error.message };
    }
  },

  // Import snippets from JSON file
  importSnippets: async (file, replace = false) => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedSnippets = parsed.snippets || parsed;

      if (isLightMode) {
        // Import to localStorage
        const now = new Date().toISOString();
        const newSnippets = importedSnippets.map((s: any) => ({
          ...s,
          id: s.id || crypto.randomUUID(),
          createdAt: s.createdAt || now,
          updatedAt: now,
        }));

        const existing = replace ? [] : get().snippets;
        const snippets = [...existing, ...newSnippets];
        localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
        set({ snippets });
        return { success: true, imported: newSnippets.length };
      }

      // Server mode
      const response = await fetch(`${api.baseURL}/snippets/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippets: importedSnippets, replace }),
      });

      if (!response.ok) throw new Error('Failed to import snippets');
      const data = await response.json();

      // Reload snippets
      await get().loadSnippets();

      return { success: true, imported: data.imported };
    } catch (error: any) {
      console.error('Failed to import snippets:', error);
      return { success: false, error: error.message };
    }
  },

  // Reset templates to defaults
  resetTemplates: async () => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      // Reset to defaults in localStorage
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      set({ templates: DEFAULT_TEMPLATES });
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/templates/reset`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to reset templates');
      const data = await response.json();
      set({ templates: data.templates || [] });
    } catch (error) {
      console.error('Failed to reset templates:', error);
    }
  },

  // Reset snippets to defaults
  resetSnippets: async () => {
    const config = getDeploymentConfig();
    const isLightMode = config.mode === 'light' || config.mode === 'static';

    if (isLightMode) {
      // Reset to defaults in localStorage
      localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(DEFAULT_SNIPPETS));
      set({ snippets: DEFAULT_SNIPPETS });
      return;
    }

    // Server mode
    try {
      const response = await fetch(`${api.baseURL}/snippets/reset`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to reset snippets');
      const data = await response.json();
      set({ snippets: data.snippets || [] });
    } catch (error) {
      console.error('Failed to reset snippets:', error);
    }
  },
}));
