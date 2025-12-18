import { create } from 'zustand';

/**
 * Known core editor tabs (for type hints, not enforced)
 * With the plugin architecture, any string tab ID is valid.
 */
export type CoreEditorTab =
  | 'edit'
  | 'preview'
  | 'diff'
  | 'focused'
  | 'assets'
  | 'block-editor'
  | 'wwwyzzerdd'
  | 'comfyui';

/**
 * Tab ID type - accepts any string to support plugin-registered tabs
 */
export type EditorTab = string;

interface UIStore {
  // Editor UI State
  activeTab: EditorTab;
  showAdvanced: boolean;

  // Actions
  setActiveTab: (tab: EditorTab) => void;
  setShowAdvanced: (show: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: 'edit',
  showAdvanced: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setShowAdvanced: (show) => set({ showAdvanced: show }),
}));
