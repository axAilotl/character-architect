import type { CCFieldName, FocusField } from '@card-architect/schemas';

interface FieldEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tokenCount?: number;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  fieldName?: CCFieldName;
  onOpenLLMAssist?: (fieldName: CCFieldName, value: string) => void;
  onOpenTemplates?: (fieldName: FocusField, value: string) => void;
  specMarker?: 'v2' | 'v3' | 'v3-only' | 'both';
  helpText?: string;
}

export function FieldEditor({
  label,
  value,
  onChange,
  tokenCount,
  multiline,
  rows = 3,
  placeholder,
  fieldName,
  onOpenLLMAssist,
  onOpenTemplates,
  specMarker,
  helpText,
}: FieldEditorProps) {
  const focusFields: FocusField[] = ['description', 'personality', 'scenario', 'first_mes', 'mes_example', 'system_prompt', 'post_history_instructions', 'creator_notes'];
  const isFocusField = fieldName && focusFields.includes(fieldName as FocusField);

  const getSpecMarkerBadge = () => {
    if (!specMarker || specMarker === 'both') return null;

    const colors = {
      'v2': 'bg-gray-600 text-white',
      'v3': 'bg-blue-600 text-white',
      'v3-only': 'bg-purple-600 text-white',
    };

    const text = {
      'v2': 'V2',
      'v3': 'V3',
      'v3-only': 'V3 Only',
    };

    return (
      <span className={`text-xs px-2 py-0.5 rounded ${colors[specMarker]}`}>
        {text[specMarker]}
      </span>
    );
  };

  return (
    <div className="input-group mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="label">{label}</label>
          {getSpecMarkerBadge()}
        </div>
        <div className="flex items-center gap-2">
          {tokenCount !== undefined && (
            <span className="chip chip-token">{tokenCount} tokens</span>
          )}
          {isFocusField && onOpenTemplates && (
            <button
              onClick={() => onOpenTemplates(fieldName as FocusField, value)}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              title="Templates & Snippets"
            >
              📄 Templates
            </button>
          )}
          {fieldName && onOpenLLMAssist && (
            <button
              onClick={() => onOpenLLMAssist(fieldName, value)}
              className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              title="Open LLM Assist"
            >
              ✨ AI
            </button>
          )}
        </div>
      </div>

      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full"
        />
      )}
      {helpText && (
        <p className="text-sm text-dark-muted mt-2">{helpText}</p>
      )}
    </div>
  );
}
