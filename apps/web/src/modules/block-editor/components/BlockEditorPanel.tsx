/**
 * BlockEditorPanel
 *
 * Main panel component for the block-based character card editor.
 * Provides a toolbar and hosts the block hierarchy.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useBlockEditorStore } from '../store';
import { BlockComponent } from './BlockComponent';
import { useCardStore } from '../../../store/card-store';
import { V2_FIELDS, type TargetField } from '../types';
import { getCardFields, getInnerData } from '../../../lib/card-type-guards';
import type { CardExtensions } from '../../../lib/extension-types';
import { getVisualDescription, getDepthPrompt, updateVoxtaExtension, updateDepthPrompt } from '../../../lib/extension-types';

export function BlockEditorPanel() {
  const store = useBlockEditorStore();
  const blocks = store.blocks;
  const templates = store.templates;

  const currentCard = useCardStore((s) => s.currentCard);

  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedImportFields, setSelectedImportFields] = useState<Set<TargetField>>(new Set());

  // Track current card ID to clear blocks when switching cards
  const currentCardId = currentCard?.meta.id ?? null;
  const storedCardId = useBlockEditorStore((s) => s.currentCardId);

  useEffect(() => {
    // Only update if the card ID actually changed from what's stored
    if (currentCardId !== storedCardId) {
      store.setCurrentCardId(currentCardId);
    }
  }, [currentCardId, storedCardId, store]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      store.reorderBlocks(null, oldIndex, newIndex);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    store.saveTemplate(templateName.trim());
    setTemplateName('');
    setShowTemplates(false);
  };

  // Get available fields from current card with their content
  const cardFieldContent = useMemo(() => {
    if (!currentCard) return {};

    // Use type-safe accessor to get normalized card fields
    const fields = getCardFields(currentCard);
    const content: Record<string, string> = {};

    // Standard fields
    for (const field of V2_FIELDS) {
      const value = fields[field.value as keyof typeof fields];
      if (value && typeof value === 'string' && value.trim()) {
        content[field.value] = value;
      }
    }

    // Special fields from extensions using typed accessors
    const extensions = (fields.extensions || {}) as CardExtensions;

    // Appearance from voxta or visual_description
    const appearance = getVisualDescription(extensions);
    if (appearance && typeof appearance === 'string') {
      content.appearance = appearance;
    }

    // Character note from depth_prompt
    const charNote = getDepthPrompt(extensions)?.prompt;
    if (charNote && typeof charNote === 'string') {
      content.character_note = charNote;
    }

    return content;
  }, [currentCard]);

  const handleImportFromCard = () => {
    if (selectedImportFields.size === 0) return;

    const fieldsToImport: Record<string, string> = {};
    for (const field of selectedImportFields) {
      if (cardFieldContent[field]) {
        fieldsToImport[field] = cardFieldContent[field];
      }
    }

    store.importFromCard(fieldsToImport);
    setShowImportModal(false);
    setSelectedImportFields(new Set());
  };

  const toggleImportField = (field: TargetField) => {
    const newSet = new Set(selectedImportFields);
    if (newSet.has(field)) {
      newSet.delete(field);
    } else {
      newSet.add(field);
    }
    setSelectedImportFields(newSet);
  };

  const handleApplyToCard = () => {
    if (!currentCard) return;

    // Group blocks by target field
    const fieldContent: Record<string, string[]> = {};

    const processBlock = (block: typeof blocks[0], depth = 0) => {
      const field = block.targetField;
      if (!fieldContent[field]) {
        fieldContent[field] = [];
      }

      // Add heading if block has a label
      if (block.label) {
        const heading = '#'.repeat(Math.min(depth + 1, 6)) + ' ' + block.label;
        fieldContent[field].push(heading);
      }

      // Process babies
      for (const baby of block.babies) {
        if (baby.type === 'text') {
          fieldContent[field].push(baby.content);
        } else if (baby.type === 'flat' || baby.type === 'flat-nested') {
          // Flat list items
          for (const item of baby.items) {
            if (typeof item === 'string') {
              fieldContent[field].push(`- ${item}`);
            } else if ('split' in item) {
              const header = item.bold ? `**${item.header}**` : item.header;
              fieldContent[field].push(`- ${header}: ${item.body}`);
            }
          }

          // Nested groups
          if (baby.type === 'flat-nested' && baby.groups) {
            for (const group of baby.groups) {
              for (const item of group) {
                if (typeof item === 'string') {
                  fieldContent[field].push(`  - ${item}`);
                } else if ('split' in item) {
                  const header = item.bold ? `**${item.header}**` : item.header;
                  fieldContent[field].push(`  - ${header}: ${item.body}`);
                }
              }
            }
          }
        }
      }

      // Process children
      for (const child of block.children) {
        processBlock(child, depth + 1);
      }

      // Add empty line after block
      fieldContent[field].push('');
    };

    for (const block of blocks) {
      processBlock(block);
    }

    // Build updates object
    const fieldUpdates: Record<string, string> = {};
    for (const [field, lines] of Object.entries(fieldContent)) {
      fieldUpdates[field] = lines.join('\n').trim();
    }

    if (Object.keys(fieldUpdates).length > 0) {
      // Separate special fields from regular fields
      const { appearance, character_note, ...regularFields } = fieldUpdates;

      // Get type-safe update functions from store
      const { updateCardFields, updateExtensions } = useCardStore.getState();

      // Handle regular fields using type-safe helper
      if (Object.keys(regularFields).length > 0) {
        updateCardFields(regularFields);
      }

      // Handle appearance specially - stored in extensions
      if (appearance !== undefined) {
        const innerData = getInnerData(currentCard);
        const extensions = (innerData.extensions || {}) as CardExtensions;
        // Use voxta extension if it exists, otherwise visual_description
        if (extensions.voxta) {
          updateExtensions(updateVoxtaExtension(extensions, { appearance }));
        } else {
          updateExtensions({ visual_description: appearance });
        }
      }

      // Handle character_note specially - stored in extensions.depth_prompt.prompt
      if (character_note !== undefined) {
        const innerData = getInnerData(currentCard);
        const extensions = (innerData.extensions || {}) as CardExtensions;
        const currentDepth = getDepthPrompt(extensions);
        updateExtensions(updateDepthPrompt(extensions, {
          prompt: character_note,
          depth: currentDepth?.depth ?? 4,
          role: 'system',
        }));
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 bg-slate-800 border-b border-slate-700">
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium transition-colors hover:bg-indigo-500"
          onClick={() => store.addBlock(null, 1)}
        >
          + Add Block
        </button>

        <div className="flex-1" />

        <button
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium transition-colors hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setShowImportModal(true)}
          disabled={!currentCard || Object.keys(cardFieldContent).length === 0}
          title="Import fields from current card into blocks"
        >
          Import from Card
        </button>

        <button
          className="px-4 py-2 bg-slate-700 text-slate-200 border border-slate-600 rounded-lg font-medium transition-colors hover:bg-slate-600 hover:border-slate-500"
          onClick={() => setShowTemplates(!showTemplates)}
        >
          Templates
        </button>

        <button
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium transition-colors hover:bg-green-500"
          onClick={handleApplyToCard}
          disabled={blocks.length === 0}
          title="Apply block content to character card"
        >
          Apply to Card
        </button>

        <button
          className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/40 rounded-lg font-medium transition-colors hover:bg-red-600 hover:text-white"
          onClick={() => {
            if (confirm('Clear all blocks?')) {
              store.clearBlocks();
            }
          }}
        >
          Clear All
        </button>
      </div>

      {/* Template panel */}
      {showTemplates && (
        <div className="p-4 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="flex-1 px-3 py-2 bg-slate-700 text-slate-200 border border-slate-600 rounded-lg focus:outline-none focus:border-indigo-500"
            />
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || blocks.length === 0}
            >
              Save Template
            </button>
          </div>

          {templates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg"
                >
                  <span className="text-slate-200 text-sm">{template.name}</span>
                  <button
                    className="px-2 py-1 bg-indigo-600 text-white text-xs rounded transition-colors hover:bg-indigo-500"
                    onClick={() => store.loadTemplate(template.id)}
                  >
                    Load
                  </button>
                  <button
                    className="px-2 py-1 bg-red-600/20 text-red-400 text-xs rounded transition-colors hover:bg-red-600 hover:text-white"
                    onClick={() => store.deleteTemplate(template.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {templates.length === 0 && (
            <p className="text-slate-400 text-sm">No saved templates yet.</p>
          )}
        </div>
      )}

      {/* Block list */}
      <div className="flex-1 overflow-auto p-4">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold mb-2">No blocks yet</h3>
            <p className="text-sm mb-4">Click "Add Block" to start building your character card</p>
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium transition-colors hover:bg-indigo-500"
              onClick={() => store.addBlock(null, 1)}
            >
              + Add Your First Block
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-4">
                {blocks.map((block) => (
                  <BlockComponent key={block.id} block={block} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-slate-700 text-sm text-slate-400">
        <span>
          {blocks.length} block{blocks.length !== 1 ? 's' : ''}
        </span>
        <span>Drag blocks and items to reorder</span>
      </div>

      {/* Import from Card Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Import from Card</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedImportFields(new Set());
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-auto flex-1">
              <p className="text-slate-300 text-sm mb-4">
                Select fields to import. Content will be parsed into blocks (headings become block labels, lists become list items, text becomes text blocks).
              </p>

              <div className="space-y-2">
                {Object.entries(cardFieldContent).map(([field, content]) => {
                  const fieldDef = V2_FIELDS.find((f) => f.value === field);
                  const label = fieldDef?.label || field;
                  const preview = content.length > 100 ? content.slice(0, 100) + '...' : content;

                  return (
                    <label
                      key={field}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedImportFields.has(field as TargetField)
                          ? 'bg-cyan-600/20 border border-cyan-500'
                          : 'bg-slate-700/50 border border-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedImportFields.has(field as TargetField)}
                        onChange={() => toggleImportField(field as TargetField)}
                        className="mt-1 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white">{label}</div>
                        <div className="text-xs text-slate-400 truncate">{preview}</div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {Object.keys(cardFieldContent).length === 0 && (
                <p className="text-slate-400 text-center py-8">
                  No content found in current card to import.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-slate-700">
              <button
                onClick={() => {
                  const allFields = new Set(Object.keys(cardFieldContent) as TargetField[]);
                  setSelectedImportFields(
                    selectedImportFields.size === allFields.size ? new Set() : allFields
                  );
                }}
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-white"
              >
                {selectedImportFields.size === Object.keys(cardFieldContent).length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedImportFields(new Set());
                  }}
                  className="px-4 py-2 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportFromCard}
                  disabled={selectedImportFields.size === 0}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-medium transition-colors hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {selectedImportFields.size > 0 ? `(${selectedImportFields.size})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
