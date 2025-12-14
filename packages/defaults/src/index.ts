// ==========================================
// TYPES
// ==========================================

export interface TemplateContent {
  description?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  [key: string]: string | undefined;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  targetFields: string | 'all' | string[];
  content: TemplateContent;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

export interface Snippet {
  id: string;
  name: string;
  description?: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

export interface UserPreset {
  id: string;
  name: string;
  description?: string;
  instruction: string;
  category?: string;
  isBuiltIn: boolean;
  isHidden?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WwwyzzerddPromptSet {
  id: string;
  name: string;
  description?: string;
  characterPrompt: string;
  lorePrompt: string;
  personality: string;
  isDefault?: boolean;
}

// ==========================================
// IMPORTS
// ==========================================

import templatesData from '../assets/templates.json' with { type: 'json' };
import snippetsData from '../assets/snippets.json' with { type: 'json' };
import presetsData from '../assets/presets.json' with { type: 'json' };
import wwwyzzerddData from '../assets/wwwyzzerdd-prompts.json' with { type: 'json' };

// ==========================================
// EXPORTS
// ==========================================

export const DEFAULT_TEMPLATES = templatesData as Template[];
export const DEFAULT_SNIPPETS = snippetsData as Snippet[];
export const DEFAULT_PRESETS = presetsData as UserPreset[];
export const DEFAULT_WWWYZZERDD_PROMPTS = wwwyzzerddData as WwwyzzerddPromptSet[];