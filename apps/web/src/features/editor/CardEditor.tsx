import { useUIStore } from '../../store/ui-store';
import { EditorTabs } from './components/EditorTabs';
import { EditPanel } from './components/EditPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { DiffPanel } from './components/DiffPanel';
import { AssetsPanel } from './components/AssetsPanel';
// import { RedundancyPanel } from './components/RedundancyPanel'; // Disabled
// import { LoreTriggerPanel } from './components/LoreTriggerPanel'; // Disabled
import { FocusedEditor } from './components/FocusedEditor';

export function CardEditor() {
  const activeTab = useUIStore((state) => state.activeTab);

  return (
    <div className="h-full flex flex-col">
      <EditorTabs />

      <div className="flex-1 overflow-auto relative">
        {activeTab === 'edit' && <EditPanel />}
        {activeTab === 'assets' && <AssetsPanel />}
        {activeTab === 'focused' && <FocusedEditor />}
        {activeTab === 'preview' && <PreviewPanel />}
        {activeTab === 'diff' && <DiffPanel />}
        {/* Disabled features */}
        {/* {activeTab === 'redundancy' && <RedundancyPanel />} */}
        {/* {activeTab === 'lore-trigger' && <LoreTriggerPanel />} */}
      </div>
    </div>
  );
}
