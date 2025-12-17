import { useState, useEffect } from 'react';
import { useCardStore, extractCardData } from '../../store/card-store';
import { api } from '../../lib/api';
import { localDB } from '../../lib/db';
import { getDeploymentConfig } from '../../config/deployment';
import { importCardClientSide, importVoxtaPackageClientSide } from '../../lib/client-import';
import { exportCard as exportCardClientSide } from '../../lib/client-export';
import type { Card, CollectionData } from '../../lib/types';
import type { CCv3Data } from '../../lib/types';
import { SettingsModal } from '../../components/shared/SettingsModal';
import { useFederationStore } from '../../modules/federation/lib/federation-store';
import type { CardSyncState } from '../../modules/federation/lib/types';
import { getExtensions, isCollectionData } from '../../lib/card-type-guards';

/**
 * Generate a UUID that works in non-secure contexts (HTTP)
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
  const [sortBy, setSortBy] = useState<SortOption>('edited');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState(20);
  const { importCard, createNewCard, createNewLorebook } = useCardStore();

  // Federation sync states (only for full mode)
  const { syncStates, initialize: initFederation, initialized: federationInitialized, pollPlatformSyncState, settings: federationSettings } = useFederationStore();
  const [cardSyncMap, setCardSyncMap] = useState<Map<string, CardSyncState>>(new Map());

  const [totalCards, setTotalCards] = useState(0);

  useEffect(() => {
    loadCards();
  }, [currentPage, cardsPerPage, searchQuery]);

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

  const loadCards = async () => {
    setLoading(true);
    try {
      const config = getDeploymentConfig();
      console.log('[CardGrid] Loading cards, mode:', config.mode);

      // Client-side mode: load from IndexedDB
      if (config.mode === 'light' || config.mode === 'static') {
        const localCards = await localDB.listCards();
        console.log('[CardGrid] Found', localCards.length, 'cards in IndexedDB');
        setCards(localCards);
        setTotalCards(localCards.length);

        // Load cached images for each card
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
        // Server mode: load from API
        const response = await api.listCards(searchQuery, currentPage, cardsPerPage);
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
        setSelectedCards(prev => {
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
          setSelectedCards(prev => {
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
    const filteredCards = getFilteredCards();
    const filteredIds = new Set(filteredCards.map(c => c.meta.id));
    const allFilteredSelected = filteredCards.every(c => selectedCards.has(c.meta.id));

    if (allFilteredSelected) {
      // Deselect all filtered cards
      setSelectedCards(prev => {
        const next = new Set(prev);
        filteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered cards
      setSelectedCards(prev => new Set([...prev, ...filteredIds]));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCards.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedCards.size} card(s)?`)) return;

    const config = getDeploymentConfig();

    try {
      if (config.mode === 'light' || config.mode === 'static') {
        // Client-side mode: delete from IndexedDB
        const deletePromises = Array.from(selectedCards).map(cardId => localDB.deleteCard(cardId));
        await Promise.all(deletePromises);
      } else {
        // Server mode: delete via API
        const deletePromises = Array.from(selectedCards).map(cardId => api.deleteCard(cardId));
        const results = await Promise.allSettled(deletePromises);

        const failedDeletes = results
          .map((result, index) => ({ result, cardId: Array.from(selectedCards)[index] }))
          .filter(({ result }) => result.status === 'rejected');

        if (failedDeletes.length > 0) {
          console.error('Some deletes failed:', failedDeletes);
          alert(`${selectedCards.size - failedDeletes.length} cards deleted, ${failedDeletes.length} failed`);
        }
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
      const config = getDeploymentConfig();

      if (config.mode === 'light' || config.mode === 'static') {
        // Client-side mode: export from IndexedDB
        const card = cards.find(c => c.meta.id === cardId);
        if (!card) {
          console.error('Card not found');
          return;
        }
        await exportCardClientSide(card, format);
      } else {
        // Server mode: export via API
        const response = await fetch(`/api/cards/${cardId}/export?format=${format}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `card.${format}`;
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
              console.log(`[CardGrid] Card ${result.card.meta.name} has ${result.assets?.length || 0} assets to save`);
              if (result.assets && result.assets.length > 0) {
                for (const asset of result.assets) {
                  console.log(`[CardGrid] Saving asset: ${asset.name}.${asset.ext} (${asset.type}) for card ${result.card.meta.id}`);
                  await localDB.saveAsset({
                    id: generateUUID(),
                    cardId: result.card.meta.id,
                    name: asset.name,
                    type: asset.type as 'icon' | 'background' | 'emotion' | 'sound' | 'workflow' | 'lorebook' | 'custom' | 'package-original',
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

        await loadCards();
        if (id) {
          onCardClick(id);
        }
        e.target.value = '';
        return;
      }

      // Multiple file import
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
                  await localDB.saveImage(result.card.meta.id, 'thumbnail', result.thumbnailDataUrl);
                }
                // Save assets (including original-package for collections)
                if (result.assets && result.assets.length > 0) {
                  for (const asset of result.assets) {
                    await localDB.saveAsset({
                      id: generateUUID(),
                      cardId: result.card.meta.id,
                      name: asset.name,
                      type: asset.type as 'icon' | 'background' | 'emotion' | 'sound' | 'workflow' | 'lorebook' | 'custom' | 'package-original',
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
                  type: asset.type as 'icon' | 'background' | 'emotion' | 'sound' | 'workflow' | 'lorebook' | 'custom' | 'package-original',
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
          const failedNames = failures.map(f => f.filename).join(', ');
          message += `\n\nFailed files: ${failedNames}\n\nCheck browser console for error details.`;
        }

        alert(message);
        await loadCards();
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
      await loadCards();
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

  const handleNewLorebook = async () => {
    try {
      // Create and save the lorebook to get a real ID
      await createNewLorebook();

      const newCard = useCardStore.getState().currentCard;
      if (newCard?.meta.id) {
        // Reload cards to show the new lorebook in the grid
        await loadCards();
        // Navigate to edit view
        onCardClick(newCard.meta.id);
      } else {
        console.error('New lorebook was not created properly');
        alert('Failed to create new lorebook');
      }
    } catch (error) {
      console.error('Failed to create new lorebook:', error);
      alert('Failed to create new lorebook');
    }
  };

  const getCardName = (card: Card) => {
    const data = extractCardData(card);
    return data.name || 'Untitled Card';
  };

  const getCardImageSrc = (cardId: string) => {
    const config = getDeploymentConfig();
    if (config.mode === 'light' || config.mode === 'static') {
      // Use cached image from IndexedDB
      return cachedImages.get(cardId) || null;
    }
    // Use server API
    return `/api/cards/${cardId}/thumbnail?size=400`;
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

  // Feature checks
  const hasAlternateGreetings = (card: Card) => {
    const data = extractCardData(card);
    return data.alternate_greetings && data.alternate_greetings.length > 0;
  };

  const hasLorebook = (card: Card) => {
    const data = extractCardData(card);
    return data.character_book && data.character_book.entries && data.character_book.entries.length > 0;
  };

  const getLorebookEntryCount = (card: Card) => {
    const data = extractCardData(card);
    return data.character_book?.entries?.length || 0;
  };

  const getAlternateGreetingCount = (card: Card) => {
    const data = extractCardData(card);
    return data.alternate_greetings?.length || 0;
  };

  const hasAssets = (card: Card) => {
    // Check meta.assetCount (from database) first, then fall back to data.assets for V3
    if (card.meta.assetCount !== undefined && card.meta.assetCount > 0) {
      return true;
    }
    const isV3 = card.meta.spec === 'v3';
    if (!isV3) return false;
    const data = extractCardData(card) as CCv3Data['data'];
    return (data.assets?.length ?? 0) > 0;
  };

  const getAssetCount = (card: Card) => {
    // Check meta.assetCount (from database) first, then fall back to data.assets for V3
    if (card.meta.assetCount !== undefined && card.meta.assetCount > 0) {
      return card.meta.assetCount;
    }
    const isV3 = card.meta.spec === 'v3';
    if (!isV3) return 0;
    const data = extractCardData(card) as CCv3Data['data'];
    return data.assets?.length ?? 0;
  };

  // Check if card is a member of a collection
  const isCollectionItem = (cardId: string): boolean => {
    return cards.some(c => {
      if (c.meta.spec !== 'collection') return false;
      if (!isCollectionData(c.data)) return false;
      const data = c.data as CollectionData;
      return data.members?.some((m) => m.cardId === cardId);
    });
  };

  // Check if card is synced to SillyTavern
  const isSyncedToST = (cardId: string): boolean => {
    const syncState = cardSyncMap.get(cardId);
    return !!syncState?.platformIds.sillytavern;
  };

  // Check if card is synced to Character Archive
  const isSyncedToAR = (cardId: string): boolean => {
    const syncState = cardSyncMap.get(cardId);
    return !!syncState?.platformIds.archive;
  };

  // Check if card is synced to CardsHub
  const isSyncedToHub = (cardId: string): boolean => {
    const syncState = cardSyncMap.get(cardId);
    return !!syncState?.platformIds.hub;
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

  const getCardType = (card: Card): 'voxta' | 'charx' | 'v3' | 'v2' => {
    // Check for Voxta first (has voxta tag or voxta extension)
    if (card.meta.tags?.includes('voxta')) {
      return 'voxta';
    }
    const extensions = getExtensions(card);
    if (extensions.voxta) {
      return 'voxta';
    }

    // Check for CharX (has charx tag or has assets without being voxta)
    if (card.meta.tags?.includes('charx') || hasAssets(card)) {
      return 'charx';
    }

    // Otherwise, return spec version
    return card.meta.spec === 'v3' ? 'v3' : 'v2';
  };

  const getFilteredCards = () => {
    let filtered = cards;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(card => {
        const name = getCardName(card).toLowerCase();
        return name.includes(query);
      });
    }

    // Apply type filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(card => {
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
        sorted.sort((a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.meta.createdAt).getTime() - new Date(b.meta.createdAt).getTime());
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
        sorted.sort((a, b) => new Date(b.meta.updatedAt).getTime() - new Date(a.meta.updatedAt).getTime());
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
            <img src="/logo.png" alt="Character Architect" className="w-24 h-24" />
            <div>
              <h1 className="text-2xl font-bold">Character Architect</h1>
              <p className="text-sm text-dark-muted">
                {totalCards} {totalCards === 1 ? 'card' : 'cards'}
                {searchQuery && ` (${totalFilteredCards} matching search)`}
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
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
              className="btn-secondary inline-flex items-center cursor-pointer"
              title="Import from local file (JSON, PNG, CHARX, or VOXPKG)"
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
                title="Import JSON, PNG, CHARX, or VOXPKG files (select multiple)"
              />
            </label>
            <button onClick={handleNewCard} className="btn-primary">
              New Card
            </button>
            <button onClick={handleNewLorebook} className="btn-secondary">
              Add Lorebook
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
                    checked={getFilteredCards().length > 0 && getFilteredCards().every(c => selectedCards.has(c.meta.id))}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-dark-border"
                  />
                  Select All ({getFilteredCards().length}{filterBy !== 'all' ? ` ${filterBy}` : ''})
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
                onClick={() => { setFilterBy('all'); setSearchQuery(''); }}
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
              <div
                key={card.meta.id}
                onClick={() => {
                  if (selectionMode) {
                    toggleSelectCard(card.meta.id);
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
                        onChange={() => toggleSelectCard(card.meta.id)}
                        className="w-5 h-5 rounded border-2 border-white bg-dark-bg/80 backdrop-blur cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  {imageErrors.has(card.meta.id) || !getCardImageSrc(card.meta.id) ? (
                    <div className="text-dark-muted text-sm">No Image</div>
                  ) : (
                    <img
                      src={getCardImageSrc(card.meta.id)!}
                      alt={getCardName(card)}
                      className="w-full h-full object-cover"
                      loading="lazy"
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
                    <div className="flex gap-1 flex-shrink-0">
                      {/* Federation Sync Badges (only in full mode) */}
                      {getDeploymentConfig().mode === 'full' && isSyncedToST(card.meta.id) && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-600/20 text-orange-300" title="Synced to SillyTavern">
                          ST
                        </span>
                      )}
                      {getDeploymentConfig().mode === 'full' && isSyncedToAR(card.meta.id) && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-pink-600/20 text-pink-300" title="Synced to Character Archive">
                          AR
                        </span>
                      )}
                      {getDeploymentConfig().mode === 'full' && isSyncedToHub(card.meta.id) && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-violet-600/20 text-violet-300" title="Synced to CardsHub">
                          HUB
                        </span>
                      )}
                      {/* Collection Item Badge */}
                      {isCollectionItem(card.meta.id) && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-600/20 text-purple-300" title="Member of a Collection">
                          CI
                        </span>
                      )}
                      {/* Voxta Badge */}
                      {card.meta.tags?.includes('voxta') && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-600/20 text-indigo-300" title="Imported from Voxta Package">
                          VOXTA
                        </span>
                      )}
                      {/* CharX Badge */}
                      {(card.meta.tags?.includes('charx') || (hasAssets(card) && !card.meta.tags?.includes('voxta'))) && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-cyan-600/20 text-cyan-300" title="Imported from CHARX">
                          CHARX
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          card.meta.spec === 'collection'
                            ? 'bg-purple-600/20 text-purple-300'
                            : card.meta.spec === 'v3'
                            ? 'bg-emerald-600/20 text-emerald-300'
                            : 'bg-amber-600/20 text-amber-300'
                        }`}
                        title={card.meta.spec === 'collection' ? 'Voxta Collection' : `Character Card ${card.meta.spec.toUpperCase()} Format`}
                      >
                        {card.meta.spec === 'collection' ? 'COLLECTION' : card.meta.spec.toUpperCase()}
                      </span>
                    </div>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/cards/${card.meta.id}`, '_blank');
                        }}
                        className="px-2 py-1 bg-dark-bg hover:bg-dark-border rounded text-xs transition-colors"
                        title="Open in new tab"
                      >
                        ↗
                      </button>
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
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
