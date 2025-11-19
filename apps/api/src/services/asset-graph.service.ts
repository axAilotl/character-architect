/**
 * Asset Graph Service
 * Provides helper methods for working with card assets as an in-memory graph
 */

import type {
  AssetNode,
  AssetMetadata,
  AssetTag,
  AssetValidationError,
  CardAssetWithDetails,
} from '@card-architect/schemas';
import { parseActorIndex, hasTag, addTag, removeTag } from '@card-architect/schemas';
import { CardAssetRepository } from '../db/repository.js';

export class AssetGraphService {
  constructor(private cardAssetRepo: CardAssetRepository) {}

  /**
   * Build in-memory asset graph from database
   */
  async buildGraph(cardId: string): Promise<AssetNode[]> {
    const cardAssets = this.cardAssetRepo.listByCardWithDetails(cardId);

    return cardAssets.map((ca) => this.toAssetNode(ca));
  }

  /**
   * Convert CardAssetWithDetails to AssetNode
   */
  private toAssetNode(cardAsset: CardAssetWithDetails): AssetNode {
    const tags = (cardAsset.tags || []) as AssetTag[];
    const actorIndex = parseActorIndex(tags);
    const isAnimated = tags.includes('animated');

    const metadata: AssetMetadata = {
      type: cardAsset.type as any,
      tags,
      actorIndex,
      isAnimated,
      order: cardAsset.order,
      format: cardAsset.ext,
    };

    return {
      id: cardAsset.id,
      cardId: cardAsset.cardId,
      assetId: cardAsset.assetId,
      name: cardAsset.name,
      metadata,
      url: cardAsset.asset.url,
      mimetype: cardAsset.asset.mimetype,
      size: cardAsset.asset.size,
      width: cardAsset.asset.width,
      height: cardAsset.asset.height,
      isMain: cardAsset.isMain,
    };
  }

  /**
   * Get main portrait for a card
   * Returns the asset tagged as portrait-override, or the main icon asset
   */
  getMainPortrait(graph: AssetNode[]): AssetNode | null {
    // First, look for portrait-override tag
    const portraitOverride = graph.find((node) =>
      hasTag(node.metadata, 'portrait-override')
    );
    if (portraitOverride) return portraitOverride;

    // Fallback to main icon
    const mainIcon = graph.find(
      (node) => node.metadata.type === 'icon' && node.isMain
    );
    if (mainIcon) return mainIcon;

    // Fallback to first icon
    const firstIcon = graph.find((node) => node.metadata.type === 'icon');
    return firstIcon || null;
  }

  /**
   * List all expressions for a specific actor
   */
  listExpressions(graph: AssetNode[], actorIndex: number): AssetNode[] {
    return graph
      .filter((node) => {
        // Must be an expression or emotion type
        if (node.metadata.type !== 'emotion' && node.metadata.type !== 'icon') {
          return false;
        }

        // Must be bound to the specified actor
        return node.metadata.actorIndex === actorIndex;
      })
      .sort((a, b) => a.metadata.order - b.metadata.order);
  }

  /**
   * Get all portraits (icons) for a card
   */
  listPortraits(graph: AssetNode[]): AssetNode[] {
    return graph
      .filter((node) => node.metadata.type === 'icon')
      .sort((a, b) => a.metadata.order - b.metadata.order);
  }

  /**
   * Get main background for a card
   */
  getMainBackground(graph: AssetNode[]): AssetNode | null {
    // Look for main-background tag
    const mainBg = graph.find((node) =>
      hasTag(node.metadata, 'main-background')
    );
    if (mainBg) return mainBg;

    // Fallback to main background asset
    const mainBgAsset = graph.find(
      (node) => node.metadata.type === 'background' && node.isMain
    );
    if (mainBgAsset) return mainBgAsset;

    // Fallback to first background
    const firstBg = graph.find((node) => node.metadata.type === 'background');
    return firstBg || null;
  }

