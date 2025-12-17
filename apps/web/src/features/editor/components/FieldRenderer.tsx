/**
 * FieldRenderer - Schema-driven field rendering component
 *
 * Renders the appropriate input component based on field definition type.
 * This replaces the hardcoded field rendering in EditPanel.tsx.
 */

import type { FieldDefinition } from '../config/field-definitions';
import type { FocusField } from '../../../lib/types';
import { TagInput } from './TagInput';

// ============================================================================
// PROPS INTERFACE
// ============================================================================

export interface FieldRendererProps {
  /** Field definition from config */
  definition: FieldDefinition;
  /** Current field value */
  value: unknown;
  /** Value change handler */
  onChange: (value: unknown) => void;
  /** Token count for this field (if applicable) */
  tokenCount?: number;
  /** Whether AI generation is in progress */
  generating?: boolean;
  /** Handler for AI generate button */
  onGenerate?: () => void;
  /** Handler for LLM assist button */
  onOpenLLMAssist?: (fieldName: string, value: string) => void;
  /** Handler for templates button */
  onOpenTemplates?: (fieldName: FocusField, value: string) => void;
  /** Error message to display */
  error?: string;
  /** For array types: token counts per item */
  itemTokenCounts?: Record<string, number>;
}

// ============================================================================
// SPEC MARKER BADGE
// ============================================================================

