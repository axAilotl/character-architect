import { useState, useEffect, useRef } from 'react';
import { useCardStore, extractCardData } from '../../store/card-store';
import { api } from '../../lib/api';
import { localDB } from '../../lib/db';
import { getDeploymentConfig } from '../../config/deployment';
import { importCardClientSide, importVoxtaPackageClientSide } from '../../lib/client-import';
import { exportCard as exportCardClientSide } from '../../lib/client-export';
import type { Card, CCv3Data } from '../../lib/types';
import { SettingsModal } from '../../components/shared/SettingsModal';
import { useFederationStore } from '../../modules/federation/lib/federation-store';
import type { CardSyncState } from '../../modules/federation/lib/types';
import { getExtensions } from '../../lib/card-type-guards';
import { CardItem, CardSkeleton } from './CardItem';
import { registry } from '@character-foundry/character-foundry/tokenizers';

/**
 * Generate a UUID that works in non-secure contexts (HTTP)
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function computeTotalTokens(card: Card): number {
  const tokenizer = registry.get('gpt-4');
  const data = extractCardData(card);

  let total = 0;

  if (data.name) total += tokenizer.count(data.name);
  if (data.description) total += tokenizer.count(data.description);
  if (data.personality) total += tokenizer.count(data.personality);
  if (data.scenario) total += tokenizer.count(data.scenario);
  if (data.first_mes) total += tokenizer.count(data.first_mes);
  if (data.mes_example) total += tokenizer.count(data.mes_example);
  if (data.system_prompt) total += tokenizer.count(data.system_prompt);
  if (data.post_history_instructions) total += tokenizer.count(data.post_history_instructions);

  if (data.alternate_greetings) {
    for (const greeting of data.alternate_greetings) {
      if (greeting) total += tokenizer.count(greeting);
    }
  }

  if (data.character_book?.entries) {
    for (const entry of data.character_book.entries) {
      if (entry.content) total += tokenizer.count(entry.content);
    }
  }

  return total;
}

interface CardGridProps {
  onCardClick: (cardId: string) => void;
}

type SortOption = 'edited' | 'newest' | 'oldest' | 'name';
type FilterOption = 'all' | 'collection' | 'lorebook' | 'voxta' | 'charx' | 'v3' | 'v2';

export function CardGrid({ onCardClick }: CardGridProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [cachedImages, setCachedImages] = useState<Map<string, string>>(new Map());
  const [tokenCounts, setTokenCounts] = useState<Map<string, number>>(new Map());
  const [sortBy, setSortBy] = useState<SortOption>('edited');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState(20);
  const { importCard, createNewCard } = useCardStore();

  // Federation sync states (only for full mode)
  const {
    syncStates,
    initialize: initFederation,
    initialized: federationInitialized,
    pollPlatformSyncState,
    settings: federationSettings,
  } = useFederationStore();
  const [cardSyncMap, setCardSyncMap] = useState<Map<string, CardSyncState>>(new Map());

  const [totalCards, setTotalCards] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    loadCards(debouncedSearch);
  }, [currentPage, cardsPerPage, debouncedSearch]);

  useEffect(() => {
    const counts = new Map<string, number>();
    for (const card of cards) {
      counts.set(card.meta.id, computeTotalTokens(card));
    }
    setTokenCounts(counts);
  }, [cards]);

  // Initialize federation and track sync states (only for full mode)
  useEffect(() => {
    const config = getDeploymentConfig();
    if (config.mode === 'full' && !federationInitialized) {
      initFederation();
    }
  }, [federationInitialized, initFederation]);

  // Poll connected platforms to get actual sync state
  useEffect(() => {
    const config = getDeploymentConfig();
    if (config.mode !== 'full' || !federationInitialized) return;

    // Poll each connected platform
    const pollPlatforms = async () => {
      const platforms = federationSettings?.platforms || {};

      // Poll SillyTavern if connected
      if (platforms.sillytavern?.enabled && platforms.sillytavern?.connected) {
        await pollPlatformSyncState('sillytavern');
      }

      // Poll Character Archive if connected
      if (platforms.archive?.enabled && platforms.archive?.connected) {
        await pollPlatformSyncState('archive');
      }

      // Poll CardsHub if connected
      if (platforms.hub?.enabled && platforms.hub?.connected) {
        await pollPlatformSyncState('hub');
      }
    };

    pollPlatforms();
  }, [federationInitialized, federationSettings, pollPlatformSyncState]);

  // Build a map of cardId -> syncState for quick lookup
  useEffect(() => {
    const map = new Map<string, CardSyncState>();
    for (const state of syncStates) {
      // Map by localId (our local card ID)
      if (state.localId) {
        map.set(state.localId, state);
      }
    }
    setCardSyncMap(map);
  }, [syncStates]);

  const loadCards = async (query: string = '') => {
    setLoading(true);
    try {
      const config = getDeploymentConfig();
      console.log('[CardGrid] Loading cards, mode:', config.mode);

      if (config.mode === 'light' || config.mode === 'static') {
        const localCards = await localDB.listCards();
        console.log('[CardGrid] Found', localCards.length, 'cards in IndexedDB');
        setCards(localCards);
        setTotalCards(localCards.length);

        const images = new Map<string, string>();
        for (const card of localCards) {
          const imageData = await localDB.getImage(card.meta.id, 'thumbnail');
          if (imageData) {
            images.set(card.meta.id, imageData);
          }
        }
        console.log('[CardGrid] Loaded', images.size, 'cached images');
        setCachedImages(images);
      } else {
        const response = await api.listCards(query, currentPage, cardsPerPage);
        if (response.data) {
          // Safety check: ensure items is an array
          setCards(Array.isArray(response.data.items) ? response.data.items : []);
          setTotalCards(response.data.total || 0);
        } else if (response.error) {
          console.error('API error:', response.error);
          setCards([]); // Fallback to empty
        }
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
      setCards([]); // Fallback to empty
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this card?')) return;

    try {
      const config = getDeploymentConfig();

      if (config.mode === 'light' || config.mode === 'static') {
        // Client-side mode: delete from IndexedDB
        await localDB.deleteCard(cardId);
        setCards(cards.filter((c) => c.meta.id !== cardId));
        setSelectedCards((prev) => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
      } else {
        // Server mode: delete via API
        const response = await api.deleteCard(cardId);
        if (response.error) {
          console.error('Failed to delete card:', response.error);
          alert('Failed to delete card: ' + response.error);
        } else {
          setCards(cards.filter((c) => c.meta.id !== cardId));
          setSelectedCards((prev) => {
            const next = new Set(prev);
            next.delete(cardId);
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Failed to delete card:', error);
      alert('Failed to delete card');
    }
  };

  const toggleSelectCard = (cardId: string, e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    setSelectedCards((prev) => {
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
    const filteredCards = getFilteredCards();
    const filteredIds = new Set(filteredCards.map((c) => c.meta.id));
    const allFilteredSelected = filteredCards.every((c) => selectedCards.has(c.meta.id));

    if (allFilteredSelected) {
      // Deselect all filtered cards
      setSelectedCards((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered cards
      setSelectedCards((prev) => new Set([...prev, ...filteredIds]));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCards.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedCards.size} card(s)?`)) return;

    const config = getDeploymentConfig();

    try {
      if (config.mode === 'light' || config.mode === 'static') {
        // Client-side mode: delete from IndexedDB
        const deletePromises = Array.from(selectedCards).map((cardId) =>
          localDB.deleteCard(cardId)
        );
        await Promise.all(deletePromises);
      } else {
        // Server mode: delete via API
        const deletePromises = Array.from(selectedCards).map((cardId) => api.deleteCard(cardId));
        const results = await Promise.allSettled(deletePromises);

        const failedDeletes = results
          .map((result, index) => ({ result, cardId: Array.from(selectedCards)[index] }))
          .filter(({ result }) => result.status === 'rejected');

        if (failedDeletes.length > 0) {
          console.error('Some deletes failed:', failedDeletes);
          alert(
            `${selectedCards.size - failedDeletes.length} cards deleted, ${failedDeletes.length} failed`
          );
        }
      }

      // Reload cards, clear selection, and exit selection mode
      await loadCards(debouncedSearch);
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

  type ExportFormat = 'json' | 'png' | 'charx' | 'voxta';

  const handleExport = async (cardId: string, format: ExportFormat, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const config = getDeploymentConfig();

      if (config.mode === 'light' || config.mode === 'static') {
        const card = cards.find((c) => c.meta.id === cardId);
        if (!card) {
          console.error('Card not found');
          return;
        }
        if (format === 'json' || format === 'png') {
          await exportCardClientSide(card, format);
        } else {
          alert(`${format.toUpperCase()} export requires server mode`);
        }
      } else {
        const response = await fetch(`/api/cards/${cardId}/export?format=${format}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = format === 'voxta' ? 'voxpkg' : format;
        a.download = `card.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export card:', error);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const config = getDeploymentConfig();

    try {
      // Single file import - use existing store method
      if (files.length === 1) {
        const file = files[0];
        let id = null;

        if (file.name.endsWith('.voxpkg')) {
          if (config.mode === 'light' || config.mode === 'static') {
            // Client-side Voxta import
            const buffer = await file.arrayBuffer();
            const results = await importVoxtaPackageClientSide(new Uint8Array(buffer));

            if (results.length === 0) {
              alert('Voxta package contains no characters');
              e.target.value = '';
              return;
            }

            // Import all characters from the package (includes collection card if multi-character)
            for (const result of results) {
              await localDB.saveCard(result.card);
              if (result.fullImageDataUrl) {
                await localDB.saveImage(result.card.meta.id, 'icon', result.fullImageDataUrl);
              }
              if (result.thumbnailDataUrl) {
                await localDB.saveImage(result.card.meta.id, 'thumbnail', result.thumbnailDataUrl);
              }
              // Save assets (including original-package for collections)
              console.log(
                `[CardGrid] Card ${result.card.meta.name} has ${result.assets?.length || 0} assets to save`
              );
              if (result.assets && result.assets.length > 0) {
                for (const asset of result.assets) {
                  console.log(
                    `[CardGrid] Saving asset: ${asset.name}.${asset.ext} (${asset.type}) for card ${result.card.meta.id}`
                  );
                  await localDB.saveAsset({
                    id: generateUUID(),
                    cardId: result.card.meta.id,
                    name: asset.name,
                    type: asset.type as
                      | 'icon'
                      | 'background'
                      | 'emotion'
                      | 'sound'
                      | 'workflow'
                      | 'lorebook'
                      | 'custom'
                      | 'package-original',
                    ext: asset.ext,
                    mimetype: asset.mimetype,
                    size: asset.size,
                    width: asset.width,
                    height: asset.height,
                    data: asset.data,
                    isMain: asset.isMain ?? false,
                    tags: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
              }
            }

            if (results.length > 1) {
              alert(`Imported ${results.length} characters from Voxta package`);
            }

            id = results[0].card.meta.id;
          } else {
            id = await useCardStore.getState().importVoxtaPackage(file);
          }
        } else {
          id = await importCard(file);
        }

        await loadCards(debouncedSearch);
        if (id) {
          onCardClick(id);
        }
        e.target.value = '';
        return;
      }

      if (config.mode === 'light' || config.mode === 'static') {
        // Client-side mode: import each file individually
        let successCount = 0;
        let failCount = 0;
        const failures: Array<{ filename: string; error: string }> = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
            if (file.name.endsWith('.voxpkg')) {
              // Client-side Voxta import for bulk
              const buffer = await file.arrayBuffer();
              const results = await importVoxtaPackageClientSide(new Uint8Array(buffer));

              for (const result of results) {
                await localDB.saveCard(result.card);
                if (result.fullImageDataUrl) {
                  await localDB.saveImage(result.card.meta.id, 'icon', result.fullImageDataUrl);
                }
                if (result.thumbnailDataUrl) {
                  await localDB.saveImage(
                    result.card.meta.id,
                    'thumbnail',
                    result.thumbnailDataUrl
                  );
                }
                // Save assets (including original-package for collections)
                if (result.assets && result.assets.length > 0) {
                  for (const asset of result.assets) {
                    await localDB.saveAsset({
                      id: generateUUID(),
                      cardId: result.card.meta.id,
                      name: asset.name,
                      type: asset.type as
                        | 'icon'
                        | 'background'
                        | 'emotion'
                        | 'sound'
                        | 'workflow'
                        | 'lorebook'
                        | 'custom'
                        | 'package-original',
                      ext: asset.ext,
                      mimetype: asset.mimetype,
                      size: asset.size,
                      width: asset.width,
                      height: asset.height,
                      data: asset.data,
                      isMain: asset.isMain ?? false,
                      tags: [],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    });
                  }
                }
                successCount++;
              }
              continue;
            }

            const result = await importCardClientSide(file);
            await localDB.saveCard(result.card);
            if (result.fullImageDataUrl) {
              await localDB.saveImage(result.card.meta.id, 'icon', result.fullImageDataUrl);
            }
            if (result.thumbnailDataUrl) {
              await localDB.saveImage(result.card.meta.id, 'thumbnail', result.thumbnailDataUrl);
            }
            // Save assets for regular imports too
            if (result.assets && result.assets.length > 0) {
              for (const asset of result.assets) {
                await localDB.saveAsset({
                  id: generateUUID(),
                  cardId: result.card.meta.id,
                  name: asset.name,
                  type: asset.type as
                    | 'icon'
                    | 'background'
                    | 'emotion'
                    | 'sound'
                    | 'workflow'
                    | 'lorebook'
                    | 'custom'
                    | 'package-original',
                  ext: asset.ext,
                  mimetype: asset.mimetype,
                  size: asset.size,
                  width: asset.width,
                  height: asset.height,
                  data: asset.data,
                  isMain: asset.isMain ?? false,
                  tags: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }
            successCount++;
          } catch (err) {
            failures.push({
              filename: file.name,
              error: err instanceof Error ? err.message : String(err),
            });
            failCount++;
          }
        }

        let message = `Import complete: ${successCount} succeeded`;
        if (failCount > 0) {
          message += `, ${failCount} failed`;
          console.group('Failed card imports');
          for (const failure of failures) {
            console.error(`${failure.filename}: ${failure.error}`);
          }
          console.groupEnd();
          const failedNames = failures.map((f) => f.filename).join(', ');
          message += `\n\nFailed files: ${failedNames}\n\nCheck browser console for error details.`;
        }

        alert(message);
        await loadCards(debouncedSearch);
        e.target.value = '';
        return;
      }

      // Server mode: multiple file import via API
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

        // Log each failure with details to console
        console.group('Failed card imports');
        for (const failure of failures) {
          console.error(`${failure.filename}: ${failure.error}`);
        }
        console.groupEnd();

        // Add failed filenames to the alert message
        const failedNames = failures.map((f: any) => f.filename).join(', ');
        message += `\n\nFailed files: ${failedNames}\n\nCheck browser console for error details.`;
      }

      alert(message);

      // Reload the cards list
      await loadCards(debouncedSearch);
      e.target.value = '';
    } catch (error) {
      console.error('Failed to import cards:', error);
      alert('Failed to import cards. Check console for details.');
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
        await loadCards(debouncedSearch);
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

  const getCardImageSrc = (cardId: string) => {
    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      return cachedImages.get(cardId) || null;
    }
    return `/api/cards/${cardId}/thumbnail?size=400`;
  };

  const hasAssets = (card: Card) => {
    if (card.meta.assetCount !== undefined && card.meta.assetCount > 0) {
      return true;
    }
    const isV3 = card.meta.spec === 'v3';
    if (!isV3) return false;
    const data = extractCardData(card) as CCv3Data['data'];
    return (data.assets?.length ?? 0) > 0;
  };

  const getCardType = (card: Card): 'voxta' | 'charx' | 'v3' | 'v2' => {
    if (card.meta.tags?.includes('voxta')) {
      return 'voxta';
    }
    const extensions = getExtensions(card);
    if (extensions.voxta) {
      return 'voxta';
    }
    if (card.meta.tags?.includes('charx') || hasAssets(card)) {
      return 'charx';
    }
    return card.meta.spec === 'v3' ? 'v3' : 'v2';
  };

  const handleImageError = (cardId: string) => {
    setImageErrors((prev) => new Set(prev).add(cardId));
  };

  const getFilteredCards = () => {
    let filtered = cards;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((card) => {
        const name = getCardName(card).toLowerCase();
        return name.includes(query);
      });
    }

    // Apply type filter
    if (filterBy !== 'all') {
      filtered = filtered.filter((card) => {
        if (filterBy === 'collection') return card.meta.spec === 'collection';
        if (filterBy === 'lorebook') return card.meta.spec === 'lorebook';
        const cardType = getCardType(card);
        if (filterBy === 'voxta') return cardType === 'voxta';
        if (filterBy === 'charx') return cardType === 'charx';
        if (filterBy === 'v3') return cardType === 'v3';
        if (filterBy === 'v2') return cardType === 'v2';
        return true;
      });
    }

    return filtered;
  };

  const getSortedCards = () => {
    const filtered = getFilteredCards();
    const sorted = [...(filtered || [])]; // Safety fallback
    switch (sortBy) {
      case 'newest':
        sorted.sort(
          (a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime()
        );
        break;
      case 'oldest':
        sorted.sort(
          (a, b) => new Date(a.meta.createdAt).getTime() - new Date(b.meta.createdAt).getTime()
        );
        break;
      case 'name':
        sorted.sort((a, b) => {
          const nameA = getCardName(a).toLowerCase();
          const nameB = getCardName(b).toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
      case 'edited':
      default:
        sorted.sort(
          (a, b) => new Date(b.meta.updatedAt).getTime() - new Date(a.meta.updatedAt).getTime()
        );
    }
    return sorted;
  };

  // Get paginated cards
  const getPaginatedCards = () => {
    const config = getDeploymentConfig();
    const sorted = getSortedCards();

    // In server mode, we already have paginated data in 'cards'
    if (config.mode !== 'light' && config.mode !== 'static') {
      return sorted;
    }

    // In client mode, we need to slice
    const startIndex = (currentPage - 1) * cardsPerPage;
    return sorted.slice(startIndex, startIndex + cardsPerPage);
  };

  // Calculate total pages
  const config = getDeploymentConfig();
  const isClientMode = config.mode === 'light' || config.mode === 'static';

  let totalPages = 0;
  let totalFilteredCards = 0;

  if (isClientMode) {
    totalFilteredCards = getFilteredCards().length;
    totalPages = Math.ceil(totalFilteredCards / cardsPerPage);
  } else {
    // In server mode, totalCards comes from the API response
    totalFilteredCards = totalCards;
    totalPages = Math.ceil(totalCards / cardsPerPage);
  }

  // Reset to page 1 when filter/search/count changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterBy, cardsPerPage]);

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-dark-bg">
        <div className="bg-dark-surface border-b border-dark-border px-4 py-2 h-[72px] flex items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Character Architect" className="w-12 h-12" />
            <div>
              <h1 className="text-lg font-bold">Character Architect</h1>
              <p className="text-xs text-dark-muted">Loading cards...</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Header */}
      <div className="bg-dark-surface border-b border-dark-border">
        <div className="px-4 py-2 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Character Architect" className="w-12 h-12" />
            <div>
              <h1 className="text-lg font-bold">Character Architect</h1>
              <p className="text-xs text-dark-muted">
                {totalCards} {totalCards === 1 ? 'card' : 'cards'}
                {searchQuery && ` (${totalFilteredCards} matching)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-48 px-3 py-2 pl-8 bg-dark-bg border border-dark-border rounded text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="btn-secondary"
              title="Settings"
            >
              ⚙️
            </button>
            <label
              htmlFor="import-card-file"
              className="btn-primary inline-flex items-center gap-1 cursor-pointer"
              title="Import Character Card or Lorebook (JSON, PNG, CHARX, or VOXPKG)"
            >
              Import
              <input
                id="import-card-file"
                name="import-card-file"
                type="file"
                accept=".json,.png,.charx,.voxpkg"
                multiple
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
            <button onClick={handleNewCard} className="btn-secondary">
              New Card
            </button>
          </div>
        </div>

        {/* Selection Row - only show when cards exist */}
        {cards.length > 0 && (
          <div className="px-4 flex items-center gap-3 border-t border-dark-border/50 h-[84px]">
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
              <span className="text-sm text-dark-muted">Filter:</span>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-dark-text hover:bg-dark-surface transition-colors cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="collection">Collections</option>
                <option value="lorebook">Lorebooks</option>
                <option value="voxta">Voxta</option>
                <option value="charx">CharX</option>
                <option value="v3">V3 (Standard)</option>
                <option value="v2">V2 (Legacy)</option>
              </select>
            </div>

            <div className="h-4 w-px bg-dark-border" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-dark-muted">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-dark-text hover:bg-dark-surface transition-colors cursor-pointer"
              >
                <option value="edited">Last Edited</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </select>
            </div>

            <div className="h-4 w-px bg-dark-border" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-dark-muted">Count:</span>
              <select
                value={cardsPerPage}
                onChange={(e) => setCardsPerPage(Number(e.target.value))}
                className="px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-dark-text hover:bg-dark-surface transition-colors cursor-pointer"
              >
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value={60}>60</option>
                <option value={80}>80</option>
              </select>
            </div>

            {selectionMode && (
              <>
                <div className="h-4 w-px bg-dark-border" />
                <label className="flex items-center gap-2 text-sm text-dark-muted cursor-pointer hover:text-dark-text">
                  <input
                    type="checkbox"
                    checked={
                      getFilteredCards().length > 0 &&
                      getFilteredCards().every((c) => selectedCards.has(c.meta.id))
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-dark-border"
                  />
                  Select All ({getFilteredCards().length}
                  {filterBy !== 'all' ? ` ${filterBy}` : ''})
                </label>
                {selectedCards.size > 0 && (
                  <>
                    <span className="text-sm text-dark-muted">{selectedCards.size} selected</span>
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
        ) : totalFilteredCards === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-dark-muted">
              <h2 className="text-xl font-semibold mb-2">No matching cards</h2>
              <p>
                {searchQuery
                  ? `No cards match "${searchQuery}".`
                  : 'No cards match the current filter.'}
              </p>
              <button
                onClick={() => {
                  setFilterBy('all');
                  setSearchQuery('');
                }}
                className="mt-4 btn-secondary"
              >
                Show All Cards
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {getPaginatedCards().map((card) => (
                <CardItem
                  key={card.meta.id}
                  card={card}
                  cards={cards}
                  cardSyncMap={cardSyncMap}
                  selectionMode={selectionMode}
                  isSelected={selectedCards.has(card.meta.id)}
                  imageSrc={getCardImageSrc(card.meta.id)}
                  hasImageError={imageErrors.has(card.meta.id)}
                  tokenCount={tokenCounts.get(card.meta.id)}
                  onCardClick={onCardClick}
                  onToggleSelect={toggleSelectCard}
                  onExport={handleExport}
                  onDelete={handleDelete}
                  onImageError={handleImageError}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pb-4">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-border transition-colors"
                  title="First page"
                >
                  ««
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-border transition-colors"
                  title="Previous page"
                >
                  «
                </button>
                <span className="px-4 py-1.5 text-sm text-dark-muted">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-border transition-colors"
                  title="Next page"
                >
                  »
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-border transition-colors"
                  title="Last page"
                >
                  »»
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
