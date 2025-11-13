import type { CCFieldName } from '@card-architect/schemas';

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
}: FieldEditorProps) {
  return (
    <div className="input-group mb-4">
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        <div className="flex items-center gap-2">
          {tokenCount !== undefined && (
            <span className="chip chip-token">{tokenCount} tokens</span>
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
    </div>
  );
}
