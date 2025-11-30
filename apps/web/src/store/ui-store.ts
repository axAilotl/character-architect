import { create } from 'zustand';

type EditorTab = 'edit' | 'preview' | 'diff' | 'simulator' | 'redundancy' | 'lore-trigger' | 'focused' | 'assets' | 'wwwyzzerdd' | 'comfyui';

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