function SpecMarkerBadge({ marker }: { marker: FieldDefinition['specMarker'] }) {
  if (!marker) return null;

  const styles: Record<string, string> = {
    v2: 'bg-gray-600 text-white',
    v3: 'bg-blue-600 text-white',
    v3only: 'bg-purple-600 text-white',
    extension: 'bg-green-600 text-white',
    voxta: 'bg-orange-600 text-white',
  };

  const labels: Record<string, string> = {
    v2: 'V2',
    v3: 'V3',
    v3only: 'V3 Only',
    extension: 'Extension',
    voxta: 'VOXTA',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[marker]}`}>{labels[marker]}</span>
  );
}

// ============================================================================
// FIELD HEADER (Label + Actions)
// ============================================================================

interface FieldHeaderProps {
  definition: FieldDefinition;
  value: unknown;
  tokenCount?: number;
  generating?: boolean;
  onGenerate?: () => void;
  onOpenLLMAssist?: (fieldName: string, value: string) => void;
  onOpenTemplates?: (fieldName: FocusField, value: string) => void;
}

function FieldHeader({
  definition,
  value,
  tokenCount,
  generating,
  onGenerate,
  onOpenLLMAssist,
  onOpenTemplates,
}: FieldHeaderProps) {
  const stringValue = typeof value === 'string' ? value : '';

  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <label className="label">{definition.label}</label>
        <SpecMarkerBadge marker={definition.specMarker} />
      </div>
      <div className="flex items-center gap-1">
        {definition.showTokens && tokenCount !== undefined && (
          <span className="chip chip-token">{tokenCount} tokens</span>
        )}
        {definition.templatesButton && onOpenTemplates && definition.fieldName && (
          <button
            onClick={() => onOpenTemplates(definition.fieldName as FocusField, stringValue)}
            className="text-sm px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="Templates & Snippets"
          >
            📄
          </button>
        )}
        {definition.llmAssist && onOpenLLMAssist && (
          <button
            onClick={() => onOpenLLMAssist(definition.fieldName || definition.id, stringValue)}
            className="text-sm px-1.5 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            title="AI Assist"
          >
            ✨
          </button>
        )}
        {definition.aiGenerate && onGenerate && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="text-sm px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
            title={`Generate ${definition.label.toLowerCase()} using AI`}
          >
            {generating ? (
              <span className="animate-spin inline-block">&#9696;</span>
            ) : (
              <>&#10024;</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TEXT FIELD
// ============================================================================

function TextField({
  definition,
  value,
  onChange,
}: {
  definition: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={definition.placeholder}
      maxLength={definition.maxLength}
      className="w-full"
    />
  );
}

// ============================================================================
// TEXTAREA FIELD
// ============================================================================

function TextareaField({
  definition,
  value,
  onChange,
}: {
  definition: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={definition.rows || 3}
      placeholder={definition.placeholder}
      maxLength={definition.maxLength}
      className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
    />
  );
}

// ============================================================================
// NUMBER FIELD
// ============================================================================

function NumberField({
  definition,
  value,
  onChange,
}: {
  definition: FieldDefinition;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || (definition.defaultValue as number) || 0)}
      min={definition.min}
      max={definition.max}
      className="w-24 bg-dark-card border border-dark-border rounded px-2 py-1 text-sm"
    />
  );
}

// ============================================================================
// TAGS FIELD
// ============================================================================

function TagsField({
  value,
  onChange,
}: {
  definition: FieldDefinition;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return <TagInput tags={value || []} onChange={onChange} label="" />;
}

// ============================================================================
// ARRAY FIELD (Alternate Greetings, Source URLs, etc.)
// ============================================================================

interface ArrayFieldProps {
  definition: FieldDefinition;
  value: string[];
  onChange: (value: string[]) => void;
  tokenCounts?: Record<string, number>;
  onOpenLLMAssist?: (fieldName: string, value: string) => void;
  onOpenTemplates?: (fieldName: FocusField, value: string) => void;
}

function ArrayField({
  definition,
  value,
  onChange,
  tokenCounts,
  onOpenLLMAssist,
  onOpenTemplates,
}: ArrayFieldProps) {
  const items = value || [];
  const isTextarea = (definition.rows || 1) > 1;
  const itemLabel = definition.itemLabel || 'Item';

  const handleAdd = () => {
    onChange([...items, '']);
  };

  const handleRemove = (index: number) => {
    if (!confirm(`Delete this ${itemLabel.toLowerCase()}?`)) return;
    const updated = [...items];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleChange = (index: number, newValue: string) => {
    const updated = [...items];
    updated[index] = newValue;
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="card bg-dark-bg border border-dark-border p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm text-dark-muted">
                {itemLabel} {index + 1}
              </h4>
              {tokenCounts?.[`${definition.id}_${index}`] !== undefined && (
                <span className="chip chip-token">
                  {tokenCounts[`${definition.id}_${index}`]} tokens
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {definition.templatesButton && onOpenTemplates && (
                <button
                  onClick={() => onOpenTemplates('first_mes', item)}
                  className="text-sm px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Templates & Snippets"
                >
                  📄
                </button>
              )}
              {definition.llmAssist && onOpenLLMAssist && (
                <button
                  onClick={() => onOpenLLMAssist(`${definition.id}:${index}`, item)}
                  className="text-sm px-1.5 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  title="AI Assist"
                >
                  ✨
                </button>
              )}
              <button
                onClick={() => handleRemove(index)}
                className="text-sm px-1.5 py-0.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors ml-1"
                title={`Delete ${itemLabel.toLowerCase()}`}
              >
                &#128465;&#65039;
              </button>
            </div>
          </div>
          {isTextarea ? (
            <textarea
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              rows={definition.rows || 3}
              className="w-full"
              placeholder={definition.placeholder}
            />
          ) : (
            <input
              type="text"
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              className="flex-1"
              placeholder={definition.placeholder}
            />
          )}
        </div>
      ))}
      <button onClick={handleAdd} className="btn-secondary text-sm">
        {definition.addButtonText || `+ Add ${itemLabel}`}
      </button>
    </div>
  );
}

// ============================================================================
// MAP FIELD (Multilingual Creator Notes)
// ============================================================================

interface MapFieldProps {
  definition: FieldDefinition;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

function MapField({ definition, value, onChange }: MapFieldProps) {
  const entries = Object.entries(value || {});

  const handleAdd = () => {
    const updated = { ...(value || {}) };
    // Find next unused language code
    let newLang = 'xx';
    let counter = 0;
    while (updated[newLang]) {
      newLang = `x${counter++}`;
    }
    updated[newLang] = '';
    onChange(updated);
  };

  const handleRemove = (key: string) => {
    const updated = { ...(value || {}) };
    delete updated[key];
    onChange(updated);
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
    const updated = { ...(value || {}) };
    updated[newKey] = updated[oldKey];
    delete updated[oldKey];
    onChange(updated);
  };

  const handleValueChange = (key: string, newValue: string) => {
    const updated = { ...(value || {}) };
    updated[key] = newValue;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {entries.map(([key, val]) => (
        <div key={key} className="space-y-2">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={key}
              onChange={(e) => handleKeyChange(key, e.target.value)}
              className="w-24"
              placeholder={definition.placeholder || 'en'}
              maxLength={2}
            />
            <button
              onClick={() => handleRemove(key)}
              className="btn-secondary text-sm"
            >
              Remove
            </button>
          </div>
          <textarea
            value={val}
            onChange={(e) => handleValueChange(key, e.target.value)}
            rows={definition.rows || 3}
            className="w-full"
            placeholder={`Content in ${key}`}
          />
        </div>
      ))}
      <button onClick={handleAdd} className="btn-secondary text-sm">
        {definition.addButtonText || '+ Add Entry'}
      </button>
    </div>
  );
}

// ============================================================================
// EXTENSION FIELD (with optional subfields like depth)
// ============================================================================

function ExtensionField({
  definition,
  value,
  onChange,
}: {
  definition: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}) {
  // For tagline, use input with character counter
  if (definition.id === 'tagline') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value.slice(0, definition.maxLength || 500))}
          placeholder={definition.placeholder}
          maxLength={definition.maxLength}
          className="flex-1"
        />
        {definition.maxLength && (
          <span className="text-xs text-dark-muted whitespace-nowrap">
            {(value || '').length}/{definition.maxLength}
          </span>
        )}
      </div>
    );
  }

  // For other extensions (appearance, character_note), use textarea
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      rows={definition.rows || 6}
      className="w-full bg-dark-card border border-dark-border rounded px-3 py-2"
      placeholder={definition.placeholder}
    />
  );
}

// ============================================================================
// READONLY FIELD (Timestamps)
// ============================================================================

interface ReadonlyFieldProps {
  value: {
    creation_date?: number;
    modification_date?: number;
    packageId?: string;
  };
}

function ReadonlyField({ value }: ReadonlyFieldProps) {
  return (
    <div className="space-y-2 bg-dark-surface p-4 rounded border border-dark-border">
      <div className="flex justify-between text-sm">
        <span className="text-dark-muted">Creation Date:</span>
        <span className="text-dark-text">
          {value?.creation_date
            ? new Date(value.creation_date * 1000).toLocaleString()
            : 'Not set'}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-dark-muted">Modification Date:</span>
        <span className="text-dark-text">
          {value?.modification_date
            ? new Date(value.modification_date * 1000).toLocaleString()
            : 'Not set'}
        </span>
      </div>
      {value?.packageId && (
        <div className="flex justify-between text-sm pt-2 border-t border-dark-border">
          <span className="text-dark-muted">Package ID:</span>
          <span className="text-dark-text font-mono text-xs">
            {value.packageId.slice(0, 8)}...
          </span>
        </div>
      )}
      <p className="text-xs text-dark-muted mt-2">
        These timestamps are automatically managed.
      </p>
    </div>
  );
}

// ============================================================================
// MAIN FIELD RENDERER
// ============================================================================

export function FieldRenderer({
  definition,
  value,
  onChange,
  tokenCount,
  generating,
  onGenerate,
  onOpenLLMAssist,
  onOpenTemplates,
  error,
  itemTokenCounts,
}: FieldRendererProps) {
  // Render the appropriate field type
  const renderField = () => {
    switch (definition.type) {
      case 'text':
        return (
          <TextField
            definition={definition}
            value={(value as string) || ''}
            onChange={onChange}
          />
        );

      case 'textarea':
        return (
          <TextareaField
            definition={definition}
            value={(value as string) || ''}
            onChange={onChange}
          />
        );

      case 'number':
        return (
          <NumberField
            definition={definition}
            value={(value as number) ?? (definition.defaultValue as number) ?? 0}
            onChange={onChange}
          />
        );

      case 'tags':
        return (
          <TagsField
            definition={definition}
            value={(value as string[]) || []}
            onChange={onChange}
          />
        );

      case 'array':
        return (
          <ArrayField
            definition={definition}
            value={(value as string[]) || []}
            onChange={onChange}
            tokenCounts={itemTokenCounts}
            onOpenLLMAssist={onOpenLLMAssist}
            onOpenTemplates={onOpenTemplates}
          />
        );

      case 'map':
        return (
          <MapField
            definition={definition}
            value={(value as Record<string, string>) || {}}
            onChange={onChange}
          />
        );

      case 'extension':
        return (
          <ExtensionField
            definition={definition}
            value={(value as string) || ''}
            onChange={onChange}
          />
        );

      case 'readonly':
        return <ReadonlyField value={value as ReadonlyFieldProps['value']} />;

      default:
        return <div className="text-red-500">Unknown field type: {definition.type}</div>;
    }
  };

  // Tags field has its own header style, don't duplicate
  const showHeader = definition.type !== 'tags' || definition.aiGenerate;

  return (
    <div className="input-group">
      {showHeader && (
        <FieldHeader
          definition={definition}
          value={value}
          tokenCount={tokenCount}
          generating={generating}
          onGenerate={onGenerate}
          onOpenLLMAssist={onOpenLLMAssist}
          onOpenTemplates={onOpenTemplates}
        />
      )}

      {definition.helpText && definition.type !== 'readonly' && (
        <p className="text-sm text-dark-muted mb-2">{definition.helpText}</p>
      )}

      {renderField()}

      {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
    </div>
  );
}
