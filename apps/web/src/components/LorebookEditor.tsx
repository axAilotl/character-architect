import { useState } from 'react';
import { useCardStore } from '../store/card-store';
import type { CCv3Data, CCv2Data, CCv3LorebookEntry } from '@card-architect/schemas';

export function LorebookEditor() {
  const { currentCard, updateCardData } = useCardStore();
  const [editingEntry, setEditingEntry] = useState<number | null>(null);

  if (!currentCard) return null;

  const isV3 = currentCard.meta.spec === 'v3';
  const cardData = isV3 ? (currentCard.data as CCv3Data).data : (currentCard.data as CCv2Data);

  // Get lorebook based on card version
  const lorebook = cardData.character_book;
  const entries = lorebook?.entries || [];
  const hasLorebook = Boolean(lorebook);

  const handleInitializeLorebook = () => {
    if (isV3) {
      updateCardData({
        data: {
          ...cardData,
          character_book: {
            name: cardData.name + ' Lorebook',
            description: '',
            entries: [],
          },
        },
      } as Partial<CCv3Data>);
    } else {
      updateCardData({
        character_book: {
          name: cardData.name + ' Lorebook',
          description: '',
          scan_depth: 100,
          token_budget: 500,
          recursive_scanning: false,
          extensions: {},
          entries: [],
        },
      } as Partial<CCv2Data>);
    }
  };

  const handleAddEntry = () => {
    const newEntry: CCv3LorebookEntry = {
      keys: [''],
      content: '',
      enabled: true,
      insertion_order: entries.length,
      priority: 0,
    };

    if (isV3) {
      updateCardData({
        data: {
          ...cardData,
          character_book: {
            ...lorebook,
            entries: [...entries, newEntry],
          },
        },
      } as Partial<CCv3Data>);
    } else {
      updateCardData({
        character_book: {
          ...lorebook,
          entries: [...entries, newEntry],
        },
      } as Partial<CCv2Data>);
    }

    setEditingEntry(entries.length);
  };

  const handleUpdateEntry = (index: number, updates: Partial<CCv3LorebookEntry>) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], ...updates };

    if (isV3) {
      updateCardData({
        data: {
          ...cardData,
          character_book: {
            ...lorebook,
            entries: newEntries,
          },
        },
      } as Partial<CCv3Data>);
    } else {
      updateCardData({
        character_book: {
          ...lorebook,
          entries: newEntries,
        },
      } as Partial<CCv2Data>);
    }
  };

  const handleDeleteEntry = (index: number) => {
    const newEntries = entries.filter((_, i) => i !== index);

    if (isV3) {
      updateCardData({
        data: {
          ...cardData,
          character_book: {
            ...lorebook,
            entries: newEntries,
          },
        },
      } as Partial<CCv3Data>);
    } else {
      updateCardData({
        character_book: {
          ...lorebook,
          entries: newEntries,
        },
      } as Partial<CCv2Data>);
    }

    if (editingEntry === index) {
      setEditingEntry(null);
    }
  };

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">
          Character Book (Lorebook)
          <span className="ml-2 text-sm text-dark-muted font-normal">
            {isV3 ? 'V3' : 'V2'} Format
          </span>
        </h2>
        {hasLorebook ? (
          <button onClick={handleAddEntry} className="btn-primary">
            Add Entry
          </button>
        ) : (
          <button onClick={handleInitializeLorebook} className="btn-primary">
            Initialize Lorebook
          </button>
        )}
      </div>

      {!hasLorebook ? (
        <div className="text-center text-dark-muted py-8">
          <p className="mb-2">This card doesn't have a lorebook yet.</p>
          <p className="text-sm">Click "Initialize Lorebook" to add one.</p>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-dark-muted">No lorebook entries yet. Click "Add Entry" to create one.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div key={index} className="border border-dark-border rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(e) => handleUpdateEntry(index, { enabled: e.target.checked })}
                  />
                  <span className="font-medium">
                    {entry.name || `Entry ${index + 1}`}
                  </span>
                  <span className="text-xs text-dark-muted">
                    [{entry.keys.filter(Boolean).join(', ') || 'No keywords'}]
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingEntry(editingEntry === index ? null : index)}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    {editingEntry === index ? 'Close' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(index)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingEntry === index && (
                <div className="mt-4 space-y-3 border-t border-dark-border pt-3">
                  <div className="input-group">
                    <label className="label">Name</label>
                    <input
                      type="text"
                      value={entry.name || ''}
                      onChange={(e) => handleUpdateEntry(index, { name: e.target.value })}
                      placeholder="Entry name"
                      className="w-full"
                    />
                  </div>

                  <div className="input-group">
                    <label className="label">Keywords (comma-separated)</label>
                    <input
                      type="text"
                      value={entry.keys.join(', ')}
                      onChange={(e) =>
                        handleUpdateEntry(index, {
                          keys: e.target.value.split(',').map((k) => k.trim()),
                        })
                      }
                      placeholder="keyword1, keyword2"
                      className="w-full"
                    />
                  </div>

                  <div className="input-group">
                    <label className="label">Content</label>
                    <textarea
                      value={entry.content}
                      onChange={(e) => handleUpdateEntry(index, { content: e.target.value })}
                      rows={4}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="label">Priority</label>
                      <input
                        type="number"
                        value={entry.priority || 0}
                        onChange={(e) =>
                          handleUpdateEntry(index, { priority: parseInt(e.target.value, 10) })
                        }
                        className="w-full"
                      />
                    </div>

                    <div className="input-group">
                      <label className="label">Insertion Order</label>
                      <input
                        type="number"
                        value={entry.insertion_order}
                        onChange={(e) =>
                          handleUpdateEntry(index, { insertion_order: parseInt(e.target.value, 10) })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="label">Position</label>
                      <select
                        value={entry.position || 'before_char'}
                        onChange={(e) =>
                          handleUpdateEntry(index, {
                            position: e.target.value as 'before_char' | 'after_char',
                          })
                        }
                        className="w-full"
                      >
                        <option value="before_char">Before Character</option>
                        <option value="after_char">After Character</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="label">Probability (%)</label>
                      <input
                        type="number"
                        value={entry.probability || 100}
                        onChange={(e) =>
                          handleUpdateEntry(index, { probability: parseInt(e.target.value, 10) })
                        }
                        min="0"
                        max="100"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={entry.case_sensitive || false}
                        onChange={(e) =>
                          handleUpdateEntry(index, { case_sensitive: e.target.checked })
                        }
                      />
                      <span className="text-sm">Case Sensitive</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={entry.constant || false}
                        onChange={(e) => handleUpdateEntry(index, { constant: e.target.checked })}
                      />
                      <span className="text-sm">Constant</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={entry.selective || false}
                        onChange={(e) =>
                          handleUpdateEntry(index, { selective: e.target.checked })
                        }
                      />
                      <span className="text-sm">Selective</span>
                    </label>
                  </div>

                  {entry.selective && (
                    <>
                      <div className="input-group">
                        <label className="label">Secondary Keywords</label>
                        <input
                          type="text"
                          value={entry.secondary_keys?.join(', ') || ''}
                          onChange={(e) =>
                            handleUpdateEntry(index, {
                              secondary_keys: e.target.value.split(',').map((k) => k.trim()),
                            })
                          }
                          placeholder="secondary1, secondary2"
                          className="w-full"
                        />
                      </div>

                      <div className="input-group">
                        <label className="label">Selective Logic</label>
                        <select
                          value={entry.selective_logic || 'AND'}
                          onChange={(e) =>
                            handleUpdateEntry(index, {
                              selective_logic: e.target.value as 'AND' | 'NOT',
                            })
                          }
                          className="w-full"
                        >
                          <option value="AND">AND (all must match)</option>
                          <option value="NOT">NOT (none must match)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
