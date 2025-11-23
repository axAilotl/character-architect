import { useState } from 'react';
import { useCardStore, extractCardData } from '../../../store/card-store';
import { useUIStore } from '../../../store/ui-store';
import { useTokenStore } from '../../../store/token-store';
import type { CCFieldName, FocusField, Template, Snippet } from '@card-architect/schemas';
import { FieldEditor } from './FieldEditor';
import { LorebookEditor } from './LorebookEditor';
import { LLMAssistSidebar } from './LLMAssistSidebar';
import { TagInput } from './TagInput';
import { TemplateSnippetPanel } from './TemplateSnippetPanel';

type EditTab = 'basic' | 'greetings' | 'advanced' | 'lorebook';

export function EditPanel() {
  const { currentCard, updateCardData, updateCardMeta, convertSpec } = useCardStore();
  const { specMode, showV3Fields, setSpecMode, toggleV3Fields } = useUIStore();
  const tokenCounts = useTokenStore((state) => state.tokenCounts);

  const [activeTab, setActiveTab] = useState<EditTab>('basic');

  const [llmAssistOpen, setLLMAssistOpen] = useState(false);
  const [llmAssistField, setLLMAssistField] = useState<CCFieldName>('description');
  const [llmAssistValue, setLLMAssistValue] = useState('');

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesField, setTemplatesField] = useState<FocusField>('description');
  const [templatesValue, setTemplatesValue] = useState('');

  if (!currentCard) return null;

  const isV3 = currentCard.meta.spec === 'v3';
  const cardData = extractCardData(currentCard);

  // Debug: Log tags
  console.log('[EditPanel] currentCard.meta.tags:', currentCard.meta.tags);
  console.log('[EditPanel] cardData.tags:', cardData.tags);

  const handleFieldChange = (field: string, value: string | string[] | Record<string, string>) => {
    // For wrapped cards (V3 and wrapped V2), update nested data object
    // For unwrapped V2, update directly
    const v2Data = currentCard.data as any;
    const isWrappedV2 = !isV3 && v2Data.spec === 'chara_card_v2' && 'data' in v2Data;

    if (isV3 || isWrappedV2) {
      updateCardData({
        data: {
          ...cardData,
          [field]: value,
        },
      } as any);
    } else {
      updateCardData({ [field]: value });
    }
  };

  const handleTagsChange = (tags: string[]) => {
    // Update both meta.tags and data.tags for consistency
    updateCardMeta({ tags });

    // Also update data.tags for ALL cards (V3, wrapped V2, and unwrapped V2)
    const v2Data = currentCard.data as any;
    const isWrappedV2 = !isV3 && v2Data.spec === 'chara_card_v2' && 'data' in v2Data;

    if (isV3 || isWrappedV2) {
      // For V3 and wrapped V2, update data.tags in the nested data object
      updateCardData({
        data: {
          ...cardData,
          tags,
        },
      } as any);
    } else {
      // For unwrapped V2, update tags at the top level
      updateCardData({ tags } as any);
    }
  };

  const handleOpenLLMAssist = (fieldName: CCFieldName, value: string) => {
    setLLMAssistField(fieldName);
    setLLMAssistValue(value);
    setLLMAssistOpen(true);
  };

  const handleLLMApply = (value: string, action: 'replace' | 'append' | 'insert') => {
    if (action === 'replace') {
      handleFieldChange(llmAssistField, value);
    } else if (action === 'append') {
      handleFieldChange(llmAssistField, llmAssistValue + '\n' + value);
    }
    // 'insert' would be for alt greetings array manipulation
  };

  const handleOpenTemplates = (fieldName: FocusField, value: string) => {
    setTemplatesField(fieldName);
    setTemplatesValue(value);
    setTemplatesOpen(true);
  };

  const handleApplyTemplate = (template: Template, mode: 'replace' | 'append' | 'prepend') => {
    const content = template.content[templatesField];
    if (!content) {
      alert(`This template does not have content for the ${templatesField} field.`);
      return;
    }

    let newValue = '';
    if (mode === 'replace') {
      newValue = content;
    } else if (mode === 'append') {
      newValue = templatesValue + '\n\n' + content;
    } else if (mode === 'prepend') {
      newValue = content + '\n\n' + templatesValue;
    }

    handleFieldChange(templatesField, newValue);
  };

  const handleInsertSnippet = (snippet: Snippet) => {
    const newValue = templatesValue + snippet.content;
    handleFieldChange(templatesField, newValue);
  };

  const ASSIST_WIDTH_PX = 500;
  const ASSIST_GAP_PX = 24;
  const contentStyle = llmAssistOpen
    ? {
        width: `calc(100% - ${ASSIST_WIDTH_PX + ASSIST_GAP_PX}px)`,
        marginRight: `${ASSIST_GAP_PX}px`,
      }
    : undefined;

  const tabs = [
    { id: 'basic' as EditTab, label: 'Basic Info' },
    { id: 'greetings' as EditTab, label: 'Greetings' },
    { id: 'advanced' as EditTab, label: 'Advanced' },
    { id: 'lorebook' as EditTab, label: 'Lorebook' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="bg-dark-surface border-b border-dark-border">
        <div className="flex items-center justify-between">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-dark-bg text-dark-text border-b-2 border-blue-500'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 px-6">
            {/* V3 Fields Toggle */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showV3Fields}
                onChange={toggleV3Fields}
                className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-blue-600"
              />
              <span className="text-dark-muted">Show V3 Fields</span>
            </label>
            {/* Spec Mode Switcher */}
            <div className="flex items-center gap-2 bg-dark-bg rounded-lg p-1">
              <button
                onClick={() => {
                  setSpecMode('v2');
                  convertSpec('v2');
                }}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  specMode === 'v2'
                    ? 'bg-blue-600 text-white'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                V2
              </button>
              <button
                onClick={() => {
                  setSpecMode('v3');
                  convertSpec('v3');
                }}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  specMode === 'v3'
                    ? 'bg-blue-600 text-white'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                V3
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content - wrapper for positioning */}
      <div className="flex-1 relative flex">
        <div
          className={`overflow-y-auto p-6 space-y-6 transition-all duration-300 ${
            llmAssistOpen ? 'w-full' : 'max-w-[66%] w-full mx-auto'
          }`}
          style={contentStyle}
        >
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <FieldEditor
              label="Name"
              value={cardData.name}
              onChange={(v) => handleFieldChange('name', v)}
              tokenCount={tokenCounts.name}
              fieldName="description"
              onOpenLLMAssist={handleOpenLLMAssist}
              specMarker="both"
            />

            <FieldEditor
              label="Description"
              value={cardData.description}
              onChange={(v) => handleFieldChange('description', v)}
              tokenCount={tokenCounts.description}
              multiline
              rows={20}
              fieldName="description"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              specMarker="both"
            />

            <FieldEditor
              label="Personality"
              value={cardData.personality}
              onChange={(v) => handleFieldChange('personality', v)}
              tokenCount={tokenCounts.personality}
              multiline
              rows={12}
              fieldName="personality"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              specMarker="both"
            />

            <FieldEditor
              label="Scenario"
              value={cardData.scenario}
              onChange={(v) => handleFieldChange('scenario', v)}
              tokenCount={tokenCounts.scenario}
              multiline
              rows={12}
              fieldName="scenario"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              specMarker="both"
            />

            {/* Character Avatar */}
            <div className="input-group">
              <label className="label">Character Avatar</label>
              <div className="flex gap-4 items-start">
                {/* Image Preview */}
                <div className="w-48 h-48 bg-dark-bg border border-dark-border rounded overflow-hidden flex-shrink-0">
                  <img
                    src={`/api/cards/${currentCard.meta.id}/image?t=${Date.now()}`}
                    alt="Character Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.classList.add('flex', 'items-center', 'justify-center');
                        parent.innerHTML = '<div class="text-dark-muted text-sm">No Image</div>';
                      }
                    }}
                  />
                </div>

                {/* Upload Controls */}
                <div className="flex-1">
                  <p className="text-sm text-dark-muted mb-3">
                    Upload a new image to replace the current character avatar. Supports PNG, JPG, and WebP.
                  </p>
                  <label htmlFor="avatar-upload" className="btn-primary cursor-pointer inline-block">
                    Upload New Image
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        try {
                          const formData = new FormData();
                          formData.append('file', file);

                          const response = await fetch(`/api/cards/${currentCard.meta.id}/image`, {
                            method: 'POST',
                            body: formData,
                          });

                          if (!response.ok) {
                            throw new Error('Failed to upload image');
                          }

                          // Force image reload by updating the timestamp in the src
                          const img = document.querySelector(`img[src*="/api/cards/${currentCard.meta.id}/image"]`) as HTMLImageElement;
                          if (img) {
                            img.src = `/api/cards/${currentCard.meta.id}/image?t=${Date.now()}`;
                          }

                          alert('Image updated successfully!');
                        } catch (error) {
                          console.error('Failed to upload image:', error);
                          alert('Failed to upload image. Please try again.');
                        } finally {
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Tags - Show for both V2 and V3 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="label">Tags</label>
                {isV3 ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white">V3 Required</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-600 text-white">V2</span>
                )}
              </div>
              <TagInput
                tags={currentCard.meta.tags || []}
                onChange={handleTagsChange}
                label=""
              />
            </div>

            {/* V3-specific fields */}
            {showV3Fields && (
              <>
                <FieldEditor
                  label="Creator"
                  value={cardData.creator || ''}
                  onChange={(v) => handleFieldChange('creator', v)}
                  placeholder="Creator name"
                  specMarker="v3"
                />

                <FieldEditor
                  label="Character Version"
                  value={cardData.character_version || ''}
                  onChange={(v) => handleFieldChange('character_version', v)}
                  placeholder="1.0"
                  specMarker="v3"
                />

                <FieldEditor
                  label="Nickname"
                  value={(cardData as any).nickname || ''}
                  onChange={(v) => handleFieldChange('nickname', v)}
                  placeholder="Short nickname (used for {{char}} replacement)"
                  specMarker="v3"
                  helpText="If set, {{char}}, <char>, and <bot> will be replaced with this instead of the name"
                />
              </>
            )}
          </div>
        )}

        {/* Greetings Tab */}
        {activeTab === 'greetings' && (
          <div className="space-y-6">
            <FieldEditor
              label="First Message"
              value={cardData.first_mes}
              onChange={(v) => handleFieldChange('first_mes', v)}
              tokenCount={tokenCounts.first_mes}
              multiline
              rows={12}
              fieldName="first_mes"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              specMarker="both"
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="label">Alternate Greetings</label>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-600 text-white">Both</span>
                </div>
                <button
                  onClick={() => {
                    const updated = [...(cardData.alternate_greetings || []), ''];
                    handleFieldChange('alternate_greetings', updated as any);
                  }}
                  className="btn-secondary text-sm"
                >
                  + Add Alternate Greeting
                </button>
              </div>
              <p className="text-sm text-dark-muted">
                Each greeting opens like the First Message. Modify existing ones or add new ones individually.
              </p>

              {(cardData.alternate_greetings || []).map((greeting, index) => (
                <div key={index} className="card bg-dark-bg border border-dark-border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-dark-muted">Greeting {index + 1}</h4>
                    <button
                      onClick={() => {
                        const updated = [...(cardData.alternate_greetings || [])];
                        updated.splice(index, 1);
                        handleFieldChange('alternate_greetings', updated as any);
                      }}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={greeting}
                    onChange={(e) => {
                      const updated = [...(cardData.alternate_greetings || [])];
                      updated[index] = e.target.value;
                      handleFieldChange('alternate_greetings', updated as any);
                    }}
                    rows={5}
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            {/* Group Only Greetings - V3 Only */}
            {showV3Fields && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="label">Group Only Greetings</label>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-600 text-white">V3 Only</span>
                  </div>
                  <button
                    onClick={() => {
                      const updated = [...((cardData as any).group_only_greetings || []), ''];
                      handleFieldChange('group_only_greetings', updated as any);
                    }}
                    className="btn-secondary text-sm"
                  >
                    + Add Group Greeting
                  </button>
                </div>
                <p className="text-sm text-dark-muted">
                  Greetings that are only used in group chats. These will not be shown in solo conversations.
                </p>

                {((cardData as any).group_only_greetings || []).map((greeting: string, index: number) => (
                  <div key={index} className="card bg-dark-bg border border-dark-border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-dark-muted">Group Greeting {index + 1}</h4>
                      <button
                        onClick={() => {
                          const updated = [...((cardData as any).group_only_greetings || [])];
                          updated.splice(index, 1);
                          handleFieldChange('group_only_greetings', updated as any);
                        }}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      value={greeting}
                      onChange={(e) => {
                        const updated = [...((cardData as any).group_only_greetings || [])];
                        updated[index] = e.target.value;
                        handleFieldChange('group_only_greetings', updated as any);
                      }}
                      rows={3}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <FieldEditor
              label="System Prompt"
              value={cardData.system_prompt || ''}
              onChange={(v) => handleFieldChange('system_prompt', v)}
              tokenCount={tokenCounts.system_prompt}
              multiline
              rows={6}
              fieldName="system_prompt"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              specMarker="both"
            />

            <FieldEditor
              label="Post History Instructions"
              value={cardData.post_history_instructions || ''}
              onChange={(v) => handleFieldChange('post_history_instructions', v)}
              tokenCount={tokenCounts.post_history_instructions}
              multiline
              rows={6}
              fieldName="post_history_instructions"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              specMarker="both"
            />

            <FieldEditor
              label="Example Messages"
              value={cardData.mes_example}
              onChange={(v) => handleFieldChange('mes_example', v)}
              tokenCount={tokenCounts.mes_example}
              multiline
              rows={8}
              fieldName="mes_example"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              specMarker="both"
            />

            <FieldEditor
              label="Creator Notes (Not rendered in preview)"
              value={cardData.creator_notes || ''}
              onChange={(v) => handleFieldChange('creator_notes', v)}
              multiline
              rows={4}
              fieldName="creator_notes"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              specMarker="both"
            />

            {/* V3-specific advanced fields */}
            {showV3Fields && (
              <>
                {/* Source URLs */}
                <div className="input-group">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="label">Source URLs</label>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-600 text-white">V3 Only</span>
                  </div>
                  <p className="text-sm text-dark-muted mb-3">
                    URLs or IDs pointing to the source of this character card. These should generally not be edited manually.
                  </p>
                  <div className="space-y-2">
                    {((cardData as any).source || []).map((url: string, index: number) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => {
                            const updated = [...((cardData as any).source || [])];
                            updated[index] = e.target.value;
                            handleFieldChange('source', updated);
                          }}
                          className="flex-1"
                          placeholder="https://..."
                        />
                        <button
                          onClick={() => {
                            const updated = [...((cardData as any).source || [])];
                            updated.splice(index, 1);
                            handleFieldChange('source', updated);
                          }}
                          className="btn-secondary text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const updated = [...((cardData as any).source || []), ''];
                        handleFieldChange('source', updated);
                      }}
                      className="btn-secondary text-sm"
                    >
                      + Add Source URL
                    </button>
                  </div>
                </div>

                {/* Multilingual Creator Notes */}
                <div className="input-group">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="label">Multilingual Creator Notes</label>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-600 text-white">V3 Only</span>
                  </div>
                  <p className="text-sm text-dark-muted mb-3">
                    Creator notes in multiple languages (ISO 639-1 language codes).
                  </p>
                  <div className="space-y-3">
                    {Object.entries((cardData as any).creator_notes_multilingual || {}).map(([lang, notes]) => (
                      <div key={lang} className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={lang}
                            onChange={(e) => {
                              const newLang = e.target.value;
                              const updated = { ...((cardData as any).creator_notes_multilingual || {}) };
                              if (newLang !== lang) {
                                updated[newLang] = updated[lang];
                                delete updated[lang];
                                handleFieldChange('creator_notes_multilingual', updated);
                              }
                            }}
                            className="w-24"
                            placeholder="en"
                            maxLength={2}
                          />
                          <button
                            onClick={() => {
                              const updated = { ...((cardData as any).creator_notes_multilingual || {}) };
                              delete updated[lang];
                              handleFieldChange('creator_notes_multilingual', updated);
                            }}
                            className="btn-secondary text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <textarea
                          value={notes as string}
                          onChange={(e) => {
                            const updated = { ...((cardData as any).creator_notes_multilingual || {}) };
                            updated[lang] = e.target.value;
                            handleFieldChange('creator_notes_multilingual', updated);
                          }}
                          rows={3}
                          className="w-full"
                          placeholder={`Creator notes in ${lang}`}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const updated = { ...((cardData as any).creator_notes_multilingual || {}) };
                        // Find next unused language code or use 'xx' as placeholder
                        let newLang = 'xx';
                        let counter = 0;
                        while (updated[newLang]) {
                          newLang = `x${counter++}`;
                        }
                        updated[newLang] = '';
                        handleFieldChange('creator_notes_multilingual', updated);
                      }}
                      className="btn-secondary text-sm"
                    >
                      + Add Language
                    </button>
                  </div>
                </div>

                {/* Timestamps (Read-only) */}
                <div className="input-group">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="label">Metadata Timestamps</label>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-600 text-white">V3 Only</span>
                  </div>
                  <div className="space-y-2 bg-dark-surface p-4 rounded border border-dark-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-muted">Creation Date:</span>
                      <span className="text-dark-text">
                        {(cardData as any).creation_date
                          ? new Date((cardData as any).creation_date * 1000).toLocaleString()
                          : 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-muted">Modification Date:</span>
                      <span className="text-dark-text">
                        {(cardData as any).modification_date
                          ? new Date((cardData as any).modification_date * 1000).toLocaleString()
                          : 'Not set'}
                      </span>
                    </div>
                    <p className="text-xs text-dark-muted mt-2">
                      These timestamps are automatically managed and cannot be edited manually.
                    </p>
                  </div>
                </div>

              </>
            )}
          </div>
        )}

        {/* Lorebook Tab */}
        {activeTab === 'lorebook' && (
          <LorebookEditor />
        )}
        </div>

        {/* LLM Assist Sidebar - positioned within wrapper */}
        {llmAssistOpen && (
          <LLMAssistSidebar
            isOpen={llmAssistOpen}
            onClose={() => setLLMAssistOpen(false)}
            fieldName={llmAssistField}
            currentValue={llmAssistValue}
            onApply={handleLLMApply}
            cardSpec={currentCard.meta.spec}
          />
        )}
      </div>

      <TemplateSnippetPanel
        isOpen={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onApplyTemplate={handleApplyTemplate}
        onInsertSnippet={handleInsertSnippet}
        currentField={templatesField}
      />
    </div>
  );
}
