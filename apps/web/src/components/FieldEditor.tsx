interface FieldEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tokenCount?: number;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}

export function FieldEditor({
  label,
  value,
  onChange,
  tokenCount,
  multiline,
  rows = 3,
  placeholder,
}: FieldEditorProps) {
  return (
    <div className="input-group mb-4">
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        {tokenCount !== undefined && (
          <span className="chip chip-token">{tokenCount} tokens</span>
        )}
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
