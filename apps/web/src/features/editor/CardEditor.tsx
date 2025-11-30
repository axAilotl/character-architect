import { useUIStore } from '../../store/ui-store';
import { useSettingsStore } from '../../store/settings-store';
import { EditorTabs } from './components/EditorTabs';
import { EditPanel } from './components/EditPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { DiffPanel } from './components/DiffPanel';
import { AssetsPanel } from './components/AssetsPanel';
// import { RedundancyPanel } from './components/RedundancyPanel'; // Disabled
// import { LoreTriggerPanel } from './components/LoreTriggerPanel'; // Disabled
import { FocusedEditor } from './components/FocusedEditor';
import { WwwyzzerddTab } from '../wwwyzzerdd/WwwyzzerddTab';
import { ComfyUITab } from '../comfyui/ComfyUITab';
import { useAutoSnapshot } from '../../hooks/useAutoSnapshot';

export function CardEditor() {
  const activeTab = useUIStore((state) => state.activeTab);
  const wwwyzzerddEnabled = useSettingsStore((state) => state.features?.wwwyzzerddEnabled ?? false);
  const comfyUIEnabled = useSettingsStore((state) => state.features?.comfyUIEnabled ?? false);

  // Enable auto-snapshot functionality
  useAutoSnapshot();

  return (
    <div className="h-full flex flex-col">
      <EditorTabs />

      <div className="flex-1 overflow-auto relative">
        {activeTab === 'edit' && <EditPanel />}
        {activeTab === 'assets' && <AssetsPanel />}
        {activeTab === 'focused' && <FocusedEditor />}
        {activeTab === 'wwwyzzerdd' && wwwyzzerddEnabled && <WwwyzzerddTab />}
        {activeTab === 'comfyui' && comfyUIEnabled && <ComfyUITab />}
        {activeTab === 'preview' && <PreviewPanel />}
        {activeTab === 'diff' && <DiffPanel />}
        {/* Disabled features */}
        {/* {activeTab === 'redundancy' && <RedundancyPanel />} */}
        {/* {activeTab === 'lore-trigger' && <LoreTriggerPanel />} */}
      </div>
    </div>
  );
}