  /**
   * List all backgrounds for a card
   */
  listBackgrounds(graph: AssetNode[]): AssetNode[] {
    return graph
      .filter((node) => node.metadata.type === 'background')
      .sort((a, b) => a.metadata.order - b.metadata.order);
  }

  /**
   * List all actors referenced in the asset graph
   */
  listActors(graph: AssetNode[]): number[] {
    const actorIndices = new Set<number>();

    graph.forEach((node) => {
      if (node.metadata.actorIndex !== undefined) {
        actorIndices.add(node.metadata.actorIndex);
      }
    });

    return Array.from(actorIndices).sort((a, b) => a - b);
  }

  /**
   * Get all assets for a specific actor
   */
  getAssetsByActor(graph: AssetNode[], actorIndex: number): AssetNode[] {
    return graph
      .filter((node) => node.metadata.actorIndex === actorIndex)
      .sort((a, b) => a.metadata.order - b.metadata.order);
  }

  /**
   * Get all animated assets
   */
  listAnimatedAssets(graph: AssetNode[]): AssetNode[] {
    return graph
      .filter((node) => node.metadata.isAnimated)
      .sort((a, b) => a.metadata.order - b.metadata.order);
  }

  /**
   * Validate asset graph for consistency
   */
  validateGraph(graph: AssetNode[]): AssetValidationError[] {
    const errors: AssetValidationError[] = [];

    // Rule: No duplicate names
    const names = new Map<string, AssetNode[]>();
    graph.forEach((node) => {
      if (!names.has(node.name)) {
        names.set(node.name, []);
      }
      names.get(node.name)!.push(node);
    });

    names.forEach((nodes, name) => {
      if (nodes.length > 1) {
        nodes.forEach((node) => {
          errors.push({
            assetId: node.id,
            assetName: node.name,
            severity: 'warning',
            message: `Duplicate asset name: "${name}" (${nodes.length} assets)`,
          });
        });
      }
    });

    // Rule: Only one portrait-override
    const portraitOverrides = graph.filter((node) =>
      hasTag(node.metadata, 'portrait-override')
    );
    if (portraitOverrides.length > 1) {
      portraitOverrides.forEach((node) => {
        errors.push({
          assetId: node.id,
          assetName: node.name,
          severity: 'error',
          message: `Multiple portrait-override tags found (${portraitOverrides.length} total)`,
        });
      });
    }

    // Rule: Only one main-background
    const mainBackgrounds = graph.filter((node) =>
      hasTag(node.metadata, 'main-background')
    );
    if (mainBackgrounds.length > 1) {
      mainBackgrounds.forEach((node) => {
        errors.push({
          assetId: node.id,
          assetName: node.name,
          severity: 'error',
          message: `Multiple main-background tags found (${mainBackgrounds.length} total)`,
        });
      });
    }

    // Rule: Actor indices should be continuous starting from 1
    const actors = this.listActors(graph);
    if (actors.length > 0) {
      const expectedActors = Array.from(
        { length: actors.length },
        (_, i) => i + 1
      );
      const missingActors = expectedActors.filter(
        (idx) => !actors.includes(idx)
      );
      if (missingActors.length > 0) {
        errors.push({
          assetId: '',
          assetName: '',
          severity: 'warning',
          message: `Non-continuous actor indices: missing ${missingActors.join(', ')}`,
        });
      }
    }

    return errors;
  }

  /**
   * Deduplicate asset names by appending index
   * Returns new graph with renamed nodes
   */
  deduplicateNames(graph: AssetNode[]): AssetNode[] {
    const nameCount = new Map<string, number>();
    const newGraph: AssetNode[] = [];

    graph.forEach((node) => {
      const baseName = node.name;
      const count = nameCount.get(baseName) || 0;
      nameCount.set(baseName, count + 1);

      if (count > 0) {
        // Duplicate found, rename
        const newName = `${baseName}_${count}`;
        newGraph.push({
          ...node,
          name: newName,
        });
      } else {
        newGraph.push(node);
      }
    });

    return newGraph;
  }

