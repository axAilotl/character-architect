import { useCardStore } from '../../store/card-store';
import { useState } from 'react';

export function JsonPanel() {
  const currentCard = useCardStore((state) => state.currentCard);
  const [copied, setCopied] = useState(false);

  if (!currentCard) return null;

  const json = JSON.stringify(currentCard.data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-dark-surface border-b border-dark-border flex justify-between items-center">
        <h3 className="font-semibold">JSON View</h3>
        <button onClick={handleCopy} className="btn-secondary">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <pre className="bg-dark-surface p-4 rounded text-sm whitespace-pre-wrap break-words">
          <code>{json}</code>
        </pre>
      </div>
    </div>
  );
}
