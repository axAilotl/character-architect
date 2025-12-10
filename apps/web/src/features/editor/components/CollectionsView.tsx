/**
 * Collections View
 *
 * Displays member characters in a collection card as a mini card grid.
 * Used in the Assets tab when viewing a Collection card.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDB } from '../../../lib/db';
import { useCardStore } from '../../../store/card-store';
import { api } from '../../../lib/api';
import { deploymentConfig } from '../../../config/deployment';
import type { Card, CollectionData, CollectionMember } from '../../../lib/types';
import { isCollectionData } from '../../../lib/types';

interface CollectionsViewProps {
  collectionCard: Card;
}

const useServerApi = deploymentConfig.mode === 'full';

// Helper to get card by ID based on deployment mode
async function getCard(cardId: string): Promise<Card | null> {
  if (useServerApi) {
    try {
      const result = await api.getCard(cardId);
      return result.data || null;
    } catch {
      return null;
    }
  }
  return localDB.getCard(cardId);
}

// Helper to list all cards based on deployment mode
async function listCards(): Promise<Card[]> {
  if (useServerApi) {
    const result = await api.listCards();
    return result.data || [];
  }
  return localDB.listCards();
}

// Helper to get card image URL based on deployment mode
function getCardImageUrl(cardId: string): string | null {
  if (useServerApi) {
    return api.getCardImageUrl(cardId);
  }
  return null; // Will use localDB.getImage for LITE mode
}

export function CollectionsView({ collectionCard }: CollectionsViewProps) {
  const navigate = useNavigate();
  const [memberCards, setMemberCards] = useState<Array<Card | null>>([]);
  const [memberImages, setMemberImages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [availableCards, setAvailableCards] = useState<Card[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const collectionData = collectionCard.data as CollectionData;

  // Load member cards
  const loadMembers = useCallback(async () => {
    if (!isCollectionData(collectionCard.data)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = collectionCard.data as CollectionData;
      const cards: Array<Card | null> = [];
      const images = new Map<string, string>();

      for (const member of data.members) {
        const card = await getCard(member.cardId);
        cards.push(card);

        if (card) {
          // Get image URL based on mode
          if (useServerApi) {
            const imageUrl = getCardImageUrl(member.cardId);
            if (imageUrl) {
              images.set(member.cardId, imageUrl);
            }
          } else {
            // LITE mode: use IndexedDB
            const thumbnail = await localDB.getImage(member.cardId, 'thumbnail');
            if (thumbnail) {
              images.set(member.cardId, thumbnail);
            } else {
              const icon = await localDB.getImage(member.cardId, 'icon');
              if (icon) {
                images.set(member.cardId, icon);
              }
            }
          }
        }
      }

      setMemberCards(cards);
      setMemberImages(images);
    } catch (error) {
      console.error('[CollectionsView] Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  }, [collectionCard.data]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Load available cards for adding to collection
  const loadAvailableCards = async () => {
    try {
      const allCards = await listCards();
      // Filter out collection cards and cards already in this collection
      const memberIds = new Set(collectionData.members.map(m => m.cardId));
      const available = allCards.filter(card =>
        card.meta.spec !== 'collection' && !memberIds.has(card.meta.id)
      );
      setAvailableCards(available);
    } catch (error) {
      console.error('[CollectionsView] Failed to load available cards:', error);
    }
  };

  const handleOpenAddDialog = async () => {
    await loadAvailableCards();
    setShowAddDialog(true);
  };

  const handleAddCard = async (cardToAdd: Card) => {
    const { updateCardData } = useCardStore.getState();
    const newMember: CollectionMember = {
      cardId: cardToAdd.meta.id,
      name: cardToAdd.meta.name,
      order: collectionData.members.length,
      addedAt: new Date().toISOString(),
    };

    const updatedMembers = [...collectionData.members, newMember];
    updateCardData({
      members: updatedMembers,
    } as Partial<CollectionData>);

    // Update the added card's packageId
    if (useServerApi) {
      // API mode: update via API - need to get full card first
      const result = await api.getCard(cardToAdd.meta.id);
      if (result.data) {
        result.data.meta.packageId = collectionCard.meta.id;
        await api.updateCard(cardToAdd.meta.id, result.data);
      }
    } else {
      // LITE mode: update in IndexedDB
      const existingCard = await localDB.getCard(cardToAdd.meta.id);
      if (existingCard) {
        existingCard.meta.packageId = collectionCard.meta.id;
        await localDB.saveCard(existingCard);
      }
    }

    setShowAddDialog(false);
    await loadMembers();
    await loadAvailableCards();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this character from the collection?')) return;

    const { updateCardData } = useCardStore.getState();
    const updatedMembers = collectionData.members.filter(m => m.cardId !== memberId);

    updateCardData({
      members: updatedMembers,
    } as Partial<CollectionData>);

    // Remove packageId from the removed card
    if (useServerApi) {
      // API mode: update via API - need to get full card first
      const result = await api.getCard(memberId);
      if (result.data) {
        delete result.data.meta.packageId;
        await api.updateCard(memberId, result.data);
      }
    } else {
      // LITE mode: update in IndexedDB
      const removedCard = await localDB.getCard(memberId);
      if (removedCard) {
        delete removedCard.meta.packageId;
        await localDB.saveCard(removedCard);
      }
    }

    await loadMembers();
  };

  const getCardName = (card: Card | null, member: CollectionMember): string => {
    if (card && 'name' in card.meta) {
      return card.meta.name;
    }
    return member.name;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-muted">Loading collection members...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Collection Header */}
      <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">{collectionData.name}</h3>
            {collectionData.description && (
              <p className="text-sm text-dark-muted mt-1">{collectionData.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded font-medium">
              {collectionData.members.length} Characters
            </span>
            {collectionData.scenarios && collectionData.scenarios.length > 0 && (
              <span className="px-2 py-1 bg-green-600/20 text-green-300 text-xs rounded font-medium">
                {collectionData.scenarios.length} Scenarios
              </span>
            )}
            {collectionData.version && (
              <span className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded font-medium">
                v{collectionData.version}
              </span>
            )}
          </div>
        </div>
        {collectionData.creator && (
          <p className="text-xs text-dark-muted">Creator: {collectionData.creator}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleOpenAddDialog}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          + Add Character
        </button>
        <span className="text-sm text-dark-muted">
          Click a character to edit, use the × to remove from collection
        </span>
      </div>

      {/* Scenarios Section */}
      {collectionData.scenarios && collectionData.scenarios.length > 0 && (
        <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
          <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
            <span className="text-green-400">Scenarios</span>
            <span className="text-xs text-dark-muted font-normal">
              ({collectionData.scenarios.length})
            </span>
          </h4>
          <div className="space-y-3">
            {collectionData.scenarios.map((scenario) => {
              // Find member cards that are in this scenario
              const scenarioMembers = collectionData.members.filter(m =>
                m.scenarioIds?.includes(scenario.voxtaScenarioId) ||
                scenario.characterIds.includes(m.voxtaCharacterId || '')
              );

              return (
                <div
                  key={scenario.voxtaScenarioId}
                  className="bg-dark-bg border border-dark-border rounded p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-medium">{scenario.name}</h5>
                      {scenario.description && (
                        <p className="text-sm text-dark-muted mt-1 line-clamp-2">
                          {scenario.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {scenario.explicitContent && (
                        <span className="px-2 py-0.5 bg-red-600/20 text-red-300 text-xs rounded">
                          Explicit
                        </span>
                      )}
                      {scenario.version && (
                        <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 text-xs rounded">
                          v{scenario.version}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Characters in this scenario */}
                  {scenarioMembers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dark-border">
                      <span className="text-xs text-dark-muted">Characters in this scenario:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {scenarioMembers.map((member) => {
                          const card = memberCards[collectionData.members.indexOf(member)];
                          const imageUrl = memberImages.get(member.cardId);
                          return (
                            <button
                              key={member.cardId}
                              onClick={() => navigate(`/cards/${member.cardId}`)}
                              className="flex items-center gap-2 px-2 py-1 bg-dark-surface border border-dark-border rounded hover:border-blue-500 transition-colors"
                              title={`Edit ${member.name}`}
                            >
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={member.name}
                                  className="w-6 h-6 rounded object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded bg-dark-muted flex items-center justify-center text-xs">
                                  ?
                                </div>
                              )}
                              <span className="text-sm">{member.name}</span>
                              {!card && (
                                <span className="text-xs text-red-400">(missing)</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {scenario.creator && (
                    <p className="text-xs text-dark-muted mt-2">
                      Creator: {scenario.creator}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Member Cards Grid */}
      {collectionData.members.length === 0 ? (
        <div className="text-center py-12 text-dark-muted">
          <p className="text-lg mb-2">No characters in this collection</p>
          <p className="text-sm">Click "Add Character" to add existing cards to this collection</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {collectionData.members.map((member, index) => {
            const card = memberCards[index];
            const imageUrl = memberImages.get(member.cardId);

            return (
              <div
                key={member.cardId}
                className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden hover:border-blue-500 transition-colors cursor-pointer group relative"
                onClick={() => navigate(`/cards/${member.cardId}`)}
              >
                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveMember(member.cardId);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-600/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center text-sm"
                  title="Remove from collection"
                >
                  ×
                </button>

                {/* Image */}
                <div className="aspect-[2/3] bg-dark-bg relative overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={getCardName(card, member)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-dark-muted text-sm">
                      No Image
                    </div>
                  )}
                  {/* Missing Card Overlay */}
                  {!card && (
                    <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center">
                      <span className="text-xs text-white bg-red-600 px-2 py-1 rounded">
                        Card Missing
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Info */}
                <div className="p-2">
                  <h4 className="text-sm font-medium truncate" title={getCardName(card, member)}>
                    {getCardName(card, member)}
                  </h4>
                  <p className="text-xs text-dark-muted">
                    #{member.order + 1}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Character Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-surface border border-dark-border rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Character to Collection</h3>
              <button
                onClick={() => setShowAddDialog(false)}
                className="text-dark-muted hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {availableCards.length === 0 ? (
                <div className="text-center py-8 text-dark-muted">
                  <p>No available characters to add</p>
                  <p className="text-sm mt-2">Create new character cards or import them to add to this collection</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {availableCards.map((card) => (
                    <button
                      key={card.meta.id}
                      onClick={() => handleAddCard(card)}
                      className="bg-dark-bg border border-dark-border rounded-lg p-3 hover:border-blue-500 transition-colors text-left"
                    >
                      <h4 className="font-medium truncate">{card.meta.name}</h4>
                      <p className="text-xs text-dark-muted mt-1">
                        {card.meta.spec.toUpperCase()} • {new Date(card.meta.updatedAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
