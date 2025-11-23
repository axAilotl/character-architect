import { useState, useEffect } from 'react';
import { useCardStore, extractCardData } from '../../store/card-store';
import { api } from '../../lib/api';
import type { Card, CCv3Data } from '@card-architect/schemas';
import { SettingsModal } from '../../components/shared/SettingsModal';

interface CardGridProps {
  onCardClick: (cardId: string) => void;
}

type SortOption = 'added' | 'newest' | 'oldest' | 'name';

export function CardGrid({ onCardClick }: CardGridProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('added');
  const [showImportMenu, setShowImportMenu] = useState(false);
  const { importCard, importCardFromURL, createNewCard } = useCardStore();

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
        setSelectedCards(prev => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to delete card:', error);
      alert('Failed to delete card');
    }
  };

  const toggleSelectCard = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCards.size === cards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(cards.map(c => c.meta.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCards.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedCards.size} card(s)?`)) return;

    const deletePromises = Array.from(selectedCards).map(cardId => api.deleteCard(cardId));

    try {
      const results = await Promise.allSettled(deletePromises);

      const failedDeletes = results
        .map((result, index) => ({ result, cardId: Array.from(selectedCards)[index] }))
        .filter(({ result }) => result.status === 'rejected');

      if (failedDeletes.length > 0) {
        console.error('Some deletes failed:', failedDeletes);
        alert(`${selectedCards.size - failedDeletes.length} cards deleted, ${failedDeletes.length} failed`);
      }

      // Reload cards, clear selection, and exit selection mode
      await loadCards();
      setSelectedCards(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Bulk delete failed');
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedCards(new Set()); // Clear selection when toggling mode
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

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowImportMenu(false);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      // Single file import - use existing store method
      if (files.length === 1) {
        const file = files[0];
        let id = null;
        if (file.name.endsWith('.voxpkg')) {
          id = await useCardStore.getState().importVoxtaPackage(file);
        } else {
          id = await importCard(file);
        }
        
        await loadCards();
        if (id) {
          onCardClick(id);
        }
        e.target.value = '';
        return;
      }

      // Multiple file import
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const response = await fetch('/api/import-multiple', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import cards');
      }

      // Show results
      const { successCount, failCount, results } = result;
      let message = `Import complete: ${successCount} succeeded`;
      if (failCount > 0) {
        message += `, ${failCount} failed`;
        const failures = results.filter((r: any) => !r.success);
        console.error('Failed imports:', failures);
      }

      alert(message);

      // Reload the cards list
      await loadCards();
      e.target.value = '';
    } catch (error) {
      console.error('Failed to import cards:', error);
      alert('Failed to import cards. Check console for details.');
      e.target.value = '';
    }
  };

  const handleImportURL = async () => {
    setShowImportMenu(false);
    const url = prompt('Enter the URL to the character card (PNG, JSON, or CHARX file):');
    if (url && url.trim()) {
      const id = await importCardFromURL(url.trim());
      await loadCards();
      if (id) {
        onCardClick(id);
      }
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
    const data = extractCardData(card);
    return data.name || 'Untitled Card';
  };

  const getCreator = (card: Card) => {
    const data = extractCardData(card);
    return data.creator || null;
  };

  const getCreatorNotes = (card: Card) => {
    const data = extractCardData(card);
    const notes = data.creator_notes || '';
    const lines = notes.split('\n').slice(0, 2).join('\n');
    return lines.length > 150 ? lines.slice(0, 150) + '...' : lines;
  };

  const getTags = (card: Card) => {
    const data = extractCardData(card);
    return data.tags || [];
  };

  const hasAlternateGreetings = (card: Card) => {
    const data = extractCardData(card);
    return (data.alternate_greetings?.length ?? 0) > 0;
  };

  const hasLorebook = (card: Card) => {
    const data = extractCardData(card);
    return (data.character_book?.entries?.length ?? 0) > 0;
  };

  const getLorebookEntryCount = (card: Card) => {
    const data = extractCardData(card);
    return data.character_book?.entries?.length ?? 0;
  };

  const getAlternateGreetingCount = (card: Card) => {
    const data = extractCardData(card);
    return data.alternate_greetings?.length ?? 0;
  };

  const hasAssets = (card: Card) => {
    const isV3 = card.meta.spec === 'v3';
    if (!isV3) return false;
    const data = extractCardData(card) as CCv3Data['data'];
    return (data.assets?.length ?? 0) > 0;
  };

  const getAssetCount = (card: Card) => {
    const isV3 = card.meta.spec === 'v3';
    if (!isV3) return 0;
    const data = extractCardData(card) as CCv3Data['data'];
    return data.assets?.length ?? 0;
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

  const getSortedCards = () => {
    const sorted = [...cards];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.meta.createdAt).getTime() - new Date(b.meta.createdAt).getTime());
      case 'name':
        return sorted.sort((a, b) => {
          const nameA = getCardName(a).toLowerCase();
          const nameB = getCardName(b).toLowerCase();
          return nameA.localeCompare(nameB);
        });
      case 'added':
      default:
        return sorted.sort((a, b) => new Date(b.meta.updatedAt).getTime() - new Date(a.meta.updatedAt).getTime());
    }
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
      <div className="bg-dark-surface border-b border-dark-border">
        {/* Main Row */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Card Architect" className="w-24 h-24" />
            <h1 className="text-2xl font-bold">Card Architect</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="btn-secondary"
              title="Settings"
            >
              ⚙️
            </button>
            <div className="relative">
              <button
                onClick={() => setShowImportMenu(!showImportMenu)}
                className="btn-secondary"
              >
                Import ▾
              </button>
              {showImportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowImportMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 bg-dark-surface border border-dark-border rounded shadow-lg z-50 min-w-[150px]">
                                          <label
                                          htmlFor="import-card-file"
                                          className="block w-full px-4 py-2 text-left hover:bg-slate-700 rounded-t cursor-pointer"
                                          title="Import from local file (JSON, PNG, CHARX, or VOXPKG)"
                                        >
                                          From File                      <input
                        id="import-card-file"
                        name="import-card-file"
                        type="file"
                        accept=".json,.png,.charx,.voxpkg"
                        multiple
                        onChange={handleImportFile}
                        className="hidden"
                        title="Import JSON, PNG, CHARX, or VOXPKG files (select multiple)"
                      />
                    </label>
                    <button
                      onClick={handleImportURL}
                      className="block w-full px-4 py-2 text-left hover:bg-slate-700 rounded-b"
                      title="Import from URL (direct link to PNG, JSON, or CHARX)"
                    >
                      From URL
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={handleNewCard} className="btn-primary">
              New Card
            </button>
          </div>
        </div>

        {/* Selection Row - only show when cards exist */}
        {cards.length > 0 && (
          <div className="px-4 pb-3 flex items-center gap-3 border-t border-dark-border/50 pt-3">
            <button
              onClick={toggleSelectionMode}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                selectionMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-dark-bg hover:bg-dark-border text-dark-text'
              }`}
            >
              {selectionMode ? 'Cancel Selection' : 'Select'}
            </button>

            <div className="h-4 w-px bg-dark-border" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-dark-muted">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-dark-text hover:bg-dark-surface transition-colors cursor-pointer"
              >
                <option value="added">Added</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </select>
            </div>

            {selectionMode && (
              <>
                <div className="h-4 w-px bg-dark-border" />
                <label className="flex items-center gap-2 text-sm text-dark-muted cursor-pointer hover:text-dark-text">
                  <input
                    type="checkbox"
                    checked={selectedCards.size === cards.length && cards.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-dark-border"
                  />
                  Select All ({cards.length})
                </label>
                {selectedCards.size > 0 && (
                  <>
                    <span className="text-sm text-dark-muted">
                      {selectedCards.size} selected
                    </span>
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded text-sm font-medium transition-colors"
                      title={`Delete ${selectedCards.size} card(s)`}
                    >
                      Delete Selected
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
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
            {getSortedCards().map((card) => (
              <div
                key={card.meta.id}
                onClick={() => {
                  if (selectionMode) {
                    toggleSelectCard(card.meta.id, { stopPropagation: () => {} } as any);
                  } else {
                    onCardClick(card.meta.id);
                  }
                }}
                className={`bg-dark-surface border rounded-lg overflow-hidden hover:border-blue-500 transition-colors cursor-pointer flex flex-col ${
                  selectedCards.has(card.meta.id) ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-dark-border'
                }`}
              >
                {/* Image Preview */}
                <div className={`w-full aspect-[2/3] bg-dark-bg relative overflow-hidden ${
                  imageErrors.has(card.meta.id) ? 'flex items-center justify-center' : ''
                }`}>
                  {/* Selection Checkbox - only show in selection mode */}
                  {selectionMode && (
                    <div
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCards.has(card.meta.id)}
                        onChange={(e) => toggleSelectCard(card.meta.id, e as any)}
                        className="w-5 h-5 rounded border-2 border-white bg-dark-bg/80 backdrop-blur cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  {imageErrors.has(card.meta.id) ? (
                    <div className="text-dark-muted text-sm">No Image</div>
                  ) : (
                    <img
                      src={`/api/cards/${card.meta.id}/image`}
                      alt={getCardName(card)}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors(prev => new Set(prev).add(card.meta.id));
                      }}
                    />
                  )}
                </div>

                {/* Card Info */}
                <div className="p-4 flex-1 flex flex-col">
                  {/* Name and Format Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold truncate flex-1">
                      {getCardName(card)}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                        card.meta.spec === 'v3'
                          ? 'bg-emerald-600/20 text-emerald-300'
                          : 'bg-amber-600/20 text-amber-300'
                      }`}
                      title={`Character Card ${card.meta.spec.toUpperCase()} Format`}
                    >
                      {card.meta.spec.toUpperCase()}
                    </span>
                  </div>

                  {/* Creator */}
                  {getCreator(card) && (
                    <p className="text-sm text-dark-muted mb-2">
                      by {getCreator(card)}
                    </p>
                  )}

                  {/* Feature Badges */}
                  {(hasAlternateGreetings(card) || hasLorebook(card) || hasAssets(card)) && (
                    <div className="flex gap-2 mb-2">
                      {hasAssets(card) && (
                        <span
                          className="px-2 py-0.5 bg-cyan-600/20 text-cyan-300 rounded text-xs flex items-center gap-1"
                          title={`CHARX format with ${getAssetCount(card)} asset(s)`}
                        >
                          📦 {getAssetCount(card)}
                        </span>
                      )}
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
