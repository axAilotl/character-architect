/**
 * Block Editor Store
 *
 * Zustand store for managing block-based character card editing.
 * Adapted from Beast Box CharacterContext.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Block,
  Baby,
  FlatListBaby,
  FlatNestedListBaby,
  NestedListBaby,
  BlockTemplate,
  TargetField,
  ListItem,
} from './types';

interface BlockEditorStore {
  // State
  blocks: Block[];
  templates: BlockTemplate[];
  specVersion: 'v2' | 'v3';
  currentCardId: string | null;
  // Per-card block storage
  cardBlocks: Record<string, Block[]>;

  // Import from card
  importFromCard: (fieldContent: Record<string, string>) => void;

  // Card tracking
  setCurrentCardId: (cardId: string | null) => void;

  // Block CRUD
  addBlock: (parentId: string | null, level?: number) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  moveBlock: (sourceId: string, targetId: string) => void;
  reorderBlocks: (parentId: string | null, fromIndex: number, toIndex: number) => void;

  // Baby CRUD
  addBaby: (blockId: string, type: 'text' | 'flat') => void;
  updateBaby: (blockId: string, babyId: string, updates: Partial<Baby>) => void;
  removeBaby: (blockId: string, babyId: string) => void;
  reorderBabies: (blockId: string, fromIndex: number, toIndex: number) => void;
  convertBabyToNested: (blockId: string, babyId: string) => void;

  // List operations
  addListItem: (blockId: string, babyId: string) => void;
  updateListItem: (blockId: string, babyId: string, index: number, value: string) => void;
  removeListItem: (blockId: string, babyId: string, index: number) => void;
  splitListItem: (blockId: string, babyId: string, index: number) => void;
  unsplitListItem: (blockId: string, babyId: string, index: number) => void;
  toggleListItemBold: (blockId: string, babyId: string, index: number) => void;
  updateListItemHeader: (blockId: string, babyId: string, index: number, value: string) => void;
  updateListItemBody: (blockId: string, babyId: string, index: number, value: string) => void;
  moveListItem: (blockId: string, babyId: string, fromIndex: number, toIndex: number) => void;
  promoteToNested: (blockId: string, babyId: string, index: number) => void;
  demoteToFlat: (blockId: string, babyId: string, groupIndex: number, itemIndex: number) => void;

  // Nested group operations
  addNestedGroup: (blockId: string, babyId: string) => void;
  addNestedItem: (blockId: string, babyId: string, groupIndex: number) => void;
  removeNestedGroup: (blockId: string, babyId: string, groupIndex: number) => void;
  removeNestedItem: (blockId: string, babyId: string, groupIndex: number, itemIndex: number) => void;
  updateNestedItem: (
    blockId: string,
    babyId: string,
    groupIndex: number,
    itemIndex: number,
    value: string
  ) => void;
  splitNestedItem: (blockId: string, babyId: string, groupIndex: number, itemIndex: number) => void;
  unsplitNestedItem: (
    blockId: string,
    babyId: string,
    groupIndex: number,
    itemIndex: number
  ) => void;
  toggleNestedItemBold: (
    blockId: string,
    babyId: string,
    groupIndex: number,
    itemIndex: number
  ) => void;
  updateNestedItemHeader: (
    blockId: string,
    babyId: string,
    groupIndex: number,
    itemIndex: number,
    value: string
  ) => void;
  updateNestedItemBody: (
    blockId: string,
    babyId: string,
    groupIndex: number,
    itemIndex: number,
    value: string
  ) => void;

  // Template operations
  saveTemplate: (name: string, description?: string) => void;
  loadTemplate: (templateId: string) => void;
  deleteTemplate: (templateId: string) => void;

  // Utility
  setSpecVersion: (version: 'v2' | 'v3') => void;
  clearBlocks: () => void;
  setBlocks: (blocks: Block[]) => void;
}

// Helper to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to find a block by ID recursively
const findBlock = (blocks: Block[], id: string): Block | null => {
  for (const block of blocks) {
    if (block.id === id) return block;
    const found = findBlock(block.children, id);
    if (found) return found;
  }
  return null;
};

// Helper to find parent block
const findParentBlock = (blocks: Block[], targetId: string): Block | null => {
  for (const block of blocks) {
    if (block.children.some((c) => c.id === targetId)) return block;
    const found = findParentBlock(block.children, targetId);
    if (found) return found;
  }
  return null;
};

// Helper to update a block recursively
const updateBlockRecursive = (
  blocks: Block[],
  id: string,
  updates: Partial<Block>
): Block[] => {
  return blocks.map((block) => {
    if (block.id === id) {
      return { ...block, ...updates };
    }
    return {
      ...block,
      children: updateBlockRecursive(block.children, id, updates),
    };
  });
};

// Helper to delete a block recursively
const deleteBlockRecursive = (blocks: Block[], id: string): Block[] => {
  return blocks
    .filter((block) => block.id !== id)
    .map((block) => ({
      ...block,
      children: deleteBlockRecursive(block.children, id),
    }));
};

// Helper to update a baby within a block
const updateBabyInBlock = (
  blocks: Block[],
  blockId: string,
  babyId: string,
  updater: (baby: Baby) => Baby
): Block[] => {
  return blocks.map((block) => {
    if (block.id === blockId) {
      return {
        ...block,
        babies: block.babies.map((baby) =>
          baby.id === babyId ? updater(baby) : baby
        ),
      };
    }
    return {
      ...block,
      children: updateBabyInBlock(block.children, blockId, babyId, updater),
    };
  });
};

// Array move helper
const arrayMove = <T>(array: T[], from: number, to: number): T[] => {
  const newArray = [...array];
  const [item] = newArray.splice(from, 1);
  newArray.splice(to, 0, item);
  return newArray;
};

// Parse markdown content into blocks
const parseMarkdownToBlocks = (
  content: string,
  targetField: TargetField
): Block[] => {
  const blocks: Block[] = [];
  const lines = content.split('\n');

  let currentBlock: Block | null = null;
  let currentTextContent: string[] = [];
  let currentListItems: ListItem[] = [];
  let inList = false;

  const flushText = () => {
    if (currentTextContent.length > 0 && currentBlock) {
      const text = currentTextContent.join('\n').trim();
      if (text) {
        currentBlock.babies.push({
          id: generateId(),
          type: 'text',
          content: text,
        });
      }
      currentTextContent = [];
    }
  };

  const flushList = () => {
    if (currentListItems.length > 0 && currentBlock) {
      currentBlock.babies.push({
        id: generateId(),
        type: 'flat',
        items: currentListItems,
      });
      currentListItems = [];
    }
    inList = false;
  };

  const ensureBlock = (label = '') => {
    if (!currentBlock) {
      currentBlock = {
        id: generateId(),
        label,
        targetField,
        collapsed: false,
        babies: [],
        children: [],
        level: 1,
      };
      blocks.push(currentBlock);
    }
  };

  for (const line of lines) {
    // Check for headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Flush any pending content
      flushList();
      flushText();

      // Start a new block with the heading as label
      currentBlock = {
        id: generateId(),
        label: headingMatch[2].trim(),
        targetField,
        collapsed: false,
        babies: [],
        children: [],
        level: headingMatch[1].length,
      };
      blocks.push(currentBlock);
      continue;
    }

    // Check for list items (- or * or numbered)
    const listMatch = line.match(/^(\s*)[-*]\s+(.+)$/) || line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (listMatch) {
      ensureBlock();

      // If we were collecting text, flush it first
      if (!inList) {
        flushText();
      }
      inList = true;

      const itemContent = listMatch[2].trim();

      // Check for "Header: Body" pattern (split item)
      const splitMatch = itemContent.match(/^\*\*(.+?)\*\*:\s*(.+)$/) ||
                         itemContent.match(/^(.+?):\s+(.+)$/);
      if (splitMatch && splitMatch[1].length < 50) {
        // Looks like a split item
        const isBold = itemContent.startsWith('**');
        currentListItems.push({
          header: splitMatch[1].replace(/\*\*/g, ''),
          body: splitMatch[2],
          bold: isBold,
          split: true,
        });
      } else {
        currentListItems.push(itemContent);
      }
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      if (inList) {
        flushList();
      }
      // Keep empty lines in text for paragraph breaks
      if (currentTextContent.length > 0) {
        currentTextContent.push('');
      }
      continue;
    }

    // Regular text
    ensureBlock();
    if (inList) {
      flushList();
    }
    currentTextContent.push(line);
  }

  // Flush any remaining content
  flushList();
  flushText();

  // If no blocks were created but there was content, create one
  if (blocks.length === 0 && content.trim()) {
    blocks.push({
      id: generateId(),
      label: '',
      targetField,
      collapsed: false,
      babies: [{
        id: generateId(),
        type: 'text',
        content: content.trim(),
      }],
      children: [],
      level: 1,
    });
  }

  return blocks;
};

