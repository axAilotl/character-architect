import { useState, useEffect } from 'react';
import { useCardStore } from '../store/card-store';
import { api } from '../lib/api';
import type { Card, CCv2Data, CCv3Data } from '@card-architect/schemas';
import { SettingsModal } from './SettingsModal';

interface CardGridProps {
  onCardClick: (cardId: string) => void;
}

export function CardGrid({ onCardClick }: CardGridProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const { importCard, createNewCard } = useCardStore();

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setLoading(true);
    try {
      const response = await api.listCards();
      if (response.data) {
        setCards(response.data);
      } else if (response.error) {
        console.error('API error:', response.error);
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this card?')) return;

    try {
      const response = await api.deleteCard(cardId);
      if (response.error) {
        console.error('Failed to delete card:', response.error);
        alert('Failed to delete card: ' + response.error);
      } else {
        setCards(cards.filter((c) => c.meta.id !== cardId));
      }
    } catch (error) {
      console.error('Failed to delete card:', error);
      alert('Failed to delete card');
    }
  };

  const handleExport = async (cardId: string, format: 'json' | 'png', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/cards/${cardId}/export?format=${format}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `card.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export card:', error);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importCard(file);
      // Reload the cards list after successful import
      await loadCards();
      // Reset the input so the same file can be imported again if needed
      e.target.value = '';
    } catch (error) {
      console.error('Failed to import card:', error);
      alert('Failed to import card. Check console for details.');
      e.target.value = '';
    }
  };

  const handleNewCard = async () => {
    try {
      // Create and save the card to get a real ID
      await createNewCard();

      const newCard = useCardStore.getState().currentCard;
      if (newCard?.meta.id) {
        // Reload cards to show the new card in the grid
        await loadCards();
        // Navigate to edit view
        onCardClick(newCard.meta.id);
      } else {
        console.error('New card was not created properly');
        alert('Failed to create new card');
      }
    } catch (error) {
      console.error('Failed to create new card:', error);
      alert('Failed to create new card');
    }
  };

  const getCardName = (card: Card) => {
    const isV3 = card.meta.spec === 'v3';
    const data = isV3 ? (card.data as CCv3Data).data : (card.data as CCv2Data);
    return data.name || 'Untitled Card';
  };

  const getCreatorNotes = (card: Card) => {
    const isV3 = card.meta.spec === 'v3';
    const data = isV3 ? (card.data as CCv3Data).data : (card.data as CCv2Data);
    const notes = data.creator_notes || '';
    const lines = notes.split('\n').slice(0, 2).join('\n');
    return lines.length > 150 ? lines.slice(0, 150) + '...' : lines;
  };

  const getTags = (card: Card) => {
    const isV3 = card.meta.spec === 'v3';
    const data = isV3 ? (card.data as CCv3Data).data : (card.data as CCv2Data);
    return data.tags || [];
  };

  const hasAlternateGreetings = (card: Card) => {
    const isV3 = card.meta.spec === 'v3';
    const data = isV3 ? (card.data as CCv3Data).data : (card.data as CCv2Data);
    return (data.alternate_greetings?.length ?? 0) > 0;
  };

  const hasLorebook = (card: Card) => {
    const isV3 = card.meta.spec === 'v3';
    const data = isV3 ? (card.data as CCv3Data).data : (card.data as CCv2Data);
    return (data.character_book?.entries?.length ?? 0) > 0;
  };

  const getLorebookEntryCount = (card: Card) => {
    const isV3 = card.meta.spec === 'v3';
    const data = isV3 ? (card.data as CCv3Data).data : (card.data as CCv2Data);
    return data.character_book?.entries?.length ?? 0;
  };

  const getAlternateGreetingCount = (card: Card) => {
    const isV3 = card.meta.spec === 'v3';
    const data = isV3 ? (card.data as CCv3Data).data : (card.data as CCv2Data);
    return data.alternate_greetings?.length ?? 0;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-dark-muted">Loading cards...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Header */}
      <div className="bg-dark-surface border-b border-dark-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Card Architect</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="btn-secondary"
              title="Settings"
            >
              ⚙️
            </button>
            <label htmlFor="import-card-file" className="btn-secondary cursor-pointer">
              Import
              <input
                id="import-card-file"
                name="import-card-file"
                type="file"
                accept=".json,.png,.charx"
                onChange={handleImport}
                className="hidden"
                title="Import JSON, PNG, or CHARX file"
              />
            </label>
            <button onClick={handleNewCard} className="btn-primary">
              New Card
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-dark-muted">
              <h2 className="text-xl font-semibold mb-2">No cards yet</h2>
              <p>Create a new card or import one to get started</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cards.map((card) => (
              <div
                key={card.meta.id}
                onClick={() => onCardClick(card.meta.id)}
                className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden hover:border-blue-500 transition-colors cursor-pointer flex flex-col"
              >
                {/* Image Preview */}
                <div className="w-full aspect-[2/3] bg-dark-bg relative overflow-hidden">
                  <img
                    src={`/api/cards/${card.meta.id}/image`}
                    alt={getCardName(card)}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide image on error (no image available)
                      e.currentTarget.style.display = 'none';
                      // Show placeholder
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.classList.add('flex', 'items-center', 'justify-center');
                        parent.innerHTML = '<div class="text-dark-muted text-sm">No Image</div>';
                      }
                    }}
                  />
                </div>

                {/* Card Info */}
                <div className="p-4 flex-1 flex flex-col">
                  {/* Name */}
                  <h3 className="text-lg font-semibold mb-2 truncate">
                    {getCardName(card)}
                  </h3>

                  {/* Feature Badges */}
                  {(hasAlternateGreetings(card) || hasLorebook(card)) && (
                    <div className="flex gap-2 mb-2">
                      {hasAlternateGreetings(card) && (
                        <span
                          className="px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded text-xs flex items-center gap-1"
                          title={`${getAlternateGreetingCount(card)} alternate greeting(s)`}
                        >
                          💬 {getAlternateGreetingCount(card)}
                        </span>
                      )}
                      {hasLorebook(card) && (
                        <span
                          className="px-2 py-0.5 bg-green-600/20 text-green-300 rounded text-xs flex items-center gap-1"
                          title={`${getLorebookEntryCount(card)} lorebook entry/entries`}
                        >
                          📚 {getLorebookEntryCount(card)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {getTags(card).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {getTags(card).slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                      {getTags(card).length > 3 && (
                        <span className="px-2 py-0.5 bg-dark-bg text-dark-muted rounded text-xs">
                          +{getTags(card).length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Creator Notes Preview */}
                  {getCreatorNotes(card) && (
                    <p className="text-sm text-dark-muted mb-3 line-clamp-2 min-h-[2.5rem]">
                      {getCreatorNotes(card)}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-dark-border">
                    <span className="text-xs text-dark-muted">
                      {formatDate(card.meta.updatedAt)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => handleExport(card.meta.id, 'json', e)}
                        className="px-2 py-1 bg-dark-bg hover:bg-dark-border rounded text-xs transition-colors"
                        title="Export JSON"
                      >
                        JSON
                      </button>
                      <button
                        onClick={(e) => handleExport(card.meta.id, 'png', e)}
                        className="px-2 py-1 bg-dark-bg hover:bg-dark-border rounded text-xs transition-colors"
                        title="Export PNG"
                      >
                        PNG
                      </button>
                      <button
                        onClick={(e) => handleDelete(card.meta.id, e)}
                        className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded text-xs transition-colors"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
