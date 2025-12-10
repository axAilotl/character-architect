/**
 * Template Store
 *
 * Manages templates and snippets for character creation.
 * Uses PersistenceAdapter to handle server/local mode automatically.
 *
 * REFACTORED: Reduced from 552 lines to ~200 lines by using PersistenceAdapter
 * to abstract deployment mode differences.
 */

import { create } from 'zustand';
import type { Template, Snippet } from '../lib/types';
import { persistence } from '../adapters/persistence';

interface TemplateStore {
  templates: Template[];
  snippets: Snippet[];
  isLoading: boolean;
  error: string | null;

  // Load from persistence
  loadTemplates: () => Promise<void>;
  loadSnippets: () => Promise<void>;

  // Template operations
  getTemplate: (id: string) => Template | undefined;
  createTemplate: (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Template | null>;
  updateTemplate: (id: string, updates: Partial<Omit<Template, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Snippet operations
  getSnippet: (id: string) => Snippet | undefined;
  createSnippet: (snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Snippet | null>;
  updateSnippet: (id: string, updates: Partial<Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;

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

  // Load templates via adapter
  loadTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const templates = await persistence.listTemplates();
      set({ templates, isLoading: false });
    } catch (error) {
      console.error('Failed to load templates:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load templates', isLoading: false });
    }
  },

  // Load snippets via adapter
  loadSnippets: async () => {
    set({ isLoading: true, error: null });
    try {
      const snippets = await persistence.listSnippets();
      set({ snippets, isLoading: false });
    } catch (error) {
      console.error('Failed to load snippets:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load snippets', isLoading: false });
    }
  },

  // Template operations
  getTemplate: (id) => get().templates.find((t) => t.id === id),

  createTemplate: async (template) => {
    try {
      const newTemplate = await persistence.createTemplate(template);
      set((state) => ({ templates: [...state.templates, newTemplate] }));
      return newTemplate;
    } catch (error) {
      console.error('Failed to create template:', error);
      return null;
    }
  },

  updateTemplate: async (id, updates) => {
    try {
      const updated = await persistence.updateTemplate(id, updates);
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (error) {
      console.error('Failed to update template:', error);
    }
  },

  deleteTemplate: async (id) => {
    try {
      await persistence.deleteTemplate(id);
      set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  },

  // Snippet operations
  getSnippet: (id) => get().snippets.find((s) => s.id === id),

  createSnippet: async (snippet) => {
    try {
      const newSnippet = await persistence.createSnippet(snippet);
      set((state) => ({ snippets: [...state.snippets, newSnippet] }));
      return newSnippet;
    } catch (error) {
      console.error('Failed to create snippet:', error);
      return null;
    }
  },

  updateSnippet: async (id, updates) => {
    try {
      const updated = await persistence.updateSnippet(id, updates);
      set((state) => ({
        snippets: state.snippets.map((s) => (s.id === id ? updated : s)),
      }));
    } catch (error) {
      console.error('Failed to update snippet:', error);
    }
  },

  deleteSnippet: async (id) => {
    try {
      await persistence.deleteSnippet(id);
      set((state) => ({ snippets: state.snippets.filter((s) => s.id !== id) }));
    } catch (error) {
      console.error('Failed to delete snippet:', error);
    }
  },

  // Export templates - download as JSON
  exportTemplates: async () => {
    const templates = get().templates;
    const blob = new Blob([JSON.stringify({ templates }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'templates.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  // Export snippets - download as JSON
  exportSnippets: async () => {
    const snippets = get().snippets;
    const blob = new Blob([JSON.stringify({ snippets }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snippets.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  // Import templates from JSON file
  importTemplates: async (file, replace = false) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedTemplates = parsed.templates || parsed;

      if (replace) {
        // Reset then add all
        await persistence.resetTemplates();
      }

      let imported = 0;
      for (const t of importedTemplates) {
        await persistence.createTemplate({
          name: t.name,
          description: t.description,
          content: t.content,
          category: t.category,
          targetFields: t.targetFields,
          isDefault: false,
        });
        imported++;
      }

      // Reload from persistence
      await get().loadTemplates();
      return { success: true, imported };
    } catch (error) {
      console.error('Failed to import templates:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Import failed' };
    }
  },

  // Import snippets from JSON file
  importSnippets: async (file, replace = false) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedSnippets = parsed.snippets || parsed;

      if (replace) {
        await persistence.resetSnippets();
      }

      let imported = 0;
      for (const s of importedSnippets) {
        await persistence.createSnippet({
          name: s.name,
          description: s.description,
          content: s.content,
          category: s.category,
          isDefault: false,
        });
        imported++;
      }

      await get().loadSnippets();
      return { success: true, imported };
    } catch (error) {
      console.error('Failed to import snippets:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Import failed' };
    }
  },

  // Reset templates to defaults
  resetTemplates: async () => {
    try {
      const templates = await persistence.resetTemplates();
      set({ templates });
    } catch (error) {
      console.error('Failed to reset templates:', error);
    }
  },

  // Reset snippets to defaults
  resetSnippets: async () => {
    try {
      const snippets = await persistence.resetSnippets();
      set({ snippets });
    } catch (error) {
      console.error('Failed to reset snippets:', error);
    }
  },
}));
