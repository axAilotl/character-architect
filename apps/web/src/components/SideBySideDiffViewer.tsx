/**
 * Side-by-Side Diff Viewer Component
 * Shows original and revised text side-by-side with synchronized scrolling
 */

import { useRef } from 'react';
import type { DiffOperation } from '@card-architect/schemas';

interface SideBySideDiffViewerProps {
  diff: DiffOperation[];
  originalText: string;
  revisedText: string;
}

interface DiffLine {
  originalLineNum?: number;
  revisedLineNum?: number;
  originalContent?: string;
  revisedContent?: string;
  type: 'unchanged' | 'modified' | 'added' | 'removed';
}

export function SideBySideDiffViewer({ diff }: SideBySideDiffViewerProps) {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Parse diff into side-by-side format
  const sideBySideLines = parseDiffToSideBySide(diff);
  const stats = computeStats(diff);

  // Synchronized scrolling
  const handleLeftScroll = () => {
    if (leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
  };

  const handleRightScroll = () => {
    if (leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
  };

  return (
    <div className="border border-dark-border rounded overflow-hidden">
      {/* Stats Header */}
      <div className="bg-dark-bg px-3 py-2 border-b border-dark-border flex gap-4 text-xs">
        <span className="text-green-400">+{stats.additions} additions</span>
        <span className="text-red-400">-{stats.deletions} deletions</span>
        {stats.unchanged > 0 && (
          <span className="text-dark-muted">{stats.unchanged} unchanged</span>
        )}
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-2 bg-dark-bg border-b border-dark-border">
        <div className="px-3 py-2 text-xs font-semibold text-dark-muted border-r border-dark-border">
          Original
        </div>
        <div className="px-3 py-2 text-xs font-semibold text-dark-muted">
          Revised
        </div>
      </div>

      {/* Side-by-side content */}
      <div className="grid grid-cols-2 max-h-[600px]">
        {/* Left side (original) */}
        <div
          ref={leftScrollRef}
          onScroll={handleLeftScroll}
          className="overflow-auto border-r border-dark-border bg-dark-card"
        >
          <div className="font-mono text-xs">
            {sideBySideLines.map((line, idx) => (
              <div
                key={`left-${idx}`}
                className={getLineClass(
                  line.type === 'removed' || line.type === 'modified'
                    ? 'remove'
                    : line.type === 'unchanged'
                      ? 'unchanged'
                      : 'empty'
                )}
              >
                {line.originalContent !== undefined ? (
                  <>
                    <span className="inline-block w-12 text-right mr-2 text-dark-muted select-none">
                      {line.originalLineNum || ''}
                    </span>
                    <span className="whitespace-pre-wrap break-words">
                      {line.originalContent}
                    </span>
                  </>
                ) : (
                  <span className="inline-block h-5 w-full bg-dark-bg/50"></span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right side (revised) */}
        <div
          ref={rightScrollRef}
          onScroll={handleRightScroll}
          className="overflow-auto bg-dark-card"
        >
          <div className="font-mono text-xs">
            {sideBySideLines.map((line, idx) => (
              <div
                key={`right-${idx}`}
                className={getLineClass(
                  line.type === 'added' || line.type === 'modified'
                    ? 'add'
                    : line.type === 'unchanged'
                      ? 'unchanged'
                      : 'empty'
                )}
              >
                {line.revisedContent !== undefined ? (
                  <>
                    <span className="inline-block w-12 text-right mr-2 text-dark-muted select-none">
                      {line.revisedLineNum || ''}
                    </span>
                    <span className="whitespace-pre-wrap break-words">
                      {line.revisedContent}
                    </span>
                  </>
                ) : (
                  <span className="inline-block h-5 w-full bg-dark-bg/50"></span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function parseDiffToSideBySide(diff: DiffOperation[]): DiffLine[] {
  const lines: DiffLine[] = [];
  let originalLineNum = 1;
  let revisedLineNum = 1;

  let i = 0;
  while (i < diff.length) {
    const op = diff[i];

    if (op.type === 'unchanged') {
      lines.push({
        originalLineNum,
        revisedLineNum,
        originalContent: op.value.replace(/\n$/, ''),
        revisedContent: op.value.replace(/\n$/, ''),
        type: 'unchanged',
      });
      originalLineNum++;
      revisedLineNum++;
      i++;
    } else if (op.type === 'remove') {
      // Check if next operation is an add (modification)
      const nextOp = diff[i + 1];
      if (nextOp && nextOp.type === 'add') {
        // This is a modification
        lines.push({
          originalLineNum,
          revisedLineNum,
          originalContent: op.value.replace(/\n$/, ''),
          revisedContent: nextOp.value.replace(/\n$/, ''),
          type: 'modified',
        });
        originalLineNum++;
        revisedLineNum++;
        i += 2;
      } else {
        // Pure removal
        lines.push({
          originalLineNum,
          originalContent: op.value.replace(/\n$/, ''),
          type: 'removed',
        });
        originalLineNum++;
        i++;
      }
    } else if (op.type === 'add') {
      // Pure addition
      lines.push({
        revisedLineNum,
        revisedContent: op.value.replace(/\n$/, ''),
        type: 'added',
      });
      revisedLineNum++;
      i++;
    }
  }

  return lines;
}

function getLineClass(type: 'add' | 'remove' | 'unchanged' | 'empty'): string {
  const base = 'px-3 py-1 min-h-[1.5rem]';

  switch (type) {
    case 'add':
      return `${base} bg-green-900/30 text-green-200`;
    case 'remove':
      return `${base} bg-red-900/30 text-red-200`;
    case 'unchanged':
      return `${base} text-dark-text`;
    case 'empty':
      return `${base} bg-dark-bg/30`;
  }
}

function computeStats(diff: DiffOperation[]): {
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
