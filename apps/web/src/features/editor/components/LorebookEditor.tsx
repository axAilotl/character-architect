import { useState } from 'react';
import { useCardStore, extractCardData } from '../../../store/card-store';
import { api } from '../../../lib/api';
import { localDB } from '../../../lib/db';
import { getDeploymentConfig } from '../../../config/deployment';
import { normalizeSpec } from '../../../lib/types';
import { LLMAssistSidebar } from './LLMAssistSidebar';
import {
  addEntry as lorebookAddEntry,
  updateEntry as lorebookUpdateEntry,
  removeEntry as lorebookRemoveEntry,
} from '@character-foundry/character-foundry/lorebook';
import type { CharacterBook } from '@character-foundry/character-foundry/schemas';
import { getLorebookEntryExtensions } from '../../../lib/extension-types';
import type { Card, CCv3LorebookEntry } from '../../../lib/types';

export function LorebookEditor() {
  const { currentCard, updateCardFields } = useCardStore();
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [availableLorebooks, setAvailableLorebooks] = useState<Card[]>([]);
  const [loadingLorebooks, setLoadingLorebooks] = useState(false);

  // LLM Assist state
  const [llmAssistOpen, setLLMAssistOpen] = useState(false);
  const [llmAssistField, setLLMAssistField] = useState<string>('');
  const [llmAssistValue, setLLMAssistValue] = useState('');

  if (!currentCard) return null;

  const cardData = extractCardData(currentCard);

  // Get lorebook based on card version
  const lorebook = cardData.character_book;
  const entries = lorebook?.entries || [];
  const hasLorebook = Boolean(lorebook);

  // Helper to update lorebook - uses type-safe updateCardFields
  const updateLorebookData = (updates: { character_book: Partial<CharacterBook> }) => {
    updateCardFields(updates as { character_book: CharacterBook });
  };

  const handleInitializeLorebook = () => {
    updateLorebookData({
      character_book: {
        name: cardData.name + ' Lorebook',
        description: '',
        scan_depth: 100,
        token_budget: 500,
        recursive_scanning: false,
        extensions: {},
        entries: [],
      },
    });
  };

  const handleAddEntry = () => {
    if (!lorebook) return;

    const updatedBook = lorebookAddEntry(lorebook, {
      keys: [''],
      content: '',
      enabled: true,
      priority: 0,
      depth: 4,
      probability: 100,
      extensions: {
        depth: 4,
        weight: 10,
        probability: 100,
        displayIndex: entries.length + 1,
        useProbability: true,
        excludeRecursion: true,
        addMemo: true,
        characterFilter: null,
      },
    });

    updateLorebookData({
      character_book: updatedBook,
    });

    // Auto-select the new entry
    setSelectedEntryIndex(entries.length);
  };

  const handleUpdateEntry = (index: number, updates: Partial<CCv3LorebookEntry>) => {
    if (!lorebook) return;

    const entry = entries[index];
    const entryId = entry.id ?? index;
    const updatedBook = lorebookUpdateEntry(lorebook, entryId, updates);

    updateLorebookData({
      character_book: updatedBook,
    });
  };

  const handleDeleteEntry = (index: number) => {
    if (!lorebook) return;
    if (!confirm('Delete this lorebook entry?')) return;

    const entry = entries[index];
    const entryId = entry.id ?? index;
    const updatedBook = lorebookRemoveEntry(lorebook, entryId);

    updateLorebookData({
      character_book: updatedBook,
    });

    // Clear selection if deleted entry was selected
    if (selectedEntryIndex === index) {
      setSelectedEntryIndex(null);
    } else if (selectedEntryIndex !== null && selectedEntryIndex > index) {
      setSelectedEntryIndex(selectedEntryIndex - 1);
    }
  };

  const handleCopyEntry = (index: number) => {
    if (!lorebook) return;

    const entryToCopy = entries[index];
    const { id: _id, insertion_order: _order, ...entryData } = entryToCopy;
    const updatedBook = lorebookAddEntry(lorebook, {
      ...entryData,
      name: (entryToCopy.name || `Entry ${index + 1}`) + ' (Copy)',
    });

    updateLorebookData({
      character_book: updatedBook,
    });

    // Select the copied entry
    setSelectedEntryIndex(entries.length);
  };

  const handleUpdateLorebookSettings = (updates: Partial<typeof lorebook>) => {
    updateLorebookData({
      character_book: {
        ...lorebook,
        ...updates,
      },
    });
  };

  // Load available lorebooks for import modal
  const loadAvailableLorebooks = async () => {
    setLoadingLorebooks(true);
    const config = getDeploymentConfig();

    try {
      if (config.mode === 'light' || config.mode === 'static') {
        // Light mode: load from IndexedDB
        const allCards = await localDB.listCards();
        const lorebooks = allCards.filter((card: Card) => card.meta.spec === 'lorebook');
        setAvailableLorebooks(lorebooks);
      } else {
        // Server mode: load from API
        const { data } = await api.listCards();
        if (data?.items) {
          const lorebooks = data.items.filter((card: Card) => card.meta.spec === 'lorebook');
          setAvailableLorebooks(lorebooks);
        }
      }
    } catch (error) {
      console.error('Failed to load lorebooks:', error);
    } finally {
      setLoadingLorebooks(false);
    }
  };

  const handleOpenImportModal = () => {
    setShowImportModal(true);
    loadAvailableLorebooks();
  };

  const handleImportLorebook = (lorebookCard: Card) => {
    const lorebookData = extractCardData(lorebookCard);
    if (lorebookData.character_book) {
      updateLorebookData({
        character_book: { ...lorebookData.character_book },
      });
    }
    setShowImportModal(false);
  };

  // LLM Assist handlers
  const handleOpenLLMAssist = (fieldName: string, value: string) => {
    setLLMAssistField(fieldName);
    setLLMAssistValue(value);
    setLLMAssistOpen(true);
  };

  const handleLLMApply = (newValue: string, action: 'replace' | 'append' | 'insert') => {
    if (llmAssistField === 'lorebook_description') {
      // Handle lorebook-level description
      const currentDesc = lorebook?.description || '';
      const finalValue =
        action === 'replace'
          ? newValue
          : action === 'append'
            ? currentDesc + '\n' + newValue
            : newValue;
      handleUpdateLorebookSettings({ description: finalValue });
    } else if (llmAssistField === 'lore_keys' && selectedEntryIndex !== null) {
      // Parse comma-separated keys for entry
      const keys = newValue
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k);
      handleUpdateEntry(selectedEntryIndex, { keys });
    } else if (llmAssistField === 'lore_content' && selectedEntryIndex !== null) {
      // Handle entry content
      const currentContent = entries[selectedEntryIndex]?.content || '';
      const finalContent =
        action === 'replace'
          ? newValue
          : action === 'append'
            ? currentContent + '\n' + newValue
            : newValue;
      handleUpdateEntry(selectedEntryIndex, { content: finalContent });
    }
    setLLMAssistOpen(false);
  };

  const selectedEntry = selectedEntryIndex !== null ? entries[selectedEntryIndex] : null;
  const entryExt = getLorebookEntryExtensions(selectedEntry?.extensions);

  return (
    <div className="flex flex-col h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto w-full">
        {!hasLorebook ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-dark-muted mb-4">This card doesn't have a lorebook yet.</p>
              <button onClick={handleInitializeLorebook} className="btn-primary">
                Initialize Lorebook
              </button>
              <button onClick={handleOpenImportModal} className="btn-secondary mt-3 ml-3">
                Import Lorebook
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Lorebook Settings */}
            <div className="mb-6 pb-6 border-b border-dark-border space-y-4">
              <h3 className="text-lg font-bold mb-4">Lorebook Settings</h3>

              <div className="input-group">
                <div className="flex items-center justify-between">
                  <label className="label">Description</label>
                  <button
                    onClick={() =>
                      handleOpenLLMAssist('lorebook_description', lorebook?.description || '')
                    }
                    className="text-sm px-1.5 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    title="AI Assist"
                  >
                    ✨
                  </button>
                </div>
                <textarea
                  value={lorebook?.description || ''}
                  onChange={(e) => handleUpdateLorebookSettings({ description: e.target.value })}
                  rows={3}
                  placeholder="Lorebook description"
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="input-group">
                  <label className="label">Scan Depth</label>
                  <input
                    type="number"
                    value={lorebook?.scan_depth ?? 100}
                    onChange={(e) =>
                      handleUpdateLorebookSettings({
                        scan_depth: parseInt(e.target.value, 10) || 100,
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div className="input-group">
                  <label className="label">Token Budget</label>
                  <input
                    type="number"
                    value={lorebook?.token_budget ?? 500}
                    onChange={(e) =>
                      handleUpdateLorebookSettings({
                        token_budget: parseInt(e.target.value, 10) || 500,
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lorebook?.recursive_scanning || false}
                    onChange={(e) =>
                      handleUpdateLorebookSettings({ recursive_scanning: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span>Recursive Scanning</span>
                </label>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="flex-1 flex min-h-0 gap-4">
              {/* Left Sidebar - Entry List */}
              <div className="w-[300px] flex-shrink-0 bg-dark-surface rounded-lg border border-dark-border flex flex-col">
                <div className="p-3 border-b border-dark-border">
                  <button
                    onClick={handleAddEntry}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span>+</span>
                    Add Entry
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {entries.map((entry, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedEntryIndex(index)}
                      className={`p-3 rounded cursor-pointer transition-colors group relative ${
                        selectedEntryIndex === index
                          ? 'bg-blue-600/20 border border-blue-500'
                          : 'bg-dark-bg hover:bg-dark-bg/70 border border-dark-border'
                      }`}
                    >
                      <div className="font-medium text-sm mb-1 pr-16">
                        {entry.name || `Entry ${index + 1}`}
                      </div>
                      <div className="text-xs text-dark-muted">
                        {(entry.keys || []).filter(Boolean).join(', ') || 'No keywords'}
                      </div>

                      {/* Action buttons on hover */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyEntry(index);
                          }}
                          className="p-1 text-xs bg-dark-bg hover:bg-blue-600 rounded"
                          title="Copy"
                        >
                          📋
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEntry(index);
                          }}
                          className="p-1 text-xs bg-dark-bg hover:bg-red-600 rounded"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  {entries.length === 0 && (
                    <div className="text-center text-dark-muted py-8 text-sm">
                      No entries yet.
                      <br />
                      Click "Add Entry" to create one.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel - Entry Form */}
              <div className="flex-1 overflow-y-auto">
                {selectedEntry && selectedEntryIndex !== null ? (
                  <div className="space-y-4">
                    <div className="input-group">
                      <label className="label">Entry Name</label>
                      <input
                        type="text"
                        value={selectedEntry.name || ''}
                        onChange={(e) =>
                          handleUpdateEntry(selectedEntryIndex, { name: e.target.value })
                        }
                        placeholder="Entry name"
                        className="w-full"
                      />
                    </div>

                    <div className="input-group">
                      <div className="flex items-center justify-between">
                        <label className="label">Activation Keys (comma-separated)</label>
                        <button
                          onClick={() =>
                            handleOpenLLMAssist('lore_keys', (selectedEntry.keys || []).join(', '))
                          }
                          className="text-sm px-1.5 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                          title="AI Assist"
                        >
                          ✨
                        </button>
                      </div>
                      <input
                        type="text"
                        value={(selectedEntry.keys || []).join(', ')}
                        onChange={(e) =>
                          handleUpdateEntry(selectedEntryIndex, {
                            keys: e.target.value.split(',').map((k) => k.trim()),
                          })
                        }
                        placeholder="keyword1, keyword2"
                        className="w-full"
                      />
                    </div>

                    <div className="input-group">
                      <label className="label">Secondary Keys (comma-separated)</label>
                      <input
                        type="text"
                        value={selectedEntry.secondary_keys?.join(', ') || ''}
                        onChange={(e) =>
                          handleUpdateEntry(selectedEntryIndex, {
                            secondary_keys: e.target.value.split(',').map((k) => k.trim()),
                          })
                        }
                        placeholder="secondary1, secondary2"
                        className="w-full"
                      />
                    </div>

                    <div className="input-group">
                      <div className="flex items-center justify-between">
                        <label className="label">Content</label>
                        <button
                          onClick={() => handleOpenLLMAssist('lore_content', selectedEntry.content)}
                          className="text-sm px-1.5 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                          title="AI Assist"
                        >
                          ✨
                        </button>
                      </div>
                      <textarea
                        value={selectedEntry.content}
                        onChange={(e) =>
                          handleUpdateEntry(selectedEntryIndex, { content: e.target.value })
                        }
                        rows={12}
                        className="w-full font-mono text-sm"
                        style={{ height: '400px' }}
                      />
                    </div>

                    <div className="input-group">
                      <label className="label">Comment</label>
                      <input
                        type="text"
                        value={selectedEntry.comment || ''}
                        onChange={(e) =>
                          handleUpdateEntry(selectedEntryIndex, { comment: e.target.value })
                        }
                        placeholder="Optional comment"
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="input-group">
                        <label className="label">Priority</label>
                        <input
                          type="number"
                          value={selectedEntry.priority || 0}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              priority: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full"
                        />
                      </div>

                      <div className="input-group">
                        <label className="label">Insertion Order</label>
                        <input
                          type="number"
                          value={selectedEntry.insertion_order ?? 0}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              insertion_order: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="input-group">
                        <label className="label">Depth</label>
                        <input
                          type="number"
                          value={(selectedEntry as CCv3LorebookEntry).depth ?? 4}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              depth: parseInt(e.target.value, 10) || 4,
                            })
                          }
                          className="w-full"
                        />
                      </div>

                      <div className="input-group">
                        <label className="label">Probability (%)</label>
                        <input
                          type="number"
                          value={(selectedEntry as CCv3LorebookEntry).probability ?? 100}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              probability: parseInt(e.target.value, 10) || 100,
                            })
                          }
                          min="0"
                          max="100"
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="input-group">
                        <label className="label">Weight / Group Weight</label>
                        <input
                          type="number"
                          value={entryExt.weight ?? 10}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              extensions: {
                                ...(selectedEntry.extensions || {}),
                                weight: parseInt(e.target.value, 10) || 10,
                              },
                            })
                          }
                          className="w-full"
                        />
                      </div>

                      <div className="input-group">
                        <label className="label">Display Index</label>
                        <input
                          type="number"
                          value={entryExt.displayIndex ?? selectedEntryIndex + 1}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              extensions: {
                                ...(selectedEntry.extensions || {}),
                                displayIndex: parseInt(e.target.value, 10) || 1,
                              },
                            })
                          }
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label className="label">Position</label>
                      <select
                        value={selectedEntry.position || 'before_char'}
                        onChange={(e) =>
                          handleUpdateEntry(selectedEntryIndex, {
                            position: e.target.value as 'before_char' | 'after_char',
                          })
                        }
                        className="w-full"
                      >
                        <option value="">Default</option>
                        <option value="before_char">Before Character</option>
                        <option value="after_char">After Character</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="label">Character Filter</label>
                      <input
                        type="text"
                        value={entryExt.characterFilter || ''}
                        onChange={(e) =>
                          handleUpdateEntry(selectedEntryIndex, {
                            extensions: {
                              ...(selectedEntry.extensions || {}),
                              characterFilter: e.target.value || null,
                            },
                          })
                        }
                        placeholder="Leave empty for all characters"
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEntry.enabled}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, { enabled: e.target.checked })
                          }
                          className="rounded"
                        />
                        <span>Enabled</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEntry.selective || false}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, { selective: e.target.checked })
                          }
                          className="rounded"
                        />
                        <span>Selective (requires secondary keys)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEntry.constant || false}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, { constant: e.target.checked })
                          }
                          className="rounded"
                        />
                        <span>Constant (always active)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEntry.case_sensitive || false}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              case_sensitive: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        <span>Case Sensitive</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entryExt.useProbability ?? true}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              extensions: {
                                ...(selectedEntry.extensions || {}),
                                useProbability: e.target.checked,
                              },
                            })
                          }
                          className="rounded"
                        />
                        <span>Use Probability</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entryExt.excludeRecursion ?? true}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              extensions: {
                                ...(selectedEntry.extensions || {}),
                                excludeRecursion: e.target.checked,
                              },
                            })
                          }
                          className="rounded"
                        />
                        <span>Exclude Recursion</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer col-span-2">
                        <input
                          type="checkbox"
                          checked={entryExt.addMemo ?? true}
                          onChange={(e) =>
                            handleUpdateEntry(selectedEntryIndex, {
                              extensions: {
                                ...(selectedEntry.extensions || {}),
                                addMemo: e.target.checked,
                              },
                            })
                          }
                          className="rounded"
                        />
                        <span>Add Memo (include entry name in content)</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-dark-muted">
                    Select an entry from the list to edit
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Import Lorebook Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg w-[600px] max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-dark-border">
                <h3 className="text-lg font-semibold">Import Lorebook</h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-dark-muted hover:text-dark-text"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {loadingLorebooks ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-dark-muted">Loading lorebooks...</p>
                  </div>
                ) : availableLorebooks.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-dark-muted">
                      No standalone lorebooks found. Create one from the dashboard.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {availableLorebooks.map((lorebook) => {
                      const data = extractCardData(lorebook);
                      const entryCount = data.character_book?.entries?.length || 0;
                      return (
                        <button
                          key={lorebook.meta.id}
                          onClick={() => handleImportLorebook(lorebook)}
                          className="text-left p-3 bg-dark-bg hover:bg-dark-border border border-dark-border rounded-lg transition-colors"
                        >
                          <p className="font-medium truncate">{data.name || lorebook.meta.name}</p>
                          <p className="text-sm text-dark-muted">
                            {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LLM Assist Sidebar */}
      {llmAssistOpen && (
        <LLMAssistSidebar
          isOpen={llmAssistOpen}
          onClose={() => setLLMAssistOpen(false)}
          fieldName={llmAssistField}
          currentValue={llmAssistValue}
          onApply={handleLLMApply}
          cardSpec={normalizeSpec(currentCard.meta.spec)}
        />
      )}
    </div>
  );
}