export const useBlockEditorStore = create<BlockEditorStore>()(
  persist(
    (set, get) => ({
      blocks: [],
      templates: [],
      specVersion: 'v2',
      currentCardId: null,
      cardBlocks: {},

  // Card tracking - saves current blocks and loads blocks for new card
  setCurrentCardId: (cardId) => {
    const { currentCardId: oldCardId, blocks, cardBlocks } = get();

    if (cardId === oldCardId) {
      return; // No change
    }

    // Save current blocks to the old card (if any)
    const updatedCardBlocks = { ...cardBlocks };
    if (oldCardId !== null) {
      updatedCardBlocks[oldCardId] = blocks;
    }

    // Load blocks for the new card (or empty array if none)
    const newBlocks = cardId ? (updatedCardBlocks[cardId] || []) : [];

    set({
      currentCardId: cardId,
      blocks: newBlocks,
      cardBlocks: updatedCardBlocks,
    });
  },

  // Import from card - parses markdown content into blocks
  importFromCard: (fieldContent) => {
    const allBlocks: Block[] = [];

    for (const [field, content] of Object.entries(fieldContent)) {
      if (!content || !content.trim()) continue;

      const parsedBlocks = parseMarkdownToBlocks(content, field as TargetField);
      allBlocks.push(...parsedBlocks);
    }

    if (allBlocks.length > 0) {
      set((state) => ({
        blocks: [...state.blocks, ...allBlocks],
      }));
    }
  },

  // Block CRUD
  addBlock: (parentId, level = 1) => {
    const newBlock: Block = {
      id: generateId(),
      label: '',
      targetField: 'description',
      collapsed: false,
      babies: [],
      children: [],
      level,
    };

    set((state) => {
      if (!parentId) {
        return { blocks: [...state.blocks, newBlock] };
      }

      const addChildToBlock = (blocks: Block[]): Block[] => {
        return blocks.map((block) => {
          if (block.id === parentId) {
            return {
              ...block,
              children: [...block.children, { ...newBlock, level: block.level + 1 }],
            };
          }
          return {
            ...block,
            children: addChildToBlock(block.children),
          };
        });
      };

      return { blocks: addChildToBlock(state.blocks) };
    });
  },

  updateBlock: (id, updates) => {
    set((state) => ({
      blocks: updateBlockRecursive(state.blocks, id, updates),
    }));
  },

  deleteBlock: (id) => {
    set((state) => ({
      blocks: deleteBlockRecursive(state.blocks, id),
    }));
  },

  moveBlock: (sourceId, targetId) => {
    set((state) => {
      const sourceBlock = findBlock(state.blocks, sourceId);
      if (!sourceBlock) return state;

      // Remove from original location
      let newBlocks = deleteBlockRecursive(state.blocks, sourceId);

      // Add to target
      const addToTarget = (blocks: Block[]): Block[] => {
        return blocks.map((block) => {
          if (block.id === targetId) {
            return {
              ...block,
              children: [...block.children, { ...sourceBlock, level: block.level + 1 }],
            };
          }
          return {
            ...block,
            children: addToTarget(block.children),
          };
        });
      };

      return { blocks: addToTarget(newBlocks) };
    });
  },

  reorderBlocks: (parentId, fromIndex, toIndex) => {
    set((state) => {
      if (!parentId) {
        return { blocks: arrayMove(state.blocks, fromIndex, toIndex) };
      }

      const reorderInBlock = (blocks: Block[]): Block[] => {
        return blocks.map((block) => {
          if (block.id === parentId) {
            return {
              ...block,
              children: arrayMove(block.children, fromIndex, toIndex),
            };
          }
          return {
            ...block,
            children: reorderInBlock(block.children),
          };
        });
      };

      return { blocks: reorderInBlock(state.blocks) };
    });
  },

  // Baby CRUD
  addBaby: (blockId, type) => {
    const newBaby: Baby =
      type === 'text'
        ? { id: generateId(), type: 'text', content: '' }
        : { id: generateId(), type: 'flat', items: [''] };

    set((state) => ({
      blocks: updateBlockRecursive(state.blocks, blockId, {
        babies: [...(findBlock(state.blocks, blockId)?.babies || []), newBaby],
      }),
    }));
  },

  updateBaby: (blockId, babyId, updates) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => ({
        ...baby,
        ...updates,
      } as Baby)),
    }));
  },

  removeBaby: (blockId, babyId) => {
    set((state) => ({
      blocks: updateBlockRecursive(state.blocks, blockId, {
        babies: findBlock(state.blocks, blockId)?.babies.filter((b) => b.id !== babyId) || [],
      }),
    }));
  },

  reorderBabies: (blockId, fromIndex, toIndex) => {
    set((state) => {
      const block = findBlock(state.blocks, blockId);
      if (!block) return state;
      return {
        blocks: updateBlockRecursive(state.blocks, blockId, {
          babies: arrayMove(block.babies, fromIndex, toIndex),
        }),
      };
    });
  },

  convertBabyToNested: (blockId, babyId) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat') return baby;
        return {
          id: baby.id,
          type: 'flat-nested',
          items: baby.items,
          groups: [['']],
        } as FlatNestedListBaby;
      }),
    }));
  },

  // List operations
  addListItem: (blockId, babyId) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat' && baby.type !== 'flat-nested') return baby;
        return { ...baby, items: [...baby.items, ''] } as FlatListBaby | FlatNestedListBaby;
      }),
    }));
  },

  updateListItem: (blockId, babyId, index, value) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat' && baby.type !== 'flat-nested') return baby;
        const newItems = [...baby.items];
        newItems[index] = value;
        return { ...baby, items: newItems } as FlatListBaby | FlatNestedListBaby;
      }),
    }));
  },

  removeListItem: (blockId, babyId, index) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat' && baby.type !== 'flat-nested') return baby;
        return {
          ...baby,
          items: baby.items.filter((_, i) => i !== index),
        } as FlatListBaby | FlatNestedListBaby;
      }),
    }));
  },

  splitListItem: (blockId, babyId, index) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat' && baby.type !== 'flat-nested') return baby;
        const newItems = [...baby.items];
        const currentItem = newItems[index];
        const content = typeof currentItem === 'string' ? currentItem : '';
        newItems[index] = { header: '', body: content, bold: false, split: true };
        return { ...baby, items: newItems } as FlatListBaby | FlatNestedListBaby;
      }),
    }));
  },

  unsplitListItem: (blockId, babyId, index) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat' && baby.type !== 'flat-nested') return baby;
        const newItems = [...baby.items];
        const item = newItems[index];
        if (typeof item === 'object' && 'split' in item) {
          const merged =
            item.header && item.body
              ? `${item.header}: ${item.body}`
              : item.header || item.body || '';
          newItems[index] = merged;
        }
        return { ...baby, items: newItems } as FlatListBaby | FlatNestedListBaby;
      }),
    }));
  },

  toggleListItemBold: (blockId, babyId, index) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat' && baby.type !== 'flat-nested') return baby;
        const newItems = [...baby.items];
        const item = newItems[index];
        if (typeof item === 'object' && 'split' in item) {
          newItems[index] = { ...item, bold: !item.bold };
        }
        return { ...baby, items: newItems } as FlatListBaby | FlatNestedListBaby;
      }),
    }));
  },

  updateListItemHeader: (blockId, babyId, index, value) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat' && baby.type !== 'flat-nested') return baby;
        const newItems = [...baby.items];
        const item = newItems[index];
        if (typeof item === 'object' && 'split' in item) {
          newItems[index] = { ...item, header: value };
        }
        return { ...baby, items: newItems } as FlatListBaby | FlatNestedListBaby;
      }),
    }));
  },

  updateListItemBody: (blockId, babyId, index, value) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat' && baby.type !== 'flat-nested') return baby;
        const newItems = [...baby.items];
        const item = newItems[index];
        if (typeof item === 'object' && 'split' in item) {
          newItems[index] = { ...item, body: value };
        }
        return { ...baby, items: newItems } as FlatListBaby | FlatNestedListBaby;
      }),
    }));
  },

  moveListItem: (blockId, babyId, fromIndex, toIndex) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat' && baby.type !== 'flat-nested') return baby;
        return {
          ...baby,
          items: arrayMove(baby.items, fromIndex, toIndex),
        } as FlatListBaby | FlatNestedListBaby;
      }),
    }));
  },

  promoteToNested: (blockId, babyId, index) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested') return baby;
        const newItems = [...baby.items];
        const item = newItems.splice(index, 1)[0];
        const itemValue =
          typeof item === 'string'
            ? item
            : item.header && item.body
              ? `${item.header}: ${item.body}`
              : item.header || item.body || '';
        const newGroups = [...(baby.groups || []), [itemValue]];
        return { ...baby, items: newItems, groups: newGroups };
      }),
    }));
  },

  demoteToFlat: (blockId, babyId, groupIndex, itemIndex) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested') return baby;
        const newGroups = [...baby.groups];
        const item = newGroups[groupIndex][itemIndex];
        newGroups[groupIndex].splice(itemIndex, 1);
        if (newGroups[groupIndex].length === 0) {
          newGroups.splice(groupIndex, 1);
        }
        const itemValue =
          typeof item === 'string'
            ? item
            : typeof item === 'object' && 'header' in item
              ? item.header && item.body
                ? `${item.header}: ${item.body}`
                : item.header || item.body || ''
              : '';
        return { ...baby, items: [...baby.items, itemValue], groups: newGroups };
      }),
    }));
  },

  // Nested group operations
  addNestedGroup: (blockId, babyId) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        return { ...baby, groups: [...baby.groups, ['']] } as
          | FlatNestedListBaby
          | NestedListBaby;
      }),
    }));
  },

  addNestedItem: (blockId, babyId, groupIndex) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        const newGroups = [...baby.groups];
        newGroups[groupIndex] = [...newGroups[groupIndex], ''];
        return { ...baby, groups: newGroups } as FlatNestedListBaby | NestedListBaby;
      }),
    }));
  },

  removeNestedGroup: (blockId, babyId, groupIndex) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        return {
          ...baby,
          groups: baby.groups.filter((_, i) => i !== groupIndex),
        } as FlatNestedListBaby | NestedListBaby;
      }),
    }));
  },

  removeNestedItem: (blockId, babyId, groupIndex, itemIndex) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        const newGroups = [...baby.groups];
        newGroups[groupIndex] = newGroups[groupIndex].filter((_, i) => i !== itemIndex);
        if (newGroups[groupIndex].length === 0) {
          newGroups.splice(groupIndex, 1);
        }
        return { ...baby, groups: newGroups } as FlatNestedListBaby | NestedListBaby;
      }),
    }));
  },

  updateNestedItem: (blockId, babyId, groupIndex, itemIndex, value) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        const newGroups = [...baby.groups];
        newGroups[groupIndex] = [...newGroups[groupIndex]];
        newGroups[groupIndex][itemIndex] = value;
        return { ...baby, groups: newGroups } as FlatNestedListBaby | NestedListBaby;
      }),
    }));
  },

  splitNestedItem: (blockId, babyId, groupIndex, itemIndex) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        const newGroups = [...baby.groups];
        newGroups[groupIndex] = [...newGroups[groupIndex]];
        const currentItem = newGroups[groupIndex][itemIndex];
        const content = typeof currentItem === 'string' ? currentItem : '';
        newGroups[groupIndex][itemIndex] = { header: '', body: content, bold: false, split: true };
        return { ...baby, groups: newGroups } as FlatNestedListBaby | NestedListBaby;
      }),
    }));
  },

  unsplitNestedItem: (blockId, babyId, groupIndex, itemIndex) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        const newGroups = [...baby.groups];
        newGroups[groupIndex] = [...newGroups[groupIndex]];
        const item = newGroups[groupIndex][itemIndex];
        if (typeof item === 'object' && 'split' in item) {
          const merged =
            item.header && item.body
              ? `${item.header}: ${item.body}`
              : item.header || item.body || '';
          newGroups[groupIndex][itemIndex] = merged;
        }
        return { ...baby, groups: newGroups } as FlatNestedListBaby | NestedListBaby;
      }),
    }));
  },

  toggleNestedItemBold: (blockId, babyId, groupIndex, itemIndex) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        const newGroups = [...baby.groups];
        newGroups[groupIndex] = [...newGroups[groupIndex]];
        const item = newGroups[groupIndex][itemIndex];
        if (typeof item === 'object' && 'split' in item) {
          newGroups[groupIndex][itemIndex] = { ...item, bold: !item.bold };
        }
        return { ...baby, groups: newGroups } as FlatNestedListBaby | NestedListBaby;
      }),
    }));
  },

  updateNestedItemHeader: (blockId, babyId, groupIndex, itemIndex, value) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        const newGroups = [...baby.groups];
        newGroups[groupIndex] = [...newGroups[groupIndex]];
        const item = newGroups[groupIndex][itemIndex];
        if (typeof item === 'object' && 'split' in item) {
          newGroups[groupIndex][itemIndex] = { ...item, header: value };
        }
        return { ...baby, groups: newGroups } as FlatNestedListBaby | NestedListBaby;
      }),
    }));
  },

  updateNestedItemBody: (blockId, babyId, groupIndex, itemIndex, value) => {
    set((state) => ({
      blocks: updateBabyInBlock(state.blocks, blockId, babyId, (baby) => {
        if (baby.type !== 'flat-nested' && baby.type !== 'nested') return baby;
        const newGroups = [...baby.groups];
        newGroups[groupIndex] = [...newGroups[groupIndex]];
        const item = newGroups[groupIndex][itemIndex];
        if (typeof item === 'object' && 'split' in item) {
          newGroups[groupIndex][itemIndex] = { ...item, body: value };
        }
        return { ...baby, groups: newGroups } as FlatNestedListBaby | NestedListBaby;
      }),
    }));
  },

  // Template operations
  saveTemplate: (name, description) => {
    const template: BlockTemplate = {
      id: generateId(),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blocks: JSON.parse(JSON.stringify(get().blocks)),
    };

    set((state) => ({
      templates: [...state.templates, template],
    }));
  },

  loadTemplate: (templateId) => {
    const template = get().templates.find((t) => t.id === templateId);
    if (template) {
      set({ blocks: JSON.parse(JSON.stringify(template.blocks)) });
    }
  },

  deleteTemplate: (templateId) => {
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== templateId),
    }));
  },

  // Utility
  setSpecVersion: (version) => set({ specVersion: version }),
  clearBlocks: () => set({ blocks: [] }),
  setBlocks: (blocks) => set({ blocks }),
    }),
    {
      name: 'card-architect-block-editor',
      partialize: (state) => {
        // When persisting, save current blocks to cardBlocks
        const cardBlocks = { ...state.cardBlocks };
        if (state.currentCardId) {
          cardBlocks[state.currentCardId] = state.blocks;
        }
        return {
          templates: state.templates,
          specVersion: state.specVersion,
          currentCardId: state.currentCardId,
          cardBlocks,
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<BlockEditorStore>;
        // When loading, restore blocks for current card from cardBlocks
        const cardBlocks = persisted.cardBlocks || {};
        const currentCardId = persisted.currentCardId || null;
        const blocks = currentCardId ? (cardBlocks[currentCardId] || []) : [];
        return {
          ...currentState,
          ...persisted,
          blocks,
          cardBlocks,
        };
      },
    }
  )
);
