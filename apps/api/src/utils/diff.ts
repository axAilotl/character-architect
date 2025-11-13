/**
 * Diff computation for showing changes between original and revised text
 * Uses a simple word-level diff algorithm
 */

import type { DiffOperation, DiffOperationType } from '@card-architect/schemas';

/**
 * Normalize text for diffing (remove extra whitespace)
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ');
}

/**
 * Compute diff between two texts
 * Returns an array of diff operations
 */
export function computeDiff(original: string, revised: string): DiffOperation[] {
  const normalizedOriginal = normalizeText(original);
  const normalizedRevised = normalizeText(revised);

  // Split into lines for line-level diff
  const originalLines = normalizedOriginal.split('\n');
  const revisedLines = normalizedRevised.split('\n');

  const diff: DiffOperation[] = [];
  const maxLines = Math.max(originalLines.length, revisedLines.length);

  // Simple line-by-line comparison
  let originalIdx = 0;
  let revisedIdx = 0;

  while (originalIdx < originalLines.length || revisedIdx < revisedLines.length) {
    const originalLine = originalLines[originalIdx];
    const revisedLine = revisedLines[revisedIdx];

    if (originalLine === revisedLine) {
      // Lines match
      diff.push({
        type: 'unchanged',
        value: originalLine + '\n',
        lineNumber: originalIdx + 1,
      });
      originalIdx++;
      revisedIdx++;
    } else if (revisedIdx >= revisedLines.length) {
      // Removed line
      diff.push({
        type: 'remove',
        value: originalLine + '\n',
        lineNumber: originalIdx + 1,
      });
      originalIdx++;
    } else if (originalIdx >= originalLines.length) {
      // Added line
      diff.push({
        type: 'add',
        value: revisedLine + '\n',
        lineNumber: revisedIdx + 1,
      });
      revisedIdx++;
    } else {
      // Lines differ - check if it's a modification or add/remove
      const nextOriginalMatch = revisedLines.slice(revisedIdx).indexOf(originalLine);
      const nextRevisedMatch = originalLines.slice(originalIdx).indexOf(revisedLine);

      if (nextOriginalMatch === -1 && nextRevisedMatch === -1) {
        // Both lines are unique - treat as remove + add
        diff.push({
          type: 'remove',
          value: originalLine + '\n',
          lineNumber: originalIdx + 1,
        });
        diff.push({
          type: 'add',
          value: revisedLine + '\n',
          lineNumber: revisedIdx + 1,
        });
        originalIdx++;
        revisedIdx++;
      } else if (nextOriginalMatch >= 0 && nextOriginalMatch < 3) {
        // Found original line soon in revised - treat as additions
        for (let i = 0; i < nextOriginalMatch; i++) {
          diff.push({
            type: 'add',
            value: revisedLines[revisedIdx + i] + '\n',
            lineNumber: revisedIdx + i + 1,
          });
        }
        revisedIdx += nextOriginalMatch;
      } else if (nextRevisedMatch >= 0 && nextRevisedMatch < 3) {
        // Found revised line soon in original - treat as removals
        for (let i = 0; i < nextRevisedMatch; i++) {
          diff.push({
            type: 'remove',
            value: originalLines[originalIdx + i] + '\n',
            lineNumber: originalIdx + i + 1,
          });
        }
        originalIdx += nextRevisedMatch;
      } else {
        // Treat as modification
        diff.push({
          type: 'remove',
          value: originalLine + '\n',
          lineNumber: originalIdx + 1,
        });
        diff.push({
          type: 'add',
          value: revisedLine + '\n',
          lineNumber: revisedIdx + 1,
        });
        originalIdx++;
        revisedIdx++;
      }
    }
  }

  return diff;
}

/**
 * Compute compact diff stats
 */
export function computeDiffStats(diff: DiffOperation[]): {
  additions: number;
  deletions: number;
  unchanged: number;
} {
  return diff.reduce(
    (acc, op) => {
      if (op.type === 'add') acc.additions++;
      else if (op.type === 'remove') acc.deletions++;
      else acc.unchanged++;
      return acc;
    },
    { additions: 0, deletions: 0, unchanged: 0 }
  );
}

/**
 * Apply diff to reconstruct revised text
 */
export function applyDiff(original: string, diff: DiffOperation[]): string {
  return diff
    .filter((op) => op.type !== 'remove')
    .map((op) => op.value)
    .join('');
}
