import { useState } from 'react';
import { Dialog } from '../../../components/ui/Dialog';

interface ExpandEditorButtonProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  singleLine?: boolean;
}

/** Edits the same controlled value as the inline field, with no separate draft to lose. */
export function ExpandEditorButton({ label, value, onChange, placeholder, maxLength, singleLine }: ExpandEditorButtonProps) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="field-action" title={`Expand ${label}`} aria-label={`Expand ${label}`} onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6" /></svg>
    </button>
    {open && <Dialog label={`Edit ${label}`} onClose={() => setOpen(false)} className="expanded-editor-dialog">
      <div className="flex items-center justify-between gap-4 p-5 border-b border-dark-border shrink-0">
        <div className="min-w-0"><h2 className="text-lg font-semibold truncate">{label}</h2><p className="text-sm text-dark-muted mt-1">Changes apply to the card as you type.</p></div>
        <button type="button" className="btn-primary" onClick={() => setOpen(false)}>Done</button>
      </div>
      <div className="flex-1 min-h-0 p-4 sm:p-6 flex">
        <textarea data-autofocus aria-label={label} value={value} maxLength={maxLength} placeholder={placeholder}
          className="flex-1 min-h-0 w-full resize-none leading-relaxed expanded-editor-text"
          onChange={event => onChange(singleLine ? event.target.value.replace(/[\r\n]/g, '') : event.target.value)} />
      </div>
      <div className="px-6 pb-4 text-xs text-dark-muted flex justify-between shrink-0"><span>Escape to return to the card</span><span>{value.length.toLocaleString()} characters{maxLength ? ` / ${maxLength}` : ''}</span></div>
    </Dialog>}
  </>;
}
