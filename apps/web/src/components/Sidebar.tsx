import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useCardStore } from '../store/card-store';
import type { Card } from '@card-architect/schemas';

export function Sidebar() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const currentCard = useCardStore((state) => state.currentCard);
  const loadCard = useCardStore((state) => state.loadCard);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setLoading(true);
    const { data } = await api.listCards();
    if (data) {
      setCards(data);
    }
    setLoading(false);
  };

  return (
    <aside className="w-64 bg-dark-surface border-r border-dark-border overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Your Cards</h2>

        {loading ? (
          <div className="text-dark-muted">Loading...</div>
        ) : cards.length === 0 ? (
          <div className="text-dark-muted text-sm">No cards yet</div>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => (
              <button
                key={card.meta.id}
                onClick={() => loadCard(card.meta.id)}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${
                  currentCard?.meta.id === card.meta.id
                    ? 'bg-blue-900 text-blue-100'
                    : 'hover:bg-slate-700'
                }`}
              >
                <div className="font-medium truncate">{card.meta.name}</div>
                <div className="text-xs text-dark-muted">{card.meta.spec.toUpperCase()}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
