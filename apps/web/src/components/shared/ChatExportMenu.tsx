import { useEffect, useRef, useState } from 'react';

interface ChatExportMenuProps {
  onLumiverse?: () => Promise<void>;
  onSillyTavern?: () => Promise<void>;
}

export function ChatExportMenu({ onLumiverse, onSillyTavern }: ChatExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = [
    { label: 'Lumiverse', send: onLumiverse },
    { label: 'SillyTavern', send: onSillyTavern },
  ].filter(option => option.send);

  useEffect(() => {
    if (!open) return;
    container.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const closeOutside = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  async function send(option: typeof options[number]) {
    if (sending) return;
    setOpen(false);
    trigger.current?.focus();
    setSending(true);
    try { await option.send?.(); }
    finally { setSending(false); }
  }

  if (!options.length) return null;
  if (options.length === 1) return (
    <button ref={trigger} type="button" className="btn-secondary whitespace-nowrap" disabled={sending}
      title={`Send to ${options[0].label}`} onClick={() => void send(options[0])}>
      {sending ? 'Sending…' : options[0].label}
    </button>
  );

  return (
    <div ref={container} className="relative" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={event => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) return setOpen(true);
        const items = [...(container.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])];
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    }}>
      <button ref={trigger} type="button" className="btn-secondary" disabled={sending}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {sending ? 'Sending…' : 'Chat Export ▾'}
      </button>
      {open && (
        <div role="menu" aria-label="Chat Export" className="absolute right-0 mt-1 bg-dark-surface border border-dark-border rounded shadow-lg z-50 min-w-[160px]">
          {options.map(option => (
            <button key={option.label} type="button" role="menuitem"
              className="block w-full px-4 py-2 text-left hover:bg-slate-700 focus:bg-slate-700 first:rounded-t last:rounded-b"
              onClick={() => void send(option)}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
