import { useCardStore } from '../store/card-store';
import { EditorTabs } from './EditorTabs';
import { EditPanel } from './EditPanel';
import { PreviewPanel } from './PreviewPanel';
import { DiffPanel } from './DiffPanel';
import { RedundancyPanel } from './RedundancyPanel';
import { LoreTriggerPanel } from './LoreTriggerPanel';

export function CardEditor() {
  const activeTab = useCardStore((state) => state.activeTab);

  return (
    <div className="h-full flex flex-col">
      <EditorTabs />

      <div className="flex-1 overflow-auto">
        {activeTab === 'edit' && <EditPanel />}
        {activeTab === 'preview' && <PreviewPanel />}
        {activeTab === 'diff' && <DiffPanel />}
        {activeTab === 'redundancy' && <RedundancyPanel />}
        {activeTab === 'lore-trigger' && <LoreTriggerPanel />}
      </div>
    </div>
  );
}