  /**
   * Set an asset as the main portrait (portrait-override)
   * Removes portrait-override from other assets
   */
  setPortraitOverride(graph: AssetNode[], assetId: string): AssetNode[] {
    return graph.map((node) => {
      if (node.id === assetId) {
        // Add portrait-override tag
        return {
          ...node,
          metadata: addTag(node.metadata, 'portrait-override'),
        };
      } else {
        // Remove portrait-override tag from others
        return {
          ...node,
          metadata: removeTag(node.metadata, 'portrait-override'),
        };
      }
    });
  }

  /**
   * Set an asset as the main background
   * Removes main-background from other assets
   */
  setMainBackground(graph: AssetNode[], assetId: string): AssetNode[] {
    return graph.map((node) => {
      if (node.id === assetId) {
        return {
          ...node,
          metadata: addTag(node.metadata, 'main-background'),
        };
      } else {
        return {
          ...node,
          metadata: removeTag(node.metadata, 'main-background'),
        };
      }
    });
  }

  /**
   * Bind an asset to a specific actor
   * Removes any existing actor binding
   */
  bindToActor(graph: AssetNode[], assetId: string, actorIndex: number): AssetNode[] {
    return graph.map((node) => {
      if (node.id === assetId) {
        // Remove existing actor tags
        let newMetadata = node.metadata;
        node.metadata.tags.forEach((tag) => {
          if (typeof tag === 'string' && tag.startsWith('actor-')) {
            newMetadata = removeTag(newMetadata, tag);
          }
        });

        // Add new actor tag
        newMetadata = addTag(newMetadata, `actor-${actorIndex}` as AssetTag);
        newMetadata.actorIndex = actorIndex;

        return {
          ...node,
          metadata: newMetadata,
        };
      }
      return node;
    });
  }

  /**
   * Remove actor binding from an asset
   */
  unbindFromActor(graph: AssetNode[], assetId: string): AssetNode[] {
    return graph.map((node) => {
      if (node.id === assetId) {
        let newMetadata = node.metadata;
        node.metadata.tags.forEach((tag) => {
          if (typeof tag === 'string' && tag.startsWith('actor-')) {
            newMetadata = removeTag(newMetadata, tag);
          }
        });
        newMetadata.actorIndex = undefined;

        return {
          ...node,
          metadata: newMetadata,
        };
      }
      return node;
    });
  }

  /**
   * Reorder assets by updating order field
   * Returns new graph with updated order
   */
  reorderAssets(graph: AssetNode[], assetIds: string[]): AssetNode[] {
    const orderMap = new Map<string, number>();
    assetIds.forEach((id, index) => {
      orderMap.set(id, index);
    });

    return graph.map((node) => {
      const newOrder = orderMap.get(node.id);
      if (newOrder !== undefined) {
        return {
          ...node,
          metadata: {
            ...node.metadata,
            order: newOrder,
          },
        };
      }
      return node;
    });
  }

  /**
   * Apply graph changes to database
   * Updates only modified nodes
   */
  async applyChanges(
    originalGraph: AssetNode[],
    modifiedGraph: AssetNode[]
  ): Promise<void> {
    // Find changed nodes
    const changes: AssetNode[] = [];

    modifiedGraph.forEach((node) => {
      const original = originalGraph.find((n) => n.id === node.id);
      if (!original) {
        // New node (shouldn't happen in graph operations)
        return;
      }

      // Check if metadata changed
      if (JSON.stringify(original.metadata) !== JSON.stringify(node.metadata)) {
        changes.push(node);
      }

      // Check if name changed
      if (original.name !== node.name) {
        changes.push(node);
      }
    });

    // Apply changes to database
    for (const node of changes) {
      await this.cardAssetRepo.update(node.id, {
        name: node.name,
        tags: node.metadata.tags as string[],
        order: node.metadata.order,
      });
    }
  }
}
