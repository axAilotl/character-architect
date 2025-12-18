/**
 * EditPanel V2 - Schema-driven character card editor
 *
 * This is a refactored version of EditPanel that uses configuration-driven
 * field rendering instead of hardcoded JSX. It reduces the code by ~80%
 * while maintaining all functionality.
 *
 * Key changes:
 * - Field definitions in config/field-definitions.ts
 * - DynamicField component for field binding
 * - FieldRenderer for type-specific rendering
 * - Tab content generated from configuration
 */

import { useState, useEffect } from 'react';
import { useCardStore, extractCardData } from '../../../store/card-store';
import { useSettingsStore } from '../../../store/settings-store';
import { useTokenStore } from '../../../store/token-store';
import { useLLMStore } from '../../../store/llm-store';
import { localDB } from '../../../lib/db';
import { getDeploymentConfig } from '../../../config/deployment';
import { invokeClientLLM } from '../../../lib/client-llm';
import {
  normalizeSpec,
  type FocusField,
  type Template,
  type Snippet,
  type LLMProvider,
} from '../../../lib/types';

import { DynamicField } from './DynamicField';
import { LorebookEditor } from './LorebookEditor';
import { LLMAssistSidebar } from './LLMAssistSidebar';
import { TemplateSnippetPanel } from './TemplateSnippetPanel';

import { getFieldsForTab, tabDefinitions, type TabId } from '../config/field-definitions';

// ============================================================================
// TYPES
// ============================================================================

type EditTab = TabId | 'lorebook' | 'extensions';

// ============================================================================
// AVATAR UPLOAD COMPONENT (Special handling, not schema-driven)
// ============================================================================

interface AvatarUploadProps {
  cardId: string;
  isLightMode: boolean;
  cachedImageUrl: string | null;
  onImageUploaded: (imageUrl: string) => void;
}

