import { useState, useEffect } from 'react';
import { useCardStore, extractCardData } from '../../../store/card-store';
import { useSettingsStore } from '../../../store/settings-store';
import { useTokenStore } from '../../../store/token-store';
import { useLLMStore } from '../../../store/llm-store';
import { localDB } from '../../../lib/db';
import { getDeploymentConfig } from '../../../config/deployment';
import { invokeClientLLM, type ClientLLMProvider } from '../../../lib/client-llm';
import { normalizeSpec, type FocusField, type Template, type Snippet } from '../../../lib/types';
import { FieldEditor } from './FieldEditor';
import { LorebookEditor } from './LorebookEditor';
import { ElaraVossPanel } from './ElaraVossPanel';
import { LLMAssistSidebar } from './LLMAssistSidebar';
import { TagInput } from './TagInput';
import { TemplateSnippetPanel } from './TemplateSnippetPanel';

type EditTab = 'basic' | 'character' | 'greetings' | 'advanced' | 'lorebook' | 'elara-voss' | 'extensions';

export function EditPanel() {
  const { currentCard, updateCardData, updateCardMeta } = useCardStore();
  const { editor, aiPrompts } = useSettingsStore();
  const tokenCounts = useTokenStore((state) => state.tokenCounts);
  const { settings: llmSettings, loadSettings } = useLLMStore();

  const [activeTab, setActiveTab] = useState<EditTab>('basic');

  // Load LLM settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [generatingTagline, setGeneratingTagline] = useState(false);

  const [llmAssistOpen, setLLMAssistOpen] = useState(false);
  const [llmAssistField, setLLMAssistField] = useState<string>('description');
  const [llmAssistValue, setLLMAssistValue] = useState('');

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesField, setTemplatesField] = useState<FocusField>('description');
  const [templatesValue, setTemplatesValue] = useState('');

  const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);
  const config = getDeploymentConfig();
  const isLightMode = config.mode === 'light' || config.mode === 'static';

  // Load cached image from IndexedDB in light mode
  useEffect(() => {
    if (isLightMode && currentCard?.meta?.id) {
      localDB.getImage(currentCard.meta.id, 'thumbnail').then((imageData) => {
        setCachedImageUrl(imageData);
      });
    }
  }, [isLightMode, currentCard?.meta?.id]);

  if (!currentCard) return null;

  const isV3 = currentCard.meta.spec === 'v3';
  const cardData = extractCardData(currentCard);
  const showV3Fields = editor.showV3Fields;

  const handleFieldChange = (field: string, value: string | string[] | Record<string, string> | any) => {
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

  // Get depth_prompt extension data
  const depthPrompt = (cardData as any).extensions?.depth_prompt;
  const characterNoteValue = depthPrompt?.prompt || '';
  const characterNoteDepth = depthPrompt?.depth ?? 4;

  // Get appearance from voxta or visual_description extension
  const getAppearance = () => {
    const extensions = (cardData as any).extensions || {};
    if (extensions.voxta?.appearance) return extensions.voxta.appearance;
    if (extensions.visual_description) return extensions.visual_description;
    return '';
  };

  const setAppearance = (value: string) => {
    const existingExtensions = (cardData as any).extensions || {};
    const extensions = { ...existingExtensions };
    // Prefer voxta extension if it exists, otherwise use visual_description
    if (extensions.voxta) {
      extensions.voxta = { ...extensions.voxta, appearance: value };
    } else {
      extensions.visual_description = value;
    }
    handleFieldChange('extensions', extensions);
  };

  const handleCharacterNoteChange = (value: string) => {
    const existingExtensions = (cardData as any).extensions || {};
    const extensions = { ...existingExtensions };
    extensions.depth_prompt = {
      ...(extensions.depth_prompt || {}),
      prompt: value,
      depth: characterNoteDepth,
      role: 'system',
    };
    handleFieldChange('extensions', extensions);
  };

  const handleCharacterNoteDepthChange = (depth: number) => {
    const existingExtensions = (cardData as any).extensions || {};
    const extensions = { ...existingExtensions };
    extensions.depth_prompt = {
      ...(extensions.depth_prompt || {}),
      prompt: characterNoteValue,
      depth,
      role: 'system',
    };
    handleFieldChange('extensions', extensions);
  };

  // Get extensions for display (filtered)
  const getFilteredExtensions = () => {
    const existingExtensions = (cardData as any).extensions || {};
    const extensions = { ...existingExtensions };
    // Remove handled extensions
    const filtered = { ...extensions };
    delete filtered.depth_prompt;
    delete filtered.visual_description;
    // Keep voxta but remove appearance if showing separately
    if (filtered.voxta) {
      const voxtaCopy = { ...filtered.voxta };
      delete voxtaCopy.appearance;
      if (Object.keys(voxtaCopy).length === 0) {
        delete filtered.voxta;
      } else {
        filtered.voxta = voxtaCopy;
      }
    }
    return filtered;
  };

  const handleOpenLLMAssist = (fieldName: string, value: string) => {
    setLLMAssistField(fieldName);
    setLLMAssistValue(value);
    setLLMAssistOpen(true);
  };

  const handleLLMApply = (value: string, action: 'replace' | 'append' | 'insert') => {
    if (llmAssistField === 'appearance') {
      if (action === 'replace') setAppearance(value);
      else if (action === 'append') setAppearance(getAppearance() + '\n' + value);
      return;
    }

    if (llmAssistField === 'character_note') {
      if (action === 'replace') handleCharacterNoteChange(value);
      else if (action === 'append') handleCharacterNoteChange(characterNoteValue + '\n' + value);
      return;
    }

    if (llmAssistField.startsWith('alternate_greetings:')) {
      const index = parseInt(llmAssistField.split(':')[1], 10);
      if (!isNaN(index) && cardData.alternate_greetings) {
        const updated = [...cardData.alternate_greetings];
        if (action === 'replace') updated[index] = value;
        else if (action === 'append') updated[index] = updated[index] + '\n' + value;
        handleFieldChange('alternate_greetings', updated);
      }
      return;
    }

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

  // AI Generate Tags from description
  const handleGenerateTags = async () => {
    if (!cardData.description) {
      alert('Please add a description first to generate tags.');
      return;
    }

    let activeProvider = llmSettings.providers.find((p) => p.id === llmSettings.activeProviderId);
    if (!activeProvider && llmSettings.providers.length > 0) {
      activeProvider = llmSettings.providers[0];
    }
    if (!activeProvider) {
      alert('Please configure an LLM provider in Settings > AI Providers first.');
      return;
    }

    setGeneratingTags(true);
    try {
      let content = '';

      if (isLightMode) {
        // Client-side LLM call
        const clientProvider: ClientLLMProvider = {
          id: activeProvider.id,
          name: activeProvider.label || activeProvider.name,
          kind: (activeProvider as any).clientKind || (activeProvider.kind === 'anthropic' ? 'anthropic' : 'openai-compatible'),
          baseURL: activeProvider.baseURL || '',
          apiKey: activeProvider.apiKey || '',
          defaultModel: activeProvider.defaultModel || '',
          temperature: activeProvider.temperature,
          maxTokens: activeProvider.maxTokens,
        };

        const result = await invokeClientLLM({
          provider: clientProvider,
          messages: [
            { role: 'system', content: aiPrompts.tagsSystemPrompt },
            { role: 'user', content: `Generate tags for this character:\n\nName: ${cardData.name || 'Unknown'}\n\nDescription:\n${cardData.description}` }
          ],
          temperature: 0.7,
          maxTokens: 200,
        });

        if (!result.success) throw new Error(result.error || 'LLM request failed');
        content = result.content || '';
      } else {
        // Server-side LLM call
        const response = await fetch('/api/llm/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId: activeProvider.id,
            system: aiPrompts.tagsSystemPrompt,
            messages: [
              { role: 'user', content: `Generate tags for this character:\n\nName: ${cardData.name || 'Unknown'}\n\nDescription:\n${cardData.description}` }
            ],
            temperature: 0.7,
            maxTokens: 200,
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        content = data.content || data.text || '';
      }

      // Parse JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const tags = JSON.parse(jsonMatch[0]) as string[];
        if (Array.isArray(tags) && tags.length > 0) {
          // Merge with existing tags, avoiding duplicates - ensure single-word slugs
          const existingTags = currentCard?.meta.tags || [];
          const newTags = [...new Set([...existingTags, ...tags.map((t: string) => t.toLowerCase().trim().replace(/\s+/g, '-'))])];
          handleTagsChange(newTags);
        }
      }
    } catch (err) {
      console.error('Failed to generate tags:', err);
      alert(`Failed to generate tags: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGeneratingTags(false);
    }
  };

  // AI Generate Tagline from description
  const handleGenerateTagline = async () => {
    if (!cardData.description) {
      alert('Please add a description first to generate a tagline.');
      return;
    }

    let activeProvider = llmSettings.providers.find((p) => p.id === llmSettings.activeProviderId);
    if (!activeProvider && llmSettings.providers.length > 0) {
      activeProvider = llmSettings.providers[0];
    }
    if (!activeProvider) {
      alert('Please configure an LLM provider in Settings > AI Providers first.');
      return;
    }

    setGeneratingTagline(true);
    try {
      let content = '';

      if (isLightMode) {
        // Client-side LLM call
        const clientProvider: ClientLLMProvider = {
          id: activeProvider.id,
          name: activeProvider.label || activeProvider.name,
          kind: (activeProvider as any).clientKind || (activeProvider.kind === 'anthropic' ? 'anthropic' : 'openai-compatible'),
          baseURL: activeProvider.baseURL || '',
          apiKey: activeProvider.apiKey || '',
          defaultModel: activeProvider.defaultModel || '',
          temperature: activeProvider.temperature,
          maxTokens: activeProvider.maxTokens,
        };

        const result = await invokeClientLLM({
          provider: clientProvider,
          messages: [
            { role: 'system', content: aiPrompts.taglineSystemPrompt },
            { role: 'user', content: `Write a short tagline for this character:\n\nName: ${cardData.name || 'Unknown'}\n\nDescription:\n${cardData.description}` }
          ],
          temperature: 0.8,
          maxTokens: 200,
        });

        if (!result.success) throw new Error(result.error || 'LLM request failed');
        content = (result.content || '').trim();
      } else {
        // Server-side LLM call
        const response = await fetch('/api/llm/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId: activeProvider.id,
            system: aiPrompts.taglineSystemPrompt,
            messages: [
              { role: 'user', content: `Write a short tagline for this character:\n\nName: ${cardData.name || 'Unknown'}\n\nDescription:\n${cardData.description}` }
            ],
            temperature: 0.8,
            maxTokens: 200,
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        content = (data.content || data.text || '').trim();
      }

      if (content) {
        // Update tagline extension
        const existingExtensions = (cardData as any).extensions || {};
        const extensions = { ...existingExtensions, tagline: content.slice(0, 500) };
        handleFieldChange('extensions', extensions);
      }
    } catch (err) {
      console.error('Failed to generate tagline:', err);
      alert(`Failed to generate tagline: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGeneratingTagline(false);
    }
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
    { id: 'character' as EditTab, label: 'Character' },
    { id: 'greetings' as EditTab, label: 'Greetings' },
    { id: 'advanced' as EditTab, label: 'Advanced' },
    { id: 'lorebook' as EditTab, label: 'Lorebook' },
    // ELARA VOSS requires server - hide in light mode
    ...(!isLightMode ? [{ id: 'elara-voss' as EditTab, label: 'ELARA VOSS' }] : []),
    ...(editor.showExtensionsTab ? [{ id: 'extensions' as EditTab, label: 'Extensions' }] : []),
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
            {/* Character Avatar - First, larger */}
            <div className="input-group">
              <label className="label">Character Avatar</label>
              <div className="flex gap-6 items-start">
                {/* Image Preview - larger with proper aspect ratio */}
                <div className="w-64 bg-dark-bg border border-dark-border rounded overflow-hidden flex-shrink-0">
                  {(isLightMode ? cachedImageUrl : true) ? (
                    <img
                      src={isLightMode ? (cachedImageUrl || '') : `/api/cards/${currentCard.meta.id}/image?t=${Date.now()}`}
                      alt="Character Avatar"
                      className="w-full h-auto object-contain"
                      style={{ minHeight: '256px', maxHeight: '384px', display: (isLightMode && !cachedImageUrl) ? 'none' : 'block' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent && !parent.querySelector('.no-image-placeholder')) {
                          const placeholder = document.createElement('div');
                          placeholder.className = 'no-image-placeholder flex items-center justify-center text-dark-muted text-sm';
                          placeholder.style.height = '256px';
                          placeholder.textContent = 'No Image';
                          parent.appendChild(placeholder);
                        }
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center text-dark-muted text-sm" style={{ height: '256px' }}>
                      No Image
                    </div>
                  )}
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
                          if (isLightMode) {
                            // Light mode: create thumbnail and save to IndexedDB
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const fullDataUrl = reader.result as string;
                              // Create smaller WebP thumbnail
                              let thumbnailUrl = fullDataUrl;
                              try {
                                const img = new Image();
                                await new Promise<void>((resolve, reject) => {
                                  img.onload = () => resolve();
                                  img.onerror = () => reject();
                                  img.src = fullDataUrl;
                                });
                                let width = img.width;
                                let height = img.height;
                                const maxSize = 400;
                                if (width > height && width > maxSize) {
                                  height = Math.round((height * maxSize) / width);
                                  width = maxSize;
                                } else if (height > maxSize) {
                                  width = Math.round((width * maxSize) / height);
                                  height = maxSize;
                                }
                                const canvas = document.createElement('canvas');
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  ctx.drawImage(img, 0, 0, width, height);
                                  thumbnailUrl = canvas.toDataURL('image/webp', 0.8);
                                  if (!thumbnailUrl.startsWith('data:image/webp')) {
                                    thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);
                                  }
                                }
                              } catch {
                                // Use full image if thumbnail creation fails
                              }
                              await localDB.saveImage(currentCard.meta.id, 'thumbnail', thumbnailUrl);
                              setCachedImageUrl(thumbnailUrl);
                              alert('Image updated successfully!');
                            };
                            reader.readAsDataURL(file);
                          } else {
                            // Server mode: upload via API
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
                          }
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

            <FieldEditor
              label="Name"
              value={cardData.name}
              onChange={(v) => handleFieldChange('name', v)}
              tokenCount={tokenCounts.name}
              fieldName="description"
              onOpenLLMAssist={handleOpenLLMAssist}
            />

            {/* Nickname - always visible, no V3 tag */}
            <FieldEditor
              label="Nickname"
              value={(cardData as any).nickname || ''}
              onChange={(v) => handleFieldChange('nickname', v)}
              placeholder="Short nickname (used for {{char}} replacement)"
              helpText="If set, {{char}}, <char>, and <bot> will be replaced with this instead of the name"
            />

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Tags</label>
                <button
                  onClick={handleGenerateTags}
                  disabled={generatingTags || !cardData.description}
                  className="text-sm px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                  title="Generate tags from description using AI"
                >
                  {generatingTags ? (
                    <span className="animate-spin inline-block">&#9696;</span>
                  ) : (
                    <>&#10024;</>
                  )}
                </button>
              </div>
              <TagInput
                tags={currentCard.meta.tags || []}
                onChange={handleTagsChange}
                label=""
              />
            </div>

            {/* Creator - no V3 tag */}
            <FieldEditor
              label="Creator"
              value={cardData.creator || ''}
              onChange={(v) => handleFieldChange('creator', v)}
              placeholder="Creator name"
            />

            {/* Character Version - no V3 tag */}
            <FieldEditor
              label="Character Version"
              value={cardData.character_version || ''}
              onChange={(v) => handleFieldChange('character_version', v)}
              placeholder="1.0"
            />

            {/* Tagline / Short Description - Extension field */}
            <div className="input-group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="label">Tagline / Short Description</label>
                  <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white">Extension</span>
                </div>
                <button
                  onClick={handleGenerateTagline}
                  disabled={generatingTagline || !cardData.description}
                  className="text-sm px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                  title="Generate tagline from description using AI"
                >
                  {generatingTagline ? (
                    <span className="animate-spin inline-block">&#9696;</span>
                  ) : (
                    <>&#10024;</>
                  )}
                </button>
              </div>
              <p className="text-sm text-dark-muted mb-2">
                A short tagline for display on card hosting sites. Max 500 characters.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={((cardData as any).extensions?.tagline) || ''}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, 500);
                    const existingExtensions = (cardData as any).extensions || {};
                    const extensions = { ...existingExtensions, tagline: value };
                    handleFieldChange('extensions', extensions);
                  }}
                  placeholder="A brief, catchy description of this character..."
                  maxLength={500}
                  className="flex-1"
                />
                <span className="text-xs text-dark-muted whitespace-nowrap">
                  {((cardData as any).extensions?.tagline || '').length}/500
                </span>
              </div>
            </div>

            {/* Metadata Timestamps - V3 Only, read-only */}
            {showV3Fields && (
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
                    These timestamps are automatically managed.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Character Tab */}
        {activeTab === 'character' && (
          <div className="space-y-6">
            <FieldEditor
              label="Description"
              value={cardData.description}
              onChange={(v) => handleFieldChange('description', v)}
              tokenCount={tokenCounts.description}
              multiline
              rows={16}
              fieldName="description"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
            />

            <FieldEditor
              label="Scenario"
              value={cardData.scenario}
              onChange={(v) => handleFieldChange('scenario', v)}
              tokenCount={tokenCounts.scenario}
              multiline
              rows={10}
              fieldName="scenario"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
            />

            <FieldEditor
              label="Personality"
              value={cardData.personality}
              onChange={(v) => handleFieldChange('personality', v)}
              tokenCount={tokenCounts.personality}
              multiline
              rows={10}
              fieldName="personality"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
            />

            {/* Appearance - always visible, used by Voxta/Wyvern */}
            <div className="input-group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="label">Appearance</label>
                  <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white">Extension</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-600 text-white">VOXTA</span>
                </div>
                <div className="flex items-center gap-1">
                  {tokenCounts.appearance !== undefined && (
                    <span className="chip chip-token">{tokenCounts.appearance} tokens</span>
                  )}
                  <button
                    onClick={() => handleOpenTemplates('description', getAppearance())}
                    className="text-sm px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    title="Templates & Snippets"
                  >
                    📄
                  </button>
                  <button
                    onClick={() => handleOpenLLMAssist('appearance', getAppearance())}
                    className="text-sm px-1.5 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    title="AI Assist"
                  >
                    ✨
                  </button>
                </div>
              </div>
              <p className="text-sm text-dark-muted mb-2">
                Physical description used by Voxta and Wyvern as a prompt for Image Diffusion models. Stored in extensions.
              </p>
              <textarea
                value={getAppearance()}
                onChange={(e) => setAppearance(e.target.value)}
                rows={8}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                placeholder="Character's physical appearance..."
              />
            </div>
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
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="label">Alternate Greetings</label>
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
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-dark-muted">Greeting {index + 1}</h4>
                      {tokenCounts[`alternate_greeting_${index}` as keyof typeof tokenCounts] !== undefined && (
                        <span className="chip chip-token">{tokenCounts[`alternate_greeting_${index}` as keyof typeof tokenCounts]} tokens</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenTemplates('first_mes', greeting)}
                        className="text-sm px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        title="Templates & Snippets"
                      >
                        📄
                      </button>
                      <button
                        onClick={() => handleOpenLLMAssist(`alternate_greetings:${index}`, greeting)}
                        className="text-sm px-1.5 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                        title="AI Assist"
                      >
                        ✨
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm('Delete this alternate greeting?')) return;
                          const updated = [...(cardData.alternate_greetings || [])];
                          updated.splice(index, 1);
                          handleFieldChange('alternate_greetings', updated as any);
                        }}
                        className="text-sm px-1.5 py-0.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors ml-1"
                        title="Delete greeting"
                      >
                        🗑️
                      </button>
                    </div>
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
              rows={8}
              fieldName="system_prompt"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
            />

            <FieldEditor
              label="Post History Instructions"
              value={cardData.post_history_instructions || ''}
              onChange={(v) => handleFieldChange('post_history_instructions', v)}
              tokenCount={tokenCounts.post_history_instructions}
              multiline
              rows={8}
              fieldName="post_history_instructions"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
            />

            <FieldEditor
              label="Example Messages"
              value={cardData.mes_example}
              onChange={(v) => handleFieldChange('mes_example', v)}
              tokenCount={tokenCounts.mes_example}
              multiline
              rows={10}
              fieldName="mes_example"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
            />

            <FieldEditor
              label="Creator Notes"
              value={cardData.creator_notes || ''}
              onChange={(v) => handleFieldChange('creator_notes', v)}
              tokenCount={tokenCounts.creator_notes}
              multiline
              rows={8}
              fieldName="creator_notes"
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              helpText="Not rendered in preview. Used for notes to other users/creators."
            />

            {/* Character Note (depth_prompt extension) */}
            <div className="input-group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="label">Character Note</label>
                  <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white">Extension</span>
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-xs text-dark-muted">Depth:</span>
                    <input
                      type="number"
                      value={characterNoteDepth}
                      onChange={(e) => handleCharacterNoteDepthChange(parseInt(e.target.value) || 4)}
                      min={0}
                      max={100}
                      className="w-16 bg-dark-card border border-dark-border rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {tokenCounts.character_note !== undefined && (
                    <span className="chip chip-token">{tokenCounts.character_note} tokens</span>
                  )}
                  <button
                    onClick={() => handleOpenTemplates('description', characterNoteValue)}
                    className="text-sm px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    title="Templates & Snippets"
                  >
                    📄
                  </button>
                  <button
                    onClick={() => handleOpenLLMAssist('character_note', characterNoteValue)}
                    className="text-sm px-1.5 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    title="AI Assist"
                  >
                    ✨
                  </button>
                </div>
              </div>
              <p className="text-sm text-dark-muted mb-2">
                SillyTavern Character Note. Injected at the specified depth in conversation.
              </p>
              <textarea
                value={characterNoteValue}
                onChange={(e) => handleCharacterNoteChange(e.target.value)}
                rows={6}
                className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
                placeholder="Character note content..."
              />
            </div>

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
                    URLs or IDs pointing to the source of this character card.
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
              </>
            )}
          </div>
        )}

        {/* Lorebook Tab */}
        {activeTab === 'lorebook' && (
          <LorebookEditor />
        )}

        {/* ELARA VOSS Tab */}
        {activeTab === 'elara-voss' && (
          <ElaraVossPanel />
        )}

        {/* Extensions Tab */}
        {activeTab === 'extensions' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Extensions Data</h3>
              <p className="text-dark-muted">
                Read-only view of extension data. Character Note and Appearance are edited in the Advanced and Character tabs.
              </p>
            </div>

            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <pre className="text-sm text-dark-text whitespace-pre-wrap overflow-auto max-h-[60vh] font-mono">
                {JSON.stringify(getFilteredExtensions(), null, 2) || '{}'}
              </pre>
            </div>

            {Object.keys(getFilteredExtensions()).length === 0 && (
              <p className="text-dark-muted text-center py-4">
                No additional extension data present.
              </p>
            )}
          </div>
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
            cardSpec={normalizeSpec(currentCard.meta.spec)}
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
