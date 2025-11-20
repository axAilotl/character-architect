import { useUIStore } from '../store/ui-store';
import { EditorTabs } from './EditorTabs';
import { EditPanel } from './EditPanel';
import { PreviewPanel } from './PreviewPanel';
import { DiffPanel } from './DiffPanel';
import { AssetsPanel } from './AssetsPanel';
// import { RedundancyPanel } from './RedundancyPanel'; // Disabled
// import { LoreTriggerPanel } from './LoreTriggerPanel'; // Disabled
import { FocusedEditor } from './FocusedEditor';

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
