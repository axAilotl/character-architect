import { TemplateSnippetPanel } from '../../editor/components/TemplateSnippetPanel';

export function TemplatesSettingsPanel() {
  return (
    <TemplateSnippetPanel isOpen={true} onClose={() => {}} manageMode={true} embedded={true} />
  );
}

