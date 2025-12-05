import { create } from 'zustand';
import type { Template, Snippet, UUID } from '@card-architect/schemas';
import { api } from '../lib/api';
import { getDeploymentConfig } from '../config/deployment';

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

  // Load templates from API
  loadTemplates: async () => {
    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      // Templates require server - skip in light mode
      set({ isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${api.baseURL}/templates`);
      if (!response.ok) throw new Error('Failed to load templates');
      const data = await response.json();
      set({ templates: data.templates || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Load snippets from API
  loadSnippets: async () => {
    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      // Snippets require server - skip in light mode
      set({ isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
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
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const templates = parsed.templates || parsed;

      const response = await fetch(`${api.baseURL}/templates/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates, replace }),
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
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const snippets = parsed.snippets || parsed;

      const response = await fetch(`${api.baseURL}/snippets/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippets, replace }),
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
