import { create } from 'zustand';

interface UIStore {
  // Editor UI State
  activeTab: 'edit' | 'preview' | 'diff' | 'simulator' | 'redundancy' | 'lore-trigger' | 'focused' | 'assets';
  showAdvanced: boolean;
  specMode: 'v2' | 'v3'; // Current spec mode for editing and export
  showV3Fields: boolean; // Whether to show v3-only fields in the UI
  
  // Actions
  setActiveTab: (
    tab: 'edit' | 'preview' | 'diff' | 'simulator' | 'redundancy' | 'lore-trigger' | 'focused' | 'assets'
  ) => void;
  setShowAdvanced: (show: boolean) => void;
  setSpecMode: (mode: 'v2' | 'v3') => void;
  toggleV3Fields: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: 'edit',
  showAdvanced: false,
  specMode: 'v3',
  showV3Fields: true,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setShowAdvanced: (show) => set({ showAdvanced: show }),
  setSpecMode: (mode) => set({ specMode: mode, showV3Fields: mode === 'v3' }),
  toggleV3Fields: () => set((state) => ({ showV3Fields: !state.showV3Fields })),
}));
