import { useState } from 'react';
import { useCardStore, extractCardData } from '../store/card-store';
import type {
  CCv3LorebookEntry,
} from '@card-architect/schemas';

export function LorebookEditor() {
  const { currentCard, updateCardData } = useCardStore();
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(null);

  if (!currentCard) return null;

  const isV3 = currentCard.meta.spec === 'v3';
  const cardData = extractCardData(currentCard);

  // Get lorebook based on card version
  const lorebook = cardData.character_book;
  const entries = lorebook?.entries || [];
  const hasLorebook = Boolean(lorebook);

  // Helper to update card data - handles wrapped V2 automatically
  const updateLorebookData = (updates: any) => {
    const v2Data = currentCard.data as any;
    const isWrappedV2 = !isV3 && v2Data.spec === 'chara_card_v2' && 'data' in v2Data;

    if (isV3 || isWrappedV2) {
      // Wrapped cards - update nested data object
      updateCardData({
        data: {
          ...cardData,
          ...updates,
        },
      } as any);
    } else {
      // Unwrapped legacy V2
      updateCardData(updates);
    }
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
    const newEntry: CCv3LorebookEntry = {
      keys: [''],
      content: '',
      enabled: true,
      insertion_order: entries.length,
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
    };

    updateLorebookData({
      character_book: {
        ...lorebook,
        entries: [...entries, newEntry],
      },
    });

    // Auto-select the new entry
    setSelectedEntryIndex(entries.length);
  };

  const handleUpdateEntry = (index: number, updates: Partial<CCv3LorebookEntry>) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], ...updates };

    updateLorebookData({
      character_book: {
        ...lorebook,
        entries: newEntries,
      },
    });
  };

  const handleDeleteEntry = (index: number) => {
    if (!confirm('Delete this lorebook entry?')) return;

    const newEntries = entries.filter((_, i) => i !== index);

    updateLorebookData({
      character_book: {
        ...lorebook,
        entries: newEntries,
      },
    });

    // Clear selection if deleted entry was selected
    if (selectedEntryIndex === index) {
      setSelectedEntryIndex(null);
    } else if (selectedEntryIndex !== null && selectedEntryIndex > index) {
      setSelectedEntryIndex(selectedEntryIndex - 1);
    }
  };

  const handleCopyEntry = (index: number) => {
    const entryToCopy = entries[index];
    const copiedEntry: CCv3LorebookEntry = {
      ...entryToCopy,
      name: (entryToCopy.name || `Entry ${index + 1}`) + ' (Copy)',
    };

    updateLorebookData({
      character_book: {
        ...lorebook,
        entries: [...entries, copiedEntry],
      },
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

  const selectedEntry = selectedEntryIndex !== null ? entries[selectedEntryIndex] : null;

  return (
    <div className="flex flex-col h-full">
      {!hasLorebook ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-dark-muted mb-4">This card doesn't have a lorebook yet.</p>
            <button onClick={handleInitializeLorebook} className="btn-primary">
              Initialize Lorebook
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Lorebook Settings */}
          <div className="mb-6 pb-6 border-b border-dark-border space-y-4">
            <h3 className="text-lg font-bold mb-4">Lorebook Settings</h3>

            <div className="input-group">
              <label className="label">Description</label>
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
                    handleUpdateLorebookSettings({ scan_depth: parseInt(e.target.value, 10) || 100 })
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
                    handleUpdateLorebookSettings({ token_budget: parseInt(e.target.value, 10) || 500 })
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
                      {entry.keys.filter(Boolean).join(', ') || 'No keywords'}
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
                    No entries yet.<br />Click "Add Entry" to create one.
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
                      onChange={(e) => handleUpdateEntry(selectedEntryIndex, { name: e.target.value })}
                      placeholder="Entry name"
                      className="w-full"
                    />
                  </div>

                  <div className="input-group">
                    <label className="label">Activation Keys (comma-separated)</label>
                    <input
                      type="text"
                      value={selectedEntry.keys.join(', ')}
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
                    <label className="label">Content</label>
                    <textarea
                      value={selectedEntry.content}
                      onChange={(e) => handleUpdateEntry(selectedEntryIndex, { content: e.target.value })}
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
                      onChange={(e) => handleUpdateEntry(selectedEntryIndex, { comment: e.target.value })}
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
                          handleUpdateEntry(selectedEntryIndex, { priority: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full"
                      />
                    </div>

                    <div className="input-group">
                      <label className="label">Insertion Order</label>
                      <input
                        type="number"
                        value={selectedEntry.insertion_order}
                        onChange={(e) =>
                          handleUpdateEntry(selectedEntryIndex, { insertion_order: parseInt(e.target.value, 10) || 0 })
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
                          handleUpdateEntry(selectedEntryIndex, { depth: parseInt(e.target.value, 10) || 4 })
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
                        value={(selectedEntry.extensions as any)?.weight ?? 10}
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
                        value={(selectedEntry.extensions as any)?.displayIndex ?? selectedEntryIndex + 1}
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
                      value={(selectedEntry.extensions as any)?.characterFilter || ''}
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
                          handleUpdateEntry(selectedEntryIndex, { case_sensitive: e.target.checked })
                        }
                        className="rounded"
                      />
                      <span>Case Sensitive</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(selectedEntry.extensions as any)?.useProbability ?? true}
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
                        checked={(selectedEntry.extensions as any)?.excludeRecursion ?? true}
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
                        checked={(selectedEntry.extensions as any)?.addMemo ?? true}
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
    </div>
  );
}
