/**
 * Diff Viewer Component
 * Shows semantic diffs between original and revised text
 */

import { useState } from 'react';
import type { DiffOperation } from '@card-architect/schemas';
import { SideBySideDiffViewer } from './SideBySideDiffViewer';

interface DiffViewerProps {
  diff: DiffOperation[];
  originalText?: string;
  revisedText?: string;
  compact?: boolean;
}

export function DiffViewer({ diff, originalText, revisedText, compact = false }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('split');
  // Group consecutive unchanged lines for compaction
  const renderDiff = () => {
    if (compact) {
      return renderCompactDiff();
    }

    return diff.map((op, idx) => (
      <div key={idx} className={getDiffLineClass(op.type)}>
        <span className="inline-block w-8 text-right mr-2 text-dark-muted text-xs">
          {op.lineNumber || ''}
        </span>
        <span className={getDiffSymbolClass(op.type)}>{getDiffSymbol(op.type)}</span>
        <span className="ml-2">{op.value}</span>
      </div>
    ));
  };

  const renderCompactDiff = () => {
    const compacted: JSX.Element[] = [];
    let unchangedCount = 0;
    let lastUnchangedIdx = -1;

    diff.forEach((op, idx) => {
      if (op.type === 'unchanged') {
        unchangedCount++;
        lastUnchangedIdx = idx;
      } else {
        // If we had unchanged lines, show ellipsis
        if (unchangedCount > 3) {
          compacted.push(
            <div key={`ellipsis-${lastUnchangedIdx}`} className="text-dark-muted text-xs py-1">
              ... ({unchangedCount} unchanged lines)
            </div>
          );
        } else {
          // Show the few unchanged lines
          for (let i = idx - unchangedCount; i < idx; i++) {
            const unchangedOp = diff[i];
            compacted.push(
              <div key={i} className={getDiffLineClass('unchanged')}>
                <span className="inline-block w-8 text-right mr-2 text-dark-muted text-xs">
                  {unchangedOp.lineNumber || ''}
                </span>
                <span className="ml-2">{unchangedOp.value}</span>
              </div>
            );
          }
        }

        unchangedCount = 0;

        // Show the changed line
        compacted.push(
          <div key={idx} className={getDiffLineClass(op.type)}>
            <span className="inline-block w-8 text-right mr-2 text-dark-muted text-xs">
              {op.lineNumber || ''}
            </span>
            <span className={getDiffSymbolClass(op.type)}>{getDiffSymbol(op.type)}</span>
            <span className="ml-2">{op.value}</span>
          </div>
        );
      }
    });

    // Handle trailing unchanged lines
    if (unchangedCount > 3) {
      compacted.push(
        <div key={`ellipsis-end`} className="text-dark-muted text-xs py-1">
          ... ({unchangedCount} unchanged lines)
        </div>
      );
    } else if (unchangedCount > 0) {
      for (let i = diff.length - unchangedCount; i < diff.length; i++) {
        const unchangedOp = diff[i];
        compacted.push(
          <div key={i} className={getDiffLineClass('unchanged')}>
            <span className="inline-block w-8 text-right mr-2 text-dark-muted text-xs">
              {unchangedOp.lineNumber || ''}
            </span>
            <span className="ml-2">{unchangedOp.value}</span>
          </div>
        );
      }
    }

    return compacted;
  };

  const stats = computeStats(diff);

  // Render toggle buttons
  const renderViewToggle = () => {
    if (!originalText || !revisedText) return null;

    return (
      <div className="mb-2 flex justify-end">
        <div className="inline-flex rounded border border-dark-border overflow-hidden">
          <button
            onClick={() => setViewMode('unified')}
            className={`px-3 py-1 text-xs ${
              viewMode === 'unified'
                ? 'bg-blue-600 text-white'
                : 'bg-dark-card text-dark-muted hover:bg-dark-surface'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 text-xs ${
              viewMode === 'split'
                ? 'bg-blue-600 text-white'
                : 'bg-dark-card text-dark-muted hover:bg-dark-surface'
            }`}
          >
            Side-by-side
          </button>
        </div>
      </div>
    );
  };

  // If we have original and revised text and split mode is selected, show the side-by-side viewer
  if (viewMode === 'split' && originalText && revisedText) {
    return (
      <div>
        {renderViewToggle()}
        <SideBySideDiffViewer diff={diff} originalText={originalText} revisedText={revisedText} />
      </div>
    );
  }

  return (
    <div>
      {renderViewToggle()}

      <div className="border border-dark-border rounded overflow-hidden">
        {/* Stats Header */}
        <div className="bg-dark-bg px-3 py-2 border-b border-dark-border flex gap-4 text-xs">
          <span className="text-green-400">+{stats.additions} additions</span>
          <span className="text-red-400">-{stats.deletions} deletions</span>
          {stats.unchanged > 0 && (
            <span className="text-dark-muted">{stats.unchanged} unchanged</span>
          )}
        </div>

        {/* Diff Content */}
        <div className="bg-dark-card p-3 font-mono text-xs overflow-x-auto max-h-[400px] overflow-y-auto">
          {renderDiff()}
        </div>
      </div>
    </div>
  );
}

function getDiffLineClass(type: DiffOperation['type']): string {
  switch (type) {
    case 'add':
      return 'bg-green-900/30 text-green-200';
    case 'remove':
      return 'bg-red-900/30 text-red-200';
    case 'unchanged':
      return 'text-dark-muted';
    default:
      return 'text-dark-muted';
  }
}

function getDiffSymbolClass(type: DiffOperation['type']): string {
  switch (type) {
    case 'add':
      return 'text-green-400 font-bold';
    case 'remove':
      return 'text-red-400 font-bold';
    case 'unchanged':
      return 'text-dark-muted';
    default:
      return 'text-dark-muted';
  }
}

function getDiffSymbol(type: DiffOperation['type']): string {
  switch (type) {
    case 'add':
      return '+';
    case 'remove':
      return '-';
    case 'unchanged':
      return ' ';
    default:
      return ' ';
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
