import { useCardStore } from '../store/card-store';
import { EditorTabs } from './EditorTabs';
import { EditPanel } from './EditPanel';
import { PreviewPanel } from './PreviewPanel';
import { JsonPanel } from './JsonPanel';
import { DiffPanel } from './DiffPanel';

export function CardEditor() {
  const activeTab = useCardStore((state) => state.activeTab);

  return (
    <div className="h-full flex flex-col">
      <EditorTabs />

      <div className="flex-1 overflow-auto">
        {activeTab === 'edit' && <EditPanel />}
        {activeTab === 'preview' && <PreviewPanel />}
        {activeTab === 'json' && <JsonPanel />}
        {activeTab === 'diff' && <DiffPanel />}
      </div>
    </div>
  );
}
