/**
 * Focused Module Settings Panel
 *
 * Settings for the focused/distraction-free editor mode.
 */

import { useSettingsStore } from '../../../store/settings-store';

export function FocusedSettings() {
  const creatorNotes = useSettingsStore((state) => state.creatorNotes);
  const setCreatorNotesHtmlMode = useSettingsStore((state) => state.setCreatorNotesHtmlMode);
  const editor = useSettingsStore((state) => state.editor);
  const setExtendedFocusedField = useSettingsStore((state) => state.setExtendedFocusedField);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Focused Mode Settings</h3>
        <p className="text-dark-muted">
          Configure the Focused editor mode for distraction-free editing.
        </p>
      </div>

      {/* Creator's Notes Settings */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Creator's Notes</h4>
        <p className="text-sm text-dark-muted">
          Configure how the Creator's Notes field is edited in Focused Mode.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="creatorNotesHtmlModeFocused"
            checked={creatorNotes.htmlMode}
            onChange={(e) => setCreatorNotesHtmlMode(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="creatorNotesHtmlModeFocused" className="text-sm font-medium">
            HTML Mode
          </label>
        </div>

        <div className="p-3 bg-dark-bg rounded border border-dark-border">
          <h5 className="font-medium text-sm mb-2">HTML Mode Behavior</h5>
          <ul className="text-xs text-dark-muted space-y-1 list-disc list-inside">
            <li>When enabled, the Focused Editor for Creator's Notes uses an HTML code editor</li>
            <li>Left panel: HTML source code with syntax highlighting</li>
            <li>Right panel: Live HTML preview (sanitized for safety)</li>
            <li>When disabled, uses the standard Markdown WYSIWYG editor</li>
          </ul>
        </div>
      </div>

      {/* Extended Focused Editor Fields */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Focused Editor Fields</h4>
        <p className="text-sm text-dark-muted">
          Choose which fields to show in the Focused Mode editor.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="focusedPersonalitySettings"
              checked={editor.extendedFocusedFields.personality}
              onChange={(e) => setExtendedFocusedField('personality', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="focusedPersonalitySettings" className="text-sm">Personality</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="focusedAppearanceSettings"
              checked={editor.extendedFocusedFields.appearance}
              onChange={(e) => setExtendedFocusedField('appearance', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="focusedAppearanceSettings" className="text-sm">Appearance</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="focusedCharacterNoteSettings"
              checked={editor.extendedFocusedFields.characterNote}
              onChange={(e) => setExtendedFocusedField('characterNote', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="focusedCharacterNoteSettings" className="text-sm">Character Note</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="focusedExampleDialogueSettings"
              checked={editor.extendedFocusedFields.exampleDialogue}
              onChange={(e) => setExtendedFocusedField('exampleDialogue', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="focusedExampleDialogueSettings" className="text-sm">Example Dialogue</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="focusedSystemPromptSettings"
              checked={editor.extendedFocusedFields.systemPrompt}
              onChange={(e) => setExtendedFocusedField('systemPrompt', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="focusedSystemPromptSettings" className="text-sm">System Prompt</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="focusedPostHistorySettings"
              checked={editor.extendedFocusedFields.postHistory}
              onChange={(e) => setExtendedFocusedField('postHistory', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="focusedPostHistorySettings" className="text-sm">Post History</label>
          </div>
        </div>
      </div>
    </div>
  );
}
