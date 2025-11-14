import { useState, useEffect } from 'react';
import { useCardStore } from '../store/card-store';
import type { CCv3Data, CCv2Data, CCFieldName } from '@card-architect/schemas';
import { FieldEditor } from './FieldEditor';
import { LorebookEditor } from './LorebookEditor';
import { LLMAssistSidebar } from './LLMAssistSidebar';
import { TagInput } from './TagInput';

interface CollapsibleSectionProps {
  title: string;
  sectionId: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function CollapsibleSection({ title, sectionId, children, defaultExpanded = true }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem(`section-${sectionId}-expanded`);
    return saved !== null ? saved === 'true' : defaultExpanded;
  });

  useEffect(() => {
    localStorage.setItem(`section-${sectionId}-expanded`, String(isExpanded));
  }, [isExpanded, sectionId]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={toggleExpanded}
          className="flex items-center gap-2 text-left flex-1"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-xl font-bold">{title}</h2>
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {children}
        </div>
      )}
    </section>
  );
}

export function EditPanel() {
  const { currentCard, updateCardData, updateCardMeta, showAdvanced, setShowAdvanced } = useCardStore();
  const tokenCounts = useCardStore((state) => state.tokenCounts);

  const [llmAssistOpen, setLLMAssistOpen] = useState(false);
  const [llmAssistField, setLLMAssistField] = useState<CCFieldName>('description');
  const [llmAssistValue, setLLMAssistValue] = useState('');

  if (!currentCard) return null;

  const isV3 = currentCard.meta.spec === 'v3';
  const cardData = isV3 ? (currentCard.data as CCv3Data).data : (currentCard.data as CCv2Data);

  const handleFieldChange = (field: string, value: string) => {
    if (isV3) {
      updateCardData({
        data: {
          ...(currentCard.data as CCv3Data).data,
          [field]: value,
        },
      } as Partial<CCv3Data>);
    } else {
      updateCardData({ [field]: value });
    }
  };

  const handleTagsChange = (tags: string[]) => {
    // Update both meta.tags and data.tags for consistency
    updateCardMeta({ tags });
    if (isV3) {
      updateCardData({
        data: {
          ...(currentCard.data as CCv3Data).data,
          tags,
        },
      } as Partial<CCv3Data>);
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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Basic Information - Collapsible */}
      <CollapsibleSection title="Basic Information" sectionId="basic-info" defaultExpanded={true}>
        <FieldEditor
          label="Name"
          value={cardData.name}
          onChange={(v) => handleFieldChange('name', v)}
          tokenCount={tokenCounts.name}
          fieldName="description"
          onOpenLLMAssist={handleOpenLLMAssist}
        />

        {isV3 && (
          <>
            <FieldEditor
              label="Creator"
              value={cardData.creator || ''}
              onChange={(v) => handleFieldChange('creator', v)}
            />

            <FieldEditor
              label="Character Version"
              value={cardData.character_version || ''}
              onChange={(v) => handleFieldChange('character_version', v)}
            />

            <div>
              <label className="label">Tags</label>
              <input
                type="text"
                value={cardData.tags?.join(', ') || ''}
                onChange={(e) => {
                  const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                  handleFieldChange('tags', tags as any);
                }}
                placeholder="tag1, tag2, tag3"
                className="w-full"
              />
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* Description */}
      <CollapsibleSection title="Description" sectionId="description" defaultExpanded={true}>
        <FieldEditor
          label="Description"
          value={cardData.description}
          onChange={(v) => handleFieldChange('description', v)}
          tokenCount={tokenCounts.description}
          multiline
          rows={4}
          fieldName="description"
          onOpenLLMAssist={handleOpenLLMAssist}
        />
      </CollapsibleSection>

      {/* Personality */}
      <CollapsibleSection title="Personality" sectionId="personality" defaultExpanded={true}>
        <FieldEditor
          label="Personality"
          value={cardData.personality}
          onChange={(v) => handleFieldChange('personality', v)}
          tokenCount={tokenCounts.personality}
          multiline
          rows={4}
          fieldName="personality"
          onOpenLLMAssist={handleOpenLLMAssist}
        />
      </CollapsibleSection>

      {/* Scenario */}
      <CollapsibleSection title="Scenario" sectionId="scenario" defaultExpanded={true}>
        <FieldEditor
          label="Scenario"
          value={cardData.scenario}
          onChange={(v) => handleFieldChange('scenario', v)}
          tokenCount={tokenCounts.scenario}
          multiline
          rows={4}
          fieldName="scenario"
          onOpenLLMAssist={handleOpenLLMAssist}
        />
      </CollapsibleSection>

      {/* First Message */}
      <CollapsibleSection title="First Message" sectionId="first-message" defaultExpanded={true}>
        <FieldEditor
          label="First Message"
          value={cardData.first_mes}
          onChange={(v) => handleFieldChange('first_mes', v)}
          tokenCount={tokenCounts.first_mes}
          multiline
          rows={4}
          fieldName="first_mes"
          onOpenLLMAssist={handleOpenLLMAssist}
        />
      </CollapsibleSection>

      {/* Example Dialogue */}
      <CollapsibleSection title="Example Dialogue" sectionId="example-dialogue" defaultExpanded={true}>
        <FieldEditor
          label="Example Dialogue"
          value={cardData.mes_example}
          onChange={(v) => handleFieldChange('mes_example', v)}
          tokenCount={tokenCounts.mes_example}
          multiline
          rows={6}
          fieldName="mes_example"
          onOpenLLMAssist={handleOpenLLMAssist}
        />
      </CollapsibleSection>

      {/* Alternate Greetings */}
      <CollapsibleSection title="Alternate Greetings" sectionId="alternate-greetings" defaultExpanded={false}>
        <div>
          <label className="label">Alternate Greetings</label>
          <p className="text-sm text-dark-muted mb-2">
            Additional first messages (one per line)
          </p>
          <textarea
            value={cardData.alternate_greetings?.join('\n') || ''}
            onChange={(e) => {
              const greetings = e.target.value.split('\n').filter((g) => g.trim());
              handleFieldChange('alternate_greetings', greetings as any);
            }}
            rows={4}
            className="w-full"
          />
        </div>
      </CollapsibleSection>

      {/* Advanced Section */}
      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Advanced</h2>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            {showAdvanced ? 'Hide' : 'Show'}
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4">
            <FieldEditor
              label="System Prompt"
              value={cardData.system_prompt || ''}
              onChange={(v) => handleFieldChange('system_prompt', v)}
              tokenCount={tokenCounts.system_prompt}
              multiline
              rows={4}
            />

            <FieldEditor
              label="Post History Instructions"
              value={cardData.post_history_instructions || ''}
              onChange={(v) => handleFieldChange('post_history_instructions', v)}
              tokenCount={tokenCounts.post_history_instructions}
              multiline
              rows={4}
            />

            <FieldEditor
              label="Creator Notes (Not rendered in preview)"
              value={cardData.creator_notes || ''}
              onChange={(v) => handleFieldChange('creator_notes', v)}
              multiline
              rows={3}
            />

            <div>
              <label className="label">Alternate Greetings</label>
              <p className="text-sm text-dark-muted mb-2">
                Additional first messages (one per line)
              </p>
              <textarea
                value={cardData.alternate_greetings?.join('\n') || ''}
                onChange={(e) => {
                  const greetings = e.target.value.split('\n').filter((g) => g.trim());
                  handleFieldChange('alternate_greetings', greetings as any);
                }}
                rows={4}
                className="w-full"
              />
            </div>

            {isV3 && (
              <div className="input-group">
                <FieldEditor
                  label="Creator"
                  value={cardData.creator || ''}
                  onChange={(v) => handleFieldChange('creator', v)}
                />

                <FieldEditor
                  label="Character Version"
                  value={cardData.character_version || ''}
                  onChange={(v) => handleFieldChange('character_version', v)}
                />

                <TagInput
                  tags={currentCard.meta.tags || []}
                  onChange={handleTagsChange}
                />
              </div>
            )}
          </div>
        )}
      </section>

      <LorebookEditor />

      <LLMAssistSidebar
        isOpen={llmAssistOpen}
        onClose={() => setLLMAssistOpen(false)}
        fieldName={llmAssistField}
        currentValue={llmAssistValue}
        onApply={handleLLMApply}
        cardSpec={currentCard.meta.spec}
      />
    </div>
  );
}
