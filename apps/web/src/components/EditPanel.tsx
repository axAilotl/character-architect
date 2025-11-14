import { useState } from 'react';
import { useCardStore } from '../store/card-store';
import type { CCv3Data, CCFieldName } from '@card-architect/schemas';
'@card-architect/schemas';
import { FieldEditor } from './FieldEditor';
import { LorebookEditor } from './LorebookEditor';
import { LLMAssistSidebar } from './LLMAssistSidebar';

export function EditPanel() {
  const { currentCard, updateCardData, showAdvanced, setShowAdvanced } = useCardStore();
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
      <section className="card">
        <h2 className="text-xl font-bold mb-4">Basic Information</h2>

        <FieldEditor
          label="Name"
          value={cardData.name}
          onChange={(v) => handleFieldChange('name', v)}
          tokenCount={tokenCounts.name}
          fieldName="description"
          onOpenLLMAssist={handleOpenLLMAssist}
        />

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
      </section>

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