function AvatarUpload({ cardId, isLightMode, cachedImageUrl, onImageUploaded }: AvatarUploadProps) {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (isLightMode) {
        const reader = new FileReader();
        reader.onload = async () => {
          const fullDataUrl = reader.result as string;
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
            // Use full image if thumbnail fails
          }

          await localDB.saveImage(cardId, 'thumbnail', thumbnailUrl);
          onImageUploaded(thumbnailUrl);
          alert('Image updated successfully!');
        };
        reader.readAsDataURL(file);
      } else {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/cards/${cardId}/image`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload image');
        }

        onImageUploaded(`/api/cards/${cardId}/image?t=${Date.now()}`);
        alert('Image updated successfully!');
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      e.target.value = '';
    }
  };

  const imageUrl = isLightMode
    ? cachedImageUrl || ''
    : cachedImageUrl || `/api/cards/${cardId}/image`;

  return (
    <div className="flex flex-col items-center">
      <div className="w-[300px] bg-dark-bg border border-dark-border rounded overflow-hidden mb-2">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Character Avatar"
            className="w-full h-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent && !parent.querySelector('.no-image-placeholder')) {
                const placeholder = document.createElement('div');
                placeholder.className =
                  'no-image-placeholder flex items-center justify-center text-dark-muted text-sm w-full h-48';
                placeholder.textContent = 'No Image';
                parent.appendChild(placeholder);
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center text-dark-muted text-sm w-full h-48">
            No Image
          </div>
        )}
      </div>
      <label htmlFor="avatar-upload" className="btn-secondary text-sm cursor-pointer">
        Upload Image
        <input
          id="avatar-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </label>
    </div>
  );
}

// ============================================================================
// EXTENSIONS TAB (Read-only JSON view)
// ============================================================================

interface ExtensionsViewProps {
  cardData: Record<string, unknown>;
}

function ExtensionsView({ cardData }: ExtensionsViewProps) {
  // Filter out handled extensions
  const getFilteredExtensions = () => {
    const extensions = { ...((cardData.extensions as Record<string, unknown>) || {}) };

    // Remove handled extensions
    delete extensions.depth_prompt;
    delete extensions.visual_description;

    // Keep voxta but remove appearance if showing separately
    if (extensions.voxta) {
      const voxtaCopy = { ...(extensions.voxta as Record<string, unknown>) };
      delete voxtaCopy.appearance;
      if (Object.keys(voxtaCopy).length === 0) {
        delete extensions.voxta;
      } else {
        extensions.voxta = voxtaCopy;
      }
    }

    return extensions;
  };

  const filtered = getFilteredExtensions();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Extensions Data</h3>
        <p className="text-dark-muted">
          Read-only view of extension data. Character Note and Appearance are edited in the Advanced
          and Character tabs.
        </p>
      </div>

      <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
        <pre className="text-sm text-dark-text whitespace-pre-wrap overflow-auto max-h-[60vh] font-mono">
          {JSON.stringify(filtered, null, 2) || '{}'}
        </pre>
      </div>

      {Object.keys(filtered).length === 0 && (
        <p className="text-dark-muted text-center py-4">No additional extension data present.</p>
      )}
    </div>
  );
}

// ============================================================================
// TAB CONTENT RENDERER
// ============================================================================

interface TabContentProps {
  tab: TabId;
  cardData: Record<string, unknown>;
  spec: 'v2' | 'v3';
  showV3Fields: boolean;
  tokenCounts: Record<string, number>;
  onFieldChange: (field: string, value: unknown) => void;
  onOpenLLMAssist: (fieldName: string, value: string) => void;
  onOpenTemplates: (fieldName: FocusField, value: string) => void;
  llmSettings: { providers: LLMProvider[]; activeProviderId?: string };
  aiPrompts: { tagsSystemPrompt: string; taglineSystemPrompt: string };
  isLightMode: boolean;
  // Avatar-specific props
  cardId?: string;
  cachedImageUrl?: string | null;
  onImageUploaded?: (url: string) => void;
  // Package ID for timestamps
  packageId?: string;
}

function TabContent({
  tab,
  cardData,
  spec,
  showV3Fields,
  tokenCounts,
  onFieldChange,
  onOpenLLMAssist,
  onOpenTemplates,
  llmSettings,
  aiPrompts,
  isLightMode,
  cardId,
  cachedImageUrl,
  onImageUploaded,
}: TabContentProps) {
  const fields = getFieldsForTab(tab);

  if (tab === 'basic') {
    const coreFieldIds = ['name', 'nickname', 'creator', 'character_version'];
    const coreFields = fields.filter((f) => coreFieldIds.includes(f.id));
    const fullWidthFields = fields.filter((f) => !coreFieldIds.includes(f.id));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
          {cardId && onImageUploaded && (
            <div className="flex justify-center md:justify-start">
              <AvatarUpload
                cardId={cardId}
                isLightMode={isLightMode}
                cachedImageUrl={cachedImageUrl || null}
                onImageUploaded={onImageUploaded}
              />
            </div>
          )}

          <div className="space-y-4">
            {coreFields.map((field) => (
              <DynamicField
                key={field.id}
                definition={field}
                cardData={cardData}
                onFieldChange={onFieldChange}
                spec={spec}
                showV3Fields={showV3Fields}
                tokenCounts={tokenCounts}
                onOpenLLMAssist={onOpenLLMAssist}
                onOpenTemplates={onOpenTemplates}
                llmSettings={llmSettings}
                aiPrompts={aiPrompts}
                isLightMode={isLightMode}
                invokeClientLLM={isLightMode ? invokeClientLLM : undefined}
              />
            ))}
          </div>
        </div>

        {fullWidthFields.map((field) => (
          <DynamicField
            key={field.id}
            definition={field}
            cardData={cardData}
            onFieldChange={onFieldChange}
            spec={spec}
            showV3Fields={showV3Fields}
            tokenCounts={tokenCounts}
            onOpenLLMAssist={onOpenLLMAssist}
            onOpenTemplates={onOpenTemplates}
            llmSettings={llmSettings}
            aiPrompts={aiPrompts}
            isLightMode={isLightMode}
            invokeClientLLM={isLightMode ? invokeClientLLM : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <DynamicField
          key={field.id}
          definition={field}
          cardData={cardData}
          onFieldChange={onFieldChange}
          spec={spec}
          showV3Fields={showV3Fields}
          tokenCounts={tokenCounts}
          onOpenLLMAssist={onOpenLLMAssist}
          onOpenTemplates={onOpenTemplates}
          llmSettings={llmSettings}
          aiPrompts={aiPrompts}
          isLightMode={isLightMode}
          invokeClientLLM={isLightMode ? invokeClientLLM : undefined}
        />
      ))}
    </div>
  );
}

// ============================================================================
// MAIN EDIT PANEL COMPONENT
// ============================================================================

export function EditPanelV2() {
  const { currentCard, updateCardData, updateCardMeta } = useCardStore();
  const { editor, aiPrompts } = useSettingsStore();
  const tokenCounts = useTokenStore((state) => state.tokenCounts);
  const { settings: llmSettings, loadSettings } = useLLMStore();

  const [activeTab, setActiveTab] = useState<EditTab>('basic');
  const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);

  // LLM Assist sidebar state
  const [llmAssistOpen, setLLMAssistOpen] = useState(false);
  const [llmAssistField, setLLMAssistField] = useState<string>('description');
  const [llmAssistValue, setLLMAssistValue] = useState('');

  // Templates panel state
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesField, setTemplatesField] = useState<FocusField>('description');
  const [templatesValue, setTemplatesValue] = useState('');

  const config = getDeploymentConfig();
  const isLightMode = config.mode === 'light' || config.mode === 'static';

  // Load LLM settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load cached image from IndexedDB in light mode
  useEffect(() => {
    if (isLightMode && currentCard?.meta?.id) {
      localDB.getImage(currentCard.meta.id, 'thumbnail').then((imageData) => {
        setCachedImageUrl(imageData);
      });
    }
  }, [isLightMode, currentCard?.meta?.id]);

  // Early return if no card
  if (!currentCard) return null;

  const isV3 = currentCard.meta.spec === 'v3';
  const cardData = extractCardData(currentCard) as unknown as Record<string, unknown>;
  const spec = normalizeSpec(currentCard.meta.spec);
  const showV3Fields = editor.showV3Fields;

  // Field change handler
  const handleFieldChange = (field: string, value: unknown) => {
    const v2Data = currentCard.data as unknown as Record<string, unknown>;
    const isWrappedV2 = !isV3 && v2Data.spec === 'chara_card_v2' && 'data' in v2Data;

    if (isV3 || isWrappedV2) {
      updateCardData({
        data: {
          ...cardData,
          [field]: value,
        },
      } as Record<string, unknown>);
    } else {
      updateCardData({ [field]: value });
    }

    // Special handling for tags - also update meta.tags
    if (field === 'tags') {
      updateCardMeta({ tags: value as string[] });
    }
  };

  // LLM Assist handlers
  const handleOpenLLMAssist = (fieldName: string, value: string) => {
    setLLMAssistField(fieldName);
    setLLMAssistValue(value);
    setLLMAssistOpen(true);
  };

  const handleLLMApply = (value: string, action: 'replace' | 'append' | 'insert') => {
    // Handle appearance field
    if (llmAssistField === 'appearance') {
      const existingExtensions = (cardData.extensions || {}) as Record<string, unknown>;
      const extensions = { ...existingExtensions };
      const currentAppearance = getAppearanceFromExtensions(extensions);

      if (extensions.voxta) {
        (extensions.voxta as Record<string, unknown>).appearance =
          action === 'replace' ? value : currentAppearance + '\n' + value;
      } else {
        extensions.visual_description =
          action === 'replace' ? value : currentAppearance + '\n' + value;
      }
      handleFieldChange('extensions', extensions);
      return;
    }

    // Handle character_note field
    if (llmAssistField === 'character_note') {
      const existingExtensions = (cardData.extensions || {}) as Record<string, unknown>;
      const depthPrompt = (existingExtensions.depth_prompt || {}) as Record<string, unknown>;
      const currentPrompt = (depthPrompt.prompt as string) || '';
      const depth = (depthPrompt.depth as number) ?? 4;

      const extensions = {
        ...existingExtensions,
        depth_prompt: {
          prompt: action === 'replace' ? value : currentPrompt + '\n' + value,
          depth,
          role: 'system',
        },
      };
      handleFieldChange('extensions', extensions);
      return;
    }

    // Handle alternate_greetings array items
    if (llmAssistField.startsWith('alternate_greetings:')) {
      const index = parseInt(llmAssistField.split(':')[1], 10);
      if (!isNaN(index) && cardData.alternate_greetings) {
        const updated = [...(cardData.alternate_greetings as string[])];
        if (action === 'replace') updated[index] = value;
        else if (action === 'append') updated[index] = updated[index] + '\n' + value;
        handleFieldChange('alternate_greetings', updated);
      }
      return;
    }

    // Standard field handling
    if (action === 'replace') {
      handleFieldChange(llmAssistField, value);
    } else if (action === 'append') {
      handleFieldChange(llmAssistField, llmAssistValue + '\n' + value);
    }
  };

  // Templates handlers
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

  // Determine card type for tab filtering
  const cardSpec = currentCard.meta.spec;
  const isLorebook = cardSpec === 'lorebook';
  const isCollection = cardSpec === 'collection';

  // Build tabs list based on card type
  const tabs: Array<{ id: EditTab; label: string }> = (() => {
    if (isLorebook) {
      // Lorebooks: Basic Info, Lorebook, Extensions
      return [
        { id: 'basic' as EditTab, label: 'Basic Info' },
        { id: 'lorebook' as EditTab, label: 'Lorebook' },
        ...(editor.showExtensionsTab ? [{ id: 'extensions' as EditTab, label: 'Extensions' }] : []),
      ];
    }

    if (isCollection) {
      // Collections: Basic Info, Character, Extensions
      return [
        { id: 'basic' as EditTab, label: 'Basic Info' },
        { id: 'character' as EditTab, label: 'Character' },
        ...(editor.showExtensionsTab ? [{ id: 'extensions' as EditTab, label: 'Extensions' }] : []),
      ];
    }

    // Character cards: All tabs
    return [
      ...tabDefinitions.map((t) => ({ id: t.id as EditTab, label: t.label })),
      ...(editor.showExtensionsTab ? [{ id: 'extensions' as EditTab, label: 'Extensions' }] : []),
    ];
  })();

  // Layout calculations for LLM assist sidebar
  const ASSIST_WIDTH_PX = 500;
  const ASSIST_GAP_PX = 24;
  const contentStyle = llmAssistOpen
    ? {
        width: `calc(100% - ${ASSIST_WIDTH_PX + ASSIST_GAP_PX}px)`,
        marginRight: `${ASSIST_GAP_PX}px`,
      }
    : undefined;

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
                className={`font-medium transition-colors ${
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

      {/* Tab Content */}
      <div className="flex-1 relative flex">
        <div
          className={`overflow-y-auto p-6 space-y-6 transition-all duration-300 ${
            llmAssistOpen ? 'w-full' : 'max-w-[66%] w-full mx-auto'
          }`}
          style={contentStyle}
        >
          {/* Schema-driven tabs */}
          {(activeTab === 'basic' ||
            activeTab === 'character' ||
            activeTab === 'greetings' ||
            activeTab === 'advanced') && (
            <TabContent
              tab={activeTab}
              cardData={cardData}
              spec={spec === 'collection' || spec === 'lorebook' ? 'v3' : spec}
              showV3Fields={showV3Fields}
              tokenCounts={tokenCounts}
              onFieldChange={handleFieldChange}
              onOpenLLMAssist={handleOpenLLMAssist}
              onOpenTemplates={handleOpenTemplates}
              llmSettings={llmSettings}
              aiPrompts={aiPrompts}
              isLightMode={isLightMode}
              cardId={currentCard.meta.id}
              cachedImageUrl={cachedImageUrl}
              onImageUploaded={setCachedImageUrl}
              packageId={currentCard.meta.packageId}
            />
          )}

          {/* Lorebook Tab - separate component */}
          {activeTab === 'lorebook' && <LorebookEditor />}

          {/* Extensions Tab - read-only view */}
          {activeTab === 'extensions' && <ExtensionsView cardData={cardData} />}
        </div>

        {/* LLM Assist Sidebar */}
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

      {/* Templates Panel */}
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

// Helper function for appearance
function getAppearanceFromExtensions(extensions: Record<string, unknown>): string {
  if ((extensions.voxta as Record<string, unknown> | undefined)?.appearance) {
    return (extensions.voxta as Record<string, unknown>).appearance as string;
  }
  if (extensions.visual_description) {
    return extensions.visual_description as string;
  }
  return '';
}
