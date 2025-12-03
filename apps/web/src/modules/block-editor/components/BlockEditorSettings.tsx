/**
 * Block Editor Module Settings Panel
 *
 * Settings for the BeastBlocks visual block-based editor.
 */

import { useBlockEditorStore } from '../store';

export function BlockEditorSettings() {
  const templates = useBlockEditorStore((state) => state.templates);
  const deleteTemplate = useBlockEditorStore((state) => state.deleteTemplate);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Block Editor Settings</h3>
        <p className="text-dark-muted">
          Configure the BeastBlocks visual block-based editor.
        </p>
      </div>

      {/* Templates Management */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Block Templates</h4>
        <p className="text-sm text-dark-muted">
          Templates allow you to save and reuse block structures across different character cards.
        </p>

        {templates.length > 0 ? (
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Saved Templates ({templates.length})</h5>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 bg-dark-bg rounded border border-dark-border"
                >
                  <div>
                    <div className="font-medium text-sm">{template.name}</div>
                    {template.description && (
                      <div className="text-xs text-dark-muted">{template.description}</div>
                    )}
                    <div className="text-xs text-dark-muted mt-1">
                      {template.blocks.length} block{template.blocks.length !== 1 ? 's' : ''}
                      {' · '}
                      {new Date(template.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete template "${template.name}"?`)) {
                        deleteTemplate(template.id);
                      }
                    }}
                    className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-dark-bg rounded border border-dark-border text-center">
            <p className="text-sm text-dark-muted">No templates saved yet.</p>
            <p className="text-xs text-dark-muted mt-1">
              Create templates from the Block Editor toolbar using the "Templates" button.
            </p>
          </div>
        )}

        <div className="p-3 bg-dark-bg rounded border border-dark-border">
          <h5 className="font-medium text-sm mb-2">Using Templates</h5>
          <ul className="text-xs text-dark-muted space-y-1 list-disc list-inside">
            <li>Create templates from the Block Editor toolbar using the "Templates" button</li>
            <li>Save your current block structure as a named template</li>
            <li>Load saved templates to quickly set up new characters</li>
            <li>Templates are stored locally in your browser</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
